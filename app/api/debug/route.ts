import { NextResponse } from 'next/server'
import { fetchSheet } from '@/lib/google-sheets'

export async function GET() {
  const sheet = await fetchSheet(5) // Presupuesto - rango extendido para ver sección ANUAL
  return NextResponse.json({
    headers: sheet.headers.map((h, i) => ({ col: i, value: h })),
    totalRows: sheet.rows.length,
    totalsRow: sheet.rows.find(r => r[0]?.toUpperCase().includes('TOTAL'))
  })
}
