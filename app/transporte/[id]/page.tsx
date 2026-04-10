'use client'

import { useRouter } from 'next/navigation'

export default function DetalleSolicitudTransportePage() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: '#888', margin: '0 0 12px' }}>Detalle de solicitud transporte — en construccion</p>
        <button onClick={() => router.push('/transporte')}
          style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          Volver
        </button>
      </div>
    </div>
  )
}