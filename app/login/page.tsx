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
      if (perfil?.rol === 'evaluador') router.push('/evaluador')
      else if (perfil?.rol === 'comercial') router.push('/comercial')
      else if (perfil?.rol === 'pricing') router.push('/pricing')
      else if (perfil?.rol === 'operativo_sli') router.push('/operativo')
      else if (perfil?.rol === 'transporte') router.push('/transporte')
      else if (perfil?.rol === 'admin') router.push('/evaluador')
      else router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ height: '5px', background: '#C41230' }} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>

          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '48px', marginBottom: '20px' }} />
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }}>
              Plataforma de Homologación
            </h1>
            <p style={{ fontSize: '13px', color: '#888' }}>
              Ingresa tus credenciales para acceder
            </p>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', padding: '36px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', border: '1px solid #EEEEEE' }}>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#444', marginBottom: '7px' }}>
                  Correo electrónico
                </label>
                <input type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@omnilogistics.com" required
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#1a1a1a', background: 'white', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#444', marginBottom: '7px' }}>
                  Contraseña
                </label>
                <input type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '14px', outline: 'none', color: '#1a1a1a', background: 'white', boxSizing: 'border-box' }} />
              </div>

              <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                <a href="/forgot-password" style={{ fontSize: '12px', color: '#C41230', textDecoration: 'none', fontWeight: 500 }}>
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px' }}>
                  <p style={{ color: '#C41230', fontSize: '13px', margin: 0 }}>{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '13px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1, letterSpacing: '0.3px' }}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#888' }}>
                ¿Eres proveedor nuevo?{' '}
                <a href="/registro" style={{ color: '#C41230', fontWeight: 600, textDecoration: 'none' }}>
                  Regístrate aquí
                </a>
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '28px' }}>
            <p style={{ fontSize: '11px', color: '#BBB' }}>
              © 2026 Omni Logistics · Plataforma de Homologación de Proveedores
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}