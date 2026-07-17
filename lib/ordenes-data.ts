import { encrypt, decrypt } from './crypto'
import {
  PROVEEDORES_SPREADSHEET_ID, PROVEEDORES_GID, PROVEEDORES_RANGE, PROVEEDORES_COLS,
  OC_SPREADSHEET_ID, CODIGOS_TAB, CODIGOS_RANGE, CODIGOS_COLS, PERSONAS_COLS,
  ORDENES_TAB, ORDENES_RANGE, ORDENES_COLS,
  OAUTH_TOKENS_TAB, OAUTH_TOKENS_RANGE, OAUTH_TOKENS_COLS,
  CONTROL_PAGO_TAB, CONTROL_PAGO_RANGE, CONTROL_PAGO_COLS,
  type EstadoOrden,
} from './ordenes-config'
import { getTabTitleByGid, readRange, appendRow, updateRange } from './ordenes-sheets'

export interface Proveedor {
  area: string
  razonSocial: string
  tipoDocumento: string
  nDocumento: string
  direccion: string
  metodoPago: string
  banco: string
  numeroCuenta: string
  cci: string
  yapePlin: string
  titularCuenta: string
  terminosPago: string
}

export async function getProveedorByDoc(doc: string): Promise<Proveedor | null> {
  const tab = await getTabTitleByGid(PROVEEDORES_SPREADSHEET_ID, PROVEEDORES_GID)
  const rows = await readRange(PROVEEDORES_SPREADSHEET_ID, `${tab}!${PROVEEDORES_RANGE}`)

  const docNormalizado = doc.trim()
  const row = rows.find(r => (r[PROVEEDORES_COLS.nDocumento] ?? '').trim() === docNormalizado)
  if (!row) return null

  return {
    area: row[PROVEEDORES_COLS.area] ?? '',
    razonSocial: row[PROVEEDORES_COLS.razonSocial] ?? '',
    tipoDocumento: row[PROVEEDORES_COLS.tipoDocumento] ?? '',
    nDocumento: row[PROVEEDORES_COLS.nDocumento] ?? '',
    direccion: row[PROVEEDORES_COLS.direccion] ?? '',
    metodoPago: row[PROVEEDORES_COLS.metodoPago] ?? '',
    banco: row[PROVEEDORES_COLS.banco] ?? '',
    numeroCuenta: row[PROVEEDORES_COLS.numeroCuenta] ?? '',
    cci: row[PROVEEDORES_COLS.cci] ?? '',
    yapePlin: row[PROVEEDORES_COLS.yapePlin] ?? '',
    titularCuenta: row[PROVEEDORES_COLS.titularCuenta] ?? '',
    terminosPago: row[PROVEEDORES_COLS.terminosPago] ?? '',
  }
}

export interface Persona {
  correo: string
  nombre: string
  puesto: string
}

async function readCodigosSheet(): Promise<string[][]> {
  return readRange(OC_SPREADSHEET_ID, `${CODIGOS_TAB}!${CODIGOS_RANGE}`)
}

// Lista de valores de "Clasificación de Gasto" (columna D de CODIGOS): Prev. SSGG,
// Prev. HVAC, CAP, CACP, CCP, CAC, CTZ, COM, Presupuesto — se muestran tal cual, sin código.
export async function getClasificacionesGasto(): Promise<string[]> {
  const rows = await readCodigosSheet()
  return rows
    .map(r => (r[CODIGOS_COLS.clasificacionGasto] ?? '').trim())
    .filter(v => v !== '')
}

// Lista de RUBRO (columna C de CODIGOS) — usada como catálogo de "Código" en las líneas.
export async function getRubros(): Promise<string[]> {
  const rows = await readCodigosSheet()
  return rows
    .map(r => (r[CODIGOS_COLS.rubro] ?? '').trim())
    .filter(v => v !== '')
}

export async function getPersonasAutorizadas(): Promise<Persona[]> {
  const rows = await readCodigosSheet()
  return rows
    .filter(r => (r[PERSONAS_COLS.correo] ?? '').trim() !== '')
    .map(r => ({
      correo: (r[PERSONAS_COLS.correo] ?? '').trim().toLowerCase(),
      nombre: r[PERSONAS_COLS.nombre] ?? '',
      puesto: r[PERSONAS_COLS.puesto] ?? '',
    }))
}

export async function getPersonaPorEmail(email: string): Promise<Persona | null> {
  const personas = await getPersonasAutorizadas()
  return personas.find(p => p.correo === email.trim().toLowerCase()) ?? null
}

// Usa directamente el Gmail personal del aprobador
export const APROBADOR_EMAIL = 'ad.fin.kllpa@gmail.com'
export const APROBADOR_GMAIL_ACCOUNT = 'ad.fin.kllpa@gmail.com'

// ─── OAuth tokens (Gmail conectado por persona) ────────────────────────────

interface OAuthTokenRow {
  rowNumber: number // fila real en el sheet (1-indexed, incluye header)
  email: string
  refreshToken: string
  nombre: string
}

async function findOAuthTokenRow(email: string): Promise<OAuthTokenRow | null> {
  const rows = await readRange(OC_SPREADSHEET_ID, `${OAUTH_TOKENS_TAB}!${OAUTH_TOKENS_RANGE}`)
  const emailNorm = email.trim().toLowerCase()
  const idx = rows.findIndex(r => (r[OAUTH_TOKENS_COLS.email] ?? '').trim().toLowerCase() === emailNorm)
  if (idx < 0) return null
  const row = rows[idx]
  // OAUTH_TOKENS_RANGE arranca en la fila 2 (después del header)
  const rowNumber = idx + 2
  return {
    rowNumber,
    email: row[OAUTH_TOKENS_COLS.email],
    refreshToken: decrypt(row[OAUTH_TOKENS_COLS.refreshTokenCifrado]),
    nombre: row[OAUTH_TOKENS_COLS.nombre] ?? '',
  }
}

export async function getRefreshTokenFor(email: string): Promise<string | null> {
  const row = await findOAuthTokenRow(email)
  return row?.refreshToken ?? null
}

export async function saveRefreshToken(email: string, refreshToken: string, nombre: string): Promise<void> {
  const cifrado = encrypt(refreshToken)
  const existing = await findOAuthTokenRow(email)
  const now = new Date().toISOString()

  if (existing) {
    await updateRange(
      OC_SPREADSHEET_ID,
      `${OAUTH_TOKENS_TAB}!A${existing.rowNumber}:D${existing.rowNumber}`,
      [[email, cifrado, nombre, now]],
    )
  } else {
    await appendRow(OC_SPREADSHEET_ID, OAUTH_TOKENS_TAB, [email, cifrado, nombre, now])
  }
}

// ─── Órdenes ────────────────────────────────────────────────────────────────

export interface LineaOrden {
  codigo: string
  descripcion: string
  fechaConclusion: string
  cantidad: number
  igv: boolean
  precioUnitario: number
  total: number
}

export interface NuevaOrden {
  creadoPorNombre: string
  creadoPorEmail: string
  clasificacionGasto: string
  tipoComprobante: string
  detalleGasto: string
  comentarios: string
  proveedorDoc: string
  proveedorRazonSocial: string
  terminosPago: string
  lineas: LineaOrden[]
  montoTotal: number
  comprobanteSiNo?: 'Sí' | 'No' // ¿Adjuntará comprobante?
}

export interface Orden extends NuevaOrden {
  folio: string
  fechaCreacion: string
  area: string // solo lectura, de filas antiguas; el formulario ya no lo pide
  estado: EstadoOrden
  fechaDecision: string | null
  fechaPago: string | null
  fechaPagoReal: string | null
  comprobanteSiNo: 'Sí' | 'No' | '' // ¿Adjuntará comprobante al crear OC?
  comprobantePago: string // URL/ruta del comprobante de pago (adjuntado al pagar)
}

const ESTADO_PENDIENTE: EstadoOrden = 'Pendiente de aprobación'

async function siguienteFolio(): Promise<string> {
  const rows = await readRange(OC_SPREADSHEET_ID, `${ORDENES_TAB}!${ORDENES_RANGE}`)
  const numeros = rows
    .map(r => parseInt(r[ORDENES_COLS.folio] ?? '', 10))
    .filter(n => !isNaN(n))
  const siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1
  return String(siguiente)
}

export async function crearOrden(datos: NuevaOrden): Promise<Orden> {
  const folio = await siguienteFolio()
  const fechaCreacion = new Date().toISOString()

  await appendRow(OC_SPREADSHEET_ID, ORDENES_TAB, [
    folio,
    fechaCreacion,
    datos.creadoPorNombre,
    '', // Área: ya no se pide en el formulario
    datos.proveedorRazonSocial,
    datos.proveedorDoc,
    datos.montoTotal,
    datos.terminosPago,
    ESTADO_PENDIENTE,
    '',
    '',
    datos.creadoPorEmail,
    datos.clasificacionGasto,
    datos.tipoComprobante,
    datos.detalleGasto,
    JSON.stringify(datos.lineas),
    '',
    datos.comentarios,
    datos.comprobanteSiNo ?? '', // Sí/No para adjuntar comprobante
    '', // Comprobante de pago (se llena al pagar)
  ])

  return {
    ...datos,
    comprobanteSiNo: datos.comprobanteSiNo ?? '',
    folio,
    fechaCreacion,
    area: '',
    estado: ESTADO_PENDIENTE,
    fechaDecision: null,
    fechaPago: null,
    fechaPagoReal: null,
    comprobantePago: '',
  }
}

function filaAOrden(row: string[]): Orden {
  return {
    folio: row[ORDENES_COLS.folio] ?? '',
    fechaCreacion: row[ORDENES_COLS.fechaCreacion] ?? '',
    creadoPorNombre: row[ORDENES_COLS.creadoPorNombre] ?? '',
    creadoPorEmail: row[ORDENES_COLS.creadoPorEmail] ?? '',
    area: row[ORDENES_COLS.area] ?? '',
    clasificacionGasto: row[ORDENES_COLS.clasificacionGasto] ?? '',
    tipoComprobante: row[ORDENES_COLS.tipoComprobante] ?? '',
    detalleGasto: row[ORDENES_COLS.detalleGasto] ?? '',
    comentarios: row[ORDENES_COLS.comentarios] ?? '',
    proveedorDoc: row[ORDENES_COLS.proveedorDoc] ?? '',
    proveedorRazonSocial: row[ORDENES_COLS.proveedorRazonSocial] ?? '',
    terminosPago: row[ORDENES_COLS.terminosPago] ?? '',
    lineas: JSON.parse(row[ORDENES_COLS.lineasJson] || '[]'),
    montoTotal: parseFloat(row[ORDENES_COLS.montoTotal] ?? '0') || 0,
    estado: (row[ORDENES_COLS.estado] as EstadoOrden) || ESTADO_PENDIENTE,
    fechaDecision: row[ORDENES_COLS.fechaDecision] || null,
    fechaPago: row[ORDENES_COLS.fechaPago] || null,
    fechaPagoReal: row[ORDENES_COLS.fechaPagoReal] || null,
    comprobanteSiNo: (row[ORDENES_COLS.comprobanteSiNo] ?? '') as 'Sí' | 'No' | '',
    comprobantePago: row[ORDENES_COLS.comprobantePago] ?? '',
  }
}

interface OrdenRowRef {
  rowNumber: number
  orden: Orden
}

export async function findOrdenByFolio(folio: string): Promise<OrdenRowRef | null> {
  const rows = await readRange(OC_SPREADSHEET_ID, `${ORDENES_TAB}!${ORDENES_RANGE}`)
  const idx = rows.findIndex(r => (r[ORDENES_COLS.folio] ?? '').trim() === folio.trim())
  if (idx < 0) return null
  // ORDENES_RANGE arranca en la fila 2 (después del header)
  return { rowNumber: idx + 2, orden: filaAOrden(rows[idx]) }
}

export async function listOrdenesPorEmail(email: string): Promise<Orden[]> {
  const rows = await readRange(OC_SPREADSHEET_ID, `${ORDENES_TAB}!${ORDENES_RANGE}`)
  const emailNorm = email.trim().toLowerCase()
  return rows
    .filter(r => (r[ORDENES_COLS.creadoPorEmail] ?? '').trim().toLowerCase() === emailNorm)
    .map(filaAOrden)
    .reverse()
}

export async function actualizarDecisionOrden(
  rowNumber: number,
  estado: 'Aprobada' | 'Rechazada',
  fechaDecision: string,
  fechaPago: string | null,
): Promise<void> {
  await updateRange(OC_SPREADSHEET_ID, `${ORDENES_TAB}!I${rowNumber}:K${rowNumber}`, [
    [estado, fechaDecision, fechaPago ?? ''],
  ])
}

// ─── Pagos (solo APROBADOR_EMAIL) ──────────────────────────────────────────

export async function listOrdenesPendientesPago(): Promise<Orden[]> {
  const rows = await readRange(OC_SPREADSHEET_ID, `${ORDENES_TAB}!${ORDENES_RANGE}`)
  return rows
    .map(filaAOrden)
    .filter(o => o.estado === 'Aprobada')
    .sort((a, b) => (a.fechaPago ?? '9999-99-99').localeCompare(b.fechaPago ?? '9999-99-99'))
}

export async function marcarOrdenPagada(rowNumber: number): Promise<void> {
  const hoy = new Date().toISOString().slice(0, 10)
  await updateRange(OC_SPREADSHEET_ID, `${ORDENES_TAB}!I${rowNumber}:I${rowNumber}`, [['Pagada']])
  await updateRange(OC_SPREADSHEET_ID, `${ORDENES_TAB}!Q${rowNumber}:Q${rowNumber}`, [[hoy]])
}

export async function marcarOrdenPagadaConComprobante(rowNumber: number, comprobantePagoPath: string): Promise<void> {
  const hoy = new Date().toISOString().slice(0, 10)
  // Columnas: I=estado, Q=fechaPagoReal, T=comprobantePago
  await updateRange(OC_SPREADSHEET_ID, `${ORDENES_TAB}!I${rowNumber}:I${rowNumber}`, [['Pagada']])
  await updateRange(OC_SPREADSHEET_ID, `${ORDENES_TAB}!Q${rowNumber}:Q${rowNumber}`, [[hoy]])
  await updateRange(OC_SPREADSHEET_ID, `${ORDENES_TAB}!T${rowNumber}:T${rowNumber}`, [[comprobantePagoPath]])
}

// Vista resumida (sin el JSON de líneas) para que el aprobador vea de un vistazo
// qué se debe pagar y cuándo. Se actualiza al aprobar/rechazar y al marcar como pagada.
export async function upsertControlPago(orden: Orden, appUrl?: string): Promise<void> {
  const rows = await readRange(OC_SPREADSHEET_ID, `${CONTROL_PAGO_TAB}!${CONTROL_PAGO_RANGE}`)
  const idx = rows.findIndex(r => (r[CONTROL_PAGO_COLS.folio] ?? '').trim() === orden.folio.trim())

  const linkPago = appUrl
    ? `=HIPERVINCULO("${appUrl}/ordenes/pagos?folio=${orden.folio}";"Pagar")`
    : ''

  const comprobante = orden.comprobanteSiNo === 'Sí' ? '✓' : ''

  const fila = [
    orden.folio,
    orden.creadoPorNombre,
    orden.detalleGasto,
    orden.tipoComprobante,
    orden.montoTotal,
    orden.fechaPago ?? '',
    orden.comentarios,
    orden.estado,
    linkPago,
    comprobante,
  ]

  if (idx < 0) {
    await appendRow(OC_SPREADSHEET_ID, CONTROL_PAGO_TAB, fila)
  } else {
    const rowNumber = idx + 2 // CONTROL_PAGO_RANGE arranca en la fila 2
    await updateRange(OC_SPREADSHEET_ID, `${CONTROL_PAGO_TAB}!A${rowNumber}:J${rowNumber}`, [fila])
  }
}
