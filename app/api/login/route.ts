import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (username === process.env.DASHBOARD_USER && password === process.env.DASHBOARD_PASSWORD) {
    await createSession()
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false }, { status: 401 })
}
