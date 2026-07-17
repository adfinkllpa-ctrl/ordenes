'use client'
import React, { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle, Plus, Trash2 } from 'lucide-react'

interface Proveedor {
  razonSocial: string
  direccion: string
  metodoPago: string
  banco: string
  numeroCuenta: string
  cci: string
  yapePlin: string
  titularCuenta: string
  terminosPago: string
}

function tieneValor(v: string | undefined): boolean {
  return Boolean(v && v.trim() !== '' && v.trim() !== '-')
}

interface Linea {
  id: string
  codigo: string
  descripcion: string
  fechaConclusion: string
  cantidad: number
  igv: boolean
  precioUnitario: number
}

function nuevaLinea(igv: boolean): Linea {
  return {
    id: Math.random().toString(36).slice(2),
    codigo: '',
    descripcion: '',
    fechaConclusion: '',
    cantidad: 1,
    igv,
    precioUnitario: 0,
  }
}

// El total mostrado siempre es sin IGV — el admin lo agrega manualmente al pagar.
function totalLinea(l: Linea): number {
  return l.cantidad * l.precioUnitario
}

// Factura/Boleta llevan IGV por defecto; Recibo por Honorarios y "No tiene" no.
function igvPorDefecto(tipoComprobante: string): boolean {
  return tipoComprobante === 'Factura' || tipoComprobante === 'Boleta'
}

const ERROR_MENSAJES: Record<string, string> = {
  sesion_invalida: 'La sesión de inicio de sesión expiró o es inválida. Intenta de nuevo.',
  correo_no_autorizado: 'Tu correo no está en la lista de personas autorizadas para crear órdenes.',
  error_conexion: 'Ocurrió un error conectando con Google. Intenta de nuevo.',
  reautoriza_en_myaccount_google_com: 'Necesitamos que reautorices el acceso. Ve a myaccount.google.com/permissions, quita el acceso de esta app y vuelve a conectar.',
}

function ConectarGoogle({ error }: { error: string | null }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold mb-2" style={{ color: '#002F5D' }}>Nueva Orden de Compra</h1>
        <p className="text-sm text-gray-500 mb-6">Inicia sesión con tu cuenta de Google KLLPA para crear una orden.</p>
        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {ERROR_MENSAJES[error] ?? 'Ocurrió un error. Intenta de nuevo.'}
          </div>
        )}
        <a
          href="/api/ordenes/auth/start"
          className="inline-block w-full py-3 rounded-xl font-semibold text-white transition-colors"
          style={{ background: '#33B44A' }}
        >
          Conectar con Google
        </a>
      </div>
    </div>
  )
}

export default function NuevaOrdenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" size={28} /></div>}>
      <NuevaOrdenForm />
    </Suspense>
  )
}

function NuevaOrdenForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  const [checking, setChecking] = useState(true)
  const [session, setSession] = useState<{ email: string; nombre: string } | null>(null)
  const [clasificaciones, setClasificaciones] = useState<string[]>([])
  const [rubros, setRubros] = useState<string[]>([])

  const [clasificacionGasto, setClasificacionGasto] = useState('')
  const [tipoComprobante, setTipoComprobante] = useState('')
  const [detalleGasto, setDetalleGasto] = useState('')
  const [comentarios, setComentarios] = useState('')
  const [comprobanteSiNo, setComprobanteSiNo] = useState('No')
  const [comprobanteArchivo, setComprobanteArchivo] = useState<File | null>(null)

  const [proveedorDoc, setProveedorDoc] = useState('')
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [buscandoProveedor, setBuscandoProveedor] = useState(false)
  const [proveedorNoEncontrado, setProveedorNoEncontrado] = useState(false)
  const [metodoPagoElegido, setMetodoPagoElegido] = useState<'banco' | 'yape'>('banco')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea(false)])

  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [folioCreado, setFolioCreado] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      try {
        const [meRes, catRes] = await Promise.all([
          fetch('/api/ordenes/me'),
          fetch('/api/ordenes/catalogo'),
        ])
        const me = await meRes.json()
        if (me.isLoggedIn) {
          setSession({ email: me.email, nombre: me.nombre })
          if (catRes.ok) {
            const cat = await catRes.json()
            setClasificaciones(cat.clasificaciones ?? [])
            setRubros(cat.rubros ?? [])
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setChecking(false)
      }
    }
    cargar()
  }, [])

  // Si tipo de comprobante es "No tiene", no permite adjuntar
  useEffect(() => {
    if (tipoComprobante === 'No tiene') {
      setComprobanteSiNo('No')
      setComprobanteArchivo(null)
    }
  }, [tipoComprobante])

  const buscarProveedor = useCallback((doc: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setProveedor(null)
    setProveedorNoEncontrado(false)
    if (!doc.trim()) return
    debounceRef.current = setTimeout(async () => {
      setBuscandoProveedor(true)
      try {
        const res = await fetch(`/api/proveedores/lookup?doc=${encodeURIComponent(doc.trim())}`)
        const data = await res.json()
        if (data.found) {
          setProveedor(data.proveedor)
          setProveedorNoEncontrado(false)
          const p: Proveedor = data.proveedor
          setMetodoPagoElegido(tieneValor(p.numeroCuenta) ? 'banco' : 'yape')
        } else {
          setProveedor(null)
          setProveedorNoEncontrado(true)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setBuscandoProveedor(false)
      }
    }, 500)
  }, [])

  function actualizarLinea(id: string, cambios: Partial<Linea>) {
    setLineas(prev => prev.map(l => (l.id === id ? { ...l, ...cambios } : l)))
  }

  function agregarLinea() {
    setLineas(prev => [...prev, nuevaLinea(igvPorDefecto(tipoComprobante))])
  }

  function cambiarTipoComprobante(valor: string) {
    setTipoComprobante(valor)
    const igv = igvPorDefecto(valor)
    setLineas(prev => prev.map(l => ({ ...l, igv })))
  }

  function quitarLinea(id: string) {
    setLineas(prev => (prev.length > 1 ? prev.filter(l => l.id !== id) : prev))
  }

  const montoTotal = lineas.reduce((s, l) => s + totalLinea(l), 0)
  const lineasValidas = lineas.some(l => l.descripcion.trim() && l.cantidad > 0 && l.precioUnitario > 0)
  const puedeEnviar = Boolean(
    proveedor && clasificacionGasto && tipoComprobante && detalleGasto.trim() && lineasValidas && !enviando,
  )

  async function enviarOrden() {
    if (!puedeEnviar) return
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const formData = new FormData()
      formData.append('clasificacionGasto', clasificacionGasto)
      formData.append('tipoComprobante', tipoComprobante)
      formData.append('detalleGasto', detalleGasto)
      formData.append('comentarios', comentarios)
      formData.append('comprobanteSiNo', comprobanteSiNo)
      formData.append('proveedorDoc', proveedorDoc)
      if (comprobanteArchivo) {
        formData.append('comprobante', comprobanteArchivo)
      }
      formData.append('lineas', JSON.stringify(
        lineas
          .filter(l => l.descripcion.trim() && l.cantidad > 0 && l.precioUnitario > 0)
          .map(l => ({
            codigo: l.codigo,
            descripcion: l.descripcion,
            fechaConclusion: l.fechaConclusion,
            cantidad: l.cantidad,
            igv: l.igv,
            precioUnitario: l.precioUnitario,
            total: totalLinea(l),
          }))
      ))

      const res = await fetch('/api/ordenes', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok && res.status !== 207) {
        setErrorEnvio(data.error ?? 'No se pudo crear la orden')
        return
      }
      setFolioCreado(data.orden?.folio ?? null)
      if (data.warning) setErrorEnvio(data.warning)
    } catch (err) {
      console.error(err)
      setErrorEnvio('Error de red al enviar la orden')
    } finally {
      setEnviando(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    )
  }

  if (!session) return <ConectarGoogle error={errorParam} />

  if (folioCreado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
          <CheckCircle2 className="mx-auto mb-3" size={40} color="#33B44A" />
          <h1 className="text-lg font-bold mb-1" style={{ color: '#002F5D' }}>Orden enviada</h1>
          <p className="text-sm text-gray-500 mb-1">Orden de Compra N° <strong>{folioCreado}</strong></p>
          <p className="text-sm text-gray-500 mb-6">Se envió el correo de aprobación. Te avisaremos por correo cuando sea aprobada o rechazada.</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl font-semibold text-white"
            style={{ background: '#002F5D' }}
          >
            Crear otra orden
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold" style={{ color: '#002F5D' }}>Nueva Orden de Compra — KLLPA</h1>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
          Creado por: <strong>{session.nombre}</strong> ({session.email})
        </div>

        {/* Datos generales */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 text-white font-semibold" style={{ background: '#002F5D' }}>Datos generales</div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Clasificación de gasto</label>
              <select value={clasificacionGasto} onChange={e => setClasificacionGasto(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Selecciona...</option>
                {clasificaciones.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de comprobante</label>
              <select value={tipoComprobante} onChange={e => cambiarTipoComprobante(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Selecciona...</option>
                <option value="Factura">Factura</option>
                <option value="Boleta">Boleta</option>
                <option value="Recibo por Honorarios">Recibo por Honorarios</option>
                <option value="No tiene">No tiene</option>
              </select>
            </div>
            {tipoComprobante !== 'No tiene' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">¿Adjuntará comprobante?</label>
                <select value={comprobanteSiNo} onChange={e => setComprobanteSiNo(e.target.value as 'Sí' | 'No')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="No">No (lo adjuntaré después del pago)</option>
                  <option value="Sí">Sí (lo adjunto ahora)</option>
                </select>
              </div>
            )}
            {comprobanteSiNo === 'Sí' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">📎 Adjuntar comprobante (PDF, JPG, PNG)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => setComprobanteArchivo(e.target.files?.[0] || null)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                {comprobanteArchivo && (
                  <p className="text-xs text-green-600 mt-1">✓ {comprobanteArchivo.name}</p>
                )}
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Detalle de gasto</label>
              <input value={detalleGasto} onChange={e => setDetalleGasto(e.target.value)} placeholder="Ej: compras"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Comentarios</label>
              <textarea value={comentarios} onChange={e => setComentarios(e.target.value)} rows={2}
                placeholder="Ej: se paga hoy, o se contabiliza para el viernes, u otras notas para el aprobador"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
          </div>
        </section>

        {/* Proveedor */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 text-white font-semibold" style={{ background: '#002F5D' }}>Proveedor</div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">RUC o DNI del proveedor</label>
              <div className="relative">
                <input
                  value={proveedorDoc}
                  onChange={e => { setProveedorDoc(e.target.value); buscarProveedor(e.target.value) }}
                  placeholder="Escribe el RUC o DNI y espera..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-9"
                />
                {buscandoProveedor && <Loader2 className="animate-spin absolute right-3 top-2.5 text-gray-400" size={16} />}
                {!buscandoProveedor && proveedor && <CheckCircle2 className="absolute right-3 top-2.5" size={16} color="#33B44A" />}
                {!buscandoProveedor && proveedorNoEncontrado && <XCircle className="absolute right-3 top-2.5" size={16} color="#dc2626" />}
              </div>
              {proveedorNoEncontrado && (
                <p className="text-xs text-red-600 mt-1">Proveedor no encontrado. Verifica el documento o pide que lo agreguen a la base de proveedores.</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Razón Social / Nombre</label>
                <input value={proveedor?.razonSocial ?? ''} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Dirección</label>
                <input value={proveedor?.direccion ?? ''} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Método de pago</label>
                <input value={proveedor?.metodoPago ?? ''} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Términos de pago</label>
                <input value={proveedor?.terminosPago ?? ''} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600" />
              </div>
            </div>

            {proveedor && tieneValor(proveedor.numeroCuenta) && tieneValor(proveedor.yapePlin) && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Este proveedor tiene ambos — elige cuál usar para esta orden</label>
                <select value={metodoPagoElegido} onChange={e => setMetodoPagoElegido(e.target.value as 'banco' | 'yape')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm md:w-64">
                  <option value="banco">Cuenta bancaria</option>
                  <option value="yape">Yape / Plin</option>
                </select>
              </div>
            )}

            {proveedor && metodoPagoElegido === 'banco' && tieneValor(proveedor.numeroCuenta) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Banco</label>
                  <input value={proveedor.banco} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Número de Cuenta</label>
                  <input value={proveedor.numeroCuenta} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">CCI</label>
                  <input value={proveedor.cci} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600" />
                </div>
              </div>
            )}

            {proveedor && metodoPagoElegido === 'yape' && tieneValor(proveedor.yapePlin) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Número de Yape/Plin</label>
                  <input value={proveedor.yapePlin} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Titular de la Cuenta</label>
                  <input value={proveedor.titularCuenta} readOnly className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600" />
                </div>
              </div>
            )}

            {proveedor && !tieneValor(proveedor.numeroCuenta) && !tieneValor(proveedor.yapePlin) && (
              <p className="text-xs text-amber-600">Este proveedor no tiene cuenta bancaria ni Yape/Plin registrados.</p>
            )}
          </div>
        </section>

        {/* Líneas */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 text-white font-semibold flex items-center justify-between" style={{ background: '#002F5D' }}>
            <span>Líneas de productos / servicios</span>
            <button onClick={agregarLinea} className="flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 rounded-lg px-2 py-1">
              <Plus size={14} /> Agregar línea
            </button>
          </div>
          <div className="p-5 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 pr-2">Código</th>
                  <th className="text-left py-2 pr-2">Descripción</th>
                  <th className="text-left py-2 pr-2">Fecha conclusión</th>
                  <th className="text-center py-2 pr-2">Cant.</th>
                  <th className="text-center py-2 pr-2">IGV</th>
                  <th className="text-right py-2 pr-2">P. Unitario</th>
                  <th className="text-right py-2 pr-2">Total</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map(l => (
                  <tr key={l.id} className="border-b border-gray-50">
                    <td className="py-1.5 pr-2">
                      <select value={l.codigo} onChange={e => actualizarLinea(l.id, { codigo: e.target.value })}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-32">
                        <option value="">-</option>
                        {rubros.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <input value={l.descripcion} onChange={e => actualizarLinea(l.id, { descripcion: e.target.value })}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-40" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input type="date" value={l.fechaConclusion} onChange={e => actualizarLinea(l.id, { fechaConclusion: e.target.value })}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input type="number" min={0} value={l.cantidad} onChange={e => actualizarLinea(l.id, { cantidad: Number(e.target.value) })}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-16 text-center" />
                    </td>
                    <td className="py-1.5 pr-2 text-center">
                      <input type="checkbox" checked={l.igv} disabled readOnly
                        title="Se activa automáticamente según el Tipo de comprobante"
                        className="cursor-not-allowed" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input type="number" min={0} step="0.01" value={l.precioUnitario} onChange={e => actualizarLinea(l.id, { precioUnitario: Number(e.target.value) })}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-24 text-right" />
                    </td>
                    <td className="py-1.5 pr-2 text-right font-medium">{totalLinea(l).toFixed(2)}</td>
                    <td className="py-1.5 text-center">
                      <button onClick={() => quitarLinea(l.id)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right mt-4 text-lg font-bold" style={{ color: '#002F5D' }}>
              Total: S/.{montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </section>

        {errorEnvio && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{errorEnvio}</div>
        )}

        <button
          onClick={enviarOrden}
          disabled={!puedeEnviar}
          className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={{ background: '#33B44A' }}
        >
          {enviando ? 'Enviando...' : 'Enviar orden'}
        </button>
      </div>
    </div>
  )
}
