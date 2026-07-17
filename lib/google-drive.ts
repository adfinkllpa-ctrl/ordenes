import { google } from 'googleapis'

const COMPROBANTES_FOLDER_ID = '1VG3XvGvBb1TGjmdSrBnGYTVmNY-hb7L5'

export async function subirComprobanteADrive(
  nombreArchivo: string,
  buffer: Buffer,
  folio: string,
  mimeType: string
): Promise<string> {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string)
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })

  const drive = google.drive({ version: 'v3', auth })

  // Nombre del archivo: fact_FOLIO.ext
  const ext = nombreArchivo.split('.').pop() || 'pdf'
  const nuevoNombre = `fact_${folio}.${ext}`

  const fileMetadata = {
    name: nuevoNombre,
    parents: [COMPROBANTES_FOLDER_ID],
  }

  const media = {
    mimeType,
    body: buffer,
  }

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, webViewLink',
  })

  if (!file.data.id) {
    throw new Error('No se pudo obtener el ID del archivo en Drive')
  }

  // Obtener el link compartible
  const fileLink = `https://drive.google.com/file/d/${file.data.id}/view`
  return fileLink
}
