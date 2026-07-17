import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join } from 'path'
import { getOrdenesSession } from '@/lib/ordenes-session'
import { findOrdenByFolio, marcarOrdenPagadaConComprobante, upsertControlPago, APROBADOR_GMAIL_ACCOUNT, APROBADOR_EMAIL, getRefreshTokenFor } from '@/lib/ordenes-data'
import { refreshAccessToken } from '@/lib/google-oauth'
import { sendGmail } from '@/lib/gmail-send'
import { buildPagoConfirmacionEmail } from '@/lib/ordenes-email'

export async function POST(req: NextRequest) {
  const session = await getOrdenesSession()
  if (!session.isLoggedIn) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.email.trim().toLowerCase() !== APROBADOR_GMAIL_ACCOUNT.trim().toLowerCase()) {
    return NextResponse.json({ error: 'Solo el aprobador puede marcar órdenes como pagadas' }, { status: 403 })
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3003'

  try {
    const formData = await req.formData()
    const folio = (formData.get('folio') as string)?.trim()
    const comprobante = formData.get('comprobante') as File | null
    const comentariosAdicionales = (formData.get('comentarios') as string)?.trim() || ''

    if (!folio) {
      return NextResponse.json({ error: 'Folio requerido' }, { status: 400 })
    }

    const ref = await findOrdenByFolio(folio)
    if (!ref) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    if (ref.orden.estado !== 'Aprobada') {
      return NextResponse.json({ error: `La orden está en estado "${ref.orden.estado}", no se puede marcar como pagada` }, { status: 400 })
    }

    // Guardar comprobante si existe
    let comprobantePath = ''
    if (comprobante && comprobante.size > 0) {
      const buffer = await comprobante.arrayBuffer()
      const ext = comprobante.name.split('.').pop()?.toLowerCase() || 'pdf'
      const filename = `pago_${folio}_${Date.now()}.${ext}`
      const dir = join(process.cwd(), 'public', 'comprobantes-pago')

      try {
        await mkdir(dir, { recursive: true })
        const filepath = join(dir, filename)
        await writeFile(filepath, Buffer.from(buffer))
        comprobantePath = `/comprobantes-pago/${filename}`
      } catch (err) {
        console.error('Error guardando comprobante:', err)
        // No es fatal, continuamos sin archivo
      }
    }

    // Marcar como pagada
    await marcarOrdenPagadaConComprobante(ref.rowNumber, comprobantePath)

    // Actualizar Control de Pagos
    try {
      const ordenActualizada = { ...ref.orden, estado: 'Pagada' as const, comprobantePago: comprobantePath }
      await upsertControlPago(ordenActualizada, appUrl)
    } catch (err) {
      console.error('Falló actualizar Control de Pagos:', err)
    }

    // Enviar correo al solicitante
    try {
      const refreshToken = await getRefreshTokenFor(APROBADOR_GMAIL_ACCOUNT)
      if (refreshToken) {
        const accessToken = await refreshAccessToken(refreshToken)
        const { subject, html } = buildPagoConfirmacionEmail(ref.orden, comprobantePath, comentariosAdicionales, appUrl)

        const emailOpts: any = {
          accessToken,
          from: APROBADOR_EMAIL,
          to: ref.orden.creadoPorEmail,
          subject,
          html,
        }

        // Adjuntar comprobante si existe
        if (comprobantePath) {
          try {
            const filepath = join(process.cwd(), 'public', comprobantePath)
            const fileBuffer = await readFile(filepath)
            const filename = comprobantePath.split('/').pop() || 'comprobante'
            emailOpts.adjunto = {
              filename,
              content: fileBuffer,
              mimeType: comprobantePath.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
            }
          } catch (err) {
            console.error('Error leyendo comprobante para adjuntar:', err)
          }
        }

        await sendGmail(emailOpts)
      }
    } catch (err) {
      console.error('Falló enviar correo de confirmación:', err)
      // No es fatal
    }

    return NextResponse.json({ ok: true, comprobantePath })
  } catch (err) {
    console.error('Error en marcar-pagada:', err)
    return NextResponse.json({
      error: 'Error procesando el pago',
      details: String(err)
    }, { status: 500 })
  }
}
