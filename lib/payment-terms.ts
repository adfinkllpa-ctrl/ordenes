export interface PagoCalculado {
  dias: number | null
  fechaPago: string | null // YYYY-MM-DD
  requiereRevisionManual: boolean
}

const LIMA_TZ = 'America/Lima'
const DIA_MS = 24 * 60 * 60 * 1000

// Parsea el texto libre de "TÉRMINOS DE PAGO" del proveedor (ej. "al contado",
// "neto 30", "30 días", "45") a un número de días desde la fecha base.
export function parseDiasPago(terminoPago: string | undefined): number | null {
  if (!terminoPago) return null
  const texto = terminoPago.toLowerCase().trim()

  if (texto.includes('contado')) return 0

  const match = texto.match(/\d+/)
  if (match) return parseInt(match[0], 10)

  return null
}

interface PartesLima {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: string // 'Sun' | 'Mon' | ... | 'Sat'
}

function getPartesLima(fecha: Date): PartesLima {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: LIMA_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  })
  const partes = fmt.formatToParts(fecha)
  const get = (type: string) => partes.find(p => p.type === type)?.value ?? ''
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour: parseInt(get('hour'), 10) % 24, // a medianoche a veces formatea "24"
    minute: parseInt(get('minute'), 10),
    weekday: get('weekday'),
  }
}

// Horario de recepción de OCs: Lun-Vie 9:00am-5:00pm, Sáb 9:00am-11:59am.
// Fuera de ese horario (incluido domingo) se procesa el siguiente día hábil.
function dentroDeHorarioRecepcion(p: PartesLima): boolean {
  const minutosDelDia = p.hour * 60 + p.minute
  if (p.weekday === 'Sun') return false
  if (p.weekday === 'Sat') return minutosDelDia >= 9 * 60 && minutosDelDia < 12 * 60
  return minutosDelDia >= 9 * 60 && minutosDelDia < 17 * 60
}

function siguienteDiaHabil(year: number, month: number, day: number): { year: number; month: number; day: number } {
  let ms = Date.UTC(year, month - 1, day)
  do {
    ms += DIA_MS
  } while (new Date(ms).getUTCDay() === 0) // domingo no es día hábil
  const d = new Date(ms)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

// Determina la fecha base (Lima) desde la cual se cuentan los días de pago,
// aplicando el corte de horario de recepción de OCs.
export function calcularFechaBase(fechaDecision: Date): { year: number; month: number; day: number } {
  const p = getPartesLima(fechaDecision)
  if (dentroDeHorarioRecepcion(p)) return { year: p.year, month: p.month, day: p.day }
  return siguienteDiaHabil(p.year, p.month, p.day)
}

export function calcularFechaPago(terminoPago: string | undefined, fechaDecision: Date): PagoCalculado {
  const dias = parseDiasPago(terminoPago)
  if (dias === null) {
    return { dias: null, fechaPago: null, requiereRevisionManual: true }
  }
  const base = calcularFechaBase(fechaDecision)
  const baseMs = Date.UTC(base.year, base.month - 1, base.day)
  const fechaPago = new Date(baseMs + dias * DIA_MS).toISOString().slice(0, 10)
  return { dias, fechaPago, requiereRevisionManual: false }
}
