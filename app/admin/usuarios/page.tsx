'use client'

import { useState } from 'react'

const ROLES = [
  { value: 'proveedor', label: 'Proveedor' },
  { value: 'evaluador', label: 'Evaluador' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'operativo_sli', label: 'Operativo SLI' },
  { value: 'admin_operativo', label: 'Admin Operativo' },
  { value: 'supervisor_sli', label: 'Supervisor SLI' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'admin', label: 'Administrador' },
]

export default function CrearUsuarioPage() {
  const [form, setForm] = useState({ ruc: '', razon_social: '', email: '', password: '', rol: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setExito(false)

    const res = await fetch('/api/admin/crear-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })

    const data = await res.json()

    if (data.error) {
      setError(data.error)
    } else {
      setExito(true)
      setForm({ ruc: '', razon_social: '', email: '', password: '', rol: '' })
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* SIDEBAR */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '220px', height: '100vh', background: '#0F1923', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <img src="/LogoOmni.png" alt="Omni" style={{ height: '30px', filter: 'brightness(0) invert(1)' }} />
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', margin: '8px 0 0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Panel de administración</p>
        </div>
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 8px 10px', fontWeight: 600 }}>Módulos</p>
          {[
            { href: '/evaluador', icon: '🏢', label: 'Homologación' },
            { href: '/comercial', icon: '📋', label: 'Cotizaciones' },
            { href: '/transporte', icon: '🚛', label: 'Transporte' },
          ].map((item: any) => (
            <a key={item.href} href={item.href}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', marginBottom: '2px', textDecoration: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
              <span style={{ fontSize: '15px' }}>{item.icon}</span>
              {item.label}
            </a>
          ))}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '16px 0' }} />
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 8px 10px', fontWeight: 600 }}>Configuración</p>
          <a href="/admin/usuarios"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', textDecoration: 'none', background: 'rgba(196,18,48,0.15)', color: '#FF6B6B', fontSize: '13px', border: '1px solid rgba(196,18,48,0.2)' }}>
            <span style={{ fontSize: '15px' }}>👤</span>
            Gestionar usuarios
          </a>
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <a href="/admin" style={{ display: 'block', padding: '9px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', textAlign: 'center', textDecoration: 'none' }}>
            ← Volver al panel
          </a>
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ marginLeft: '220px', padding: '40px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>Crear nuevo usuario</h1>
          <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>Completa los datos para registrar un nuevo usuario en el portal</p>
        </div>

        <div style={{ maxWidth: '520px' }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '32px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <form onSubmit={handleSubmit}>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>RUC</label>
                <input type="text" required maxLength={11}
                  value={form.ruc}
                  onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                  placeholder="20xxxxxxxxx"
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: '#0F1923', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Razón Social</label>
                <input type="text" required
                  value={form.razon_social}
                  onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                  placeholder="Empresa S.A.C."
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: '#0F1923', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correo Electrónico</label>
                <input type="email" required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@empresa.com"
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: '#0F1923', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contraseña Temporal</label>
                <input type="password" required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', color: '#0F1923', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rol</label>
                <select required value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: 'white', color: '#0F1923', outline: 'none' }}>
                  <option value="">Selecciona un rol</option>
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                  <p style={{ color: '#B71C1C', fontSize: '13px', margin: 0 }}>❌ {error}</p>
                </div>
              )}

              {exito && (
                <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                  <p style={{ color: '#2E7D32', fontSize: '13px', margin: 0 }}>✅ Usuario creado exitosamente</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '13px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
                {loading ? 'Creando usuario...' : 'Crear usuario'}
              </button>

            </form>
          </div>
        </div>
      </div>
    </div>
  )
}