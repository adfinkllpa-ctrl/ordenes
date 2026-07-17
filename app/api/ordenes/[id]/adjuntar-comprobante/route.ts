import { NextRequest, NextResponse } from 'next/server'
import { getOrdenesSession } from '@/lib/ordenes-session'
import { findOrdenByFolio, marcarOrdenPagadaConComprobante, APROBADOR_GMAIL_ACCOUNT, APROBADOR_EMAIL, getRefreshTokenFor } from '@/lib/ordenes-data'
import { OC_SPREADSHEET_ID, ORDENES_TAB } from '@/lib/ordenes-config'
import { updateRange } from '@/lib/ordenes-sheets'
import { subirComprobanteADrive } from '@/lib/google-drive'
import { refreshAccessToken } from '@/lib/google-oauth'
import { sendGmail } from '@/lib/gmail-send'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getOrdenesSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const folio = id.trim()

  try {
    const formData = await req.formData()
    const comprobante = formData.get('comprobante') as File | null

    if (!comprobante || comprobante.size === 0) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }

    const ref = await findOrdenByFolio(folio)
    if (!ref) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

    // Verificar que el usuario es el creador de la orden
    if (ref.orden.creadoPorEmail.trim().toLowerCase() !== session.email.trim().toLowerCase()) {
      return NextResponse.json({ error: 'No tienes permiso para adjuntar comprobante a esta orden' }, { status: 403 })
    }

    const tiposComprobanteValidos = ['Factura', 'Boleta', 'Recibo por Honorarios']
    const esFactura = ref.orden.comprobanteSiNo === 'No'

    if (esFactura && !tiposComprobanteValidos.includes(ref.orden.tipoComprobante)) {
      return NextResponse.json({
        error: 'No se puede adjuntar factura cuando el tipo es "No tiene"'
      }, { status: 400 })
    }

    if (ref.orden.estado !== 'Pagada' && !esFactura) {
      return NextResponse.json({ error: 'Solo puedes adjuntar comprobante a órdenes pagadas' }, { status: 400 })
    }

    // Si ya tiene comprobante, no permitir sobrescribir
    if (ref.orden.comprobantePago && ref.orden.comprobantePago.trim() !== '') {
      return NextResponse.json({ error: 'Esta orden ya tiene comprobante adjunto' }, { status: 400 })
    }

    // Guardar archivo en Google Drive
    const buffer = await comprobante.arrayBuffer()
    const mimeType = comprobante.type || 'application/pdf'

    let comprobantePath: string
    try {
      comprobantePath = await subirComprobanteADrive(comprobante.name, Buffer.from(buffer), folio, mimeType)
      console.log('Archivo subido a Drive:', comprobantePath)
    } catch (err) {
      console.error('Error subiendo a Drive:', err)
      return NextResponse.json({ error: 'Error subiendo archivo a Drive', details: String(err) }, { status: 500 })
    }

    // Actualizar en sheets
    try {
      if (esFactura) {
        // Si es factura: solo actualizar columna T (comprobante), sin tocar estado ni fechaPago
        const range = `${ORDENES_TAB}!T${ref.rowNumber}:T${ref.rowNumber}`
        console.log('Actualizando rango:', range, 'con:', comprobantePath)
        await updateRange(OC_SPREADSHEET_ID, range, [[comprobantePath]])
      } else {
        // Si es comprobante de pago: marcar como pagada + actualizar estado y fechas
        await marcarOrdenPagadaConComprobante(ref.rowNumber, comprobantePath)
      }
    } catch (sheetErr) {
      console.error('Error actualizando Sheets:', sheetErr)
      throw sheetErr
    }

    // Enviar notificación al admin SOLO si es factura (no comprobante de pago)
    try {
      if (esFactura) {
        const refreshToken = await getRefreshTokenFor(ref.orden.creadoPorEmail)
        if (refreshToken) {
          const accessToken = await refreshAccessToken(refreshToken)
          const { subject, html } = buildFacturaAdjuntadaEmail(ref.orden, comprobante.name)

          const emailOpts: any = {
            accessToken,
            from: ref.orden.creadoPorEmail,
            to: APROBADOR_GMAIL_ACCOUNT,
            subject,
            html: html + `<p><a href="${comprobantePath}" style="background:#33B44A;color:#ffffff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">📄 Ver factura en Drive</a></p>`,
          }

          await sendGmail(emailOpts)
        }
      }
    } catch (err) {
      console.error('Falló enviar notificación al admin:', err)
      // No es fatal
    }

    return NextResponse.json({ ok: true, comprobantePath })
  } catch (err) {
    console.error('Error en adjuntar-comprobante:', err)
    const mensaje = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      error: 'Error al procesar el archivo',
      details: mensaje
    }, { status: 500 })
  }
}

function buildFacturaAdjuntadaEmail(orden: any, nombreArchivo: string): { subject: string; html: string } {
  return {
    subject: `📄 Factura adjuntada — Orden N° ${orden.folio}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;max-width:640px;">
        <h2 style="color:#33B44A;">📄 Factura/Boleta Adjuntada</h2>
        <p><strong>${orden.creadoPorNombre}</strong> acaba de adjuntar la factura, boleta o recibo del proveedor para la orden.</p>

        <div style="background:#f0f9ff;border-left:4px solid #002F5D;padding:12px;margin:16px 0;">
          <p style="margin:0;"><strong>Detalles:</strong></p>
          <p style="margin:8px 0;"><strong>Orden N°:</strong> ${orden.folio}</p>
          <p style="margin:8px 0;"><strong>Proveedor:</strong> ${orden.proveedorRazonSocial}</p>
          <p style="margin:8px 0;"><strong>Monto:</strong> S/.${orden.montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          <p style="margin:8px 0;"><strong>Archivo:</strong> ${nombreArchivo}</p>
        </div>

        <p style="font-size:12px;color:#6b7280;">La factura está adjunta en este correo.</p>
      </div>`
  }
}

function buildComprobanteAdjuntadoEmail(orden: any, nombreArchivo: string): { subject: string; html: string } {
  return {
    subject: `✅ Comprobante de pago adjuntado — Orden N° ${orden.folio}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#111827;max-width:640px;">
        <h2 style="color:#33B44A;">✅ Comprobante de Pago Adjuntado</h2>
        <p><strong>${orden.creadoPorNombre}</strong> acaba de adjuntar el comprobante de pago para la orden.</p>

        <div style="background:#f0f9ff;border-left:4px solid #002F5D;padding:12px;margin:16px 0;">
          <p style="margin:0;"><strong>Detalles:</strong></p>
          <p style="margin:8px 0;"><strong>Orden N°:</strong> ${orden.folio}</p>
          <p style="margin:8px 0;"><strong>Proveedor:</strong> ${orden.proveedorRazonSocial}</p>
          <p style="margin:8px 0;"><strong>Monto:</strong> S/.${orden.montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
          <p style="margin:8px 0;"><strong>Archivo:</strong> ${nombreArchivo}</p>
        </div>

        <p style="font-size:12px;color:#6b7280;">El comprobante está adjunto en este correo.</p>
      </div>`
  }
}
