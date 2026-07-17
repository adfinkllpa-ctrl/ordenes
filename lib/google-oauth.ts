// OAuth 2.0 "Sign in with Google" + Gmail send, por persona (independiente de la
// cuenta de servicio usada para leer los Sheets del dashboard).

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ')

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} no configurada`)
  return v
}

export function getRedirectUri(): string {
  return `${requireEnv('APP_URL')}/api/ordenes/auth/callback`
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv('GOOGLE_OAUTH_CLIENT_ID'),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  id_token?: string
  error?: string
  error_description?: string
}

interface GoogleIdentity {
  email: string
  name: string
}

function decodeIdToken(idToken: string): GoogleIdentity {
  const payloadB64 = idToken.split('.')[1]
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  return { email: payload.email as string, name: (payload.name as string) ?? payload.email }
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string
  refreshToken: string | null
  identity: GoogleIdentity
}> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: requireEnv('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  const data = (await res.json()) as TokenResponse
  if (!data.access_token || !data.id_token) {
    throw new Error(`OAuth exchange fallido: ${data.error} - ${data.error_description}`)
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    identity: decodeIdToken(data.id_token),
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
      grant_type: 'refresh_token',
    }),
  })
  const data = (await res.json()) as TokenResponse
  if (!data.access_token) {
    throw new Error(`No se pudo refrescar el token: ${data.error} - ${data.error_description}`)
  }
  return data.access_token
}
