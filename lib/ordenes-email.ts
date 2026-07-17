import type { Orden } from './ordenes-data'

function formatMonto(n: number): string {
  return `S/.${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
}

export function buildNuevaOrdenEmail(orden: Orden, linkAprobar: string, linkRechazar: string): { subject: string; html: string } {
  const subject = `Orden de Compra ${orden.folio} - ${orden.creadoPorNombre}`
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;max-width:640px;">
      <h2 style="color:#002F5D;">Orden de Compra ${orden.folio}</h2>
      <p><strong>Clasificación de gasto:</strong> ${orden.clasificacionGasto}<br/><strong>Detalle de gasto:</strong> ${orden.detalleGasto}</p>
      <p><strong>Tipo de comprobante:</strong> ${orden.tipoComprobante}</p>
      <p><strong>Términos de pago:</strong> ${orden.terminosPago}</p>
      <p><strong>Proveedor:</strong> ${orden.proveedorRazonSocial}<br/><strong>RUC / DNI:</strong> ${orden.proveedorDoc}</p>
      ${orden.comentarios ? `<p><strong>Comentarios:</strong> ${orden.comentarios}</p>` : ''}
      <p style="margin-top:12px;font-size:16px;"><strong>Total: ${formatMonto(orden.montoTotal)}</strong></p>
      <p style="font-size:13px;color:#6b7280;">Se adjunta el detalle completo en PDF.</p>
      <div style="margin-top:24px;">
        <a href="${linkAprobar}" style="background:#33B44A;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-right:12px;">✅ Aprobar</a>
        <a href="${linkRechazar}" style="background:#dc2626;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">❌ Rechazar</a>
      </div>
      <p style="margin-top:24px;font-size:12px;color:#6b7280;">Este enlace es válido por 14 días y de un solo uso.</p>
    </div>`
  return { subject, html }
}

export function buildResultadoOrdenEmail(orden: Orden, paraAdmin: boolean): { subject: string; html: string } {
  const aprobada = orden.estado === 'Aprobada'
  const subject = `Orden ${orden.folio} ${aprobada ? 'aprobada ✅' : 'rechazada ❌'}`

  const fechaPagoTexto = aprobada
    ? (orden.fechaPago
        ? `Se pagará el <strong>${orden.fechaPago}</strong> (según términos de pago del proveedor).`
        : `No se pudo calcular la fecha de pago automáticamente a partir de los términos de pago del proveedor — requiere revisión manual.`)
    : ''

  const saludo = paraAdmin
    ? `Confirmación: acabas de ${aprobada ? 'aprobar' : 'rechazar'} la orden ${orden.folio}.`
    : `Tu orden ${orden.folio} fue ${aprobada ? 'aprobada' : 'rechazada'}.`

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;max-width:640px;">
      <h2 style="color:${aprobada ? '#33B44A' : '#dc2626'};">${aprobada ? 'Orden aprobada' : 'Orden rechazada'} — ${orden.folio}</h2>
      <p>${saludo}</p>
      <p><strong>Proveedor:</strong> ${orden.proveedorRazonSocial} &nbsp; | &nbsp; <strong>Total:</strong> ${formatMonto(orden.montoTotal)}</p>
      ${orden.comentarios ? `<p><strong>Comentarios:</strong> ${orden.comentarios}</p>` : ''}
      ${fechaPagoTexto ? `<p>${fechaPagoTexto}</p>` : ''}
    </div>`
  return { subject, html }
}

export function buildPagoConfirmacionEmail(orden: Orden, comprobantePagoPath: string, comentariosAdicionales: string, appUrl?: string): { subject: string; html: string } {
  const subject = `✅ Orden pagada — Orden N° ${orden.folio}`
  const faltaFactura = orden.comprobanteSiNo === 'No' && orden.tipoComprobante !== 'No tiene'
  const faltaComprobantePago = !comprobantePagoPath || comprobantePagoPath.trim() === ''

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;max-width:640px;">
      <h2 style="color:#33B44A;">✅ Orden Pagada — ${orden.folio}</h2>
      <p>Tu orden ha sido procesada y pagada exitosamente.</p>

      <div style="background:#f0f9ff;border-left:4px solid #002F5D;padding:12px;margin:16px 0;">
        <p style="margin:0;"><strong>Detalles:</strong></p>
        <p style="margin:8px 0;"><strong>Proveedor:</strong> ${orden.proveedorRazonSocial}</p>
        <p style="margin:8px 0;"><strong>Monto:</strong> ${formatMonto(orden.montoTotal)}</p>
        <p style="margin:8px 0;"><strong>Fecha de Pago Real:</strong> ${new Date().toISOString().slice(0, 10)}</p>
        ${orden.comentarios ? `<p style="margin:8px 0;"><strong>Comentarios de la Orden:</strong> ${orden.comentarios}</p>` : ''}
      </div>

      ${comentariosAdicionales ? `
        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px;margin:16px 0;">
          <p style="margin:0;"><strong>Nota del Pago:</strong></p>
          <p style="margin:8px 0;">${comentariosAdicionales}</p>
        </div>
      ` : ''}

      ${faltaFactura ? `
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px;margin:16px 0;">
          <p style="margin:0;"><strong>⚠️ Falta adjuntar factura/boleta del proveedor:</strong></p>
          <p style="margin:8px 0;">Por favor, adjunta la factura, boleta o recibo del proveedor en el panel de Mis Órdenes para completar el registro de esta orden.</p>
          ${appUrl ? `<p style="margin:12px 0;"><a href="${appUrl}/ordenes" style="background:#33B44A;color:#ffffff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">📋 Ir a Mis Órdenes</a></p>` : ''}
        </div>
      ` : ''}

      ${faltaComprobantePago ? `
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px;margin:16px 0;">
          <p style="margin:0;"><strong>⚠️ Falta adjuntar comprobante de pago:</strong></p>
          <p style="margin:8px 0;">Por favor, adjunta el comprobante de la transferencia o pago en el panel de Mis Órdenes.</p>
          ${appUrl ? `<p style="margin:12px 0;"><a href="${appUrl}/ordenes" style="background:#33B44A;color:#ffffff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">📋 Adjuntar en Mis Órdenes</a></p>` : ''}
        </div>
      ` : ''}

      <p style="font-size:13px;color:#6b7280;margin-top:16px;">
        Si tienes preguntas sobre este pago, contacta al equipo de finanzas.
      </p>
    </div>`
  return { subject, html }
}
