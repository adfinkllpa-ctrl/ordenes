import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { getOrdenesSession } from '@/lib/ordenes-session'
import {
  crearOrden, getProveedorByDoc, listOrdenesPorEmail, getRefreshTokenFor,
  APROBADOR_EMAIL, type LineaOrden,
} from '@/lib/ordenes-data'
import { refreshAccessToken } from '@/lib/google-oauth'
import { sendGmail } from '@/lib/gmail-send'
import { makeDecisionToken } from '@/lib/order-tokens'
import { buildNuevaOrdenEmail } from '@/lib/ordenes-email'
import { generarPdfOrden } from '@/lib/ordenes-pdf'

interface CrearOrdenBody {
  clasificacionGasto: string
  tipoComprobante: string
  detalleGasto: string
  comentarios: string
  comprobanteSiNo?: 'Sí' | 'No'
  proveedorDoc: string
  lineas: LineaOrden[]
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} no configurada`)
  return v
}

export async function GET() {
  const session = await getOrdenesSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const ordenes = await listOrdenesPorEmail(session.email)
  return NextResponse.json({ ordenes })
}

export async function POST(req: NextRequest) {
  const session = await getOrdenesSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const body: CrearOrdenBody = {
    clasificacionGasto: formData.get('clasificacionGasto') as string,
    tipoComprobante: formData.get('tipoComprobante') as string,
    detalleGasto: formData.get('detalleGasto') as string,
    comentarios: formData.get('comentarios') as string,
    comprobanteSiNo: (formData.get('comprobanteSiNo') as 'Sí' | 'No') || 'No',
    proveedorDoc: formData.get('proveedorDoc') as string,
    lineas: JSON.parse(formData.get('lineas') as string),
  }

  if (!body.proveedorDoc || !body.clasificacionGasto || !body.tipoComprobante || !body.detalleGasto) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }
  if (!Array.isArray(body.lineas) || body.lineas.length === 0) {
    return NextResponse.json({ error: 'La orden debe tener al menos una línea' }, { status: 400 })
  }

  const proveedor = await getProveedorByDoc(body.proveedorDoc)
  if (!proveedor) {
    return NextResponse.json({ error: 'El proveedor no existe en la base de proveedores' }, { status: 400 })
  }

  const montoTotal = body.lineas.reduce((sum, l) => sum + (Number(l.total) || 0), 0)
  if (montoTotal <= 0) {
    return NextResponse.json({ error: 'El monto total debe ser mayor a cero' }, { status: 400 })
  }

  const refreshToken = await getRefreshTokenFor(session.email)
  if (!refreshToken) {
    return NextResponse.json({ error: 'No tienes Gmail conectado. Vuelve a iniciar sesión con Google.' }, { status: 400 })
  }

  const orden = await crearOrden({
    creadoPorNombre: session.nombre,
    creadoPorEmail: session.email,
    clasificacionGasto: body.clasificacionGasto,
    tipoComprobante: body.tipoComprobante,
    detalleGasto: body.detalleGasto,
    comentarios: body.comentarios ?? '',
    comprobanteSiNo: body.comprobanteSiNo ?? 'No',
    proveedorDoc: body.proveedorDoc,
    proveedorRazonSocial: proveedor.razonSocial,
    terminosPago: proveedor.terminosPago,
    lineas: body.lineas,
    montoTotal,
  })

  const appUrl = requireEnv('APP_URL')
  const tokenAprobar = makeDecisionToken(orden.folio, 'aprobar')
  const tokenRechazar = makeDecisionToken(orden.folio, 'rechazar')
  const linkAprobar = `${appUrl}/api/ordenes/${encodeURIComponent(orden.folio)}/decidir?token=${tokenAprobar}`
  const linkRechazar = `${appUrl}/api/ordenes/${encodeURIComponent(orden.folio)}/decidir?token=${tokenRechazar}`

  const { subject, html } = buildNuevaOrdenEmail(orden, linkAprobar, linkRechazar)

  try {
    const accessToken = await refreshAccessToken(refreshToken)
    const pdfBytes = await generarPdfOrden(orden, proveedor)
    const adjuntos: Array<{ filename: string; content: Buffer; mimeType: string }> = [
      {
        filename: `Orden_de_Compra_${orden.folio}.pdf`,
        content: Buffer.from(pdfBytes),
        mimeType: 'application/pdf',
      },
    ]

    // Si hay comprobante adjunto en la OC, incluirlo en el correo
    const comprobanteFile = formData.get('comprobante') as File | null
    if (comprobanteFile && body.comprobanteSiNo === 'Sí') {
      try {
        const comprobanteBuffer = Buffer.from(await comprobanteFile.arrayBuffer())
        const comprobanteExt = comprobanteFile.name.split('.').pop()?.toLowerCase() || 'pdf'
        adjuntos.push({
          filename: `Comprobante_${orden.folio}.${comprobanteExt}`,
          content: comprobanteBuffer,
          mimeType: comprobanteFile.type || 'application/octet-stream',
        })
      } catch (err) {
        console.error('Error procesando comprobante:', err)
      }
    }

    await sendGmail({
      accessToken,
      from: session.email,
      to: APROBADOR_EMAIL,
      subject,
      html,
      adjunto: adjuntos[0],
      adjuntos: adjuntos.length > 1 ? adjuntos.slice(1) : undefined,
    })
  } catch (err) {
    console.error('Orden creada pero falló el envío de correo:', err)
    return NextResponse.json({
      orden,
      warning: 'La orden se guardó, pero no se pudo enviar el correo de aprobación. Contacta al administrador.',
    }, { status: 207 })
  }

  return NextResponse.json({ orden })
}
