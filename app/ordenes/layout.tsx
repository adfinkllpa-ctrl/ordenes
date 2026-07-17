import React from 'react'
import OrdenesNav from './nav'

export default function OrdenesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrdenesNav />
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    </>
  )
}
