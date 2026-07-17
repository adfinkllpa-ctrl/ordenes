'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Upload, X } from 'lucide-react'

interface Orden {
  folio: string
  fechaCreacion: string
  proveedorRazonSocial: string
  montoTotal: number
  estado: 'Pendiente de aprobación' | 'Aprobada' | 'Rechazada' | 'Pagada'
  fechaPago: string | null
  comprobanteSiNo?: 'Sí' | 'No' | ''
  comprobantePago?: string
}

const ESTADO_STYLE: Record<Orden['estado'], string> = {
  'Pendiente de aprobación': 'bg-amber-50 text-amber-700 border-amber-200',
  Aprobada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rechazada: 'bg-red-50 text-red-700 border-red-200',
  Pagada: 'bg-sky-50 text-sky-700 border-sky-200',
}

const APROBADOR_EMAIL = 'ad.fin.kllpa@gmail.com'

export default function MisOrdenesPage() {
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [esAprobador, setEsAprobador] = useState(false)
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [modalFolio, setModalFolio] = useState<string | null>(null)
  const [uploadingFolio, setUploadingFolio] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    async function cargar() {
      const [res, meRes] = await Promise.all([fetch('/api/ordenes'), fetch('/api/ordenes/me')])
      if (res.status === 401) {
        setLoggedIn(false)
        setLoading(false)
        return
      }
      const data = await res.json()
      setOrdenes(data.ordenes ?? [])
      if (meRes.ok) {
        const me = await meRes.json()
        setEsAprobador(me.isLoggedIn && me.email?.trim().toLowerCase() === APROBADOR_EMAIL.toLowerCase())
      }
      setLoading(false)
    }
    cargar()
  }, [])

  const handleAdjuntarComprobante = async (folio: string, file: File) => {
    setUploadingFolio(folio)
    setUploadMessage(null)
    try {
      const formData = new FormData()
      formData.append('comprobante', file)
      const res = await fetch(`/api/ordenes/${folio}/adjuntar-comprobante`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        setUploadMessage({ type: 'success', text: '✅ Comprobante adjuntado. El admin recibirá una notificación.' })
        setModalFolio(null)
        // Recargar órdenes
        const res2 = await fetch('/api/ordenes')
        const data = await res2.json()
        setOrdenes(data.ordenes ?? [])
      } else {
        const errorData = await res.json()
        const errorMsg = errorData.details || errorData.error || 'Error al adjuntar comprobante'
        setUploadMessage({ type: 'error', text: `❌ ${errorMsg}` })
      }
    } catch (err) {
      setUploadMessage({ type: 'error', text: 'Error al adjuntar comprobante' })
    } finally {
      setUploadingFolio(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Debes iniciar sesión para ver tus órdenes.</p>
          <a href="/api/ordenes/auth/start" className="text-white px-5 py-2.5 rounded-xl font-semibold" style={{ background: '#33B44A' }}>
            Conectar con Google
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: '#002F5D' }}>Mis Órdenes de Compra</h1>
          <div className="flex items-center gap-2">
            {esAprobador && (
              <Link href="/ordenes/pagos" className="text-sm font-semibold text-white px-4 py-2 rounded-lg" style={{ background: '#002F5D' }}>
                Pagos pendientes
              </Link>
            )}
            <Link href="/ordenes/nueva" className="text-sm font-semibold text-white px-4 py-2 rounded-lg" style={{ background: '#33B44A' }}>
              + Nueva orden
            </Link>
          </div>
        </div>

        {uploadMessage && (
          <div className={`p-3 rounded-lg text-sm font-medium ${uploadMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {uploadMessage.text}
          </div>
        )}

        {ordenes.length === 0 ? (
          <p className="text-gray-400 text-sm">Aún no has creado ninguna orden.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="text-left py-2.5 px-4">Orden</th>
                  <th className="text-left py-2.5 px-4">Proveedor</th>
                  <th className="text-right py-2.5 px-4">Monto</th>
                  <th className="text-center py-2.5 px-4">Estado</th>
                  <th className="text-center py-2.5 px-4">Fecha de pago</th>
                  <th className="text-center py-2.5 px-4">Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map(o => {
                  const yaAdjunto = o.comprobantePago && o.comprobantePago.trim() !== ''
                  const puedeAdjuntarFactura = o.comprobanteSiNo === 'No' && ['Factura', 'Boleta', 'Recibo por Honorarios'].includes(o.tipoComprobante) && !yaAdjunto
                  return (
                    <tr key={o.folio} className="border-t border-gray-100">
                      <td className="py-2.5 px-4 font-medium">{o.folio}</td>
                      <td className="py-2.5 px-4">{o.proveedorRazonSocial}</td>
                      <td className="py-2.5 px-4 text-right">S/.{o.montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${ESTADO_STYLE[o.estado]}`}>{o.estado}</span>
                      </td>
                      <td className="py-2.5 px-4 text-center text-gray-500">{o.fechaPago ?? '—'}</td>
                      <td className="py-2.5 px-4 text-center">
                        {puedeAdjuntarFactura ? (
                          <button
                            onClick={() => setModalFolio(o.folio)}
                            className="text-xs font-semibold px-2 py-1 rounded bg-orange-50 text-orange-600 hover:bg-orange-100"
                          >
                            <Upload size={12} className="inline mr-1" />Adjuntar
                          </button>
                        ) : yaAdjunto ? (
                          <span className="text-green-600 font-bold">✓</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {modalFolio && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">
                  {ordenes.find(o => o.folio === modalFolio)?.comprobanteSiNo === 'No'
                    ? 'Adjuntar Factura/Boleta'
                    : 'Adjuntar Comprobante de Pago'}
                </h2>
                <button onClick={() => setModalFolio(null)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-2">Orden N° {modalFolio}</p>
              <p className="text-xs text-gray-500 mb-4">
                {ordenes.find(o => o.folio === modalFolio)?.comprobanteSiNo === 'No'
                  ? 'Factura, boleta o recibo del proveedor'
                  : 'Comprobante de la transferencia o pago'}
              </p>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files[0]
                  if (file) handleAdjuntarComprobante(modalFolio, file)
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  type="file"
                  id="file-input"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleAdjuntarComprobante(modalFolio, file)
                  }}
                  accept=".pdf,.jpg,.jpeg,.png"
                  disabled={uploadingFolio === modalFolio}
                />
                <label htmlFor="file-input" className="cursor-pointer block">
                  <Upload size={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">PDF, JPG, PNG</p>
                  <p className="text-xs text-gray-500">Arrastra o haz clic</p>
                </label>
              </div>
              {uploadingFolio === modalFolio && <p className="text-xs text-gray-500 mt-3">Subiendo...</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
