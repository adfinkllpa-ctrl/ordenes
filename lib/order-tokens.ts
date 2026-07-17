import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.APPROVAL_TOKEN_SECRET ?? 'fallback-secret-32-chars-minimum!!'

export type Accion = 'aprobar' | 'rechazar'

interface DecisionPayload {
  ordenId: string
  accion: Accion
  exp: number
}

function sign(value: string) {
  return createHmac('sha256', SECRET).update(value).digest('hex')
}

export function makeDecisionToken(ordenId: string, accion: Accion, ttlHoras = 24 * 14): string {
  const exp = Date.now() + ttlHoras * 60 * 60 * 1000
  const payload: DecisionPayload = { ordenId, accion, exp }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifyDecisionToken(token: string): DecisionPayload | null {
  const lastDot = token.lastIndexOf('.')
  if (lastDot < 0) return null
  const encoded = token.slice(0, lastDot)
  const sig = token.slice(lastDot + 1)

  const expectedSig = sign(encoded)
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as DecisionPayload
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
