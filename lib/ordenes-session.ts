import { cookies } from 'next/headers'
import { createHmac } from 'crypto'

const COOKIE_NAME = 'ordenes_auth'
const SECRET = process.env.SESSION_SECRET ?? 'fallback-secret-32-chars-minimum!!'

function sign(value: string) {
  return createHmac('sha256', SECRET).update(value).digest('hex')
}

function makeToken(payload: string) {
  return `${payload}.${sign(payload)}`
}

function verifyToken(cookie: string): string | null {
  const lastDot = cookie.lastIndexOf('.')
  if (lastDot < 0) return null
  const payload = cookie.slice(0, lastDot)
  const sig = cookie.slice(lastDot + 1)
  if (sig !== sign(payload)) return null
  return payload
}

export interface OrdenesSessionUser {
  email: string
  nombre: string
}

export async function getOrdenesSession(): Promise<{ isLoggedIn: false } | ({ isLoggedIn: true } & OrdenesSessionUser)> {
  const jar = await cookies()
  const cookie = jar.get(COOKIE_NAME)?.value
  if (!cookie) return { isLoggedIn: false }
  const payload = verifyToken(cookie)
  if (!payload) return { isLoggedIn: false }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as OrdenesSessionUser
    return { isLoggedIn: true, ...data }
  } catch {
    return { isLoggedIn: false }
  }
}

export async function createOrdenesSession(user: OrdenesSessionUser) {
  const payload = Buffer.from(JSON.stringify(user)).toString('base64')
  const token = makeToken(payload)
  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export async function destroyOrdenesSession() {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
}
