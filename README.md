# Asistente de Finanzas por WhatsApp

Chatbot de WhatsApp que responde preguntas del área de finanzas usando:
- **Google Calendar** → reuniones y agenda
- **Google Sheets** → datos del área (reportes, presupuestos, tareas)
- **Claude AI** → entiende las preguntas y responde en lenguaje natural

---

## Paso 1 — API Key de Anthropic

1. Ve a [console.anthropic.com](https://console.anthropic.com/) y crea una cuenta.
2. En **API Keys** → **Create Key** → copia el valor.

---

## Paso 2 — Google Cloud (Service Account)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com/).
2. Crea un proyecto y activa estas 3 APIs:
   - **Google Calendar API**
   - **Google Sheets API**
   - **Google Drive API**
3. Ve a **IAM & Admin → Service Accounts → Create Service Account**.
4. Descarga la clave JSON → guárdala como `service_account.json` en la raíz del proyecto.
5. Copia el **email** de la cuenta de servicio (termina en `@...iam.gserviceaccount.com`).

### Dar acceso al calendario
- Abre Google Calendar → Configuración del calendario → **Compartir con personas específicas**
- Agrega el email de la cuenta de servicio con permiso **Ver todos los detalles**.

### Dar acceso al Sheets
- Abre el Google Sheets → **Compartir** → agrega el email de la cuenta de servicio como **Lector**.
- Copia el ID del spreadsheet desde la URL.

---

## Paso 3 — Meta WhatsApp Cloud API

1. Ve a [developers.facebook.com](https://developers.facebook.com/) → **Create App → Business**.
2. Agrega el producto **WhatsApp**.
3. En **WhatsApp → API Setup**, copia:
   - **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Access Token** → `WHATSAPP_TOKEN`
4. En **WhatsApp → Configuration → Webhook**:
   - **Callback URL**: `https://<tu-dominio>/webhook`
   - **Verify Token**: el valor que pondrás en `WHATSAPP_VERIFY_TOKEN`
   - Suscríbete al campo `messages`.

---

## Paso 4 — Instalar y ejecutar

```bash
# Crear entorno virtual
python -m venv venv
source venv/bin/activate      # Linux/Mac
venv\Scripts\activate         # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tus valores reales

# Ejecutar
python app.py
```

### Pruebas locales con ngrok

```bash
# Terminal 1
python app.py

# Terminal 2
ngrok http 5000
```

Usa la URL HTTPS de ngrok como Callback URL en Meta.

---

## Estructura del proyecto

```
├── app.py               # Servidor Flask + webhook Meta
├── calendar_reader.py   # Lee Google Calendar
├── sheets_reader.py     # Lee Google Sheets
├── claude_client.py     # Claude AI con prompt de finanzas
├── requirements.txt
├── .env.example
└── service_account.json  # ⚠️ No subir a git
```

> Agrega `service_account.json` y `.env` a tu `.gitignore`.

---

## Ejemplos de preguntas que puede responder

- *"¿Qué reuniones tengo esta semana?"*
- *"¿Cuál es el presupuesto del mes?"*
- *"¿Hay algo programado para mañana?"*
- *"¿Cuánto llevamos de gasto en el trimestre?"*
