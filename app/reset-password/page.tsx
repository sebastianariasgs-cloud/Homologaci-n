'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [sesionLista, setSesionLista] = useState(false)
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSesionLista(true)
        setVerificando(false)
      }
    })

    const timeout = setTimeout(() => {
      setVerificando(false)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmar) {
      setError('Las contrasenias no coinciden')
      return
    }

    if (password.length < 6) {
      setError('La contrasenia debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Error al actualizar: ' + error.message)
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    setListo(true)
    setLoading(false)
    setTimeout(() => router.push('/login'), 3000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', display: 'flex', flexDirection: 'column', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>
      <div style={{ height: '5px', background: '#C41230' }} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '44px', marginBottom: '16px' }} />
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }}>
              Nueva contrasenia
            </h1>
            <p style={{ fontSize: '13px', color: '#888' }}>
              Ingresa tu nueva contrasenia
            </p>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', border: '1px solid #EEEEEE' }}>
            {verificando ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: '13px', color: '#888' }}>Verificando enlace...</p>
              </div>
            ) : listo ? (
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#15803D', marginBottom: '8px' }}>
                  Contrasenia actualizada
                </h2>
                <p style={{ fontSize: '13px', color: '#888' }}>
                  Redirigiendo al inicio de sesion...
                </p>
              </div>
            ) : !sesionLista ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#C41230', marginBottom: '8px' }}>
                  Enlace invalido o expirado
                </h2>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
                  Este enlace no es valido o ya expiro. Solicita uno nuevo.
                </p>
                <a href="/forgot-password"
                  style={{ display: 'inline-block', padding: '10px 20px', background: '#C41230', color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                  Solicitar nuevo enlace
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>
                    Nueva contrasenia
                  </label>
                  <input type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 6 caracteres" required
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>
                    Confirmar contrasenia
                  </label>
                  <input type="password" value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="Repite tu contrasenia" required
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {error && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                    <p style={{ color: '#C41230', fontSize: '13px', margin: 0 }}>{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '12px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.8 : 1 }}>
                  {loading ? 'Actualizando...' : 'Actualizar contrasenia'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}