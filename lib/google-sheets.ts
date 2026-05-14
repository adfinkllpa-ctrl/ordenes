import { getAccessToken } from './google-auth'
import { SHEETS_CONFIG } from './sheets-config'

export async function fetchSheet(sheetIndex: number) {
  const config = SHEETS_CONFIG[sheetIndex]
  if (!config) throw new Error(`Sheet ${sheetIndex} no encontrado`)

  const token = await getAccessToken()
  const range = encodeURIComponent(`${config.tabName}!${config.dataRange}`)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.id}/values/${range}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HTTP ${res.status}: ${err}`)
  }

  const data = await res.json() as { values?: string[][] }
  const rows = data.values ?? []
  if (rows.length === 0) return { headers: [], rows: [], config }

  const headers = rows[0]
  return { headers, rows: rows.slice(1), config }
}

export async function fetchAllSheets() {
  const results = await Promise.allSettled(
    SHEETS_CONFIG.map((_, i) => fetchSheet(i))
  )

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const msg = (r.reason as Error).message
    console.error(`Error Sheet ${i}:`, msg)
    return { headers: [], rows: [], config: SHEETS_CONFIG[i], error: true, errorMsg: msg }
  })
}
