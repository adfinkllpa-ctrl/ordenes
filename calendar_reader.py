"""
Lee eventos del Google Calendar y los devuelve como texto para el contexto de Claude.
"""
import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
CALENDAR_ID = os.getenv("GOOGLE_CALENDAR_ID", "primary")

# Cuántos días hacia adelante leer
DAYS_AHEAD = int(os.getenv("CALENDAR_DAYS_AHEAD", "14"))
MAX_EVENTS = 30


def _get_calendar_service():
    creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def get_calendar_context() -> Optional[str]:
    """
    Retorna los próximos eventos del calendario como texto.
    Cubre desde hoy hasta DAYS_AHEAD días adelante.
    """
    try:
        service = _get_calendar_service()
    except Exception as exc:
        logger.error("No se pudo conectar con Google Calendar: %s", exc)
        return None

    now = datetime.now(timezone.utc)
    time_min = now.isoformat()
    time_max = (now + timedelta(days=DAYS_AHEAD)).isoformat()

    try:
        events_result = (
            service.events()
            .list(
                calendarId=CALENDAR_ID,
                timeMin=time_min,
                timeMax=time_max,
                maxResults=MAX_EVENTS,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )
    except Exception as exc:
        logger.error("Error consultando Calendar: %s", exc)
        return None

    events = events_result.get("items", [])
    if not events:
        return "No hay eventos programados en los próximos días."

    lines = [f"## Agenda — próximos {DAYS_AHEAD} días\n"]
    for event in events:
        start = event.get("start", {})
        date_str = start.get("dateTime") or start.get("date", "")
        summary = event.get("summary", "(Sin título)")
        location = event.get("location", "")
        description = event.get("description", "")

        # Formatear fecha/hora
        if "T" in date_str:
            try:
                dt = datetime.fromisoformat(date_str)
                date_str = dt.strftime("%d/%m/%Y %H:%M")
            except ValueError:
                pass

        line = f"- {date_str} | {summary}"
        if location:
            line += f" | 📍 {location}"
        if description:
            line += f"\n  {description[:100]}"
        lines.append(line)

    return "\n".join(lines)
