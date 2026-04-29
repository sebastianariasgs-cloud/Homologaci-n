'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonHub from '../../components/BotonHub'

export default function EvaluadorUsuariosPage() {
  const router = useRouter()
  const [vista, setVista] = useState<'lista' | 'crear'>('lista')
  const [proveedores, setProveedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState({ ruc: '', razon_social: '', email: '', password: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [rucEstado, setRucEstado] = useState<'' | 'buscando' | 'ok' | 'error'>('')

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single()
    if (!['evaluador', 'admin'].includes(perfil?.rol)) { router.push('/login'); return }
    await cargarProveedores()
  }

  const cargarProveedores = async () => {
    setLoading(true)
    const { data } = await supabase.from('perfiles').select('*')
      .eq('rol', 'proveedor').order('created_at', { ascending: false })
    setProveedores(data || [])
    setLoading(false)
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
      } else setRucEstado('error')
    } catch { setRucEstado('error') }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rucEstado !== 'ok') { setError('Debes validar el RUC antes de continuar'); return }
    setGuardando(true)
    setError('')
    setExito('')

    const { data: existing } = await supabase.from('perfiles').select('id').eq('ruc', form.ruc).single()
    if (existing) { setError('Ya existe un proveedor con ese RUC'); setGuardando(false); return }

    const res = await fetch('/api/admin/crear-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, password: form.password, razon_social: form.razon_social, ruc: form.ruc, rol: 'proveedor' })
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setExito('✅ Proveedor creado exitosamente')
      setForm({ ruc: '', razon_social: '', email: '', password: '' })
      setRucEstado('')
      await cargarProveedores()
      setTimeout(() => { setVista('lista'); setExito('') }, 1500)
    }
    setGuardando(false)
  }

  const proveedoresFiltrados = proveedores.filter((p: any) => {
    const q = busqueda.toLowerCase()
    return !busqueda || p.email?.toLowerCase().includes(q) || p.nombre?.toLowerCase().includes(q) || p.ruc?.includes(q)
  })

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* NAV */}
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/evaluador">
            <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
          </a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <a href="/evaluador" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Evaluador</a>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Usuarios proveedores</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BotonHub />
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>Usuarios proveedores</h1>
            <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>{proveedores.length} proveedores registrados</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setVista('lista'); setError(''); setExito('') }}
              style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: vista === 'lista' ? '#0F1923' : 'white', color: vista === 'lista' ? 'white' : '#8A9BB0', border: vista === 'lista' ? 'none' : '1px solid #E8ECF0' }}>
              Ver lista
            </button>
            <button onClick={() => { setVista('crear'); setError(''); setExito('') }}
              style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: vista === 'crear' ? '#C41230' : 'white', color: vista === 'crear' ? 'white' : '#8A9BB0', border: vista === 'crear' ? 'none' : '1px solid #E8ECF0' }}>
              + Nuevo proveedor
            </button>
          </div>
        </div>

        {/* LISTA */}
        {vista === 'lista' && (
          <div>
            <div style={{ marginBottom: '14px' }}>
              <input type="text" placeholder="Buscar por nombre, email o RUC..."
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#0F1923', background: 'white', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Proveedores registrados</p>
                <span style={{ fontSize: '11px', color: '#8A9BB0' }}>{proveedoresFiltrados.length} resultado{proveedoresFiltrados.length !== 1 ? 's' : ''}</span>
              </div>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ color: '#8A9BB0', fontSize: '13px', margin: 0 }}>Cargando...</p>
                </div>
              ) : proveedoresFiltrados.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ fontSize: '28px', margin: '0 0 10px' }}>🔍</p>
                  <p style={{ color: '#8A9BB0', fontSize: '13px', margin: 0 }}>
                    {busqueda ? 'Sin resultados' : 'No hay proveedores registrados'}
                  </p>
                </div>
              ) : proveedoresFiltrados.map((p: any, i: number) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < proveedoresFiltrados.length - 1 ? '1px solid #F5F7FA' : 'none', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: '0 0 3px' }}>{p.nombre || p.ruc || '—'}</p>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 2px' }}>{p.email}</p>
                    {p.ruc && <p style={{ fontSize: '10px', color: '#BCC6D0', margin: 0 }}>RUC {p.ruc}</p>}
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, background: '#E3F2FD', color: '#1565C0', padding: '3px 10px', borderRadius: '20px' }}>Proveedor</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CREAR */}
        {vista === 'crear' && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '32px', border: '0.5px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 20px' }}>Registrar nuevo proveedor</p>
            <form onSubmit={handleSubmit}>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>RUC *</label>
                <div style={{ position: 'relative' }}>
                  <input type="text" required maxLength={11} value={form.ruc}
                    onChange={async (e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 11)
                      setForm(prev => ({ ...prev, ruc: val, razon_social: '' }))
                      setRucEstado('')
                      if (val.length === 11) await buscarRUC(val)
                    }}
                    placeholder="20xxxxxxxxx"
                    style={{ width: '100%', padding: '11px 14px', paddingRight: '40px', border: `1.5px solid ${rucEstado === 'ok' ? '#A5D6A7' : rucEstado === 'error' ? '#EF9A9A' : '#E8ECF0'}`, borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' as const, color: '#0F1923', outline: 'none' }} />
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px' }}>
                    {rucEstado === 'buscando' ? '⏳' : rucEstado === 'ok' ? '✅' : rucEstado === 'error' ? '❌' : ''}
                  </span>
                </div>
                {rucEstado === 'buscando' && <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '4px 0 0' }}>Consultando SUNAT...</p>}
                {rucEstado === 'error' && <p style={{ fontSize: '11px', color: '#B71C1C', margin: '4px 0 0' }}>RUC no encontrado en SUNAT</p>}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Razón social *</label>
                <input type="text" required value={form.razon_social}
                  onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                  placeholder="Se llena automáticamente con el RUC"
                  style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${rucEstado === 'ok' ? '#A5D6A7' : '#E8ECF0'}`, borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' as const, color: '#0F1923', outline: 'none', background: rucEstado === 'ok' ? '#F1F8F1' : 'white' }} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Correo electrónico *</label>
                <input type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contacto@empresa.com"
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' as const, color: '#0F1923', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Contraseña temporal *</label>
                <input type="password" required value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' as const, color: '#0F1923', outline: 'none' }} />
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

              <button type="submit" disabled={guardando || rucEstado !== 'ok'}
                style={{ width: '100%', padding: '13px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando || rucEstado !== 'ok' ? 0.6 : 1 }}>
                {guardando ? 'Creando...' : 'Crear proveedor →'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}