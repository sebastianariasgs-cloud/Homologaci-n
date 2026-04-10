'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function OperativoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [stats, setStats] = useState({ total: 0, pendientes: 0, en_transito: 0, entregadas: 0 })

  useEffect(() => { verificarRol() }, [])

  const verificarRol = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    if (!['operativo_sli', 'admin'].includes(perfil?.rol)) { router.push('/login'); return }
    await cargarSolicitudes()
  }

  const cargarSolicitudes = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('solicitudes_transporte')
      .select('*, proveedores(razon_social), unidades(placa), conductores(nombre_completo)')
      .eq('operativo_id', user!.id)
      .order('created_at', { ascending: false })

    const sols = data || []
    setSolicitudes(sols)
    setStats({
      total: sols.length,
      pendientes: sols.filter(s => s.estado === 'pendiente').length,
      en_transito: sols.filter(s => s.estado === 'en_transito').length,
      entregadas: sols.filter(s => s.estado === 'entregada').length,
    })
    setLoading(false)
  }

  const solicitudesFiltradas = solicitudes.filter(s => {
    const matchEstado = filtroEstado === 'todos' || s.estado === filtroEstado
    const matchBusqueda = busqueda === '' ||
      s.numero?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.consignatario?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.bl_awb?.toLowerCase().includes(busqueda.toLowerCase())
    const matchDesde = fechaDesde === '' || s.fecha_recojo >= fechaDesde
    const matchHasta = fechaHasta === '' || s.fecha_recojo <= fechaHasta
    return matchEstado && matchBusqueda && matchDesde && matchHasta
  })

  const estadoBadge: { [key: string]: { bg: string, color: string, texto: string } } = {
    pendiente: { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente' },
    asignada: { bg: '#EEEDFE', color: '#3C3489', texto: 'Asignada' },
    en_transito: { bg: '#EFF6FF', color: '#1D4ED8', texto: 'En transito' },
    entregada: { bg: '#F0FDF4', color: '#15803D', texto: 'Entregada' },
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
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Solicitudes de transporte</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => router.push('/operativo/nueva')}
            style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + Nueva solicitud
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 24px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total solicitudes', valor: stats.total, bg: '#F7F7F7', color: '#1a1a1a', border: '#EEEEEE' },
            { label: 'Pendientes', valor: stats.pendientes, bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
            { label: 'En transito', valor: stats.en_transito, bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
            { label: 'Entregadas', valor: stats.entregadas, bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${kpi.border}` }}>
              <p style={{ fontSize: '11px', color: '#888', margin: '0 0 8px' }}>{kpi.label}</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: kpi.color, margin: 0, lineHeight: 1 }}>{kpi.valor}</p>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '14px 20px', marginBottom: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: '10px', alignItems: 'center' }}>
            <input type="text" placeholder="Buscar por numero, BL/AWB o consignatario..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ padding: '7px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none' }} />
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              style={{ padding: '7px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none', background: 'white' }}>
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="asignada">Asignada</option>
              <option value="en_transito">En transito</option>
              <option value="entregada">Entregada</option>
            </select>
            <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
              style={{ padding: '7px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none' }} />
            <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
              style={{ padding: '7px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none' }} />
            {(fechaDesde || fechaHasta) && (
              <button onClick={() => { setFechaDesde(''); setFechaHasta('') }}
                style={{ padding: '7px 12px', background: '#F5F5F5', border: '1px solid #E8E8E8', borderRadius: '7px', fontSize: '11px', cursor: 'pointer', color: '#666' }}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
          {solicitudesFiltradas.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#888', margin: '0 0 8px' }}>No hay solicitudes aun</p>
              <p style={{ fontSize: '12px', color: '#BBB', margin: '0 0 20px' }}>Crea tu primera solicitud de transporte</p>
              <button onClick={() => router.push('/operativo/nueva')}
                style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                + Nueva solicitud
              </button>
            </div>
          ) : (
            solicitudesFiltradas.map((sol, i) => {
              const badge = estadoBadge[sol.estado] || estadoBadge.pendiente
              return (
                <div key={sol.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < solicitudesFiltradas.length - 1 ? '1px solid #F5F5F5' : 'none', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{sol.numero}</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#888', margin: '0 0 2px' }}>
                      {sol.direccion_recojo} → {sol.direccion_entrega}
                    </p>
                    <p style={{ fontSize: '10px', color: '#AAA', margin: 0 }}>
                      Recojo: {new Date(sol.fecha_recojo).toLocaleDateString('es-PE')} · {sol.tipo_carga}
                      {sol.proveedores && ` · ${sol.proveedores.razon_social}`}
                      {sol.unidades && ` · ${sol.unidades.placa}`}
                    </p>
                  </div>
                  <button onClick={() => router.push(`/operativo/${sol.id}`)}
                    style={{ fontSize: '11px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer' }}>
                    Ver detalle
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}