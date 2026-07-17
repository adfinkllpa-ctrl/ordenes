// Acceso de lectura/escritura a Google Sheets para el módulo de Órdenes de Compra.
// Usa la misma cuenta de servicio que el dashboard (GOOGLE_SERVICE_ACCOUNT_JSON),
// pero con el scope completo "spreadsheets" (no solo readonly) — la cuenta de
// servicio debe tener acceso de Editor en ambos spreadsheets (ver INSTRUCCIONES.md).
import * as forge from 'node-forge'

function signRS256(data: string, privateKeyPem: string): string {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem)
  const md = forge.md.sha256.create()
  md.update(data, 'utf8')
  const sig = (privateKey as forge.pki.rsa.PrivateKey).sign(md)
  return Buffer.from(sig, 'binary').toString('base64url')
}

async function createJWT(email: string, privateKeyPem: string, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const signingInput = `${header}.${payload}`
  const signature = signRS256(signingInput, privateKeyPem)
  return `${signingInput}.${signature}`
}

let cachedWriteToken: { token: string; exp: number } | null = null

export async function getWriteAccessToken(): Promise<string> {
  if (cachedWriteToken && Date.now() < cachedWriteToken.exp) return cachedWriteToken.token

  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string)
  const privateKey = (creds.private_key as string).replace(/\\n/g, '\n')

  const jwt = await createJWT(creds.client_email, privateKey, 'https://www.googleapis.com/auth/spreadsheets')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const data = await res.json() as { access_token?: string; error?: string; error_description?: string }
  if (!data.access_token) {
    throw new Error(`Auth (write) fallida: ${data.error} - ${data.error_description}`)
  }

  cachedWriteToken = { token: data.access_token, exp: Date.now() + 55 * 60 * 1000 }
  return data.access_token
}

const gidTitleCache = new Map<string, string>()

// Resuelve el nombre real de una pestaña a partir de su gid (el ID de spreadsheet
// no cambia pero los nombres de pestaña sí pueden — esto evita depender de que
// alguien no renombre la pestaña de proveedores).
export async function getTabTitleByGid(spreadsheetId: string, gid: number): Promise<string> {
  const cacheKey = `${spreadsheetId}:${gid}`
  const cached = gidTitleCache.get(cacheKey)
  if (cached) return cached

  const token = await getWriteAccessToken()
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`No se pudo leer metadata del spreadsheet: HTTP ${res.status}`)

  const data = await res.json() as { sheets?: { properties: { sheetId: number; title: string } }[] }
  const match = data.sheets?.find(s => s.properties.sheetId === gid)
  if (!match) throw new Error(`No se encontró pestaña con gid=${gid} en spreadsheet ${spreadsheetId}`)

  gidTitleCache.set(cacheKey, match.properties.title)
  return match.properties.title
}

export async function readRange(spreadsheetId: string, a1Range: string): Promise<string[][]> {
  const token = await getWriteAccessToken()
  const range = encodeURIComponent(a1Range)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HTTP ${res.status}: ${err}`)
  }
  const data = await res.json() as { values?: string[][] }
  return data.values ?? []
}

export async function appendRow(spreadsheetId: string, tabName: string, values: (string | number)[]): Promise<void> {
  const token = await getWriteAccessToken()
  const range = encodeURIComponent(`${tabName}!A:A`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`No se pudo agregar fila: HTTP ${res.status}: ${err}`)
  }
}

export async function updateRange(spreadsheetId: string, a1Range: string, values: (string | number)[][]): Promise<void> {
  const token = await getWriteAccessToken()
  const range = encodeURIComponent(a1Range)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`No se pudo actualizar rango: HTTP ${res.status}: ${err}`)
  }
}
