import { cookies } from 'next/headers'
import { createHmac } from 'crypto'

const COOKIE_NAME = 'dashboard_auth'
const SECRET = process.env.SESSION_SECRET ?? 'fallback-secret-32-chars-minimum!!'

function sign(value: string) {
  return createHmac('sha256', SECRET).update(value).digest('hex')
}

const PAYLOAD = 'authenticated'
const SIGNED = `${PAYLOAD}.${sign(PAYLOAD)}`

export async function getSession() {
  const jar = await cookies()
  const cookie = jar.get(COOKIE_NAME)?.value
  const isLoggedIn = cookie === SIGNED
  return { isLoggedIn }
}

export async function createSession() {
  const jar = await cookies()
  jar.set(COOKIE_NAME, SIGNED, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 horas
    path: '/',
  })
}

export async function destroySession() {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
}
