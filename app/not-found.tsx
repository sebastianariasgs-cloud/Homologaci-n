import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ height: '5px', background: '#C41230' }} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '420px' }}>

          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '48px', marginBottom: '32px' }} />

          <div style={{ fontSize: '80px', fontWeight: 700, color: '#C41230', lineHeight: 1, marginBottom: '16px' }}>
            404
          </div>

          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1a1a1a', marginBottom: '10px' }}>
            Pagina no encontrada
          </h1>

          <p style={{ fontSize: '13px', color: '#888', marginBottom: '28px', lineHeight: 1.6 }}>
            La pagina que buscas no existe o fue movida. Verifica la URL o regresa al inicio.
          </p>

          <Link href="/login"
            style={{ display: 'inline-block', padding: '12px 28px', background: '#C41230', color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
            Ir al inicio
          </Link>

          <div style={{ marginTop: '40px' }}>
            <p style={{ fontSize: '11px', color: '#BBB' }}>
              © 2026 Omni Logistics · Plataforma de Homologacion de Proveedores
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}