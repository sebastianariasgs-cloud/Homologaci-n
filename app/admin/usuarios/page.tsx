'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

const ROLES_INTERNOS = ['evaluador', 'comercial', 'pricing', 'operativo_sli', 'admin_operativo', 'supervisor_sli', 'transporte', 'admin']

const rolColors: Record<string, { bg: string, color: string }> = {
  admin:           { bg: '#FFEBEE', color: '#B71C1C' },
  proveedor:       { bg: '#E3F2FD', color: '#1565C0' },
  evaluador:       { bg: '#F3E5F5', color: '#6A1B9A' },
  comercial:       { bg: '#E8F5E9', color: '#2E7D32' },
  pricing:         { bg: '#FFF3E0', color: '#E65100' },
  transporte:      { bg: '#E0F7FA', color: '#00695C' },
  operativo_sli:   { bg: '#FFF8E1', color: '#F57F17' },
  admin_operativo: { bg: '#FCE4EC', color: '#880E4F' },
  supervisor_sli:  { bg: '#E8EAF6', color: '#283593' },
}

export default function GestionUsuariosPage() {
  const [vista, setVista] = useState<'lista' | 'crear'>('lista')
  const [pestana, setPestana] = useState<'internos' | 'externos'>('internos')
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({ ruc: '', razon_social: '', email: '', password: '', rol: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [editandoRol, setEditandoRol] = useState<string | null>(null)
  const [nuevoRol, setNuevoRol] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null)
  const [rucEstado, setRucEstado] = useState<'' | 'buscando' | 'ok' | 'error'>('')

  const esInterno = ROLES_INTERNOS.includes(form.rol)

  useEffect(() => { cargarUsuarios() }, [])

  const cargarUsuarios = async () => {
    setLoadingUsuarios(true)
    const { data } = await supabase.from('perfiles').select('*').order('created_at', { ascending: false })
    setUsuarios(data || [])
    setLoadingUsuarios(false)
  }

  const buscarRUC = async (ruc: string) => {
    if (ruc.length !== 11) return
    setRucEstado('buscando')
    try {
      const res = await fetch(`/api/validar-ruc?ruc=${ruc}`)
      const data = await res.json()
      if (data.nombre) {
        setForm(prev => ({ ...prev, razon_social: data.nombre }))
        setRucEstado('ok')
      } else {
        setRucEstado('error')
      }
    } catch {
      setRucEstado('error')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setExito('')

    if (form.rol === 'proveedor' && rucEstado !== 'ok') {
      setError('Debes validar el RUC antes de continuar')
      setLoading(false)
      return
    }

    if (form.rol === 'proveedor' && form.ruc) {
      const { data: existing } = await supabase.from('perfiles').select('id').eq('ruc', form.ruc).single()
      if (existing) {
        setError('Ya existe un proveedor con ese RUC')
        setLoading(false)
        return
      }
    }

    const res = await fetch('/api/admin/crear-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        razon_social: form.razon_social,
        ruc: esInterno ? '' : form.ruc,
        rol: form.rol,
      })
    })

    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setExito('✅ Usuario creado exitosamente')
      setForm({ ruc: '', razon_social: '', email: '', password: '', rol: '' })
      setRucEstado('')
      await cargarUsuarios()
      setTimeout(() => { setVista('lista'); setExito('') }, 1500)
    }
    setLoading(false)
  }

  const cambiarRol = async (id: string) => {
    if (!nuevoRol) return
    await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', id)
    setEditandoRol(null)
    setNuevoRol('')
    await cargarUsuarios()
  }

  const eliminarUsuario = async (id: string) => {
    const res = await fetch('/api/admin/eliminar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    const data = await res.json()
    if (!data.error) { setConfirmEliminar(null); await cargarUsuarios() }
  }

  const rolLabel = (rol: string) => ROLES.find(r => r.value === rol)?.label || rol

  const usuariosInternos = usuarios.filter((u: any) => ROLES_INTERNOS.includes(u.rol))
  const usuariosExternos = usuarios.filter((u: any) => u.rol === 'proveedor' || !u.rol)

  const filtrar = (lista: any[]) => {
    if (!busqueda) return lista
    const q = busqueda.toLowerCase()
    return lista.filter((u: any) =>
      u.email?.toLowerCase().includes(q) ||
      u.nombre?.toLowerCase().includes(q) ||
      u.razon_social?.toLowerCase().includes(q) ||
      u.ruc?.includes(q)
    )
  }

  const listaActual = filtrar(pestana === 'internos' ? usuariosInternos : usuariosExternos)

  const FilaUsuario = ({ u, i, total }: { u: any, i: number, total: number }) => {
    const rc = rolColors[u.rol] || { bg: '#F5F5F5', color: '#616161' }
    const esEditando = editandoRol === u.id
    const esEliminando = confirmEliminar === u.id
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: i < total - 1 ? '1px solid #F5F7FA' : 'none', background: i % 2 === 0 ? 'white' : '#FAFBFC', flexWrap: 'wrap' as any, gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' as any }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>
              {u.nombre || u.razon_social || u.email || '—'}
            </p>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: rc.bg, color: rc.color }}>
              {rolLabel(u.rol)}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#8A9BB0', margin: '0 0 2px' }}>{u.email || '—'}</p>
          {u.ruc && <p style={{ fontSize: '11px', color: '#BCC6D0', margin: 0 }}>RUC {u.ruc} {u.razon_social ? `· ${u.razon_social}` : ''}</p>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {esEditando ? (
            <>
              <select value={nuevoRol} onChange={(e) => setNuevoRol(e.target.value)}
                style={{ padding: '7px 12px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', outline: 'none', background: 'white', color: '#0F1923' }}>
                <option value="">Selecciona rol</option>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button onClick={() => cambiarRol(u.id)}
                style={{ padding: '7px 14px', background: '#0F1923', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Guardar
              </button>
              <button onClick={() => { setEditandoRol(null); setNuevoRol('') }}
                style={{ padding: '7px 14px', background: '#F0F2F5', color: '#8A9BB0', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </>
          ) : esEliminando ? (
            <>
              <span style={{ fontSize: '12px', color: '#B71C1C', fontWeight: 600 }}>¿Confirmar?</span>
              <button onClick={() => eliminarUsuario(u.id)}
                style={{ padding: '7px 14px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Eliminar
              </button>
              <button onClick={() => setConfirmEliminar(null)}
                style={{ padding: '7px 14px', background: '#F0F2F5', color: '#8A9BB0', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditandoRol(u.id); setNuevoRol(u.rol) }}
                style={{ padding: '7px 14px', background: '#F0F2F5', color: '#0F1923', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Cambiar rol
              </button>
              <button onClick={() => setConfirmEliminar(u.id)}
                style={{ padding: '7px 14px', background: '#FFEBEE', color: '#B71C1C', border: '1px solid #EF9A9A', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* SIDEBAR */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '220px', height: '100vh', background: '#0F1923', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <a href="/admin">
            <img src="/LogoOmni.png" alt="Omni" style={{ height: '30px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
          </a>
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
              <span>{item.icon}</span>{item.label}
            </a>
          ))}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '16px 0' }} />
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 8px 10px', fontWeight: 600 }}>Configuración</p>
          <a href="/admin/usuarios"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', textDecoration: 'none', background: 'rgba(196,18,48,0.15)', color: '#FF6B6B', fontSize: '13px', border: '1px solid rgba(196,18,48,0.2)' }}>
            <span>👤</span>Gestionar usuarios
          </a>
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <a href="/admin" style={{ display: 'block', padding: '9px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', textAlign: 'center', textDecoration: 'none' }}>
            ← Volver al panel
          </a>
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ marginLeft: '220px', padding: '32px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>Gestión de usuarios</h1>
            <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>
              {usuariosInternos.length} internos · {usuariosExternos.length} proveedores
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setVista('lista'); setError(''); setExito('') }}
              style={{ padding: '9px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: vista === 'lista' ? '#0F1923' : 'white', color: vista === 'lista' ? 'white' : '#8A9BB0', border: vista === 'lista' ? 'none' : '1px solid #E8ECF0' }}>
              👥 Ver usuarios
            </button>
            <button onClick={() => { setVista('crear'); setError(''); setExito('') }}
              style={{ padding: '9px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: vista === 'crear' ? '#C41230' : 'white', color: vista === 'crear' ? 'white' : '#8A9BB0', border: vista === 'crear' ? 'none' : '1px solid #E8ECF0' }}>
              + Crear usuario
            </button>
          </div>
        </div>

        {/* LISTA */}
        {vista === 'lista' && (
          <div>
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E8ECF0', padding: '14px 20px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <input type="text" placeholder="Buscar por nombre, email, razón social o RUC..."
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#0F1923', boxSizing: 'border-box' as any }} />
            </div>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'white', padding: '4px', borderRadius: '10px', border: '1px solid #E8ECF0', width: 'fit-content' }}>
              <button onClick={() => setPestana('internos')}
                style={{ padding: '7px 20px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', background: pestana === 'internos' ? '#0F1923' : 'transparent', color: pestana === 'internos' ? 'white' : '#8A9BB0' }}>
                🏢 Usuarios internos ({usuariosInternos.length})
              </button>
              <button onClick={() => setPestana('externos')}
                style={{ padding: '7px 20px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', background: pestana === 'externos' ? '#0F1923' : 'transparent', color: pestana === 'externos' ? 'white' : '#8A9BB0' }}>
                🚚 Proveedores ({usuariosExternos.length})
              </button>
            </div>

            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 24px', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>
                  {pestana === 'internos' ? 'Equipo Omni Logistics' : 'Proveedores externos'}
                </p>
                <span style={{ fontSize: '12px', color: '#8A9BB0' }}>{listaActual.length} resultado{listaActual.length !== 1 ? 's' : ''}</span>
              </div>

              {loadingUsuarios ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ color: '#8A9BB0', fontSize: '13px' }}>Cargando...</p>
                </div>
              ) : listaActual.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ fontSize: '28px', margin: '0 0 10px' }}>🔍</p>
                  <p style={{ color: '#8A9BB0', fontSize: '13px', margin: 0 }}>
                    {busqueda ? 'Sin resultados para tu búsqueda' : 'No hay usuarios en esta categoría'}
                  </p>
                </div>
              ) : listaActual.map((u: any, i: number) => (
                <FilaUsuario key={u.id} u={u} i={i} total={listaActual.length} />
              ))}
            </div>
          </div>
        )}

        {/* CREAR */}
        {vista === 'crear' && (
          <div style={{ maxWidth: '520px' }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <form onSubmit={handleSubmit}>

                {/* Rol */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rol</label>
                  <select required value={form.rol}
                    onChange={(e) => { setForm({ ...form, rol: e.target.value, ruc: '', razon_social: '' }); setRucEstado('') }}
                    style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' as any, background: 'white', color: '#0F1923', outline: 'none' }}>
                    <option value="">Selecciona un rol</option>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                {/* RUC y Razón Social — solo proveedores */}
                {form.rol === 'proveedor' && (
                  <>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>RUC</label>
                      <div style={{ position: 'relative' }}>
                        <input type="text" required maxLength={11}
                          value={form.ruc}
                          onChange={async (e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 11)
                            setForm(prev => ({ ...prev, ruc: val, razon_social: '' }))
                            setRucEstado('')
                            if (val.length === 11) await buscarRUC(val)
                          }}
                          placeholder="20xxxxxxxxx"
                          style={{ width: '100%', padding: '11px 14px', paddingRight: '40px', border: `1.5px solid ${rucEstado === 'ok' ? '#A5D6A7' : rucEstado === 'error' ? '#EF9A9A' : '#E8ECF0'}`, borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' as any, color: '#0F1923', outline: 'none' }} />
                        <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px' }}>
                          {rucEstado === 'buscando' ? '⏳' : rucEstado === 'ok' ? '✅' : rucEstado === 'error' ? '❌' : ''}
                        </span>
                      </div>
                      {rucEstado === 'buscando' && <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '4px 0 0' }}>Consultando SUNAT...</p>}
                      {rucEstado === 'error' && <p style={{ fontSize: '11px', color: '#B71C1C', margin: '4px 0 0' }}>RUC no encontrado en SUNAT</p>}
                      {rucEstado === 'ok' && <p style={{ fontSize: '11px', color: '#2E7D32', margin: '4px 0 0' }}>RUC validado correctamente</p>}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Razón Social</label>
                      <input type="text" required
                        value={form.razon_social}
                        onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                        placeholder="Se llena automáticamente con el RUC"
                        style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${rucEstado === 'ok' ? '#A5D6A7' : '#E8ECF0'}`, borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' as any, color: '#0F1923', outline: 'none', background: rucEstado === 'ok' ? '#F1F8F1' : 'white' }} />
                    </div>
                  </>
                )}

                {/* Nombre — usuarios internos */}
                {esInterno && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre completo</label>
                    <input type="text" required
                      value={form.razon_social}
                      onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                      placeholder="Ej: Juan Pérez"
                      style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' as any, color: '#0F1923', outline: 'none' }} />
                  </div>
                )}

                {/* Email */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correo Electrónico</label>
                  <input type="email" required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="usuario@empresa.com"
                    style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' as any, color: '#0F1923', outline: 'none' }} />
                </div>

                {/* Contraseña */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#444', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contraseña Temporal</label>
                  <input type="password" required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' as any, color: '#0F1923', outline: 'none' }} />
                </div>

                {error && (
                  <div style={{ background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                    <p style={{ color: '#B71C1C', fontSize: '13px', margin: 0 }}>❌ {error}</p>
                  </div>
                )}
                {exito && (
                  <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                    <p style={{ color: '#2E7D32', fontSize: '13px', margin: 0 }}>{exito}</p>
                  </div>
                )}

                <button type="submit" disabled={loading || !form.rol}
                  style={{ width: '100%', padding: '13px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !form.rol ? 0.7 : 1 }}>
                  {loading ? 'Creando usuario...' : 'Crear usuario'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}