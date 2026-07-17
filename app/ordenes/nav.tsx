'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'

interface Session {
  email: string
  nombre: string
  isLoggedIn: boolean
}

export default function OrdenesNav() {
  const [session, setSession] = useState<Session | null>(null)
  const [esAprobador, setEsAprobador] = useState(false)

  useEffect(() => {
    fetch('/api/ordenes/me')
      .then(res => res.json())
      .then(data => {
        if (data.isLoggedIn && data.email) {
          const sessionData = { email: data.email, nombre: data.nombre || 'Usuario', isLoggedIn: true }
          setSession(sessionData)
          setEsAprobador(data.email.toLowerCase() === 'ad.fin.kllpa@gmail.com')
        }
      })
      .catch(() => {})
  }, [])

  return (
    <nav style={{ backgroundColor: '#002F5D' }} className="text-white px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-bold">📋 Módulo de Órdenes</h1>
          <div className="flex gap-4">
            <Link href="/ordenes/nueva" className="hover:text-gray-300 transition">
              ➕ Nueva Orden
            </Link>
            <Link href="/ordenes" className="hover:text-gray-300 transition">
              📊 Mis Órdenes
            </Link>
            {esAprobador && (
              <Link href="/ordenes/pagos" className="hover:text-gray-300 transition font-semibold" style={{ color: '#33B44A' }}>
                💳 Control de Pagos
              </Link>
            )}
          </div>
        </div>
        {session && (
          <div className="text-sm text-gray-300">
            {session.nombre}
          </div>
        )}
      </div>
    </nav>
  )
}
