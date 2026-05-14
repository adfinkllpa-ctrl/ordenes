import { NextResponse } from 'next/server'
import { fetchSheet } from '@/lib/google-sheets'

export async function GET() {
  const sheet = await fetchSheet(7) // Deudas
  return NextResponse.json({
    headers: sheet.headers.map((h, i) => ({ col: i, value: h })),
    rows: sheet.rows.map((r, i) => ({ rowIdx: i, data: r }))
  })
}
