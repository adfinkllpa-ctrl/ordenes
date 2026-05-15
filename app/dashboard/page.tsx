'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  RefreshCw, LogOut, Loader2, AlertCircle,
  TrendingUp, Wallet, BarChart2, FileText, Scale, DollarSign
} from 'lucide-react'

interface SheetData {
  headers: string[]
  rows: string[][]
  config: { label: string; category: string }
  error?: boolean
  errorMsg?: string
}

// Convierte "S/.51,008.92" / "S/ 4,579" / "#REF!" a número correctamente
function toNum(v: string | undefined): number {
  if (!v || v.includes('#') || v.trim() === '' || v.trim() === '-') return 0
  let s = v.trim()
  s = s.replace(/S\/\./g, '').replace(/S\//g, '').replace(/\$/g, '') // quita prefijo moneda
  s = s.replace(/\s/g, '')   // espacios
  s = s.replace(/,/g, '')    // separadores de miles
  s = s.replace(/[()]/g, '') // paréntesis negativos
  return parseFloat(s) || 0
}

const MESES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const HOY = new Date()
const MES_ACTUAL = HOY.getMonth() // 0=enero ... 11=dic

// ─── FLUJO DE EFECTIVO — Saldo de hoy ──────────────────────────────────────
// Fila 3 del sheet = headers (row[0]) — tiene los nombres de meses
// Fila 75 del sheet = row[72] — tiene el saldo
// Busca la columna del mes actual por nombre en la fila 3

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function findMonthCol(headers: string[]): number {
  const mesActual = MESES_ES[MES_ACTUAL]
  const idx = headers.findIndex(h => h?.toLowerCase().trim() === mesActual)
  return idx >= 0 ? idx : -1
}

function FlujoEfectivoHero({ data }: { data: SheetData }) {
  const rows = data.rows
  const headers = data.headers // fila 3 del sheet

  // Encuentra columna del mes actual en fila 3
  const colActual = findMonthCol(headers)

  // Fila 75 del sheet = rows[72] (range empieza en fila 3, entonces 75-3=72)
  const saldoNetoRow   = rows[71] ?? [] // fila 74 = SALDO NETO
  const fila75Row      = rows[72] ?? [] // fila 75 = COMPRAS CON TARJETA
  const ingresosRow    = rows.find(r => r[0]?.toLowerCase().includes('total ingresos')) ?? []
  const facturasRow    = rows.find(r => r[0]?.toLowerCase().includes('ingresos por pago')) ?? []

  // Saldo del mes actual desde fila 74 (SALDO NETO) — col del mes actual
  // El label "SALDO NETO" está en col[3], los valores empiezan en col[4] (marzo)
  // Pero usamos findMonthCol para encontrar la columna correcta en headers
  const saldoHoy     = colActual >= 0 ? toNum(saldoNetoRow[colActual]) : 0
  const ingresosHoy  = colActual >= 0 ? toNum(ingresosRow[colActual])  : 0
  const facturasHoy  = colActual >= 0 ? toNum(facturasRow[colActual])  : 0

  // Gráfica: saldo neto e ingresos por cada mes que tenga columna en headers
  const chartData = MESES_ES.map((mes, i) => {
    const col = headers.findIndex(h => h?.toLowerCase().trim() === mes)
    if (col < 0) return null
    return {
      mes: MESES_LABEL[i],
      'Cobros por Facturas': toNum(facturasRow[col]),
      'Total Ingresos': toNum(ingresosRow[col]),
    }
  }).filter(Boolean).filter(d => (d!['Cobros por Facturas'] > 0 || d!['Total Ingresos'] > 0)) as { mes: string; 'Cobros por Facturas': number; 'Total Ingresos': number }[]

  const mesNombre = HOY.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden col-span-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
          <Wallet size={18} />
        </div>
        <div>
          <h2 className="font-bold text-gray-800 text-base">Flujo de Efectivo</h2>
          <p className="text-xs text-gray-400">Se actualiza automáticamente cada 60 seg</p>
        </div>
        <span className="ml-auto text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200 font-medium">
          EN VIVO
        </span>
      </div>

      {/* Saldo Hero */}
      <div className="px-6 pt-6 pb-4">
        <p className="text-sm font-medium text-gray-500 mb-1">Saldo al {HOY.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <div className="flex items-end gap-4 flex-wrap">
          <span className="text-5xl font-bold text-emerald-600">
            S/.{saldoHoy.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-sm text-gray-400 mb-2">— {mesNombre}</span>
        </div>
      </div>

      {/* KPIs del mes */}
      <div className="grid grid-cols-2 gap-3 px-6 pb-4">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs text-blue-600 font-medium">Total Ingresos del mes</p>
          <p className="text-xl font-bold text-blue-800 mt-1">
            S/.{ingresosHoy.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
          <p className="text-xs text-violet-600 font-medium">Cobros por Facturas del mes</p>
          <p className="text-xl font-bold text-violet-800 mt-1">
            S/.{facturasHoy.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Gráfica evolución mensual */}
      <div className="px-6 pb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Evolución mensual</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `S/.${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `S/.${v.toLocaleString('es-PE')}`} />
              <Legend />
              <Line type="monotone" dataKey="Cobros por Facturas" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Total Ingresos" stroke="#4361ee" strokeWidth={2} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── HELPERS TRIMESTRE ──────────────────────────────────────────────────────
// Para sheets con cols: [0=label, 1=ene, 2=feb, 3=mar, 4=abr, 5=may, 6=jun, 7=jul, 8=ago, 9=sep, 10=oct, 11=nov, 12=dic]
const QUARTERS = [
  { label: 'Q1', cols: [1, 2, 3], meses: 'Ene–Mar' },
  { label: 'Q2', cols: [4, 5, 6], meses: 'Abr–Jun' },
  { label: 'Q3', cols: [7, 8, 9], meses: 'Jul–Sep' },
  { label: 'Q4', cols: [10, 11, 12], meses: 'Oct–Dic' },
]

function sumQ(row: string[], cols: number[]) {
  return cols.reduce((s, c) => s + toNum(row[c]), 0)
}

// ─── ESTADO DE RESULTADOS — Por trimestre ──────────────────────────────────
// cols: [label, ene(1), feb(2), mar(3), abr(4), may(5), jun(6), jul(7)...dic(12), acum(13)]
function EstadoResultadosTrim({ data }: { data: SheetData }) {
  const rows = data.rows
  const findRow = (k: string) => rows.find(r => r[0]?.toUpperCase().includes(k.toUpperCase())) ?? []

  const ventasRow    = findRow('Ventas brutas')
  const utilBrutaRow = findRow('UTILIDAD BRUTA')
  const utilOpRow    = findRow('UTILIDAD OPERATIVA')

  const chartData = QUARTERS.map(q => ({
    trimestre: q.label,
    'Ventas': sumQ(ventasRow, q.cols),
    'Ut. Bruta': sumQ(utilBrutaRow, q.cols),
    'Ut. Operativa': sumQ(utilOpRow, q.cols),
  }))

  const acumVentas = toNum(ventasRow[13])
  const acumUt    = toNum(utilOpRow[13])
  const margen    = acumVentas > 0 ? ((acumUt / acumVentas) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-xs text-blue-600">Ventas acumuladas</p>
          <p className="text-base font-bold text-blue-800">S/.{(acumVentas/1000).toFixed(0)}k</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 border border-green-100">
          <p className="text-xs text-green-600">Ut. Operativa acum.</p>
          <p className="text-base font-bold text-green-800">S/.{(acumUt/1000).toFixed(0)}k</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
          <p className="text-xs text-purple-600">Margen operativo</p>
          <p className="text-base font-bold text-purple-800">{margen}%</p>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="trimestre" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => `S/.${v.toLocaleString('es-PE')}`} />
            <Legend />
            <Bar dataKey="Ventas" fill="#4361ee" radius={[3,3,0,0]} />
            <Bar dataKey="Ut. Bruta" fill="#10b981" radius={[3,3,0,0]} />
            <Bar dataKey="Ut. Operativa" fill="#7b2d8b" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── PUNTO DE EQUILIBRIO — Por trimestre ───────────────────────────────────
// cols: [label, ENE(1)...DIC(12)]
function PuntoEquilibrioTrim({ data }: { data: SheetData }) {
  const rows = data.rows
  const ingRow = rows.find(r => r[0]?.toUpperCase().includes('INGRESO')) ?? []
  const peRow  = rows.find(r => r[0]?.toUpperCase().includes('PUNTO DE EQUILIBRIO')) ?? []
  const margenRow = rows.find(r => r[0]?.toUpperCase().includes('MARGEN') && !r[0]?.includes('%')) ?? []

  const chartData = QUARTERS.map(q => ({
    trimestre: q.label,
    Ingreso: sumQ(ingRow, q.cols),
    'Punto Equilibrio': sumQ(peRow, q.cols),
    Margen: sumQ(margenRow, q.cols),
  }))

  // Mes actual (col = MES_ACTUAL+1 para esta sheet con cols 1-12)
  const colMes = Math.min(MES_ACTUAL + 1, 12)
  const peActual = toNum(peRow[colMes])
  const ingActual = toNum(ingRow[colMes])
  const sobreCobertura = ingActual - peActual

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-xs text-blue-600">Punto Equilibrio {MESES_LABEL[MES_ACTUAL]}</p>
          <p className="text-base font-bold text-blue-800">S/.{(peActual/1000).toFixed(0)}k</p>
        </div>
        <div className={`rounded-xl p-3 border ${sobreCobertura >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-xs ${sobreCobertura >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {sobreCobertura >= 0 ? 'Sobre cobertura' : 'Bajo cobertura'}
          </p>
          <p className={`text-base font-bold ${sobreCobertura >= 0 ? 'text-green-800' : 'text-red-800'}`}>
            S/.{Math.abs(sobreCobertura/1000).toFixed(0)}k
          </p>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="trimestre" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => `S/.${v.toLocaleString('es-PE')}`} />
            <Legend />
            <Bar dataKey="Ingreso" fill="#4361ee" radius={[3,3,0,0]} />
            <Bar dataKey="Punto Equilibrio" fill="#ef4444" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── FLUJO DE CAJA — Por trimestre (empieza en marzo) ──────────────────────
// headers: [label, mar(1), abr(2), may(3), jun(4), jul(5), ago(6), sep(7), oct(8), nov(9), dic(10)]
const FC_QUARTERS = [
  { label: 'Q1 parcial', cols: [1], meses: 'Mar' },
  { label: 'Q2', cols: [2, 3, 4], meses: 'Abr–Jun' },
  { label: 'Q3', cols: [5, 6, 7], meses: 'Jul–Sep' },
  { label: 'Q4', cols: [8, 9, 10], meses: 'Oct–Dic' },
]

function FlujoCajaTrim({ data }: { data: SheetData }) {
  const rows = data.rows
  const ingRow   = rows.find(r => r[0]?.toUpperCase().includes('INGRESO ESPERADO')) ?? []
  const pagosRow = rows.find(r => r[0]?.toUpperCase().includes('PAGOS PROYECTADOS')) ?? []
  const saldoRow = rows.find(r => r[0]?.toUpperCase().includes('SALDO') && !r[0]?.toUpperCase().includes('INICIO')) ?? []

  const chartData = FC_QUARTERS.map(q => ({
    trimestre: q.label,
    'Ingreso Esp.': sumQ(ingRow, q.cols),
    'Pagos Proy.': sumQ(pagosRow, q.cols),
    Saldo: sumQ(saldoRow, q.cols),
  }))

  // Mayo = col 3 en este sheet (mar=1, abr=2, may=3)
  const saldoMayo = toNum(saldoRow[3])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <p className="text-xs text-amber-600">Saldo Mayo (proyectado)</p>
          <p className="text-base font-bold text-amber-800">S/.{(saldoMayo/1000).toFixed(0)}k</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
          <p className="text-xs text-gray-500">Mes de referencia</p>
          <p className="text-base font-bold text-gray-700">Mayo 2026</p>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="trimestre" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => `S/.${v.toLocaleString('es-PE')}`} />
            <Legend />
            <Bar dataKey="Ingreso Esp." fill="#4361ee" radius={[3,3,0,0]} />
            <Bar dataKey="Pagos Proy." fill="#ef4444" radius={[3,3,0,0]} />
            <Bar dataKey="Saldo" fill="#10b981" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── BALANCE GENERAL — Ya es trimestral ────────────────────────────────────
// Cols: [label, T1_val, T1_%, T2_val, T2_%, T3_val, T3_%, T4_val, T4_%]
function BalanceGeneralTrim({ data }: { data: SheetData }) {
  const rows = data.rows
  const findRow = (k: string) => rows.find(r => r[0]?.toString().toLowerCase().includes(k.toLowerCase())) ?? []

  const activoRow = findRow('Total Activo Corriente')
  const efectivoRow = findRow('Efectivo')
  const cxcRow = findRow('Cuentas por cobrar')
  const cxfRow = findRow('Cuentas por facturar')

  const trimData = [
    { trim: '1° Trim', valCol: 1, pctCol: 2 },
    { trim: '2° Trim', valCol: 3, pctCol: 4 },
    { trim: '3° Trim', valCol: 5, pctCol: 6 },
    { trim: '4° Trim', valCol: 7, pctCol: 8 },
  ]

  const chartData = trimData.map(t => ({
    trimestre: t.trim,
    'Activo Corriente': toNum(activoRow[t.valCol]),
  }))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Efectivo', row: efectivoRow },
          { label: 'Ctas x Cobrar', row: cxcRow },
          { label: 'Ctas x Facturar', row: cxfRow },
        ].map((k, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className="text-sm font-bold text-gray-800">S/.{(toNum(k.row[1])/1000).toFixed(0)}k</p>
            <p className="text-xs text-gray-400">1° Trim</p>
          </div>
        ))}
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="trimestre" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => `S/.${v.toLocaleString('es-PE')}`} />
            <Bar dataKey="Activo Corriente" fill="#4361ee" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── EBITDA ────────────────────────────────────────────────────────────────
// Sheet "ER" — rango A6:O40
// headers = fila 6 (meses en cols 1-12)
// rows[3]  = fila 10 → Ventas brutas
// rows[17] = fila 24 → EBITDA
// Margen = EBITDA / Ventas * 100 por mes

function EbitdaChart({ data }: { data: SheetData }) {
  const findRow = (k: string) => data.rows.find(r => r[0]?.toUpperCase().includes(k.toUpperCase())) ?? []
  const ebitdaRow = findRow('UTILIDAD OPERATIVA')
  const ventasRow = findRow('Ventas Netas')

  // Meses con datos (cols 1-12, filtramos los que tienen ventas > 0 o ebitda != 0)
  const mesesDisp = Array.from({ length: 12 }, (_, i) => ({ nombre: MESES_LABEL[i], col: i + 1 }))
    .filter(m => toNum(ventasRow[m.col]) !== 0 || toNum(ebitdaRow[m.col]) !== 0)

  const mesDefault = mesesDisp.find(m => m.col === MES_ACTUAL + 1) ?? mesesDisp[mesesDisp.length - 1]
  const [mesElegido, setMesElegido] = useState(mesDefault)

  const col       = mesElegido?.col ?? MES_ACTUAL + 1
  const ebitdaMes = toNum(ebitdaRow[col])
  const ventasMes = toNum(ventasRow[col])
  const margenMes = ventasMes !== 0 ? ((ebitdaMes / ventasMes) * 100).toFixed(1) : '0'

  // Gráfica: todos los meses con datos
  const chartData = mesesDisp.map(m => ({
    mes: m.nombre,
    EBITDA: toNum(ebitdaRow[m.col]),
    Ventas: toNum(ventasRow[m.col]),
    Margen: toNum(ventasRow[m.col]) !== 0
      ? parseFloat(((toNum(ebitdaRow[m.col]) / toNum(ventasRow[m.col])) * 100).toFixed(1))
      : 0,
  }))

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden col-span-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-700">
          <TrendingUp size={18} />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-gray-800 text-base">EBITDA</h2>
          <p className="text-xs text-gray-400">Margen = Utilidad Operativa / Ventas Netas</p>
        </div>
        <div className="flex-1 flex justify-center">
          <select
            value={mesElegido?.col ?? ''}
            onChange={e => {
              const found = mesesDisp.find(m => m.col === Number(e.target.value))
              if (found) setMesElegido(found)
            }}
            className="border-2 border-purple-300 rounded-xl px-4 py-2 text-sm font-semibold text-purple-700 bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
          >
            {mesesDisp.map(m => <option key={m.col} value={m.col}>{m.nombre}</option>)}
          </select>
        </div>
        <div className="flex-1" />
      </div>

      {/* KPIs del mes seleccionado */}
      <div className="grid grid-cols-3 gap-3 px-6 pt-5 pb-3">
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
          <p className="text-xs text-purple-600">EBITDA — {mesElegido?.nombre}</p>
          <p className="text-xl font-bold text-purple-800 mt-1">
            S/.{ebitdaMes.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs text-blue-600">Ventas Netas — {mesElegido?.nombre}</p>
          <p className="text-xl font-bold text-blue-800 mt-1">
            S/.{ventasMes.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
          </p>
        </div>
        <div className={`rounded-xl p-4 border ${parseFloat(margenMes) >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-xs ${parseFloat(margenMes) >= 0 ? 'text-green-600' : 'text-red-600'}`}>Margen EBITDA</p>
          <p className={`text-xl font-bold mt-1 ${parseFloat(margenMes) >= 0 ? 'text-green-800' : 'text-red-800'}`}>
            {margenMes}%
          </p>
        </div>
      </div>

      {/* Gráfica evolución */}
      <div className="px-6 pb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Evolución mensual</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => `S/.${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
              <Tooltip formatter={(v: number, name: string) => name === 'Margen' ? `${v}%` : `S/.${v.toLocaleString('es-PE')}`} />
              <Legend />
              <Line yAxisId="left"  type="monotone" dataKey="EBITDA" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4 }} />
              <Line yAxisId="left"  type="monotone" dataKey="Ventas" stroke="#4361ee" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              <Line yAxisId="right" type="monotone" dataKey="Margen" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── PRESUPUESTO 2026 ──────────────────────────────────────────────────────
// Fila 4 (headers): [label, "enero","","", "febrero","","", "marzo","","", "Q1","","", ...]
// Fila 5 (rows[0]): [label, est,act,dif, est,act,dif, est,act,dif, est,act,dif, ...]
// Patrón: cada mes ocupa 3 cols (est,act,dif), luego cada trimestre igual
// Q1: cols 1-3=Ene, 4-6=Feb, 7-9=Mar, 10-12=Q1 total
// Q2: cols 13-15=Abr, 16-18=May, 19-21=Jun, 22-24=Q2 total ... etc.

const PRES_BLOQUES = [
  { label: 'Q1', meses: [
    { nombre: 'Ene', est: 1,  act: 2,  dif: 3  },
    { nombre: 'Feb', est: 4,  act: 5,  dif: 6  },
    { nombre: 'Mar', est: 7,  act: 8,  dif: 9  },
    { nombre: 'Q1',  est: 10, act: 11, dif: 12, esTotal: true },
  ]},
  { label: 'Q2', meses: [
    { nombre: 'Abr', est: 13, act: 14, dif: 15 },
    { nombre: 'May', est: 16, act: 17, dif: 18 },
    { nombre: 'Jun', est: 19, act: 20, dif: 21 },
    { nombre: 'Q2',  est: 22, act: 23, dif: 24, esTotal: true },
  ]},
  { label: 'Q3', meses: [
    { nombre: 'Jul', est: 25, act: 26, dif: 27 },
    { nombre: 'Ago', est: 28, act: 29, dif: 30 },
    { nombre: 'Sep', est: 31, act: 32, dif: 33 },
    { nombre: 'Q3',  est: 34, act: 35, dif: 36, esTotal: true },
  ]},
  { label: 'Q4', meses: [
    { nombre: 'Oct', est: 37, act: 38, dif: 39 },
    { nombre: 'Nov', est: 40, act: 41, dif: 42 },
    { nombre: 'Dic', est: 43, act: 44, dif: 45 },
    { nombre: 'Q4',  est: 46, act: 47, dif: 48, esTotal: true },
  ]},
]

type PresVistaQ = 'mes' | 'trimestre' | 'anual'

function PresupuestoChart({ data }: { data: SheetData }) {
  const totalsRow = data.rows.find(r => r[0]?.toUpperCase().includes('TOTAL')) ?? []
  const catRows   = data.rows.filter(r =>
    r[0] && !r[0].toUpperCase().includes('TOTAL') && !r[0].toUpperCase().includes('CATEGOR')
  )
  if (!totalsRow.length) return <p className="text-gray-400 text-sm">Sin datos</p>

  const [qIdx,    setQIdx]    = useState(0)
  const [vista,   setVista]   = useState<PresVistaQ>('trimestre')
  const [mesIdx,  setMesIdx]  = useState(0)

  const bloque = PRES_BLOQUES[qIdx]
  const mesesDelQ = bloque.meses.filter(m => !(m as {esTotal?:boolean}).esTotal)
  const totalCol  = bloque.meses.find(m =>  (m as {esTotal?:boolean}).esTotal)!

  // Columnas activas según vista
  const getCols = (row: string[]) => {
    if (vista === 'anual') {
      const est = toNum(row[49]) // AX
      const act = toNum(row[50]) // AY
      const dif = toNum(row[51]) // AZ
      return { est, act, dif }
    }
    if (vista === 'trimestre') {
      return {
        est: toNum(row[totalCol.est]),
        act: toNum(row[totalCol.act]),
        dif: toNum(row[totalCol.dif]),
      }
    }
    // mes individual
    const m = mesesDelQ[mesIdx] ?? mesesDelQ[0]
    return {
      est: toNum(row[m.est]),
      act: toNum(row[m.act]),
      dif: toNum(row[m.dif]),
    }
  }

  const totales  = getCols(totalsRow)
  const chartData = catRows.map(r => ({
    cat: (r[0] ?? '').substring(0, 16),
    Estimado: getCols(r).est,
    Actual:   getCols(r).act,
  })).filter(d => d.Estimado > 0 || d.Actual > 0)

  const labelVista = vista === 'anual' ? 'Anual' : vista === 'trimestre' ? bloque.label : mesesDelQ[mesIdx]?.nombre

  return (
    <div className="space-y-3">
      {/* Filtro 1: Trimestre + Anual */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400 font-medium">Período:</span>
        {PRES_BLOQUES.map((b, i) => (
          <button key={b.label} onClick={() => { setQIdx(i); if (vista === 'anual') setVista('trimestre') }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              qIdx === i && vista !== 'anual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>{b.label}</button>
        ))}
        <button onClick={() => setVista('anual')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            vista === 'anual' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>Anual</button>
      </div>

      {/* Filtro 2: Mes / Todo el trimestre — solo si no es Anual */}
      {vista !== 'anual' && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 font-medium">Ver:</span>
          {mesesDelQ.map((m, i) => (
            <button key={m.nombre} onClick={() => { setMesIdx(i); setVista('mes') }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                vista === 'mes' && mesIdx === i ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{m.nombre}</button>
          ))}
          <button onClick={() => setVista('trimestre')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              vista === 'trimestre' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>Todo el trimestre</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-xs text-blue-500">Estimado — {labelVista}</p>
          <p className="text-base font-bold text-blue-700">S/.{totales.est.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <p className="text-xs text-emerald-500">Actual — {labelVista}</p>
          <p className="text-base font-bold text-emerald-700">S/.{totales.act.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className={`rounded-xl p-3 border ${totales.dif >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-xs ${totales.dif >= 0 ? 'text-green-500' : 'text-red-500'}`}>Diferencia</p>
          <p className={`text-base font-bold ${totales.dif >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {totales.dif >= 0 ? '+' : ''}S/.{Math.abs(totales.dif).toLocaleString('es-PE', { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Gráfica por categoría */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 120, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `S/.${(v/1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="cat" tick={{ fontSize: 9 }} width={120} />
            <Tooltip formatter={(v: number) => `S/.${v.toLocaleString('es-PE')}`} />
            <Legend />
            <Bar dataKey="Estimado" fill="#4361ee" radius={[0,3,3,0]} />
            <Bar dataKey="Actual"   fill="#10b981" radius={[0,3,3,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── PAGOS DEL MES ─────────────────────────────────────────────────────────
// Sheet: Flujo de Caja — tab FLUJO — range A3:K17
// headers (fila 3 sheet): ["", "marzo", "abril", "mayo", ...]
// rows[5] = PAGOS PROYECTADOS (total)
// rows[7] = sueldos | rows[8] = alquiler | rows[9] = contador
// rows[10] = Egresos(cash) | rows[11] = Pago tarjeta

function PagosDelMes({ data }: { data: SheetData }) {
  const mesesDisponibles = data.headers
    .map((h, i) => ({ nombre: h?.trim().toLowerCase(), col: i }))
    .filter(h => h.nombre && h.nombre !== '')

  const mesDefault = mesesDisponibles.find(m => m.nombre === MESES_ES[MES_ACTUAL])
    ?? mesesDisponibles[0]

  const [mesSeleccionado, setMesSeleccionado] = useState(mesDefault)

  const pagosRow    = data.rows.find(r => r[0]?.toUpperCase().includes('PAGOS PROYECTADOS')) ?? []
  const detalle = [
    data.rows.find(r => r[0]?.toLowerCase().includes('sueldos'))      ?? [],
    data.rows.find(r => r[0]?.toLowerCase().includes('alquiler'))      ?? [],
    data.rows.find(r => r[0]?.toLowerCase().includes('contador'))      ?? [],
    data.rows.find(r => r[0]?.toLowerCase().includes('egresos'))       ?? [],
    data.rows.find(r => r[0]?.toLowerCase().includes('pago tarjeta'))  ?? [],
  ].filter(r => r.length > 0)

  const col = mesSeleccionado?.col ?? 1
  const totalPagos = toNum(pagosRow[col])

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="p-2 rounded-lg border bg-rose-50 border-rose-200 text-rose-700">
          <DollarSign size={16} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-800 text-sm">Pagos del Mes</h2>
          <p className="text-xs text-gray-400">Flujo de Caja — selecciona el mes</p>
        </div>
      </div>

      {/* Selector de mes */}
      <div className="px-5 pt-4">
        <select
          value={mesSeleccionado?.col ?? ''}
          onChange={e => {
            const found = mesesDisponibles.find(m => m.col === Number(e.target.value))
            if (found) setMesSeleccionado(found)
          }}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white capitalize focus:outline-none focus:ring-2 focus:ring-rose-300"
        >
          {mesesDisponibles.map(m => (
            <option key={m.col} value={m.col} className="capitalize">{m.nombre}</option>
          ))}
        </select>
      </div>

      {/* Total destacado */}
      <div className="px-5 pt-4 pb-2">
        <p className="text-xs text-gray-500 mb-1 capitalize">
          Total pagos — {mesSeleccionado?.nombre}
        </p>
        <p className="text-3xl font-bold text-rose-600">
          S/.{totalPagos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Tabla de detalle */}
      <div className="px-5 pb-5 mt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 text-xs text-gray-500 font-semibold">Concepto</th>
              <th className="text-right py-2 text-xs text-gray-500 font-semibold">Monto</th>
              <th className="text-right py-2 text-xs text-gray-500 font-semibold">% del total</th>
            </tr>
          </thead>
          <tbody>
            {detalle.map((row, i) => {
              const monto = toNum(row[col])
              const pct = totalPagos > 0 ? ((monto / totalPagos) * 100).toFixed(1) : '0'
              return (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 text-gray-700 capitalize">{row[0]}</td>
                  <td className="py-2.5 text-right font-medium text-gray-800">
                    S/.{monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 text-right text-gray-400 text-xs">{pct}%</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-rose-50">
              <td className="py-2.5 px-0 text-sm font-bold text-rose-700">TOTAL</td>
              <td className="py-2.5 text-right font-bold text-rose-700">
                S/.{totalPagos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </td>
              <td className="py-2.5 text-right text-rose-400 text-xs">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── PAGOS PROGRAMADOS ─────────────────────────────────────────────────────
// Sheet: Flujo de Caja — tab "pago recurrente" — range A5:Z10
// headers (fila 5): fechas tipo "15 de marzo", "31 de marzo", ...
// rows[1..5] = filas 6-10 con los pagos por fecha

function PagosProgramados({ data }: { data: SheetData }) {
  // headers = fila 5 del sheet: ["", "15 de marzo", "31 de marzo", ...]
  const fechas = data.headers
    .map((h, i) => ({ fecha: h?.trim(), col: i }))
    .filter(h => h.fecha && h.fecha !== '')

  // Detectar fecha actual: buscar la próxima fecha que contenga el mes actual
  const mesActualNombre = MESES_ES[MES_ACTUAL]
  const fechaDefault =
    fechas.find(f => f.fecha.toLowerCase().includes(mesActualNombre)) ?? fechas[0]

  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechaDefault)

  // rows: filas 6-10 (índices 1..5 porque fila 5 ya fue usada como headers)
  // data.rows[0] = fila 6, data.rows[1] = fila 7, ... data.rows[4] = fila 10
  const pagoRows = data.rows.slice(0, 5).filter(r => r[0]?.trim())

  const col = fechaSeleccionada?.col ?? 1

  // Agrupar fechas por mes para navegación más limpia
  const mesesGrupo = MESES_ES.map(mes => ({
    mes,
    fechasDelMes: fechas.filter(f => f.fecha.toLowerCase().includes(mes)),
  })).filter(g => g.fechasDelMes.length > 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="p-2 rounded-lg border bg-indigo-50 border-indigo-200 text-indigo-700">
          <FileText size={16} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-800 text-sm">Pagos Programados</h2>
          <p className="text-xs text-gray-400">Pago Recurrente — selecciona la fecha</p>
        </div>
      </div>

      {/* Selector de fechas como lista */}
      <div className="px-5 pt-4">
        <select
          value={fechaSeleccionada?.col ?? ''}
          onChange={e => {
            const found = fechas.find(f => f.col === Number(e.target.value))
            if (found) setFechaSeleccionada(found)
          }}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white capitalize focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          {fechas.map(f => (
            <option key={f.col} value={f.col} className="capitalize">{f.fecha}</option>
          ))}
        </select>
      </div>

      {/* Fecha seleccionada */}
      <div className="px-5 pt-4 pb-2">
        <p className="text-xs text-gray-500 mb-1 capitalize">
          Pagos al <span className="font-semibold text-indigo-600">{fechaSeleccionada?.fecha}</span>
        </p>
      </div>

      {/* Tabla */}
      <div className="px-5 pb-5 mt-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 text-xs text-gray-500 font-semibold">Concepto</th>
              <th className="text-right py-2 text-xs text-gray-500 font-semibold">Monto</th>
            </tr>
          </thead>
          <tbody>
            {pagoRows.map((row, i) => {
              const monto = toNum(row[col])
              return (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 text-gray-700">{row[0]}</td>
                  <td className={`py-2.5 text-right font-medium ${monto > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                    {monto > 0 ? `S/.${monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-indigo-50">
              <td className="py-2.5 text-sm font-bold text-indigo-700">TOTAL</td>
              <td className="py-2.5 text-right font-bold text-indigo-700">
                S/.{pagoRows.reduce((s, r) => s + toNum(r[col]), 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── VENTAS POR UNIDAD DE NEGOCIO ─────────────────────────────────────────
// 3 sheets: SSGG, HVAC, ADI — cada una con fila 2=meses, fila 3=montos
// headers = row[0] (meses), valores = row[1] (montos)

const UNIDADES = [
  { key: 'SSGG', color: '#4361ee', light: 'bg-blue-50',   border: 'border-blue-100',   text: 'text-blue-700'   },
  { key: 'HVAC', color: '#10b981', light: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
  { key: 'ADI',  color: '#f59e0b', light: 'bg-amber-50',  border: 'border-amber-100',  text: 'text-amber-700'  },
]

function VentasUnidadNegocio({ sheets }: { sheets: SheetData[] }) {
  const ssgg = sheets.find(s => s.config?.label === 'Ventas SSGG')
  const hvac = sheets.find(s => s.config?.label === 'Ventas HVAC')
  const adi  = sheets.find(s => s.config?.label === 'Ventas ADI')

  const unidades = [
    { meta: UNIDADES[0], data: ssgg },
    { meta: UNIDADES[1], data: hvac },
    { meta: UNIDADES[2], data: adi  },
  ]

  // Construir chartData: meses del eje X desde cualquiera de los 3 sheets
  const refHeaders = (ssgg ?? hvac ?? adi)?.headers ?? []
  const mesesCols = refHeaders
    .map((h, i) => ({ mes: h?.trim(), col: i }))
    .filter(h => h.mes && MESES_ES.includes(h.mes.toLowerCase()))

  const chartData = mesesCols.map(({ mes, col }) => {
    const entry: Record<string, string | number> = { mes: mes.slice(0, 1).toUpperCase() + mes.slice(1, 3) }
    unidades.forEach(({ meta, data }) => {
      entry[meta.key] = data ? toNum(data.rows[0]?.[col]) : 0
    })
    return entry
  })

  // Meses disponibles para el selector (excluye columna N = acumulado)
  const colN = refHeaders.length - 1
  const mesesDisp = mesesCols.filter(m => m.col < colN)

  const mesDefault = mesesDisp.find(m => m.mes.toLowerCase() === MESES_ES[MES_ACTUAL]) ?? mesesDisp[mesesDisp.length - 1]
  const [mesElegido, setMesElegido] = useState(mesDefault)
  const [vistaElegida, setVistaElegida] = useState<'mensual' | 'acumulado'>('mensual')

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden col-span-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="p-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-700">
          <BarChart2 size={16} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-800 text-sm">Ventas por Unidad de Negocio</h2>
          <p className="text-xs text-gray-400">SSGG · HVAC · ADI — evolución mensual</p>
        </div>
        {/* Selectores */}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={mesElegido?.col ?? ''}
            onChange={e => {
              const found = mesesDisp.find(m => m.col === Number(e.target.value))
              if (found) setMesElegido(found)
            }}
            className="border-2 border-blue-300 rounded-xl px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 capitalize focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
          >
            {mesesDisp.map(m => (
              <option key={m.col} value={m.col} className="capitalize">{m.mes}</option>
            ))}
          </select>
          <select
            value={vistaElegida}
            onChange={e => setVistaElegida(e.target.value as 'mensual' | 'acumulado')}
            className="border-2 border-indigo-300 rounded-xl px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
          >
            <option value="mensual">Mensual</option>
            <option value="acumulado">Acumulado</option>
          </select>
        </div>
      </div>

      {/* KPIs por unidad */}
      <div className="grid grid-cols-4 gap-3 px-5 pt-4 pb-2">
        {(() => {
          // Calcular montos de cada unidad y total
          const montosUnidades = unidades.map(({ meta, data }) => {
            const montoMes = mesElegido ? toNum(data?.rows[0]?.[mesElegido.col]) : 0
            const acumuladoHastaMes = mesesDisp
              .filter(m => m.col <= (mesElegido?.col ?? 0))
              .reduce((s, m) => s + toNum(data?.rows[0]?.[m.col]), 0)
            const monto = vistaElegida === 'acumulado' ? acumuladoHastaMes : montoMes
            return { meta, monto }
          })
          const totalGeneral = montosUnidades.reduce((s, u) => s + u.monto, 0)
          const label = vistaElegida === 'acumulado'
            ? `Acumulado hasta ${mesElegido?.mes}`
            : `Ventas ${mesElegido?.mes}`

          return (
            <>
              {montosUnidades.map(({ meta, monto }) => (
                <div key={meta.key} className={`rounded-xl p-4 border ${meta.light} ${meta.border}`}>
                  <p className={`text-xs font-bold ${meta.text} mb-2`}>{meta.key}</p>
                  <p className="text-xs text-gray-400 capitalize mb-0.5">{label}</p>
                  <p className={`text-2xl font-bold ${meta.text}`}>
                    S/.{monto > 0 ? monto.toLocaleString('es-PE', { minimumFractionDigits: 0 }) : '—'}
                  </p>
                </div>
              ))}
              {/* Total de los 3 */}
              <div className="rounded-xl p-4 border bg-blue-600 border-blue-700">
                <p className="text-xs font-bold text-blue-100 mb-2">TOTAL</p>
                <p className="text-xs text-blue-200 capitalize mb-0.5">{label}</p>
                <p className="text-2xl font-bold text-white">
                  S/.{totalGeneral.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                </p>
              </div>
            </>
          )
        })()}
      </div>

      {/* Gráfica de barras agrupadas */}
      <div className="px-5 pb-6 pt-2">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `S/.${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `S/.${v.toLocaleString('es-PE')}`} />
              <Legend />
              {UNIDADES.map(u => (
                <Bar key={u.key} dataKey={u.key} fill={u.color} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── PRESUPUESTO POR ÁREA ──────────────────────────────────────────────────
function PresupuestoPorArea({ data }: { data: SheetData }) {
  const catRows = data.rows.filter(r =>
    r[0] && !r[0].toUpperCase().includes('TOTAL') && !r[0].toUpperCase().includes('CATEGOR')
  )
  if (!catRows.length) return <p className="text-gray-400 text-sm">Sin datos</p>

  const [qIdx,       setQIdx]       = useState(0)
  const [vista,      setVista]      = useState<PresVistaQ>('trimestre')
  const [mesIdx,     setMesIdx]     = useState(0)
  const [areaIdx,    setAreaIdx]    = useState(0)

  const bloque     = PRES_BLOQUES[qIdx]
  const mesesDelQ  = bloque.meses.filter(m => !(m as {esTotal?:boolean}).esTotal)
  const totalCol   = bloque.meses.find(m =>  (m as {esTotal?:boolean}).esTotal)!
  const areaRow    = catRows[areaIdx] ?? catRows[0]

  const getCols = (row: string[]) => {
    if (vista === 'anual') {
      return { est: toNum(row[49]), act: toNum(row[50]), dif: toNum(row[51]) }
    }
    if (vista === 'trimestre') {
      return { est: toNum(row[totalCol.est]), act: toNum(row[totalCol.act]), dif: toNum(row[totalCol.dif]) }
    }
    const m = mesesDelQ[mesIdx] ?? mesesDelQ[0]
    return { est: toNum(row[m.est]), act: toNum(row[m.act]), dif: toNum(row[m.dif]) }
  }

  const kpi = getCols(areaRow)

  // Gráfica: evolución mensual del área seleccionada en el trimestre activo (o anual)
  const mesesGrafica = vista === 'anual'
    ? PRES_BLOQUES.flatMap(b => b.meses.filter(m => !(m as {esTotal?:boolean}).esTotal))
    : mesesDelQ

  const chartData = mesesGrafica.map(m => ({
    mes: m.nombre,
    Estimado: toNum(areaRow[m.est]),
    Actual:   toNum(areaRow[m.act]),
  }))

  const labelVista = vista === 'anual' ? 'Anual' : vista === 'trimestre' ? bloque.label : mesesDelQ[mesIdx]?.nombre

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="p-2 rounded-lg border bg-orange-50 border-orange-200 text-orange-700">
          <FileText size={16} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-800 text-sm">Presupuesto por Área</h2>
          <p className="text-xs text-gray-400">Estimado vs Actual por categoría</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Filtro área */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium shrink-0">Área:</span>
          <select
            value={areaIdx}
            onChange={e => setAreaIdx(Number(e.target.value))}
            className="border-2 border-orange-300 rounded-xl px-3 py-1.5 text-sm font-semibold text-orange-700 bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-300 cursor-pointer flex-1"
          >
            {catRows.map((r, i) => (
              <option key={i} value={i}>{r[0]}</option>
            ))}
          </select>
        </div>

        {/* Filtro período */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 font-medium">Período:</span>
          {PRES_BLOQUES.map((b, i) => (
            <button key={b.label} onClick={() => { setQIdx(i); if (vista === 'anual') setVista('trimestre') }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                qIdx === i && vista !== 'anual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{b.label}</button>
          ))}
          <button onClick={() => setVista('anual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              vista === 'anual' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>Anual</button>
        </div>

        {/* Sub-filtro mes */}
        {vista !== 'anual' && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-400 font-medium">Ver:</span>
            {mesesDelQ.map((m, i) => (
              <button key={m.nombre} onClick={() => { setMesIdx(i); setVista('mes') }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  vista === 'mes' && mesIdx === i ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>{m.nombre}</button>
            ))}
            <button onClick={() => setVista('trimestre')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                vista === 'trimestre' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>Todo el trimestre</button>
          </div>
        )}

        {/* KPIs del área */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <p className="text-xs text-blue-500">Estimado — {labelVista}</p>
            <p className="text-base font-bold text-blue-700">S/.{kpi.est.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <p className="text-xs text-emerald-500">Actual — {labelVista}</p>
            <p className="text-base font-bold text-emerald-700">S/.{kpi.act.toLocaleString('es-PE', { minimumFractionDigits: 0 })}</p>
          </div>
          <div className={`rounded-xl p-3 border ${kpi.dif >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <p className={`text-xs ${kpi.dif >= 0 ? 'text-green-500' : 'text-red-500'}`}>Diferencia</p>
            <p className={`text-base font-bold ${kpi.dif >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {kpi.dif >= 0 ? '+' : ''}S/.{Math.abs(kpi.dif).toLocaleString('es-PE', { minimumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Gráfica mensual del área */}
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `S/.${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `S/.${v.toLocaleString('es-PE')}`} />
              <Legend />
              <Bar dataKey="Estimado" fill="#4361ee" radius={[3,3,0,0]} />
              <Bar dataKey="Actual"   fill="#10b981" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── DEUDAS ────────────────────────────────────────────────────────────────
// Tab "deuda" — A3:D7
// Fila 3 = headers (col A=concepto, B=monto, C=?, D=?)
// Filas 4-6 = deuda de KLLPA (rows[0..2])
// Fila 7 = deuda de OXXO con nosotros (rows[3])

function DeudasCard({ data }: { data: SheetData }) {
  // headers = fila 3, rows[0..2] = filas 4-6 (KLLPA), rows[3] = fila 7 (OXXO)
  const headers   = data.headers  // col labels: Concepto, Monto, etc.
  const kllpaRows = data.rows.slice(0, 3).filter(r => r[0]?.trim())
  const oxxoRow   = data.rows[3] ?? []

  // Total KLLPA = suma de D4 + D5 únicamente (col índice 3)
  const totalKllpa = toNum(data.rows[0]?.[3]) + toNum(data.rows[1]?.[3])
  const totalOxxo  = toNum(oxxoRow[2])

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden col-span-full">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="p-2 rounded-lg border bg-red-50 border-red-200 text-red-700">
          <Scale size={16} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-800 text-sm">Situación de Deudas</h2>
          <p className="text-xs text-gray-400">Deuda KLLPA · Deuda OXXO con nosotros</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-100">

        {/* ── DEUDA DE KLLPA ── */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"/>
            <p className="text-sm font-bold text-gray-800">Deuda de KLLPA</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {headers.map((h, i) => (
                  <th key={i} className={`py-2 text-xs text-gray-400 font-semibold ${i === 0 ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kllpaRows.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  {row.map((cell, j) => (
                    <td key={j} className={`py-2.5 ${j === 0 ? 'text-gray-700' : j === 3 ? 'text-right font-medium text-red-600' : 'text-right text-gray-400'}`}>
                      {j === 3 && toNum(cell) > 0 ? `S/.${toNum(cell).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : j === 0 ? cell : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-red-50">
                <td className="py-2.5 text-sm font-bold text-red-700" colSpan={Math.max(1, headers.length - 1)}>TOTAL</td>
                <td className="py-2.5 text-right font-bold text-red-700">
                  S/.{totalKllpa.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── DEUDA DE OXXO CON KLLPA ── */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"/>
            <p className="text-sm font-bold text-gray-800">Deuda de OXXO con KLLPA</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-6 flex flex-col gap-1">
            <p className="text-xs text-emerald-600 font-medium">Total que OXXO nos debe</p>
            <p className="text-4xl font-bold text-emerald-700 mt-2">
              S/.{totalOxxo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── VENTAS SOCIO ──────────────────────────────────────────────────────────
// Sheet: Proyección 3 tipos — A96:O103
// headers = fila 96 (meses), rows[0..5] = filas 97-102 (tipos), rows[6] = fila 103 (totales)
// Columna O = índice 14 = total por tipo

function VentasSocio({ data }: { data: SheetData }) {
  // Rango B96:O103 → col 0=B(ene), col 12=N(último mes), col 13=O(total anual)
  const meses     = data.headers.map((h, i) => ({ nombre: h?.trim(), col: i })).filter(h => h.nombre && h.nombre !== '' && h.col < 13)
  const tipoRows  = data.rows.slice(0, 6).filter(r => r[0]?.trim())
  const totalRow  = data.rows[6] ?? []

  const mesDefault = meses.find(m => m.nombre?.toLowerCase() === MESES_ES[MES_ACTUAL]) ?? meses[meses.length - 1]
  const [mesElegido, setMesElegido] = useState(mesDefault)
  const [vista, setVista] = useState<'mensual' | 'acumulado'>('mensual')

  const getMonto = (row: string[]) => {
    if (vista === 'acumulado') {
      return meses
        .filter(m => m.col <= (mesElegido?.col ?? 0))
        .reduce((s, m) => s + toNum(row[m.col]), 0)
    }
    return mesElegido ? toNum(row[mesElegido.col]) : 0
  }

  const totalMes   = getMonto(totalRow)
  const chartData  = tipoRows.map(r => ({
    tipo: (r[0] ?? '').substring(0, 20),
    Monto: getMonto(r),
  })).filter(d => d.Monto > 0)

  const label = vista === 'acumulado' ? 'Acumulado anual' : `${mesElegido?.nombre ?? ''}`

  return (
    <div className="space-y-5">
      {/* Card principal */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
            <TrendingUp size={18} />
          </div>
          <div>
            <h2 className="font-bold text-gray-800 text-base">Proyección de Ventas</h2>
            <p className="text-xs text-gray-400">Por tipo de venta — {label}</p>
          </div>
          {/* Selectores */}
          <div className="ml-auto flex gap-2">
            <select
              value={mesElegido?.col ?? ''}
              onChange={e => { const f = meses.find(m => m.col === Number(e.target.value)); if (f) setMesElegido(f) }}
              className="border-2 border-blue-300 rounded-xl px-3 py-1.5 text-sm font-semibold text-blue-700 bg-blue-50 capitalize focus:outline-none cursor-pointer"
            >
              {meses.map(m => <option key={m.col} value={m.col} className="capitalize">{m.nombre}</option>)}
            </select>
            <select
              value={vista}
              onChange={e => setVista(e.target.value as 'mensual' | 'acumulado')}
              className="border-2 border-indigo-300 rounded-xl px-3 py-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 focus:outline-none cursor-pointer"
            >
              <option value="mensual">Mensual</option>
              <option value="acumulado">Acumulado</option>
            </select>
          </div>
        </div>

        {/* Total destacado */}
        <div className="px-6 pt-5 pb-3">
          <p className="text-xs text-gray-500 mb-1">Total ventas — {label}</p>
          <p className="text-4xl font-bold text-blue-600">
            S/.{totalMes.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Tabla de tipos */}
        <div className="px-6 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs text-gray-400 font-semibold">Tipo de Venta</th>
                <th className="text-right py-2 text-xs text-gray-400 font-semibold">Monto</th>
                <th className="text-right py-2 text-xs text-gray-400 font-semibold">% del total</th>
              </tr>
            </thead>
            <tbody>
              {tipoRows.map((row, i) => {
                const monto = getMonto(row)
                const pct   = totalMes > 0 ? ((monto / totalMes) * 100).toFixed(1) : '0'
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 text-gray-700">{row[0]}</td>
                    <td className="py-2.5 text-right font-medium text-gray-800">
                      S/.{monto.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 text-right text-gray-400 text-xs">{pct}%</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50">
                <td className="py-2.5 font-bold text-blue-700">TOTAL</td>
                <td className="py-2.5 text-right font-bold text-blue-700">
                  S/.{totalMes.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 text-right text-blue-400 text-xs">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Gráfica */}
        <div className="px-6 pb-6">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 130, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `S/.${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="tipo" tick={{ fontSize: 9 }} width={130} />
                <Tooltip formatter={(v: number) => `S/.${v.toLocaleString('es-PE')}`} />
                <Bar dataKey="Monto" fill="#4361ee" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TARJETA GENÉRICA ──────────────────────────────────────────────────────
const CARD_META = [
  { icon: Scale,    color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { icon: TrendingUp, color: 'bg-violet-50 border-violet-200 text-violet-700' },
  { icon: Wallet,   color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { icon: DollarSign, color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { icon: BarChart2, color: 'bg-rose-50 border-rose-200 text-rose-700' },
  { icon: FileText, color: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
]

function SheetCard({ sheet, index }: { sheet: SheetData; index: number }) {
  const meta = CARD_META[index % CARD_META.length]
  const Icon = meta.icon
  const label = sheet.config?.label ?? `Sheet ${index + 1}`

  const renderContent = () => {
    if (sheet.error) {
      return (
        <div className="flex items-center gap-2 text-red-500 text-sm py-2">
          <AlertCircle size={16} />
          <span>{sheet.errorMsg ?? 'Error al cargar'}</span>
        </div>
      )
    }
    if (!sheet.rows?.length) return <p className="text-gray-400 text-sm py-4 text-center">Sin datos</p>

    if (label.includes('Resultados'))  return <EstadoResultadosTrim data={sheet} />
    if (label.includes('Equilibrio'))  return <PuntoEquilibrioTrim data={sheet} />
    if (label.includes('Caja'))        return <FlujoCajaTrim data={sheet} />
    if (label.includes('Balance'))     return <BalanceGeneralTrim data={sheet} />
    if (label.includes('Presupuesto')) return <PresupuestoChart data={sheet} />
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className={`p-2 rounded-lg border ${meta.color}`}><Icon size={16} /></div>
        <div>
          <h2 className="font-semibold text-gray-800 text-sm">{label}</h2>
          <p className="text-xs text-gray-400">Por trimestre</p>
        </div>
        {!sheet.error && sheet.rows?.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">{sheet.rows.length} filas</span>
        )}
      </div>
      <div className="px-5 py-4">{renderContent()}</div>
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const [sheets, setSheets]       = useState<SheetData[]>([])
  const [loading, setLoading]     = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [username, setUsername]   = useState('')
  const [allowedTabs, setAllowedTabs] = useState<string[]>(['ventas','presupuesto','pagos','deudas'])

  const fetchData = useCallback(async () => {
    try {
      const [sheetsRes, meRes] = await Promise.all([
        fetch('/api/sheets'),
        fetch('/api/me'),
      ])
      if (sheetsRes.status === 401) { router.push('/login'); return }
      const data = await sheetsRes.json()
      setSheets(Array.isArray(data) ? data : [])
      setLastUpdate(new Date())
      if (meRes.ok) {
        const me = await meRes.json()
        setUsername(me.username ?? '')
        const tabs = me.tabs ?? ['ventas','presupuesto','pagos','deudas']
        setAllowedTabs(tabs)
        if (tabs.length > 0) setTabActiva(tabs[0] as 'ventas' | 'ventas_socio' | 'presupuesto' | 'pagos' | 'deudas')
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [router])

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 60_000)
    return () => clearInterval(iv)
  }, [fetchData])

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
  }

  const flujoEfectivo    = sheets.find(s => s.config?.label === 'Flujo de Efectivo')
  const flujoCaja        = sheets.find(s => s.config?.label === 'Flujo de Caja')
  const pagosProgramados = sheets.find(s => s.config?.label === 'Pagos Programados')
  const ventasSheets     = sheets.filter(s => s.config?.label?.startsWith('Ventas '))
  const presupuesto      = sheets.find(s => s.config?.label === 'Presupuesto')
  const deudas           = sheets.find(s => s.config?.label === 'Deudas')
  const estadoResultados = sheets.find(s => s.config?.label === 'Estado de Resultados')

  const ALL_TABS = [
    { id: 'ventas',        label: 'Ventas',      icon: TrendingUp },
    { id: 'ventas_socio',  label: 'Ventas',      icon: TrendingUp },
    { id: 'presupuesto',   label: 'Presupuesto', icon: BarChart2  },
    { id: 'pagos',         label: 'Pagos',       icon: DollarSign },
    { id: 'deudas',        label: 'Deudas',      icon: Scale      },
  ] as const

  const TABS = ALL_TABS.filter(t => allowedTabs.includes(t.id))
  const [tabActiva, setTabActiva] = useState<'ventas' | 'ventas_socio' | 'presupuesto' | 'pagos' | 'deudas'>('ventas')

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #0b1120 0%, #0f2044 40%, #0b1a38 70%, #091428 100%)',
      backgroundAttachment: 'fixed',
      position: 'relative',
    }}>
      {/* Patrón de grilla financiera sutil */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(56,139,253,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(56,139,253,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />
      {/* Brillo central suave */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(56,139,253,0.08) 0%, transparent 70%)',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <header className="px-6 py-4 sticky top-0 z-10" style={{ background: 'rgba(11,17,32,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(56,139,253,0.15)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white">Dashboard Financiero — KLLPA PERU</h1>
            {username && <p className="text-xs text-blue-300 mt-0.5">Bienvenido, {username}</p>}
            {lastUpdate && (
              <p className="text-xs text-blue-300">
                Actualizado: {lastUpdate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                {' · '}auto-refresca cada 60 seg
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="flex items-center gap-1.5 text-sm text-blue-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10">
              <RefreshCw size={14} /> Actualizar
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/20">
              <LogOut size={14} /> Salir
            </button>
          </div>
        </div>

        {/* Pestañas */}
        <div className="max-w-7xl mx-auto mt-3 flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTabActiva(id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tabActiva === id
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'text-blue-200/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-gray-500">Cargando datos financieros...</p>
          </div>
        ) : (
          <>
            {/* Sin pestañas asignadas */}
            {allowedTabs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <p className="text-blue-200 text-lg font-semibold">Bienvenido, {username}</p>
                <p className="text-blue-300/60 text-sm">Tu panel está siendo configurado. Pronto verás tu información aquí.</p>
              </div>
            )}

            {/* ── PESTAÑA VENTAS ── */}
            {tabActiva === 'ventas' && allowedTabs.includes('ventas') && (
              <div className="space-y-5">
                {flujoEfectivo && !flujoEfectivo.error
                  ? <FlujoEfectivoHero data={flujoEfectivo} />
                  : flujoEfectivo?.error && (
                    <div className="bg-white rounded-2xl border border-red-200 p-5 flex items-center gap-2 text-red-500">
                      <AlertCircle size={16} /> Error Flujo de Efectivo: {flujoEfectivo.errorMsg}
                    </div>
                  )
                }
                {ventasSheets.length > 0 && <VentasUnidadNegocio sheets={ventasSheets} />}
                {estadoResultados && !estadoResultados.error && <EbitdaChart data={estadoResultados} />}
              </div>
            )}

            {/* ── PESTAÑA PRESUPUESTO ── */}
            {tabActiva === 'presupuesto' && allowedTabs.includes('presupuesto') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {presupuesto && !presupuesto.error && (
                  <React.Fragment>
                    <SheetCard sheet={presupuesto} index={0} />
                    <PresupuestoPorArea data={presupuesto} />
                  </React.Fragment>
                )}
              </div>
            )}

            {/* ── PESTAÑA VENTAS SOCIO ── */}
            {tabActiva === 'ventas_socio' && allowedTabs.includes('ventas_socio') && (() => {
              const ventasSocioData = sheets.find(s => s.config?.label === 'Ventas Socio')
              return (
                <div className="space-y-5">
                  {ventasSocioData && !ventasSocioData.error
                    ? <VentasSocio data={ventasSocioData} />
                    : <div className="bg-white rounded-2xl border border-red-200 p-5 flex items-center gap-2 text-red-500"><AlertCircle size={16} /> Error al cargar datos de proyección</div>
                  }
                  {estadoResultados && !estadoResultados.error && <EbitdaChart data={estadoResultados} />}
                </div>
              )
            })()}

            {/* ── PESTAÑA DEUDAS ── */}
            {tabActiva === 'deudas' && allowedTabs.includes('deudas') && (
              <div className="space-y-5">
                {deudas && !deudas.error
                  ? <DeudasCard data={deudas} />
                  : <div className="bg-white rounded-2xl border border-red-200 p-5 flex items-center gap-2 text-red-500">
                      <AlertCircle size={16} /> Error al cargar datos de deudas
                    </div>
                }
              </div>
            )}

            {/* ── PESTAÑA PAGOS ── */}
            {tabActiva === 'pagos' && allowedTabs.includes('pagos') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {flujoCaja        && !flujoCaja.error        && <PagosDelMes        data={flujoCaja} />}
                {pagosProgramados && !pagosProgramados.error && <PagosProgramados   data={pagosProgramados} />}
              </div>
            )}
          </>
        )}
      </main>
      </div>
    </div>
  )
}
