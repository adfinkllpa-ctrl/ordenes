import { NextRequest, NextResponse } from 'next/server'
import { getOrdenesSession } from '@/lib/ordenes-session'
import { findOrdenByFolio, marcarOrdenPagada, upsertControlPago, APROBADOR_EMAIL } from '@/lib/ordenes-data'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getOrdenesSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.email.trim().toLowerCase() !== APROBADOR_EMAIL.trim().toLowerCase()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const folio = decodeURIComponent(id)
  const appUrl = process.env.APP_URL || 'http://localhost:3003'

  const ref = await findOrdenByFolio(folio)
  if (!ref) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (ref.orden.estado !== 'Aprobada') {
    return NextResponse.json({ error: `La orden está en estado "${ref.orden.estado}", no se puede marcar como pagada` }, { status: 400 })
  }

  await marcarOrdenPagada(ref.rowNumber)

  try {
    await upsertControlPago({ ...ref.orden, estado: 'Pagada' }, appUrl)
  } catch (err) {
    console.error('Orden marcada como pagada pero falló actualizar Control de Pagos:', err)
  }

  return NextResponse.json({ ok: true })
}
