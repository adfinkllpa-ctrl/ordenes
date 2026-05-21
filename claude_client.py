"""
Integración con Claude API para responder preguntas del área de finanzas.
Combina contexto de Google Calendar y Google Sheets.
"""
import os
from typing import Optional
from dotenv import load_dotenv

import anthropic

load_dotenv(override=True)

SYSTEM_PROMPT = """Eres un asistente del área de finanzas de la empresa. Tu función es responder preguntas del equipo sobre reuniones, agenda, reportes, presupuestos, deudas, facturación y datos financieros.

Reglas importantes:
- Responde SOLO lo que te preguntan, de forma directa y concisa.
- NO menciones qué archivos tienes disponibles ni qué carpetas puedes ver.
- NO sugieras buscar información en otros archivos ni preguntes dónde encontrarla.
- Si el dato no está en el contexto, di simplemente: "No tengo esa información disponible."
- No inventes cifras, fechas ni eventos.
- Responde siempre en español.
- Usa listas o formato simple cuando ayude a la claridad.
- Sé breve y directo."""

_client: Optional[anthropic.Anthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY") or "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"
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


def ask_claude(
    user_question: str,
    calendar_context: Optional[str] = None,
    sheets_context: Optional[str] = None,
) -> str:
    client = _get_client()

    # System prompt con cache (estático, no cambia)
    system_content: list = [
        {
            "type": "text",
            "text": SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"},
        }
    ]

    # Contexto dinámico (Calendar + Sheets)
    context_parts = []
    if calendar_context:
        context_parts.append(calendar_context)
    if sheets_context:
        context_parts.append(sheets_context)

    if context_parts:
        combined = "\n\n".join(context_parts)
        system_content.append(
            {
                "type": "text",
                "text": f"Información actual disponible:\n\n{combined}",
                "cache_control": {"type": "ephemeral"},
            }
        )

    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1024,
        system=system_content,
        messages=[{"role": "user", "content": user_question}],
    )

    return message.content[0].text
