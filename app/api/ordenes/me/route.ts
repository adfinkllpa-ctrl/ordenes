import { NextResponse } from 'next/server'
import { getOrdenesSession } from '@/lib/ordenes-session'

export async function GET() {
  const session = await getOrdenesSession()
  if (!session.isLoggedIn) return NextResponse.json({ isLoggedIn: false })
  return NextResponse.json({ isLoggedIn: true, email: session.email, nombre: session.nombre })
}
