'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ComercialPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [cotizaciones, setCotizaciones] = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [stats, setStats] = useState({ total: 0, pendientes: 0, enviadas: 0, aceptadas: 0 })

  useEffect(() => { verificarRol() }, [])

  const verificarRol = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    if (!['comercial', 'admin'].includes(perfil?.rol)) { router.push('/login'); return }
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
      pendientes: cots.filter(c => c.estado === 'pendiente').length,
      enviadas: cots.filter(c => c.estado === 'enviada').length,
      aceptadas: cots.filter(c => c.estado === 'aceptada').length,
    })
    setLoading(false)
  }

  const cotizacionesFiltradas = cotizaciones.filter(c => {
    const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado
    const matchBusqueda = busqueda === '' ||
      c.numero?.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.clientes?.razon_social?.toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchBusqueda
  })

  const estadoBadge: { [key: string]: { bg: string, color: string, texto: string } } = {
    borrador: { bg: '#F5F5F5', color: '#666', texto: 'Borrador' },
    pendiente: { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente de envio' },
    enviada: { bg: '#EFF6FF', color: '#1D4ED8', texto: 'Enviada' },
    aceptada: { bg: '#F0FDF4', color: '#15803D', texto: 'Aceptada' },
    rechazada: { bg: '#FEF2F2', color: '#C41230', texto: 'Rechazada' },
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Modulo de cotizaciones</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => router.push('/comercial/nueva')}
            style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + Nueva cotizacion
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total cotizaciones', valor: stats.total, bg: '#F7F7F7', color: '#1a1a1a', border: '#EEEEEE' },
            { label: 'Pendientes de envio', valor: stats.pendientes, bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
            { label: 'Enviadas', valor: stats.enviadas, bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
            { label: 'Aceptadas', valor: stats.aceptadas, bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${kpi.border}` }}>
              <p style={{ fontSize: '11px', color: '#888', margin: '0 0 8px' }}>{kpi.label}</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: kpi.color, margin: 0, lineHeight: 1 }}>{kpi.valor}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '14px 20px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="Buscar por numero o cliente..."
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '7px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none' }} />
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ padding: '7px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none', background: 'white' }}>
            <option value="todos">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="pendiente">Pendiente de envio</option>
            <option value="enviada">Enviada</option>
            <option value="aceptada">Aceptada</option>
            <option value="rechazada">Rechazada</option>
          </select>
          <span style={{ fontSize: '11px', color: '#888' }}>{cotizacionesFiltradas.length} resultados</span>
        </div>

        {/* Lista cotizaciones */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
          {cotizacionesFiltradas.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#888', margin: '0 0 8px' }}>No hay cotizaciones aun</p>
              <p style={{ fontSize: '12px', color: '#BBB', margin: '0 0 20px' }}>Crea tu primera cotizacion para empezar</p>
              <button onClick={() => router.push('/comercial/nueva')}
                style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                + Nueva cotizacion
              </button>
            </div>
          ) : (
            cotizacionesFiltradas.map((cot, i) => {
              const badge = estadoBadge[cot.estado] || estadoBadge.borrador
              return (
                <div key={cot.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < cotizacionesFiltradas.length - 1 ? '1px solid #F5F5F5' : 'none', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{cot.numero}</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                      {cot.clientes?.razon_social} · {cot.tipo_servicio} · {cot.origen} → {cot.destino}
                    </p>
                    <p style={{ fontSize: '10px', color: '#AAA', margin: '2px 0 0' }}>
                      {new Date(cot.created_at).toLocaleDateString('es-PE')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>
                      {cot.moneda} {cot.total_final?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </span>
                    <button onClick={() => router.push(`/comercial/${cot.id}`)}
                      style={{ fontSize: '11px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer' }}>
                      Ver
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}