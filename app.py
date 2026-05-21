"""
Servidor Flask — webhook de WhatsApp para el asistente del área de finanzas.
Consulta Google Calendar, Google Sheets y responde con Claude AI.
"""
import os
import logging
from flask import Flask, request, jsonify
from dotenv import load_dotenv
import requests

from claude_client import ask_claude
from calendar_reader import get_calendar_context
from sheets_reader import get_sheets_context

load_dotenv(override=True)

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Control de mensajes ya procesados (evita duplicados de Meta)
_processed_messages: set = set()
MAX_PROCESSED = 1000  # limpiar cuando llegue a este límite

VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN")
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")


def send_whatsapp_message(to: str, text: str):
    url = f"https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    response = requests.post(url, headers=headers, json=payload, timeout=10)
    if not response.ok:
        logger.error("Error enviando mensaje: %s", response.text)
    return response


@app.route("/webhook", methods=["GET"])
def verify_webhook():
    """Verificación del webhook con Meta."""
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        logger.info("Webhook verificado correctamente")
        return challenge, 200

    logger.warning("Verificación fallida: token incorrecto")
    return "Forbidden", 403


@app.route("/webhook", methods=["POST"])
def receive_message():
    """Recibe mensajes entrantes de WhatsApp."""
    data = request.get_json(silent=True)
    with open("debug.log", "a") as f:
        f.write(f"POST recibido: {data}\n")
    if not data:
        return jsonify({"status": "ok"}), 200

    try:
        entry = data.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])

        if not messages:
            return jsonify({"status": "ok"}), 200

        # Ignorar mensajes enviados por el propio bot
        if value.get("messaging_product") == "whatsapp":
            contacts = value.get("contacts", [])
            statuses = value.get("statuses", [])
            if statuses and not messages:
                return jsonify({"status": "ok"}), 200

        msg = messages[0]
        msg_id = msg.get("id", "")
        sender = msg.get("from")
        msg_type = msg.get("type")

        # Ignorar mensajes del propio número del bot
        if sender == PHONE_NUMBER_ID:
            return jsonify({"status": "ok"}), 200

        # Evitar procesar el mismo mensaje dos veces
        if msg_id and msg_id in _processed_messages:
            return jsonify({"status": "ok"}), 200
        if msg_id:
            if len(_processed_messages) > MAX_PROCESSED:
                _processed_messages.clear()
            _processed_messages.add(msg_id)

        if msg_type != "text":
            send_whatsapp_message(
                sender,
                "Solo puedo responder mensajes de texto por ahora. 📝",
            )
            return jsonify({"status": "ok"}), 200

        user_text = msg["text"]["body"].strip()
        logger.info("Mensaje de %s: %s", sender, user_text)

        # Obtener contexto de Calendar y Sheets
        calendar_ctx = get_calendar_context()
        sheets_ctx = get_sheets_context()

        # Consultar a Claude con ambos contextos
        reply = ask_claude(
            user_question=user_text,
            calendar_context=calendar_ctx,
            sheets_context=sheets_ctx,
        )

        result = send_whatsapp_message(sender, reply)
        with open("debug.log", "a") as f:
            f.write(f"Respuesta enviada a {sender}: status={result.status_code} body={result.text[:200]}\n")

    except Exception as exc:
        logger.exception("Error procesando mensaje: %s", exc)
        with open("debug.log", "a") as f:
            f.write(f"ERROR: {exc}\n")

    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
