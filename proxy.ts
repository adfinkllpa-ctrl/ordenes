import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function proxy(req: NextRequest) {
  const session = await getSession()
  const isLoginPage = req.nextUrl.pathname === '/login'

  if (!session.isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session.isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  // /ordenes tiene su propio login independiente (Google OAuth), no el de sesión del dashboard.
  matcher: ['/((?!api|ordenes|_next/static|_next/image|favicon.ico).*)'],
}
