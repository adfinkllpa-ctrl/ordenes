interface Adjunto {
  filename: string
  content: Uint8Array
  mimeType: string
}

function encodeMimeMessage(opts: {
  from: string
  to: string
  subject: string
  html: string
  adjunto?: Adjunto
  adjuntos?: Adjunto[]
}): string {
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(opts.subject, 'utf8').toString('base64')}?=`
  const allAdjuntos = opts.adjuntos ? [opts.adjunto, ...opts.adjuntos].filter(Boolean) : (opts.adjunto ? [opts.adjunto] : [])

  if (allAdjuntos.length === 0) {
    const lines = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      `Subject: ${subjectEncoded}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      opts.html,
    ]
    return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url')
  }

  const boundary = `----ordenes-kllpa-${Date.now()}`
  const lines: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    opts.html,
    '',
  ]

  for (const adj of allAdjuntos) {
    const adjBase64 = Buffer.from(adj.content).toString('base64')
    const adjLineas = adjBase64.match(/.{1,76}/g)?.join('\r\n') ?? adjBase64
    lines.push(
      `--${boundary}`,
      `Content-Type: ${adj.mimeType}; name="${adj.filename}"`,
      `Content-Disposition: attachment; filename="${adj.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      adjLineas,
      ''
    )
  }

  lines.push(`--${boundary}--`)
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url')
}

export async function sendGmail(opts: {
  accessToken: string
  from: string
  to: string
  subject: string
  html: string
  adjunto?: Adjunto
  adjuntos?: Adjunto[]
}): Promise<void> {
  const raw = encodeMimeMessage(opts)
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail send falló (HTTP ${res.status}): ${err}`)
  }
}
