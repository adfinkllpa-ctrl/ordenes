"""
Lee Google Sheets específicos y carpetas de Drive configuradas manualmente.
"""
import os
import json
import logging
from typing import Optional

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
]

SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")


def _get_credentials():
    json_str = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if json_str:
        info = json.loads(json_str)
        return Credentials.from_service_account_info(info, scopes=SCOPES)
    return Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)

MAX_CHARS_PER_SHEET = 8_000
MAX_TOTAL_CHARS = 60_000

# ── Sheets individuales ────────────────────────────────────────────────────────
SPECIFIC_SHEETS = [
    {"id": "1SzPnjvR92fXFCg6KTPzX4k2hmnENgQX3GImYjrv2IvM", "name": "Seguimiento"},
    {"id": "1XVj3yhU4jpcgB7cGokmnNZarm3iw0LsUrD0V9yaJAbc", "name": "Proyección de Ventas"},
    {"id": "1GtiQgffOALa1XdP1nhjDXUwOirxXDEN_xPWj6FDp07k", "name": "Presupuesto"},
    {"id": "1fl5IEuPMxENaelOw-ksL2x0ZDiR4ZCbYXlnBNJFYhZ0", "name": "Pasivos KLLPA (Deuda)"},
]

# ── Carpetas (lee todos los Sheets dentro) ─────────────────────────────────────
SPECIFIC_FOLDERS = [
    {"id": "1UbLGf_5KcXNJs3RwxrjKWib7QysuA5uB", "name": "Estados Financieros"},
    {"id": "1p5wYy60mEunip5U0lmK7UgA3yRwLm84l", "name": "Balance Anual / Facturación"},
]


def _get_drive_service():
    creds = _get_credentials()
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _get_sheets_service():
    creds = _get_credentials()
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _read_spreadsheet(spreadsheet_id: str, file_name: str) -> str:
    """Lee todas las hojas de un Google Spreadsheet y retorna el texto."""
    sheets_service = _get_sheets_service()

    try:
        spreadsheet = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    except Exception as exc:
        logger.warning("Error leyendo spreadsheet '%s': %s", file_name, exc)
        return ""

    sheet_names = [s["properties"]["title"] for s in spreadsheet.get("sheets", [])]
    parts = []

    for sheet_name in sheet_names:
        try:
            result = (
                sheets_service.spreadsheets()
                .values()
                .get(spreadsheetId=spreadsheet_id, range=f"'{sheet_name}'!A:Z")
                .execute()
            )
        except Exception as exc:
            logger.warning("Error leyendo hoja '%s': %s", sheet_name, exc)
            continue

        rows = result.get("values", [])
        if not rows:
            continue

        lines = ["\t".join(str(cell) for cell in row) for row in rows]
        text = "\n".join(lines)[:MAX_CHARS_PER_SHEET]
        parts.append(f"### Hoja: {sheet_name}\n{text}")

    return "\n\n".join(parts)


def _list_sheets_in_folder(folder_id: str, drive_service) -> list[dict]:
    """Lista todos los Sheets dentro de una carpeta (no recursivo)."""
    query = (
        f"'{folder_id}' in parents "
        f"and mimeType='application/vnd.google-apps.spreadsheet' "
        f"and trashed = false"
    )
    try:
        results = drive_service.files().list(
            q=query, fields="files(id, name)", pageSize=50
        ).execute()
        return results.get("files", [])
    except Exception as exc:
        logger.warning("Error listando Sheets en carpeta %s: %s", folder_id, exc)
        return []


def get_sheets_context() -> Optional[str]:
    """
    Lee los Sheets específicos y las carpetas configuradas,
    y retorna su contenido como texto para Claude.
    """
    try:
        drive_service = _get_drive_service()
    except Exception as exc:
        logger.error("No se pudo conectar con Google Drive: %s", exc)
        return None

    all_parts = []
    total_chars = 0

    # 1. Leer Sheets individuales
    for sheet_info in SPECIFIC_SHEETS:
        if total_chars >= MAX_TOTAL_CHARS:
            break
        text = _read_spreadsheet(sheet_info["id"], sheet_info["name"])
        if not text.strip():
            continue
        part = f"## Archivo: {sheet_info['name']}\n{text}"
        all_parts.append(part)
        total_chars += len(part)

    # 2. Leer Sheets dentro de las carpetas configuradas
    for folder_info in SPECIFIC_FOLDERS:
        if total_chars >= MAX_TOTAL_CHARS:
            break
        files = _list_sheets_in_folder(folder_info["id"], drive_service)
        for file_info in files:
            if total_chars >= MAX_TOTAL_CHARS:
                break
            text = _read_spreadsheet(file_info["id"], file_info["name"])
            if not text.strip():
                continue
            part = f"## Archivo: {file_info['name']} (carpeta: {folder_info['name']})\n{text}"
            all_parts.append(part)
            total_chars += len(part)

    if not all_parts:
        return None

    return "\n\n---\n\n".join(all_parts)
