import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/session'

const ALL_TABS = ['ventas', 'presupuesto', 'pagos', 'deudas', 'cobranza', 'margenes']

const USERS = [
  { username: 'HECTOR',  password: 'BEJARANO', role: 'socio',   tabs: ['ventas_socio', 'cobranza', 'margenes'] },
  { username: 'MAGDA',   password: 'PACHECO',  role: 'socio',   tabs: ['ventas_socio', 'cobranza', 'margenes'] },
  { username: 'GERENTE', password: 'GENERAL',  role: 'gerente', tabs: ALL_TABS },
  { username: 'ALEX',    password: '945058683', role: 'admin',  tabs: [...ALL_TABS, 'ventas_socio', 'admin'] },
]

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const found = USERS.find(
    u => u.username === username.toUpperCase() && u.password === password.toUpperCase()
  )

  if (found) {
    await createSession({ username: found.username, role: found.role, tabs: found.tabs })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false }, { status: 401 })
}
