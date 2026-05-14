import { NextResponse } from 'next/server'
import { fetchSheet } from '@/lib/google-sheets'

export async function GET() {
  const sheet = await fetchSheet(11) // Ventas Socio
  return NextResponse.json({
    headers: sheet.headers.map((h, i) => ({ col: i, value: h })),
    totalRows: sheet.rows.length,
    rows: sheet.rows.map((r, i) => ({ rowIdx: i, data: r }))
  })
}
