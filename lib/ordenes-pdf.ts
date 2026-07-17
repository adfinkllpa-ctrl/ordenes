import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Orden, Proveedor } from './ordenes-data'
import { KLLPA_LOGO_PNG_BASE64 } from './assets/kllpa-logo-base64'

// Paleta KLLPA — diseño "membrete corporativo" (serif + recuadros verdes)
const AZUL = rgb(0x00 / 255, 0x2f / 255, 0x5d / 255)
const VERDE = rgb(0x33 / 255, 0xb4 / 255, 0x4a / 255)
const VERDE_OSC = rgb(0x26 / 255, 0x8c / 255, 0x36 / 255)
const VERDE_TINTE = rgb(0xea / 255, 0xf7 / 255, 0xec / 255)
const GRIS_TEXTO = rgb(0x6a / 255, 0x70 / 255, 0x78 / 255)
const GRIS_LINEA = rgb(0xee / 255, 0xf0 / 255, 0xf2 / 255)
const NEGRO = rgb(0x1a / 255, 0x1d / 255, 0x21 / 255)
const BLANCO = rgb(1, 1, 1)

function tieneValor(v: string | undefined): boolean {
  return Boolean(v && v.trim() !== '' && v.trim() !== '-')
}

function formatMonto(n: number): string {
  return `S/.${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}

// Las fuentes estándar de pdf-lib (Helvetica/Times) solo soportan WinAnsi (Latin-1,
// 0x00-0xFF) — cubre español normal (á, é, í, ó, ú, ñ, ü) pero no emojis ni otros
// caracteres. Cualquier carácter fuera de ese rango se reemplaza para no romper el PDF.
function limpiarTexto(str: string): string {
  return str.replace(/[^\x00-\xFF]/g, '?')
}

// Rectángulo con TODAS las esquinas redondeadas (usado para el borde de las tarjetas).
function pathRectRedondeado(w: number, h: number, r: number): string {
  return `M ${r},0 H ${w - r} A ${r},${r} 0 0 1 ${w},${r} V ${h - r} A ${r},${r} 0 0 1 ${w - r},${h} H ${r} A ${r},${r} 0 0 1 0,${h - r} V ${r} A ${r},${r} 0 0 1 ${r},0 Z`
}
// Rectángulo con solo las esquinas SUPERIORES redondeadas (la barra de título de cada sección).
function pathRectRedondeadoArriba(w: number, h: number, r: number): string {
  return `M 0,${h} L 0,${r} A ${r},${r} 0 0 1 ${r},0 L ${w - r},0 A ${r},${r} 0 0 1 ${w},${r} L ${w},${h} Z`
}

export async function generarPdfOrden(orden: Orden, proveedor: Proveedor): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const serif = await pdf.embedFont(StandardFonts.TimesRoman)
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const sans = await pdf.embedFont(StandardFonts.Helvetica)
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logo = await pdf.embedPng(Buffer.from(KLLPA_LOGO_PNG_BASE64, 'base64'))

  const margin = 42
  const pageWidth = 595.28
  const pageHeight = 841.89
  const contentWidth = pageWidth - margin * 2

  let page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function nuevaPagina() {
    page = pdf.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }
  function nuevaPaginaSiHaceFalta(alturaNecesaria: number) {
    if (y - alturaNecesaria < margin) nuevaPagina()
  }

  function texto(str: string, x: number, yPos: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) {
    // Las fuentes estándar de pdf-lib solo soportan WinAnsi (Latin-1) — cualquier
    // carácter fuera de ese rango (emojis, etc.) se reemplaza para no romper el PDF.
    const seguro = limpiarTexto(str)
    page.drawText(seguro, { x, y: yPos, size: opts.size ?? 10, font: opts.font ?? sans, color: opts.color ?? NEGRO })
  }
  function textoDerecha(str: string, xDerecha: number, yPos: number, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) {
    const size = opts.size ?? 10
    const f = opts.font ?? sans
    const seguro = limpiarTexto(str)
    texto(seguro, xDerecha - f.widthOfTextAtSize(seguro, size), yPos, opts)
  }

  // ── Membrete ──────────────────────────────────────────────────────────────
  const logoTam = 40
  page.drawImage(logo, { x: margin, y: y - logoTam, width: logoTam, height: logoTam })
  texto('KLLPA PERÚ', margin + logoTam + 14, y - 26, { size: 21, font: serifBold, color: AZUL })

  textoDerecha('ORDEN DE COMPRA', margin + contentWidth, y - 6, { size: 10, font: sansBold, color: VERDE_OSC })
  textoDerecha(`N.° ${orden.folio}`, margin + contentWidth, y - 38, { size: 28, font: serif, color: AZUL })
  textoDerecha(new Date(orden.fechaCreacion).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }), margin + contentWidth, y - 54, { size: 9.5, font: sans, color: GRIS_TEXTO })

  y -= 62
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 2.2, color: AZUL })
  y -= 26

  // ── Creado por ───────────────────────────────────────────────────────────
  const labelCreado = 'Creado por  '
  texto(labelCreado, margin, y, { size: 11, font: sans, color: GRIS_TEXTO })
  texto(orden.creadoPorNombre, margin + sans.widthOfTextAtSize(labelCreado, 11), y, { size: 11, font: sansBold, color: NEGRO })
  y -= 14
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 1, color: GRIS_LINEA })
  y -= 22

  // ── Helpers de tarjeta con barra de título ──────────────────────────────
  const barH = 26
  const radio = 8

  function iniciarSeccion(titulo: string, alturaTotal: number, acento = false) {
    nuevaPaginaSiHaceFalta(alturaTotal)
    const yTop = y
    // Borde completo de la tarjeta
    page.drawSvgPath(pathRectRedondeado(contentWidth, alturaTotal, radio), { x: margin, y: yTop, borderColor: VERDE, borderWidth: 3 })
    // Barra de título (esquinas superiores redondeadas)
    page.drawSvgPath(pathRectRedondeadoArriba(contentWidth, barH, radio), { x: margin, y: yTop, color: acento ? VERDE_OSC : AZUL })
    texto(titulo.toUpperCase(), margin + 16, yTop - barH + 9, { size: 10.5, font: sansBold, color: BLANCO })
    return yTop - barH // y donde empieza el cuerpo de la sección
  }

  function filaCampos(campos: { label: string; valor: string }[], yTop: number) {
    const colWidth = contentWidth / campos.length
    campos.forEach((c, i) => {
      const x = margin + 16 + i * colWidth
      texto(c.label.toUpperCase(), x, yTop - 12, { size: 7.5, color: GRIS_TEXTO, font: sansBold })
      texto(c.valor || '—', x, yTop - 27, { size: 11, color: NEGRO, font: serif })
    })
  }

  // ── Información general ──────────────────────────────────────────────────
  const tieneComentarios = tieneValor(orden.comentarios)
  const filasInfo = 3
  const infoH = barH + 14 + filasInfo * 38 + 6
  const infoBodyTop = iniciarSeccion('Información general', infoH)
  filaCampos([
    { label: 'Clasificación de gasto', valor: orden.clasificacionGasto },
    { label: 'Tipo de comprobante', valor: orden.tipoComprobante },
  ], infoBodyTop - 14)
  filaCampos([
    { label: 'Términos de pago', valor: orden.terminosPago },
    { label: 'Detalle de gasto', valor: orden.detalleGasto },
  ], infoBodyTop - 52)
  filaCampos([
    { label: 'Comentarios', valor: tieneComentarios ? orden.comentarios : '—' },
    { label: '¿Adjuntará comprobante?', valor: orden.comprobanteSiNo || 'No' },
  ], infoBodyTop - 90)
  y -= infoH + 18

  // ── Proveedor ────────────────────────────────────────────────────────────
  const tieneBanco = tieneValor(proveedor.numeroCuenta)
  const tieneYape = tieneValor(proveedor.yapePlin)
  const filasPago = 1 + (tieneBanco ? 1 : 0) + (tieneYape ? 1 : 0) // metodoPago + banco? + yape?
  const provH = barH + 14 + (1 + filasPago) * 38 + 6
  const provBodyTop = iniciarSeccion('Proveedor', provH)
  filaCampos([
    { label: 'Razón social', valor: orden.proveedorRazonSocial },
    { label: 'RUC / DNI', valor: orden.proveedorDoc },
  ], provBodyTop - 14)
  let filaProvY = provBodyTop - 52
  filaCampos([{ label: 'Método de pago', valor: proveedor.metodoPago }], filaProvY)
  if (tieneBanco) {
    filaProvY -= 38
    filaCampos([
      { label: 'Banco', valor: proveedor.banco },
      { label: 'Número de cuenta', valor: proveedor.numeroCuenta },
      { label: 'CCI', valor: proveedor.cci },
    ], filaProvY)
  }
  if (tieneYape) {
    filaProvY -= 38
    filaCampos([
      { label: 'Número de Yape / Plin', valor: proveedor.yapePlin },
      { label: 'Titular de la cuenta', valor: proveedor.titularCuenta },
    ], filaProvY)
  }
  y -= provH + 18

  // ── Líneas de productos/servicios ────────────────────────────────────────
  const cols = [
    { label: 'Código', width: 88 },
    { label: 'Descripción', width: 142 },
    { label: 'Cant.', width: 36 },
    { label: 'IGV', width: 32 },
    { label: 'P. Unit.', width: 78 },
    { label: 'Total', width: contentWidth - 32 - 88 - 142 - 36 - 32 - 78 },
  ]
  const filaAlto = 20
  const totalBloqueH = 40
  const tablaH = barH + 14 + filaAlto + orden.lineas.length * filaAlto + totalBloqueH + 20
  const tablaBodyTop = iniciarSeccion('Líneas de productos / servicios', tablaH, true)

  let filaY = tablaBodyTop - 14
  // Encabezado de tabla (fondo azul, texto blanco)
  page.drawRectangle({ x: margin + 8, y: filaY - filaAlto + 4, width: contentWidth - 16, height: filaAlto, color: AZUL })
  let xCab = margin + 16
  cols.forEach(c => { texto(c.label, xCab, filaY - 12, { size: 8, font: sansBold, color: BLANCO }); xCab += c.width })
  filaY -= filaAlto

  orden.lineas.forEach((l, i) => {
    if (i % 2 === 1) page.drawRectangle({ x: margin + 8, y: filaY - filaAlto + 4, width: contentWidth - 16, height: filaAlto, color: VERDE_TINTE })
    const valores = [l.codigo, l.descripcion.slice(0, 32), String(l.cantidad), l.igv ? 'Sí' : 'No', formatMonto(l.precioUnitario), formatMonto(l.total)]
    let x = margin + 16
    valores.forEach((v, ci) => { texto(v, x, filaY - 12, { size: 9, color: NEGRO }); x += cols[ci].width })
    filaY -= filaAlto
  })

  filaY -= 6
  page.drawRectangle({ x: margin + 8, y: filaY - totalBloqueH + 8, width: contentWidth - 16, height: totalBloqueH - 6, color: VERDE_OSC })
  texto('TOTAL FINAL', margin + 22, filaY - totalBloqueH / 2 - 4, { size: 10.5, font: sansBold, color: BLANCO })
  textoDerecha(formatMonto(orden.montoTotal), margin + contentWidth - 22, filaY - totalBloqueH / 2 - 6, { size: 17, font: serifBold, color: BLANCO })

  y -= tablaH + 20

  // ── Pie de página ────────────────────────────────────────────────────────
  nuevaPaginaSiHaceFalta(24)
  page.drawLine({ start: { x: margin, y }, end: { x: margin + contentWidth, y }, thickness: 1, color: GRIS_LINEA })
  const nota = 'KLLPA Perú · Documento generado automáticamente por el sistema de Órdenes de Compra'
  const notaW = sans.widthOfTextAtSize(nota, 8.5)
  texto(nota, margin + (contentWidth - notaW) / 2, y - 16, { size: 8.5, color: GRIS_TEXTO })

  return pdf.save()
}
