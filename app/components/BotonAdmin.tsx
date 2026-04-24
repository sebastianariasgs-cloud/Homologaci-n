'use client'

import { useEffect, useState } from 'react'

export default function BotonAdmin() {
  const [esAdmin, setEsAdmin] = useState(false)

  useEffect(() => {
    const rol = localStorage.getItem('omni_rol')
    if (rol === 'admin') setEsAdmin(true)
  }, [])

  if (!esAdmin) return null

  return (
    <a href="/admin"
      style={{
        fontSize: '12px',
        color: 'white',
        fontWeight: 600,
        textDecoration: 'none',
        background: '#C41230',
        padding: '6px 14px',
        borderRadius: '7px',
        border: '1px solid #A01028',
        marginRight: '4px'
      }}>
      ← Panel admin
    </a>
  )
}