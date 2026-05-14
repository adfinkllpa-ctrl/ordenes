import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/session'

const ALL_TABS = ['ventas', 'presupuesto', 'pagos', 'deudas']

const USERS = [
  { username: 'HECTOR',  password: 'BEJARANO', role: 'socio',   tabs: ALL_TABS },
  { username: 'MAGDA',   password: 'PACHECO',  role: 'socio',   tabs: ALL_TABS },
  { username: 'GERENTE', password: 'GENERAL',  role: 'gerente', tabs: ALL_TABS },
]

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const found = USERS.find(
    u => u.username === username.toUpperCase() && u.password === password
  )

  if (found) {
    await createSession({ username: found.username, role: found.role, tabs: found.tabs })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false }, { status: 401 })
}
