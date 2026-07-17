import { NextRequest, NextResponse } from 'next/server'
import { getOrdenesSession } from '@/lib/ordenes-session'
import { getProveedorByDoc } from '@/lib/ordenes-data'

export async function GET(req: NextRequest) {
  const session = await getOrdenesSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const doc = req.nextUrl.searchParams.get('doc')?.trim()
  if (!doc) return NextResponse.json({ error: 'Falta el parámetro doc' }, { status: 400 })

  try {
    const proveedor = await getProveedorByDoc(doc)
    if (!proveedor) return NextResponse.json({ found: false })
    return NextResponse.json({ found: true, proveedor })
  } catch (err) {
    console.error('Error buscando proveedor:', err)
    return NextResponse.json({ error: 'Error consultando proveedores' }, { status: 500 })
  }
}
