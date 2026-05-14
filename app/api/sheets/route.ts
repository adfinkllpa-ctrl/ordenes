import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { fetchAllSheets } from '@/lib/google-sheets'

// Caché en memoria: los datos se actualizan cada 60 segundos
let cache: { data: unknown; timestamp: number } | null = null
const CACHE_TTL = 60 * 1000 // 60 segundos

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    const data = await fetchAllSheets()
    cache = { data, timestamp: now }
    return NextResponse.json(data)
  } catch (err) {
    console.error('Error fetching sheets:', err)
    return NextResponse.json({ error: 'Error al leer los Sheets' }, { status: 500 })
  }
}
