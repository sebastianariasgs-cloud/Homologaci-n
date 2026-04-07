'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegistroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    razon_social: '',
    ruc: '',
    email: '',
    password: '',
    confirmar_password: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmar_password) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (form.ruc.length !== 11) {
      setError('El RUC debe tener 11 dígitos')
      return
    }

    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (authError) {
      setError('Error al crear la cuenta: ' + authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: dbError } = await supabase
        .from('proveedores')
        .insert({
          user_id: data.user.id,
          razon_social: form.razon_social,
          ruc: form.ruc,
          estado: 'pendiente',
        })

      if (dbError) {
        setError('Error al guardar los datos: ' + dbError.message)
        setLoading(false)
        return
      }

      await supabase.from('perfiles').insert({
        id: data.user.id,
        rol: 'proveedor',
      })

      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ height: '5px', background: '#C41230' }} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ width: '100%', maxWidth: '460px' }}>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '44px', marginBottom: '16px' }} />
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }}>
              Registro de proveedor
            </h1>
            <p style={{ fontSize: '13px', color: '#888' }}>
              Completa tus datos para iniciar el proceso de homologación
            </p>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', border: '1px solid #EEEEEE' }}>

            <form onSubmit={handleRegistro}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>
                  Razón social <span style={{ color: '#C41230' }}>*</span>
                </label>
                <input type="text" name="razon_social" value={form.razon_social}
                  onChange={handleChange} placeholder="Empresa S.A.C." required
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>
                  RUC <span style={{ color: '#C41230' }}>*</span>
                </label>
                <input type="text" name="ruc" value={form.ruc}
                  onChange={handleChange} placeholder="20XXXXXXXXX" maxLength={11} required
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>
                  Correo electrónico <span style={{ color: '#C41230' }}>*</span>
                </label>
                <input type="email" name="email" value={form.email}
                  onChange={handleChange} placeholder="contacto@empresa.com" required
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>
                    Contraseña <span style={{ color: '#C41230' }}>*</span>
                  </label>
                  <input type="password" name="password" value={form.password}
                    onChange={handleChange} placeholder="Mínimo 6 caracteres" required
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>
                    Confirmar contraseña <span style={{ color: '#C41230' }}>*</span>
                  </label>
                  <input type="password" name="confirmar_password" value={form.confirmar_password}
                    onChange={handleChange} placeholder="Repite tu contraseña" required
                    style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                  <p style={{ color: '#C41230', fontSize: '13px', margin: 0 }}>{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '12px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
                {loading ? 'Registrando...' : 'Crear cuenta'}
              </button>
            </form>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#888' }}>
                ¿Ya tienes cuenta?{' '}
                <a href="/login" style={{ color: '#C41230', fontWeight: 600, textDecoration: 'none' }}>
                  Inicia sesión
                </a>
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ fontSize: '11px', color: '#BBB' }}>
              © 2026 Omni Logistics · Plataforma de Homologación de Proveedores
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}