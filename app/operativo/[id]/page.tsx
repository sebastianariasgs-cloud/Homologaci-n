'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import BotonAdmin from '../../components/BotonAdmin'

const ESTADOS_TIMELINE_BASE = [
  'Pendiente de asignación',
  'Asignado',
  'En transito a recojo',
  'Retiro en curso',
  'En transito a entrega',
  'Descarga en curso',
  'Descarga Completa',
  'Servicio completado',
]

const ESTADOS_TIMELINE_CONTENEDOR = [
  'Pendiente de asignación',
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
  'Pendiente de asignación': { bg: '#FFF7ED', color: '#C2410C' },
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

const formatFecha = (fecha: string, conHora = false) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(conHora && { hour: '2-digit', minute: '2-digit' }),
    timeZone: 'America/Lima',
  })
}

interface HistorialEntry {
  id: string
  solicitud_id: string
  usuario_id: string
  estado_anterior: string
  estado_nuevo: string
  comentario: string | null
  created_at: string
  email: string
}

export default function DetalleSolicitudOperativoPage() {
  const router = useRouter()
  const params = useParams()
  const [solicitud, setSolicitud] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [historial, setHistorial] = useState<HistorialEntry[]>([])
  const [asignaciones, setAsignaciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const iniciado = useRef(false)

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    const solicitudId = params.id as string
    cargarTodo(solicitudId)

    const canal = supabase
      .channel(`op-detalle-${solicitudId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'solicitudes_transporte',
        filter: `id=eq.${solicitudId}`,
      }, (payload) => {
        setSolicitud((prev: any) => ({ ...prev, ...payload.new }))
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'solicitud_asignaciones',
        filter: `solicitud_id=eq.${solicitudId}`,
      }, () => cargarAsignaciones(solicitudId))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'solicitud_unidad_status',
        filter: `solicitud_id=eq.${solicitudId}`,
      }, () => cargarAsignaciones(solicitudId))
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'solicitud_historial',
        filter: `solicitud_id=eq.${solicitudId}`,
      }, async (payload) => {
        try {
          const { data: email } = await supabase.rpc('get_user_email', { user_id: payload.new.usuario_id })
          const entrada: HistorialEntry = {
            id: payload.new.id,
            solicitud_id: payload.new.solicitud_id,
            usuario_id: payload.new.usuario_id,
            estado_anterior: payload.new.estado_anterior,
            estado_nuevo: payload.new.estado_nuevo,
            comentario: payload.new.comentario,
            created_at: payload.new.created_at,
            email: email || '—',
          }
          setHistorial(prev => prev.find(h => h.id === entrada.id) ? prev : [...prev, entrada])
        } catch {
          setHistorial(prev => [...prev, {
            id: payload.new.id,
            solicitud_id: payload.new.solicitud_id,
            usuario_id: payload.new.usuario_id,
            estado_anterior: payload.new.estado_anterior,
            estado_nuevo: payload.new.estado_nuevo,
            comentario: payload.new.comentario,
            created_at: payload.new.created_at,
            email: '—',
          }])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [])

  const cargarTodo = async (solicitudId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    await Promise.all([
      cargarSolicitud(solicitudId),
      cargarAsignaciones(solicitudId),
      cargarHistorial(solicitudId),
      cargarDocumentos(solicitudId),
    ])
    setLoading(false)
  }

  const cargarSolicitud = async (solicitudId: string) => {
    const { data } = await supabase
      .from('solicitudes_transporte')
      .select('*, clientes(razon_social)')
      .eq('id', solicitudId)
      .single()
    if (!data) { router.push('/operativo'); return }
    setSolicitud(data)
  }

  const cargarAsignaciones = async (solicitudId: string) => {
    const { data } = await supabase
      .from('solicitud_asignaciones')
      .select('*, proveedores(razon_social), unidades(placa), conductores(nombre_completo), solicitud_unidad_status(*)')
      .eq('solicitud_id', solicitudId)
      .order('orden')
    setAsignaciones(data || [])
  }

  const cargarHistorial = async (solicitudId: string) => {
    const { data: hist } = await supabase
      .from('solicitud_historial')
      .select('*')
      .eq('solicitud_id', solicitudId)
      .order('created_at', { ascending: true })

    const histConEmails: HistorialEntry[] = await Promise.all((hist || []).map(async (h: any) => {
      try {
        const { data: email } = await supabase.rpc('get_user_email', { user_id: h.usuario_id })
        return { ...h, email: email || '—' }
      } catch {
        return { ...h, email: '—' }
      }
    }))
    setHistorial(histConEmails)
  }

  const cargarDocumentos = async (solicitudId: string) => {
    const { data } = await supabase
      .from('solicitud_documentos')
      .select('*')
      .eq('solicitud_id', solicitudId)
    setDocumentos(data || [])
  }

  const verDocumento = async (url: string) => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const esContenedor = () => ['Contenedor 20 HQ', 'Contenedor 40 HQ'].includes(solicitud?.tipo_carga || '')

  const getStatusGeneral = () => {
    if (asignaciones.length === 0) return 'Pendiente de asignación'
    const estados = esContenedor() ? ESTADOS_TIMELINE_CONTENEDOR : ESTADOS_TIMELINE_BASE
    let minIdx = estados.length - 1
    asignaciones.forEach((a: any) => {
      const s = a.solicitud_unidad_status?.[0]?.status || 'Asignado'
      const idx = estados.indexOf(s)
      if (idx !== -1 && idx < minIdx) minIdx = idx
    })
    return estados[minIdx]
  }

  if (loading || !solicitud) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
    </div>
  )

  const badge = estadoBadge[solicitud.estado] || estadoBadge.pendiente
  const estadosTimeline = esContenedor() ? ESTADOS_TIMELINE_CONTENEDOR : ESTADOS_TIMELINE_BASE
  const statusGeneral = getStatusGeneral()
  const statusIdxGeneral = estadosTimeline.indexOf(statusGeneral)

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <button onClick={() => router.push('/operativo')}
            style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Solicitudes
          </button>
          <span style={{ color: '#DDD' }}>›</span>
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>{solicitud.numero}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BotonAdmin />
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 24px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '16px' }}>
        <div>

          {/* Cabecera */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' as const }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{solicitud.numero}</h2>
              <span style={{ fontSize: '10px', fontWeight: 700, color: solicitud.tipo_servicio === 'EXPO' ? '#1D4ED8' : '#C41230', background: solicitud.tipo_servicio === 'EXPO' ? '#EFF6FF' : '#FEF2F2', padding: '2px 8px', borderRadius: '6px' }}>
                {solicitud.tipo_servicio || 'IMPO'}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
                {badge.texto}
              </span>
              {solicitud.num_unidades > 1 && (
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: '#FEF2F2', color: '#C41230' }}>
                  {solicitud.num_unidades} unidades
                </span>
              )}
            </div>
            <p style={{ fontSize: '11px', color: '#888', margin: '0 0 14px' }}>
              Creada el {formatFecha(solicitud.created_at, true)}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#F9F9F9', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
              {[
                { label: 'Cliente', valor: solicitud.clientes?.razon_social || solicitud.consignatario || '—' },
                { label: 'Shipment', valor: solicitud.shipment || '—' },
                { label: 'BL / AWB', valor: solicitud.bl_awb || '—' },
                { label: 'Recojo / Alm. retiro', valor: solicitud.direccion_recojo },
                { label: 'Direccion de entrega', valor: solicitud.direccion_entrega },
                { label: 'Zona', valor: solicitud.zona || '—' },
                { label: 'Almacen devolucion', valor: solicitud.almacen_devolucion || '—' },
                { label: 'Tipo de carga', valor: solicitud.tipo_carga },
                { label: 'Unidades requeridas', valor: solicitud.num_unidades || 1 },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>{item.label}</p>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{item.valor}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#F0F4FF', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
              <div>
                <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Fecha recojo</p>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{formatFecha(solicitud.fecha_recojo)}</p>
              </div>
              <div>
                <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Fecha culminacion</p>
                <p style={{ fontSize: '11px', fontWeight: 600, color: solicitud.fecha_culminacion ? '#15803D' : '#AAA', margin: 0 }}>
                  {solicitud.fecha_culminacion ? formatFecha(solicitud.fecha_culminacion, true) : 'Pendiente'}
                </p>
              </div>
            </div>

            {((solicitud.evento_critico_1 && solicitud.evento_critico_1 !== 'Ninguno') ||
              (solicitud.evento_critico_2 && solicitud.evento_critico_2 !== 'Ninguno')) && (
              <div style={{ background: '#FEF2F2', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', border: '1px solid #FECACA' }}>
                <p style={{ fontSize: '10px', color: '#C41230', margin: '0 0 6px', fontWeight: 600 }}>⚠️ EVENTOS CRITICOS</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                  {solicitud.evento_critico_1 !== 'Ninguno' && (
                    <span style={{ fontSize: '11px', background: '#FEF2F2', color: '#C41230', border: '1px solid #FECACA', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>
                      {solicitud.evento_critico_1}
                    </span>
                  )}
                  {solicitud.evento_critico_2 !== 'Ninguno' && (
                    <span style={{ fontSize: '11px', background: '#FEF2F2', color: '#C41230', border: '1px solid #FECACA', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>
                      {solicitud.evento_critico_2}
                    </span>
                  )}
                </div>
              </div>
            )}

            {solicitud.comentarios_operativo && (
              <div style={{ background: '#FFFBEB', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', border: '1px solid #FDE68A' }}>
                <p style={{ fontSize: '10px', color: '#92400E', margin: '0 0 3px', fontWeight: 600 }}>COMENTARIOS OPERATIVO</p>
                <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{solicitud.comentarios_operativo}</p>
              </div>
            )}

            {solicitud.observaciones && (
              <div style={{ background: '#FFF7ED', borderRadius: '8px', padding: '10px 12px' }}>
                <p style={{ fontSize: '10px', color: '#C2410C', margin: '0 0 3px', fontWeight: 600 }}>INSTRUCCIONES PARA EL TRANSPORTISTA</p>
                <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{solicitud.observaciones}</p>
              </div>
            )}
          </div>

          {/* Barra de seguimiento */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Seguimiento del servicio</p>
              <span style={{ fontSize: '10px', color: '#15803D', background: '#F0FDF4', padding: '2px 8px', borderRadius: '20px', border: '1px solid #BBF7D0' }}>
                ● En tiempo real
              </span>
            </div>
            <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: `${estadosTimeline.length * 96}px` }}>
                {estadosTimeline.map((est, i) => {
                  const esDone = statusIdxGeneral > i
                  const esCurrent = statusGeneral === est
                  const sc = statusColor[est] || { bg: '#F5F5F5', color: '#666' }
                  return (
                    <div key={est} style={{ display: 'flex', alignItems: 'flex-start', flex: i < estadosTimeline.length - 1 ? 1 : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '80px' }}>
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', flexShrink: 0, fontWeight: 700,
                          background: esDone ? '#F0FDF4' : esCurrent ? sc.bg : '#F5F5F5',
                          border: `2px solid ${esDone ? '#15803D' : esCurrent ? sc.color : '#E8E8E8'}`,
                          color: esDone ? '#15803D' : esCurrent ? sc.color : '#AAA',
                        }}>
                          {esDone ? '✓' : esCurrent ? '●' : '○'}
                        </div>
                        <span style={{
                          fontSize: '8px', textAlign: 'center' as const, lineHeight: 1.3,
                          color: esDone ? '#15803D' : esCurrent ? sc.color : '#AAA',
                          fontWeight: esCurrent || esDone ? 600 : 400,
                          maxWidth: '76px', display: 'block',
                        }}>
                          {est}
                        </span>
                      </div>
                      {i < estadosTimeline.length - 1 && (
                        <div style={{ flex: 1, height: '2px', background: esDone ? '#15803D' : '#E8E8E8', marginTop: '12px', minWidth: '8px' }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Unidades asignadas */}
          {asignaciones.length > 0 ? (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>Unidades asignadas</p>
              {asignaciones.map((a: any, idx: number) => {
                const statusActual = a.solicitud_unidad_status?.[0]?.status || 'Asignado'
                const sc = statusColor[statusActual] || { bg: '#F5F5F5', color: '#666' }
                return (
                  <div key={a.id} style={{ background: '#F9F9F9', borderRadius: '8px', padding: '12px', marginBottom: '8px', border: '1px solid #EEEEEE' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <p style={{ fontSize: '10px', color: '#888', margin: 0, fontWeight: 600 }}>UNIDAD {idx + 1}</p>
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 10px', borderRadius: '20px', background: sc.bg, color: sc.color }}>
                        {statusActual}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      <div>
                        <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Empresa</p>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#15803D', margin: 0 }}>{a.proveedores?.razon_social || '—'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Placa</p>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{a.unidades?.placa || '—'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Conductor</p>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{a.conductores?.nombre_completo || '—'}</p>
                      </div>
                    </div>
                    {statusActual === 'Servicio completado' && a.solicitud_unidad_status?.[0]?.fecha_entrega && (
                      <p style={{ fontSize: '10px', color: '#15803D', margin: '6px 0 0', fontWeight: 600 }}>
                        ✅ Completado el {formatFecha(a.solicitud_unidad_status[0].fecha_entrega, true)}
                      </p>
                    )}
                  </div>
                )
              })}
              {solicitud.coordinador_transporte && (
                <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
                  <p style={{ fontSize: '10px', color: '#888', margin: '0 0 2px', fontWeight: 600 }}>COORDINADOR DE TRANSPORTE</p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{solicitud.coordinador_transporte}</p>
                </div>
              )}
              {solicitud.observaciones_transporte && (
                <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '10px 12px', marginTop: '8px' }}>
                  <p style={{ fontSize: '10px', color: '#888', margin: '0 0 2px', fontWeight: 600 }}>NOTAS DE TRANSPORTE</p>
                  <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{solicitud.observaciones_transporte}</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '24px', marginBottom: '12px', textAlign: 'center' as const }}>
              <p style={{ fontSize: '13px', color: '#888', margin: '0 0 4px' }}>⏳ Esperando asignación de transporte</p>
              <p style={{ fontSize: '11px', color: '#BBB', margin: 0 }}>El área de transporte asignará las unidades pronto</p>
            </div>
          )}

          {/* Historial */}
          {historial.length > 0 && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '14px' }}>Historial de cambios</p>
              {historial.map((h: HistorialEntry, i: number) => {
                const bAnterior = estadoBadge[h.estado_anterior] || { bg: '#F5F5F5', color: '#666', texto: h.estado_anterior || '—' }
                const bNuevo = estadoBadge[h.estado_nuevo] || { bg: '#F5F5F5', color: '#666', texto: h.estado_nuevo || '—' }
                return (
                  <div key={h.id} style={{ display: 'flex', gap: '12px', paddingBottom: i < historial.length - 1 ? '14px' : '0', position: 'relative' }}>
                    {i < historial.length - 1 && (
                      <div style={{ position: 'absolute', left: '11px', top: '24px', width: '2px', height: 'calc(100% - 8px)', background: '#F0F0F0' }} />
                    )}
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#F9F9F9', border: '2px solid #EEEEEE', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', zIndex: 1 }}>
                      🔄
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' as const }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '20px', background: bAnterior.bg, color: bAnterior.color }}>{bAnterior.texto}</span>
                        <span style={{ fontSize: '10px', color: '#888' }}>→</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '20px', background: bNuevo.bg, color: bNuevo.color }}>{bNuevo.texto}</span>
                      </div>
                      {h.comentario && <p style={{ fontSize: '11px', color: '#666', margin: '0 0 2px' }}>{h.comentario}</p>}
                      <p style={{ fontSize: '10px', color: '#AAA', margin: 0 }}>
                        {formatFecha(h.created_at, true)}
                        {h.email && h.email !== '—' && <span style={{ marginLeft: '6px', color: '#888' }}>· {h.email}</span>}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', marginBottom: '10px' }}>Documentos adjuntos</p>
            {documentos.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#AAA', margin: 0 }}>Sin documentos adjuntos</p>
            ) : (
              documentos.map((doc: any) => (
                <div key={doc.id} onClick={() => verDocumento(doc.url)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#E6F1FB', border: '1px solid #B5D4F4', borderRadius: '6px', padding: '6px 10px', marginBottom: '6px', cursor: 'pointer' }}>
                  <span style={{ fontSize: '11px', color: '#185FA5', fontWeight: 600 }}>📄 {doc.nombre}</span>
                </div>
              ))
            )}
          </div>

          {solicitud.evidencia_url && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', marginBottom: '10px' }}>Evidencia de entrega</p>
              <button onClick={() => verDocumento(solicitud.evidencia_url)}
                style={{ width: '100%', padding: '10px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Ver evidencia
              </button>
              {solicitud.fecha_entrega && (
                <p style={{ fontSize: '10px', color: '#888', margin: '6px 0 0', textAlign: 'center' as const }}>
                  {formatFecha(solicitud.fecha_entrega, true)}
                </p>
              )}
            </div>
          )}

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px' }}>
            <button onClick={() => router.push('/operativo')}
              style={{ width: '100%', padding: '10px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              ← Volver a solicitudes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}