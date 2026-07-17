import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/google-oauth'
import { getPersonaPorEmail, getRefreshTokenFor, saveRefreshToken } from '@/lib/ordenes-data'
import { createOrdenesSession } from '@/lib/ordenes-session'

const STATE_COOKIE = 'ordenes_oauth_state'

function errorRedirect(req: NextRequest, mensaje: string) {
  const url = new URL('/ordenes/nueva', req.url)
  url.searchParams.set('error', mensaje)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const expectedState = req.cookies.get(STATE_COOKIE)?.value

  if (!code || !state || !expectedState || state !== expectedState) {
    return errorRedirect(req, 'sesion_invalida')
  }

  try {
    const { refreshToken, identity } = await exchangeCodeForTokens(code)

    const persona = await getPersonaPorEmail(identity.email)
    if (!persona) {
      return errorRedirect(req, 'correo_no_autorizado')
    }

    if (refreshToken) {
      await saveRefreshToken(identity.email, refreshToken, persona.nombre || identity.name)
    } else if (!(await getRefreshTokenFor(identity.email))) {
      // Google no devolvió refresh_token y no hay uno guardado previamente:
      // sin él no podremos enviar correos en su nombre más adelante.
      return errorRedirect(req, 'reautoriza_en_myaccount_google_com')
    }

    await createOrdenesSession({ email: identity.email, nombre: persona.nombre || identity.name })

    const res = NextResponse.redirect(new URL('/ordenes/nueva', req.url))
    res.cookies.delete(STATE_COOKIE)
    return res
  } catch (err) {
    console.error('Error en callback OAuth de órdenes:', err)
    return errorRedirect(req, 'error_conexion')
  }
}
