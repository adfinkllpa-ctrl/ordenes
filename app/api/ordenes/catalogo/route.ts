import { NextResponse } from 'next/server'
import { getOrdenesSession } from '@/lib/ordenes-session'
import { getClasificacionesGasto, getRubros } from '@/lib/ordenes-data'

export async function GET() {
  const session = await getOrdenesSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const [clasificaciones, rubros] = await Promise.all([getClasificacionesGasto(), getRubros()])
    return NextResponse.json({ clasificaciones, rubros })
  } catch (err) {
    console.error('Error leyendo catálogo:', err)
    return NextResponse.json({ error: 'Error consultando catálogo' }, { status: 500 })
  }
}
