'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    if (data.user) {
      const { data: perfil } = await supabase
        .from('perfiles').select('rol').eq('id', data.user.id).single()
      if (perfil?.rol) localStorage.setItem('omni_rol', perfil.rol)
      if (perfil?.rol === 'evaluador') router.push('/evaluador')
      else if (perfil?.rol === 'comercial') router.push('/comercial')
      else if (perfil?.rol === 'pricing') router.push('/pricing')
      else if (perfil?.rol === 'operativo_sli') router.push('/operativo')
      else if (perfil?.rol === 'admin_operativo') router.push('/operativo')
      else if (perfil?.rol === 'supervisor_sli') router.push('/operativo')
      else if (perfil?.rol === 'transporte') router.push('/transporte')
      else if (perfil?.rol === 'admin') router.push('/admin')
      else router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ height: '5px', background: '#C41230' }} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img
              src="/LogoOmni.png"
              alt="Omni Logistics"
              style={{ height: '56px', display: 'block', margin: '0 auto 16px' }} />
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }}>
              Omni Portal
            </h1>
            <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
              Ecosistema digital de Omni Logistics
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '28px' }}>
            {[
              { icono: '🏢', nombre: 'Homologacion', desc: 'Proveedores y documentos' },
              { icono: '📋', nombre: 'Cotizaciones', desc: 'Tarifas y propuestas' },
              { icono: '🚛', nombre: 'Transporte', desc: 'Solicitudes y seguimiento' },
            ].map(mod => (
              <div key={mod.nombre} style={{ background: 'white', borderRadius: '10px', padding: '14px 12px', textAlign: 'center', border: '1px solid #EEEEEE' }}>
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>{mod.icono}</div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 3px' }}>{mod.nombre}</p>
                <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>{mod.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', border: '1px solid #EEEEEE' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', marginBottom: '20px', textAlign: 'center' }}>
              Ingresa a tu cuenta
            </p>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>
                  Correo electronico
                </label>
                <input type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@omnilogistics.com" required
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#1a1a1a', background: 'white', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>
                  Contrasena
                </label>
                <input type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#1a1a1a', background: 'white', boxSizing: 'border-box' }} />
              </div>

              <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                <a href="/forgot-password" style={{ fontSize: '12px', color: '#C41230', textDecoration: 'none', fontWeight: 500 }}>
                  ¿Olvidaste tu contrasena?
                </a>
              </div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                  <p style={{ color: '#C41230', fontSize: '13px', margin: 0 }}>{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '13px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#888' }}>
                ¿Eres proveedor nuevo?{' '}
                <a href="/registro" style={{ color: '#C41230', fontWeight: 600, textDecoration: 'none' }}>
                  Registrate aqui
                </a>
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '11px', color: '#BBB' }}>
              © 2026 Omni Logistics · Omni Portal v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}