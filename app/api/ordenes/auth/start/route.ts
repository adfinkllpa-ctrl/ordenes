import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { buildAuthUrl } from '@/lib/google-oauth'

const STATE_COOKIE = 'ordenes_oauth_state'

export async function GET() {
  const state = randomBytes(16).toString('hex')
  const res = NextResponse.redirect(buildAuthUrl(state))
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })
  return res
}
