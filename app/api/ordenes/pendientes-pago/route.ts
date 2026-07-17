import { NextResponse } from 'next/server'
import { getOrdenesSession } from '@/lib/ordenes-session'
import { listOrdenesPendientesPago, APROBADOR_GMAIL_ACCOUNT } from '@/lib/ordenes-data'

export async function GET() {
  const session = await getOrdenesSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.email.trim().toLowerCase() !== APROBADOR_GMAIL_ACCOUNT.trim().toLowerCase()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const ordenes = await listOrdenesPendientesPago()
  return NextResponse.json({ ordenes })
}
