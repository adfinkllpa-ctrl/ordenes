# Dashboard Empresarial — Instrucciones

## PASO 2: Configurar los 6 Google Sheets

Abre el archivo `lib/sheets-config.ts` y rellena los 6 objetos:

```ts
{
  id: 'REEMPLAZA_CON_ID_SHEET_1',   // ← ID de la URL del Sheet
  tabName: 'Hoja1',                  // ← nombre exacto de la pestaña
  label: 'Ventas Mensuales',         // ← nombre que aparece en el dashboard
  category: 'ventas',                // ← 'ventas' | 'kpi' | 'proyectos'
  dataRange: 'A1:Z200',             // ← rango de datos
}
```

El ID del Sheet está en la URL:
`https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit`

---

## PASO 3: Configurar variables de entorno

Abre `.env.local` y rellena:

1. `DASHBOARD_USER` — el usuario para entrar (ej: `gerencia`)
2. `DASHBOARD_PASSWORD` — contraseña segura
3. `SESSION_SECRET` — cualquier texto largo de 32+ caracteres
4. `GOOGLE_SERVICE_ACCOUNT_JSON` — pega el contenido del JSON descargado
   - Ábrelo con un editor de texto (Notepad)
   - Selecciona TODO el contenido (Ctrl+A)
   - Copialo y pégalo en UNA SOLA LÍNEA después del `=`

---

## PASO 4: Instalar y probar en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000 — verás el login.

---

## PASO 5: Deploy en Vercel (gratis)

1. Sube el código a GitHub (sin el .env.local)
2. Ve a vercel.com → "New Project" → importa el repo
3. En "Environment Variables" agrega las 4 variables de `.env.local`
4. Click Deploy — obtienes un link como `https://mi-dashboard.vercel.app`
5. Comparte ese link con tu gerenta

---

## ¿Cómo se actualiza?

- El dashboard se refresca automáticamente cada **60 segundos**
- También hay un botón "Actualizar" manual
- Cuando cambias algo en el Google Sheet, en máximo 60 seg aparece en el dashboard

---

## Estructura de archivos

```
lib/sheets-config.ts    ← configura tus 6 Sheets aquí
lib/google-sheets.ts    ← lectura de la API (no tocar)
lib/session.ts          ← manejo de sesión (no tocar)
app/login/page.tsx      ← página de login
app/dashboard/page.tsx  ← dashboard principal
app/api/sheets/route.ts ← API que lee los Sheets
.env.local              ← credenciales (NUNCA subir a GitHub)
```

---

## Módulo de Órdenes de Compra (`/ordenes/nueva`)

Este módulo es **independiente** del login del dashboard: cada solicitante entra
con su propia cuenta de Google, y el correo de la orden sale literalmente desde
su Gmail. Antes de usarlo en producción hay que hacer esta configuración manual
una sola vez:

### 1. Dar acceso de Editor a la cuenta de servicio

Hoy la cuenta de servicio (el `client_email` dentro de `GOOGLE_SERVICE_ACCOUNT_JSON`)
solo tiene acceso de **Lector** a los sheets. Este módulo necesita **escribir**
(guardar órdenes, actualizar estados), así que hay que subirle el permiso a
**Editor** en:

- El spreadsheet **"Base de proveedores - consolidado"**.
- El spreadsheet **"OC 000-2026- NO TOCAR"**.

(Compartir → pegar el email de la cuenta de servicio → rol "Editor").

### 2. Crear las pestañas nuevas en "OC 000-2026- NO TOCAR"

Agrega estas dos pestañas, con estos encabezados exactos en la fila 1:

**`Ordenes`**
```
folio | fecha_creacion | creado_por_nombre | creado_por_email | area | clasificacion_gasto | tipo_comprobante | detalle_gasto | proveedor_doc | proveedor_razon_social | lineas_json | monto_total | estado | fecha_decision | dias_pago | fecha_pago
```

**`OAuthTokens`**
```
email | refresh_token_cifrado | nombre | conectado_en
```

No hay que escribir nada más ahí — el sistema las llena solo.

### 3. Habilitar Gmail API

En el mismo proyecto de Google Cloud (console.cloud.google.com) donde ya tienes
Calendar/Sheets/Drive activadas, activa también **Gmail API**.

### 4. Crear credenciales OAuth 2.0 (Client ID)

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Tipo: **Web application**.
3. En "Authorized redirect URIs" agrega: `https://tu-dominio.vercel.app/api/ordenes/auth/callback`
   (y `http://localhost:3000/api/ordenes/auth/callback` para pruebas locales).
4. Copia el **Client ID** y **Client Secret** → van en `GOOGLE_OAUTH_CLIENT_ID` y
   `GOOGLE_OAUTH_CLIENT_SECRET`.

### 5. Configurar la pantalla de consentimiento (modo Testing)

1. **APIs & Services → OAuth consent screen**.
2. Tipo de usuario: **External**.
3. Como el scope `gmail.send` es sensible, Google pide verificación para publicar
   la app — para evitarlo, déjala en modo **Testing** y agrega como
   **Test users** los correos de las personas autorizadas (la lista de la
   pestaña "codigos"). Solo ellos podrán conectar su Gmail.

### 6. Variables de entorno

Agrega en `.env.local` y en Vercel (Settings → Environment Variables):

```
APP_URL=https://tu-dominio.vercel.app
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
TOKEN_ENCRYPTION_KEY=... (genera una con: openssl rand -hex 32)
APPROVAL_TOKEN_SECRET=... (otra clave larga distinta)
```

### 7. Probar el flujo completo

1. Entra a `/ordenes/nueva` → "Conectar con Google" con un correo de la lista
   "codigos".
2. Llena la orden con un RUC/DNI que exista en la base de proveedores.
3. Envía → debe llegar un correo a `ad.fin.kllpa@gmail.com` **desde el Gmail
   real de quien la creó**, con botones Aprobar/Rechazar.
4. Al hacer clic en "Aprobar" (sin necesidad de iniciar sesión), la orden queda
   marcada como Aprobada con la fecha de pago calculada según los "Términos de
   pago" del proveedor, y llegan los correos de confirmación.
