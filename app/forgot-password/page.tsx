'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError('Error al enviar el correo: ' + error.message)
      setLoading(false)
      return
    }

    setEnviado(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', display: 'flex', flexDirection: 'column', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>
      <div style={{ height: '5px', background: '#C41230' }} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '44px', marginBottom: '16px' }} />
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }}>
              Restablecer contrasenia
            </h1>
            <p style={{ fontSize: '13px', color: '#888' }}>
              Ingresa tu correo y te enviaremos un enlace para restablecer tu contrasenia
            </p>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', border: '1px solid #EEEEEE' }}>

            {enviado ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', background: '#F0FDF4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>
                  ✓
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#15803D', marginBottom: '8px' }}>
                  Correo enviado
                </h2>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px', lineHeight: 1.6 }}>
                  Revisa tu bandeja de entrada y haz clic en el enlace para restablecer tu contrasenia.
                </p>
                <a href="/login" style={{ fontSize: '13px', color: '#C41230', fontWeight: 600, textDecoration: 'none' }}>
                  Volver al inicio de sesion
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>
                    Correo electronico
                  </label>
                  <input type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@empresa.com" required
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {error && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                    <p style={{ color: '#C41230', fontSize: '13px', margin: 0 }}>{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '12px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.8 : 1 }}>
                  {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>

                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <a href="/login" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>
                    Volver al inicio de sesion
                  </a>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}