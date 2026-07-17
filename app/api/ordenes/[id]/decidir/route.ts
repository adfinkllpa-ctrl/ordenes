import { NextRequest, NextResponse } from 'next/server'
import { verifyDecisionToken } from '@/lib/order-tokens'
import {
  findOrdenByFolio, actualizarDecisionOrden, getRefreshTokenFor, APROBADOR_EMAIL, APROBADOR_GMAIL_ACCOUNT,
  upsertControlPago,
} from '@/lib/ordenes-data'
import { calcularFechaPago } from '@/lib/payment-terms'
import { refreshAccessToken } from '@/lib/google-oauth'
import { sendGmail } from '@/lib/gmail-send'
import { buildResultadoOrdenEmail } from '@/lib/ordenes-email'

function paginaHtml(titulo: string, mensaje: string, color: string): NextResponse {
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:40px 16px;display:flex;justify-content:center;">
  <div style="background:#ffffff;border-radius:16px;padding:32px;max-width:480px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color:${color};font-size:22px;margin-bottom:12px;">${titulo}</h1>
    <p style="color:#374151;font-size:15px;line-height:1.5;">${mensaje}</p>
  </div>
</body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const folio = decodeURIComponent(id)
  const token = req.nextUrl.searchParams.get('token')
  const appUrl = process.env.APP_URL || 'http://localhost:3003'

  if (!token) return paginaHtml('Enlace inválido', 'Falta el token de aprobación.', '#dc2626')

  const payload = verifyDecisionToken(token)
  if (!payload || payload.ordenId !== folio) {
    return paginaHtml('Enlace inválido o vencido', 'Este enlace de aprobación no es válido o ya expiró. Pide que te reenvíen la orden.', '#dc2626')
  }

  const ref = await findOrdenByFolio(folio)
  if (!ref) return paginaHtml('Orden no encontrada', `No se encontró la orden ${folio}.`, '#dc2626')

  const { rowNumber, orden } = ref

  if (orden.estado !== 'Pendiente de aprobación') {
    return paginaHtml(
      'Esta orden ya fue procesada',
      `La orden ${orden.folio} ya estaba marcada como <strong>${orden.estado}</strong> ${orden.fechaPago ? `(fecha de pago: ${orden.fechaPago})` : ''}. No se realizó ningún cambio.`,
      '#6b7280',
    )
  }

  const nuevoEstado: 'Aprobada' | 'Rechazada' = payload.accion === 'aprobar' ? 'Aprobada' : 'Rechazada'
  const fechaDecision = new Date()

  let fechaPago: string | null = null
  let requiereRevisionManual = false

  if (nuevoEstado === 'Aprobada') {
    const calculo = calcularFechaPago(orden.terminosPago, fechaDecision)
    fechaPago = calculo.fechaPago
    requiereRevisionManual = calculo.requiereRevisionManual
  }

  await actualizarDecisionOrden(rowNumber, nuevoEstado, fechaDecision.toISOString().slice(0, 10), fechaPago)

  const ordenActualizada = { ...orden, estado: nuevoEstado, fechaDecision: fechaDecision.toISOString(), fechaPago }

  if (nuevoEstado === 'Aprobada') {
    try {
      await upsertControlPago(ordenActualizada, appUrl)
    } catch (err) {
      console.error('Orden aprobada pero falló actualizar Control de Pagos:', err)
    }
  }

  try {
    const refreshToken = await getRefreshTokenFor(APROBADOR_GMAIL_ACCOUNT)
    if (refreshToken) {
      const accessToken = await refreshAccessToken(refreshToken)
      const emailSolicitante = buildResultadoOrdenEmail(ordenActualizada, false)
      await sendGmail({ accessToken, from: APROBADOR_EMAIL, to: orden.creadoPorEmail, ...emailSolicitante })
    }
  } catch (err) {
    console.error('Orden decidida pero falló el correo al solicitante:', err)
  }

  if (nuevoEstado === 'Aprobada') {
    const detallePago = requiereRevisionManual
      ? 'No se pudo calcular la fecha de pago automáticamente (revisar términos de pago del proveedor manualmente).'
      : `Se pagará el <strong>${fechaPago}</strong>.`
    return paginaHtml('✅ Orden aprobada', `La orden ${orden.folio} fue aprobada. ${detallePago}`, '#33B44A')
  }

  return paginaHtml('❌ Orden rechazada', `La orden ${orden.folio} fue rechazada.`, '#dc2626')
}
