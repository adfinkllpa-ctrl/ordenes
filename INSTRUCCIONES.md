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
