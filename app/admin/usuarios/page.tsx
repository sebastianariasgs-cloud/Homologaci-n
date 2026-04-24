'use client'

import { useState } from 'react'

const ROLES = [
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
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: '' })
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
      setForm({ nombre: '', email: '', password: '', rol: '' })
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '480px', margin: '40px auto', padding: '0 20px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px', color: '#1a1a1a' }}>
        Crear nuevo usuario
      </h2>

      <div style={{ background: 'white', borderRadius: '12px', padding: '32px', border: '1px solid #EEEEEE' }}>
        <form onSubmit={handleSubmit}>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Nombre completo</label>
            <input type="text" required value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Juan Pérez"
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Correo electrónico</label>
            <input type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="usuario@omnilogistics.com"
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Contraseña temporal</label>
            <input type="password" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Rol</label>
            <select required value={form.rol}
              onChange={(e) => setForm({ ...form, rol: e.target.value })}
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: 'white' }}>
              <option value="">Selecciona un rol</option>
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
              <p style={{ color: '#C41230', fontSize: '13px', margin: 0 }}>❌ {error}</p>
            </div>
          )}

          {exito && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
              <p style={{ color: '#16A34A', fontSize: '13px', margin: 0 }}>✅ Usuario creado exitosamente</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '13px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
            {loading ? 'Creando usuario...' : 'Crear usuario'}
          </button>
        </form>
      </div>

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <a href="/admin" style={{ fontSize: '13px', color: '#C41230', textDecoration: 'none' }}>← Volver al panel admin</a>
      </div>
    </div>
  )
}