'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonAdmin from '../components/BotonAdmin'
import BotonHub from '../components/BotonHub'

const ESTADOS_UNIDAD_ORDEN = [
  'Asignado',
  'En transito a recojo',
  'Retiro en curso',
  'En transito a entrega',
  'Descarga en curso',
  'Descarga Completa',
  'En transito a almacén de vacíos',
  'Servicio completado',
]

const statusColor: { [key: string]: { bg: string, color: string } } = {
  'Asignado': { bg: '#EEEDFE', color: '#3C3489' },
  'En transito a recojo': { bg: '#EFF6FF', color: '#1D4ED8' },
  'Retiro en curso': { bg: '#EEEDFE', color: '#3C3489' },
  'En transito a entrega': { bg: '#EFF6FF', color: '#1D4ED8' },
  'Descarga en curso': { bg: '#FFF7ED', color: '#C2410C' },
  'Descarga Completa': { bg: '#F0FDF4', color: '#15803D' },
  'En transito a almacén de vacíos': { bg: '#F5F3FF', color: '#6D28D9' },
  'Servicio completado': { bg: '#F0FDF4', color: '#15803D' },
}

const estadoBadge: { [key: string]: { bg: string, color: string, texto: string } } = {
  pendiente: { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente' },
  asignada: { bg: '#EEEDFE', color: '#3C3489', texto: 'Asignada' },
  en_transito: { bg: '#EFF6FF', color: '#1D4ED8', texto: 'En transito' },
  entregada: { bg: '#F0FDF4', color: '#15803D', texto: 'Entregada' },
}

// Calcula el status más atrasado entre todas las unidades de una solicitud
const calcularStatusGeneral = (sol: any): string | null => {
  const asigs = sol.solicitud_asignaciones || []
  if (asigs.length === 0) return null
  let minIdx = ESTADOS_UNIDAD_ORDEN.length - 1
  asigs.forEach((a: any) => {
    const s = a.solicitud_unidad_status?.[0]?.status || 'Asignado'
    const idx = ESTADOS_UNIDAD_ORDEN.indexOf(s)
    if (idx !== -1 && idx < minIdx) minIdx = idx
  })
  return ESTADOS_UNIDAD_ORDEN[minIdx]
}

const formatFecha = (fecha: string) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Lima' })
}

export default function OperativoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [rolUsuario, setRolUsuario] = useState('')
  const [stats, setStats] = useState({ total: 0, pendientes: 0, en_transito: 0, entregadas: 0, nuevas: 0 })
  const rolRef = useRef('')
  const userIdRef = useRef('')
  const iniciado = useRef(false)

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    init()
  }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', session.user.id).single()
    const rolesPermitidos = ['operativo_sli', 'admin_operativo', 'supervisor_sli', 'admin']
    if (!rolesPermitidos.includes(perfil?.rol)) { router.push('/login'); return }
    setRolUsuario(perfil?.rol)
    rolRef.current = perfil?.rol
    userIdRef.current = session.user.id
    await cargarSolicitudes(perfil?.rol, session.user.id)

    // Suscripcion en tiempo real para actualizar la lista
    supabase.channel('op-lista')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_transporte' }, () => {
        cargarSolicitudes(rolRef.current, userIdRef.current)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitud_unidad_status' }, () => {
        cargarSolicitudes(rolRef.current, userIdRef.current)
      })
      .subscribe()
  }

  const cargarSolicitudes = async (rol: string, userId: string) => {
    let query = supabase
      .from('solicitudes_transporte')
      .select(`
        *,
        clientes(razon_social),
        solicitud_asignaciones(
          id, orden,
          solicitud_unidad_status(status, updated_at)
        )
      `)
      .order('created_at', { ascending: false })

    if (rol === 'operativo_sli') {
      query = query.eq('operativo_id', userId)
    }

    const { data } = await query
    const sols = data || []
    setSolicitudes(sols)
    setStats({
      total: sols.length,
      pendientes: sols.filter((s: any) => s.estado === 'pendiente').length,
      en_transito: sols.filter((s: any) => s.estado === 'en_transito').length,
      entregadas: sols.filter((s: any) => s.estado === 'entregada').length,
      nuevas: sols.filter((s: any) => !s.visto_por_transporte && s.estado === 'pendiente').length,
    })
    setLoading(false)
  }

  const exportarExcel = async () => {
    const XLSX = await import('xlsx')
    const datos = solicitudesFiltradas.map((s: any) => ({
      'FECHA DE CULMINACION': s.fecha_culminacion ? new Date(s.fecha_culminacion).toLocaleDateString('es-PE') : '',
      'DEADLINE DE FACTURACIÓN': s.deadline_facturacion ? new Date(s.deadline_facturacion).toLocaleDateString('es-PE') : '',
      'FECHA DE FACTURACIÓN': s.fecha_facturacion ? new Date(s.fecha_facturacion).toLocaleDateString('es-PE') : '',
      'TIPO': s.tipo_servicio || '',
      'N° SOLICITUD': s.numero || '',
      'CLIENTE': s.clientes?.razon_social || s.consignatario || '',
      '# SHIPMENT': s.shipment || '',
      'BL O AWB': s.bl_awb || '',
      '#CTN / CAMIONES': s.num_unidades || 1,
      'TIPO CARGA': s.tipo_carga || '',
      'ALM. DE RETIRO / RECOJO': s.direccion_recojo || '',
      'FECHA DE RETIRO': s.fecha_recojo ? new Date(s.fecha_recojo).toLocaleDateString('es-PE') : '',
      'ZONA': s.zona || '',
      'ALMACEN DEVOLUCIÓN': s.almacen_devolucion || '',
      'STATUS': calcularStatusGeneral(s) || s.estado || '',
      'EVENTO CRÍTICO 1': s.evento_critico_1 || 'Ninguno',
      'EVENTO CRÍTICO 2': s.evento_critico_2 || 'Ninguno',
      'COMENTARIOS': s.comentarios_operativo || '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datos)
    ws['!cols'] = [
      { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 6 }, { wch: 14 },
      { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 8 }, { wch: 14 },
      { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 25 },
      { wch: 22 }, { wch: 22 }, { wch: 40 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte SLI')
    XLSX.writeFile(wb, `Reporte_SLI_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const solicitudesFiltradas = solicitudes.filter((s: any) => {
    const matchEstado = filtroEstado === 'todos' || s.estado === filtroEstado
    const matchBusqueda = busqueda === '' ||
      s.numero?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.consignatario?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.bl_awb?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.shipment?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.clientes?.razon_social?.toLowerCase().includes(busqueda.toLowerCase())
    const matchDesde = fechaDesde === '' || s.fecha_recojo >= fechaDesde
    const matchHasta = fechaHasta === '' || s.fecha_recojo <= fechaHasta
    return matchEstado && matchBusqueda && matchDesde && matchHasta
  })

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
          {rolUsuario === 'admin_operativo' && (
            <span style={{ fontSize: '10px', background: '#FEF2F2', color: '#C41230', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, border: '1px solid #FECACA' }}>Admin Operativo</span>
          )}
          {rolUsuario === 'supervisor_sli' && (
            <span style={{ fontSize: '10px', background: '#EEEDFE', color: '#3C3489', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, border: '1px solid #C4B5FD' }}>Supervisor SLI</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={exportarExcel}
            style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            ↓ Exportar Excel
          </button>
          <button onClick={() => router.push('/operativo/nueva')}
            style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '7px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + Nueva solicitud
          </button>
          <BotonHub />
          <BotonAdmin />
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total', valor: stats.total, bg: '#F7F7F7', color: '#1a1a1a', border: '#EEEEEE' },
            { label: 'Pendientes', valor: stats.pendientes, bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
            { label: 'En transito', valor: stats.en_transito, bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
            { label: 'Entregadas', valor: stats.entregadas, bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
            { label: 'Sin ver por transporte', valor: stats.nuevas, bg: stats.nuevas > 0 ? '#FEF2F2' : '#F7F7F7', color: stats.nuevas > 0 ? '#C41230' : '#888', border: stats.nuevas > 0 ? '#FECACA' : '#EEEEEE' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${kpi.border}` }}>
              <p style={{ fontSize: '11px', color: '#888', margin: '0 0 8px' }}>{kpi.label}</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: kpi.color, margin: 0, lineHeight: 1 }}>{kpi.valor}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '14px 20px', marginBottom: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
            <input type="text" placeholder="Buscar por numero, BL, shipment, cliente..."
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
            {(fechaDesde || fechaHasta || filtroEstado !== 'todos' || busqueda) && (
              <button onClick={() => { setFechaDesde(''); setFechaHasta(''); setFiltroEstado('todos'); setBusqueda('') }}
                style={{ padding: '7px 12px', background: '#F5F5F5', border: '1px solid #E8E8E8', borderRadius: '7px', fontSize: '11px', cursor: 'pointer', color: '#666' }}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Tabla */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
          {/* Cabecera */}
          <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 70px 110px 180px 160px 90px 80px', gap: '8px', padding: '10px 20px', background: '#F9F9F9', borderBottom: '1px solid #EEEEEE', fontSize: '10px', fontWeight: 600, color: '#888' }}>
            <span></span>
            <span>SOLICITUD</span>
            <span>TIPO</span>
            <span>SHIPMENT</span>
            <span>STATUS UNIDADES</span>
            <span>CLIENTE</span>
            <span>ESTADO</span>
            <span></span>
          </div>

          {solicitudesFiltradas.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: '#888', margin: '0 0 8px' }}>No hay solicitudes</p>
              <button onClick={() => router.push('/operativo/nueva')}
                style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                + Nueva solicitud
              </button>
            </div>
          ) : (
            solicitudesFiltradas.map((sol: any, i: number) => {
              const badge = estadoBadge[sol.estado] || estadoBadge.pendiente
              const esNueva = !sol.visto_por_transporte && sol.estado === 'pendiente'
              const statusGeneral = calcularStatusGeneral(sol)
              const sc = statusGeneral ? (statusColor[statusGeneral] || { bg: '#F5F5F5', color: '#666' }) : null
              const numAsigs = sol.solicitud_asignaciones?.length || 0
              const numCompletadas = sol.solicitud_asignaciones?.filter((a: any) =>
                a.solicitud_unidad_status?.[0]?.status === 'Servicio completado'
              ).length || 0

              return (
                <div key={sol.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '20px 1fr 70px 110px 180px 160px 90px 80px',
                    gap: '8px',
                    padding: '12px 20px',
                    borderBottom: i < solicitudesFiltradas.length - 1 ? '1px solid #F5F5F5' : 'none',
                    background: esNueva ? '#FFFBEB' : i % 2 === 0 ? 'white' : '#FAFAFA',
                    alignItems: 'center',
                    borderLeft: esNueva ? '3px solid #F59E0B' : '3px solid transparent',
                  }}>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {esNueva && <div title="Sin ver por transporte" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{sol.numero}</span>
                      {esNueva && <span style={{ fontSize: '9px', background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>NUEVO</span>}
                      {sol.num_unidades > 1 && <span style={{ fontSize: '9px', background: '#FEF2F2', color: '#C41230', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>{sol.num_unidades} uts</span>}
                    </div>
                    <p style={{ fontSize: '10px', color: '#888', margin: '0 0 1px' }}>
                      {sol.bl_awb || '—'} · {formatFecha(sol.fecha_recojo)}
                    </p>
                    <p style={{ fontSize: '10px', color: '#AAA', margin: 0 }}>
                      {sol.direccion_recojo} → {sol.direccion_entrega}
                    </p>
                  </div>

                  <span style={{ fontSize: '11px', fontWeight: 700, color: sol.tipo_servicio === 'EXPO' ? '#1D4ED8' : '#C41230', background: sol.tipo_servicio === 'EXPO' ? '#EFF6FF' : '#FEF2F2', padding: '3px 8px', borderRadius: '6px', textAlign: 'center' as const }}>
                    {sol.tipo_servicio || 'IMPO'}
                  </span>

                  <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>
                    {sol.shipment || '—'}
                  </span>

                  {/* Status real de unidades */}
                  <div>
                    {sc && statusGeneral ? (
                      <>
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: sc.bg, color: sc.color, display: 'inline-block', marginBottom: '2px' }}>
                          {statusGeneral}
                        </span>
                        {numAsigs > 1 && (
                          <p style={{ fontSize: '9px', color: '#AAA', margin: 0 }}>
                            {numCompletadas}/{numAsigs} unidades completadas
                          </p>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: '10px', color: '#BBB' }}>Sin asignar</span>
                    )}
                  </div>

                  <span style={{ fontSize: '11px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {sol.clientes?.razon_social || sol.consignatario || '—'}
                  </span>

                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: badge.bg, color: badge.color, textAlign: 'center' as const }}>
                    {badge.texto}
                  </span>

                  <button onClick={() => router.push(`/operativo/${sol.id}`)}
                    style={{ fontSize: '11px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                    Ver →
                  </button>
                </div>
              )
            })
          )}

          {solicitudesFiltradas.length > 0 && (
            <div style={{ padding: '10px 20px', borderTop: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#888' }}>{solicitudesFiltradas.length} solicitudes</span>
              <button onClick={exportarExcel}
                style={{ fontSize: '11px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>
                ↓ Exportar Excel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}