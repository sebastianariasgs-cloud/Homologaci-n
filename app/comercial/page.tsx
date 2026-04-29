'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonAdmin from '../components/BotonAdmin'
import BotonHub from '../components/BotonHub'

export default function ComercialPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [stats, setStats] = useState({ total: 0, pendientes: 0, enviadas: 0, aceptadas: 0 })

  useEffect(() => { verificarRol() }, [])

  const verificarRol = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', session.user.id).single()
    if (!['comercial', 'admin'].includes(perfil?.rol)) { router.push('/dashboard'); return }
    await cargarCotizaciones()
  }

  const cargarCotizaciones = async () => {
    const { data } = await supabase
      .from('cotizaciones')
      .select('*, clientes(razon_social, ruc)')
      .order('created_at', { ascending: false })
    const cots = data || []
    setCotizaciones(cots)
    setStats({
      total: cots.length,
      pendientes: cots.filter((c: any) => c.estado === 'pendiente').length,
      enviadas: cots.filter((c: any) => c.estado === 'enviada').length,
      aceptadas: cots.filter((c: any) => c.estado === 'aceptada').length,
    })
    setLoading(false)
  }

  const cotizacionesFiltradas = cotizaciones.filter((c: any) => {
    const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado
    const matchBusqueda = busqueda === '' ||
      c.numero?.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.clientes?.razon_social?.toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchBusqueda
  })

  const estadoBadge: { [key: string]: { bg: string, color: string, texto: string } } = {
    borrador:  { bg: '#F5F5F5', color: '#616161', texto: 'Borrador' },
    pendiente: { bg: '#FFF3E0', color: '#E65100', texto: 'Pendiente de envío' },
    enviada:   { bg: '#E3F2FD', color: '#1565C0', texto: 'Enviada' },
    aceptada:  { bg: '#E8F5E9', color: '#2E7D32', texto: 'Aceptada' },
    rechazada: { bg: '#FFEBEE', color: '#B71C1C', texto: 'Rechazada' },
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #EEEEEE', borderTopColor: '#C41230', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#999', fontSize: '13px', margin: 0 }}>Cargando...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '28px', filter: 'brightness(0) invert(1)' }} />
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Módulo de cotizaciones</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BotonHub />
          <BotonAdmin />
          <button onClick={() => router.push('/comercial/nueva')}
            style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + Nueva cotización
          </button>
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '1060px', margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
          {[
            { label: 'Total cotizaciones', valor: stats.total, bg: 'white', color: '#0F1923', border: '#E8ECF0', icon: '📋' },
            { label: 'Pendientes de envío', valor: stats.pendientes, bg: '#FFF3E0', color: '#E65100', border: '#FFCC80', icon: '⏳' },
            { label: 'Enviadas', valor: stats.enviadas, bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9', icon: '📤' },
            { label: 'Aceptadas', valor: stats.aceptadas, bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7', icon: '✅' },
          ].map((kpi: any) => (
            <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '14px', padding: '18px 20px', border: `1px solid ${kpi.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <span style={{ fontSize: '20px' }}>{kpi.icon}</span>
              <p style={{ fontSize: '30px', fontWeight: 800, color: kpi.color, margin: '8px 0 4px', lineHeight: 1 }}>{kpi.valor}</p>
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E8ECF0', padding: '14px 20px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <input type="text" placeholder="Buscar por número o cliente..." value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '8px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#0F1923' }} />
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ padding: '8px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', color: '#0F1923' }}>
            <option value="todos">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="pendiente">Pendiente de envío</option>
            <option value="enviada">Enviada</option>
            <option value="aceptada">Aceptada</option>
            <option value="rechazada">Rechazada</option>
          </select>
          <span style={{ fontSize: '12px', color: '#8A9BB0', fontWeight: 500 }}>{cotizacionesFiltradas.length} resultado{cotizacionesFiltradas.length !== 1 ? 's' : ''}</span>
        </div>

        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {cotizacionesFiltradas.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', margin: '0 0 12px' }}>📋</p>
              <p style={{ fontSize: '14px', color: '#8A9BB0', margin: '0 0 8px', fontWeight: 600 }}>No hay cotizaciones aún</p>
              <button onClick={() => router.push('/comercial/nueva')}
                style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                + Nueva cotización
              </button>
            </div>
          ) : cotizacionesFiltradas.map((cot: any, i: number) => {
            const b = estadoBadge[cot.estado] || estadoBadge.borrador
            return (
              <div key={cot.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: i < cotizacionesFiltradas.length - 1 ? '1px solid #F5F7FA' : 'none', background: i % 2 === 0 ? 'white' : '#FAFBFC', cursor: 'pointer' }}
                onMouseEnter={(e: any) => e.currentTarget.style.background = '#F5F7FA'}
                onMouseLeave={(e: any) => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFBFC'}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923' }}>{cot.numero}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: b.bg, color: b.color }}>{b.texto}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#8A9BB0', margin: '0 0 2px' }}>
                    {cot.clientes?.razon_social} · {cot.tipo_servicio} · {cot.origen} → {cot.destino}
                  </p>
                  <p style={{ fontSize: '11px', color: '#BCC6D0', margin: 0 }}>{new Date(cot.created_at).toLocaleDateString('es-PE')}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F1923' }}>
                    {cot.moneda} {cot.total_final?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                  <button onClick={() => router.push(`/comercial/${cot.id}`)}
                    style={{ fontSize: '12px', background: '#F0F2F5', color: '#0F1923', border: '1px solid #E8ECF0', borderRadius: '8px', padding: '6px 16px', cursor: 'pointer', fontWeight: 600 }}>
                    Ver →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}