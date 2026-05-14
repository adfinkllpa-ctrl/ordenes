import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) return NextResponse.json({}, { status: 401 })
  return NextResponse.json({
    username: session.username,
    role:     session.role,
    tabs:     session.tabs,
  })
}
