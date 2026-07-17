'use client'
import React, { useEffect, useState } from 'react'
import { Loader2, AlertCircle, Download } from 'lucide-react'

interface OrdenPendiente {
  folio: string
  creadoPorNombre: string
  detalleGasto: string
  tipoComprobante: string
  montoTotal: number
  fechaPago: string
  comentarios: string
  comprobanteSiNo: string
}

export default function ControlPagosPage() {
  const [ordenes, setOrdenes] = useState<OrdenPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagarModal, setPagarModal] = useState<OrdenPendiente | null>(null)
  const [comprobante, setComprobante] = useState<File | null>(null)
  const [comentariosForm, setComentariosForm] = useState('')
  const [marcandoPago, setMarcandoPago] = useState(false)

  useEffect(() => {
    fetchOrdenesPendientes()
  }, [])

  async function fetchOrdenesPendientes() {
    try {
      const res = await fetch('/api/ordenes/pendientes-pago')
      if (!res.ok) throw new Error('No autorizado')
      const data = await res.json()
      setOrdenes(data.ordenes || [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function marcarComoPagada() {
    if (!pagarModal) return
    setMarcandoPago(true)

    try {
      const formData = new FormData()
      formData.append('folio', pagarModal.folio)
      if (comprobante) formData.append('comprobante', comprobante)
      if (comentariosForm) formData.append('comentarios', comentariosForm)

      const res = await fetch('/api/ordenes/marcar-pagada', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al marcar como pagada')
      }

      setPagarModal(null)
      setComprobante(null)
      setComentariosForm('')
      await fetchOrdenesPendientes()
    } catch (err) {
      alert('Error: ' + String(err))
    } finally {
      setMarcandoPago(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2" style={{ color: '#002F5D' }}>
          Control de Pagos
        </h1>
        <p className="text-gray-600 mb-6">
          {ordenes.length} órdenes aprobadas pendientes de pago
        </p>

        {ordenes.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            No hay órdenes pendientes de pago
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#002F5D' }} className="text-white">
                  <th className="px-6 py-3 text-left text-sm font-semibold">OC</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Creado por</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Detalle</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Tipo</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Monto</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">F. Pago</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((orden) => {
                  const hoy = new Date().toISOString().slice(0, 10)
                  const vencida = orden.fechaPago < hoy
                  return (
                    <tr key={orden.folio} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-4 font-bold text-blue-600">#{orden.folio}</td>
                      <td className="px-6 py-4 text-sm">{orden.creadoPorNombre}</td>
                      <td className="px-6 py-4 text-sm">{orden.detalleGasto}</td>
                      <td className="px-6 py-4 text-sm">{orden.tipoComprobante}</td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        S/.{orden.montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-6 py-4 text-sm font-semibold ${vencida ? 'text-red-600' : ''}`}>
                        {orden.fechaPago} {vencida && '⏰'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setPagarModal(orden)
                            setComprobante(null)
                            setComentariosForm('')
                          }}
                          style={{ backgroundColor: '#33B44A' }}
                          className="text-white px-4 py-2 rounded text-sm font-semibold hover:opacity-90"
                        >
                          💳 Pagar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal de pago */}
        {pagarModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-1" style={{ color: '#002F5D' }}>
                  Confirmar Pago
                </h2>
                <p className="text-gray-600 text-sm mb-6">Orden N° {pagarModal.folio}</p>

                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-sm text-gray-600">Detalle</p>
                    <p className="font-semibold">{pagarModal.detalleGasto}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Monto</p>
                    <p className="text-xl font-bold" style={{ color: '#33B44A' }}>
                      S/.{pagarModal.montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      📎 Adjunta comprobante de pago
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setComprobante(e.target.files?.[0] || null)}
                        className="hidden"
                        id="comprobante-input"
                      />
                      <label htmlFor="comprobante-input" className="cursor-pointer">
                        <Download size={20} className="mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">
                          {comprobante ? comprobante.name : 'Arrastra o haz clic para seleccionar'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG — máx 5MB</p>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      💬 Comentarios (opcional)
                    </label>
                    <textarea
                      value={comentariosForm}
                      onChange={(e) => setComentariosForm(e.target.value)}
                      placeholder="Ej: Transferencia BCP ref 12345"
                      className="w-full border rounded px-3 py-2 text-sm"
                      rows={3}
                    />
                  </div>

                  <p className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                    📧 Se enviará correo de confirmación al solicitante con los comprobantes
                  </p>
                </div>

                <div className="flex gap-3 mt-6 pt-4 border-t">
                  <button
                    onClick={() => setPagarModal(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded font-semibold hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={marcarComoPagada}
                    disabled={marcandoPago}
                    style={{ backgroundColor: '#33B44A' }}
                    className="flex-1 text-white px-4 py-2 rounded font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {marcandoPago ? <Loader2 className="animate-spin inline" size={16} /> : '✓ Pagar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
