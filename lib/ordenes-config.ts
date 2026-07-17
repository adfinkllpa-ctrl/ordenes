// Configuración de los Google Sheets usados por el módulo de Órdenes de Compra.
// Los IDs de "Proveedores" y "OC 000-2026" son sheets ya existentes del negocio.
// La pestaña "Registro de Órdenes" ya existía (con datos de prueba) — se le
// agregaron 4 columnas nuevas (M-P). "OAuthTokens" es una pestaña nueva y vacía.

export const PROVEEDORES_SPREADSHEET_ID = '1u2E6nDnB9-jK4u4lOdNviAvXa-Mh4VmoW0TjTJ8J_T4'
export const PROVEEDORES_GID = 486378537 // pestaña resuelta por gid, no por nombre ("aca")
export const PROVEEDORES_RANGE = 'A4:L1000' // fila 3 = headers, datos desde fila 4

// Columnas de la pestaña de proveedores (0-indexed, relativo a PROVEEDORES_RANGE)
export const PROVEEDORES_COLS = {
  area: 0,
  razonSocial: 1,
  tipoDocumento: 2,
  nDocumento: 3,
  direccion: 4,
  metodoPago: 5,
  banco: 6,
  numeroCuenta: 7,
  cci: 8,
  yapePlin: 9,
  titularCuenta: 10,
  terminosPago: 11,
} as const

export const OC_SPREADSHEET_ID = '1wocxA4KjEit7v_OlUJQrDKM7CQZjw_whV-e2kc8O14g'

export const CODIGOS_TAB = 'CODIGOS'
export const CODIGOS_RANGE = 'B3:G500' // fila 2 = headers, datos desde fila 3
// cols B-G relativas al rango (0-indexed => 0-5): área, rubro, clasificación de gasto, correo, nombre, puesto
export const CODIGOS_COLS = { area: 0, rubro: 1, clasificacionGasto: 2, correo: 3, nombre: 4, puesto: 5 } as const
export const PERSONAS_COLS = { correo: 3, nombre: 4, puesto: 5 } as const

export const ORDENES_TAB = 'Registro de Órdenes'
export const ORDENES_RANGE = 'A2:T10000' // fila 1 = headers, datos desde fila 2
export const ORDENES_COLS = {
  folio: 0,               // Número de Orden
  fechaCreacion: 1,        // Fecha Creación
  creadoPorNombre: 2,      // Creado por
  area: 3,                 // Área (ya no se usa desde el formulario, queda vacía)
  proveedorRazonSocial: 4, // Proveedor
  proveedorDoc: 5,         // Documento
  montoTotal: 6,           // Monto Total
  terminosPago: 7,         // Términos de Pago (copiado del proveedor al crear la orden)
  estado: 8,               // Estado
  fechaDecision: 9,        // Fecha Revisión
  fechaPago: 10,           // Fecha de Pago (estimada, calculada al aprobar)
  creadoPorEmail: 11,      // Email Solicitante
  clasificacionGasto: 12,  // Clasificación de Gasto (columna nueva)
  tipoComprobante: 13,     // Tipo de Comprobante (columna nueva)
  detalleGasto: 14,        // Detalle de Gasto (columna nueva)
  lineasJson: 15,          // Líneas (JSON) (columna nueva)
  fechaPagoReal: 16,       // Fecha en que se marcó como Pagada (columna nueva)
  comentarios: 17,         // Comentarios libres (columna nueva)
  comprobanteSiNo: 18,     // ¿Adjuntará comprobante? Sí/No (columna nueva)
  comprobantePago: 19,     // Comprobante de pago (URL/ruta al adjuntar pago) (columna nueva)
} as const

export const OAUTH_TOKENS_TAB = 'OAuthTokens'
export const OAUTH_TOKENS_RANGE = 'A2:D1000'
export const OAUTH_TOKENS_COLS = { email: 0, refreshTokenCifrado: 1, nombre: 2, conectadoEn: 3 } as const

// Vista resumida y legible para el control de pagos del aprobador (sin el JSON de líneas).
export const CONTROL_PAGO_TAB = 'Control de Pagos'
export const CONTROL_PAGO_RANGE = 'A2:J10000'
export const CONTROL_PAGO_COLS = {
  folio: 0,
  creadoPorNombre: 1,
  detalleGasto: 2,
  tipoComprobante: 3,
  montoTotal: 4,
  fechaPago: 5,
  comentarios: 6,
  estado: 7,
  linkPago: 8,
  comprobante: 9,
} as const

export type EstadoOrden = 'Pendiente de aprobación' | 'Aprobada' | 'Rechazada' | 'Pagada'
