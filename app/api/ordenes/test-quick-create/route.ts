import { NextRequest, NextResponse } from 'next/server'
import { crearOrden, getProveedorByDoc } from '@/lib/ordenes-data'
import { generarPdfOrden } from '@/lib/ordenes-pdf'
import { sendGmail } from '@/lib/gmail-send'
import { makeDecisionToken } from '@/lib/order-tokens'
import { buildNuevaOrdenEmail } from '@/lib/ordenes-email'
import { refreshAccessToken } from '@/lib/google-oauth'
import { getRefreshTokenFor, APROBADOR_EMAIL } from '@/lib/ordenes-data'
import { readRange, getTabTitleByGid } from '@/lib/ordenes-sheets'
import { PROVEEDORES_SPREADSHEET_ID, PROVEEDORES_GID, PROVEEDORES_RANGE, PROVEEDORES_COLS } from '@/lib/ordenes-config'

// ⚠️ SOLO PARA TESTING EN DESARROLLO - crear orden de prueba rápida
// Este endpoint está pensado para testing local del flujo de órdenes.
// NO debe estar en producción.

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Solo disponible en desarrollo' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email') || 'test@test.com'
    const nombre = searchParams.get('nombre') || 'Test Order'
    const detalle = searchParams.get('detalle') || 'Test - Servicios varios'

    // Datos de prueba - usa un proveedor real del sheet
    // Para ello, intentamos algunos RUCs comunes de KLLPA
    const docsAProbar = ['20123456789', '20456789012', '10123456789']
    let proveedor = null
    let proveedorDoc = ''

    for (const doc of docsAProbar) {
      const p = await getProveedorByDoc(doc)
      if (p) {
        proveedor = p
        proveedorDoc = doc
        break
      }
    }

    if (!proveedor) {
      // Si no encontramos en la lista fija, leer el sheet de proveedores directamente
      const tab = await getTabTitleByGid(PROVEEDORES_SPREADSHEET_ID, PROVEEDORES_GID)
      const rows = await readRange(PROVEEDORES_SPREADSHEET_ID, `${tab}!${PROVEEDORES_RANGE}`)
      if (rows.length > 0) {
        const firstRow = rows[0]
        proveedorDoc = firstRow[PROVEEDORES_COLS.nDocumento]
        const prov = await getProveedorByDoc(proveedorDoc)
        if (prov) proveedor = prov
      }
    }

    if (!proveedor) {
      return NextResponse.json({
        error: 'Proveedor de prueba no encontrado. Asegúrate de que exista en el sheet de proveedores.',
        doc: proveedorDoc
      }, { status: 400 })
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3003'
    const orden = await crearOrden({
      creadoPorNombre: nombre,
      creadoPorEmail: email,
      clasificacionGasto: 'Prev. SSGG',
      tipoComprobante: 'Factura',
      detalleGasto: detalle,
      comentarios: 'Orden creada desde endpoint de testing',
      comprobanteSiNo: 'No',
      proveedorDoc,
      proveedorRazonSocial: proveedor.razonSocial,
      terminosPago: proveedor.terminosPago,
      lineas: [
        {
          codigo: '001',
          descripcion: 'Servicio de prueba',
          fechaConclusion: '2026-07-20',
          cantidad: 1,
          igv: true,
          precioUnitario: 1000,
          total: 1000,
        },
      ],
      montoTotal: 1000,
    })

    // Generar PDF para verificar
    const pdfBytes = await generarPdfOrden(orden, proveedor)

    // Intentar enviar correo de notificación (si hay token disponible)
    try {
      const tokenAprobar = makeDecisionToken(orden.folio, 'aprobar')
      const tokenRechazar = makeDecisionToken(orden.folio, 'rechazar')
      const linkAprobar = `${appUrl}/api/ordenes/${encodeURIComponent(orden.folio)}/decidir?token=${tokenAprobar}`
      const linkRechazar = `${appUrl}/api/ordenes/${encodeURIComponent(orden.folio)}/decidir?token=${tokenRechazar}`

      const { subject, html } = buildNuevaOrdenEmail(orden, linkAprobar, linkRechazar)

      const refreshToken = await getRefreshTokenFor(email)
      if (refreshToken) {
        const accessToken = await refreshAccessToken(refreshToken)
        await sendGmail({
          accessToken,
          from: email,
          to: APROBADOR_EMAIL,
          subject,
          html,
          adjunto: {
            filename: `Orden_de_Compra_${orden.folio}.pdf`,
            content: pdfBytes,
            mimeType: 'application/pdf',
          },
        })
        return NextResponse.json({
          orden,
          success: true,
          message: `Orden de prueba creada exitosamente desde ${email}. Correo enviado al aprobador.`,
          pdfSize: pdfBytes.length,
        })
      } else {
        return NextResponse.json({
          orden,
          success: true,
          message: `Orden de prueba creada desde ${email}. Token de Gmail no disponible para enviar correo.`,
          pdfSize: pdfBytes.length,
        })
      }
    } catch (err) {
      console.error('Error enviando correo:', err)
      return NextResponse.json({
        orden,
        success: true,
        warning: 'Orden creada pero falló el envío de correo de prueba.',
        error: String(err),
      })
    }
  } catch (err) {
    console.error('Error en test-quick-create:', err)
    return NextResponse.json({
      error: 'Error creando orden de prueba',
      details: String(err)
    }, { status: 500 })
  }
}
