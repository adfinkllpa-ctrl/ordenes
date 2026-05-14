// Autenticación con Google usando node-forge (RSA puro en JS, sin OpenSSL)
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
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
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

let cachedToken: { token: string; exp: number } | null = null

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp) return cachedToken.token

  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string)
  const privateKey = (creds.private_key as string).replace(/\\n/g, '\n')

  const jwt = await createJWT(
    creds.client_email,
    privateKey,
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  )

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const data = await res.json() as { access_token?: string; error?: string; error_description?: string }
  if (!data.access_token) {
    throw new Error(`Auth fallida: ${data.error} - ${data.error_description}`)
  }

  cachedToken = { token: data.access_token, exp: Date.now() + 55 * 60 * 1000 }
  return data.access_token
}
