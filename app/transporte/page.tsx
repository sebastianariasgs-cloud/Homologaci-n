'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonAdmin from '../components/BotonAdmin'

const estadoBadgeMap: { [key: string]: { bg: string, color: string, texto: string } } = {
  pendiente: { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente' },
  asignada: { bg: '#EEEDFE', color: '#3C3489', texto: 'Asignada' },
  en_transito: { bg: '#EFF6FF', color: '#1D4ED8', texto: 'En transito' },
  entregada: { bg: '#F0FDF4', color: '#15803D', texto: 'Entregada' },
}

const ESTADOS_UNIDAD_BASE = [
  'En transito a recojo', 'Retiro en curso', 'En transito a entrega',
  'Descarga en curso', 'Descarga Completa', 'Servicio completado',
]

const ESTADOS_UNIDAD_CONTENEDOR = [
  'En transito a recojo', 'Retiro en curso', 'En transito a entrega',
  'Descarga en curso', 'Descarga Completa', 'En transito a almacén de vacíos', 'Servicio completado',
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

const formatFecha = (fecha: string, conHora = false) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(conHora && { hour: '2-digit', minute: '2-digit' }),
    timeZone: 'America/Lima',
  })
}

type AsignacionForm = {
  proveedor_id: string; unidad_id: string; conductor_id: string
  unidades_proveedor: any[]; conductores_proveedor: any[]
}

const asignacionVacia = (): AsignacionForm => ({
  proveedor_id: '', unidad_id: '', conductor_id: '',
  unidades_proveedor: [], conductores_proveedor: [],
})

export default function TransportePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [seleccionada, setSeleccionada] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [historial, setHistorial] = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [proveedoresHomologados, setProveedoresHomologados] = useState<any[]>([])
  const [guardando, setGuardando] = useState(false)
  const [emailOperativo, setEmailOperativo] = useState('')
  const [observacionesTransporte, setObservacionesTransporte] = useState('')
  const [coordinadorTransporte, setCoordinadorTransporte] = useState('')
  const [asignacionesDB, setAsignacionesDB] = useState<any[]>([])
  const [asignacionesForm, setAsignacionesForm] = useState<AsignacionForm[]>([asignacionVacia()])
  const [modoReasignar, setModoReasignar] = useState(false)
  const [statusUnidades, setStatusUnidades] = useState<{ [key: string]: string }>({})
  const [notificaciones, setNotificaciones] = useState<any[]>([])
  const [mostrarNotif, setMostrarNotif] = useState(false)
  const [userId, setUserId] = useState('')
  const canalSolicitudRef = useRef<any>(null)
  const seleccionadaRef = useRef<any>(null)
  const iniciado = useRef(false)

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    init()
    return () => {
      if (canalSolicitudRef.current) supabase.removeChannel(canalSolicitudRef.current)
    }
  }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', session.user.id).single()
    if (!['transporte', 'admin'].includes(perfil?.rol)) { router.push('/login'); return }
    setUserId(session.user.id)

    const { data: provs } = await supabase
      .from('proveedores').select('id, razon_social, ruc').eq('estado', 'homologado').order('razon_social')
    setProveedoresHomologados(provs || [])

    await cargarSolicitudes()
    await cargarNotificaciones(session.user.id)

    // Suscripcion para notificaciones y lista
    supabase.channel(`notif-tp-${session.user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notificaciones',
        filter: `usuario_id=eq.${session.user.id}`,
      }, (payload) => {
        setNotificaciones(prev => [payload.new, ...prev])
        cargarSolicitudes()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_transporte' },
        () => cargarSolicitudes())
      .subscribe()
  }

  const cargarNotificaciones = async (uid: string) => {
    const { data } = await supabase.from('notificaciones').select('*')
      .eq('usuario_id', uid).eq('leida', false).order('created_at', { ascending: false })
    setNotificaciones(data || [])
  }

  const marcarLeidas = async () => {
    await supabase.from('notificaciones').update({ leida: true }).eq('usuario_id', userId).eq('leida', false)
    setNotificaciones([])
    setMostrarNotif(false)
  }

  const cargarSolicitudes = async () => {
    const { data } = await supabase.from('solicitudes_transporte')
      .select('*, clientes(razon_social)').order('created_at', { ascending: false })
    setSolicitudes(data || [])
    setLoading(false)
  }

  const cargarUnidadesConductores = async (proveedorId: string) => {
    const [{ data: units }, { data: conds }] = await Promise.all([
      supabase.from('unidades').select('id, placa').eq('proveedor_id', proveedorId).eq('activo', true),
      supabase.from('conductores').select('id, nombre_completo').eq('proveedor_id', proveedorId).eq('activo', true),
    ])
    return { unidades: units || [], conductores: conds || [] }
  }

  // Suscripcion en tiempo real para la solicitud seleccionada
  const suscribirSolicitud = (solicitudId: string) => {
    // Limpiar suscripcion anterior
    if (canalSolicitudRef.current) {
      supabase.removeChannel(canalSolicitudRef.current)
      canalSolicitudRef.current = null
    }

    const canal = supabase.channel(`tp-sol-${solicitudId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'solicitud_unidad_status',
        filter: `solicitud_id=eq.${solicitudId}`,
      }, () => {
        cargarAsignaciones(solicitudId)
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'solicitudes_transporte',
        filter: `id=eq.${solicitudId}`,
      }, (payload) => {
        setSeleccionada((prev: any) => ({ ...prev, ...payload.new }))
        seleccionadaRef.current = { ...seleccionadaRef.current, ...payload.new }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'solicitud_historial',
        filter: `solicitud_id=eq.${solicitudId}`,
      }, async (payload) => {
        try {
          const { data: email } = await supabase.rpc('get_user_email', { user_id: payload.new.usuario_id })
          const entrada = { ...payload.new, email: email || '—' }
          setHistorial(prev => prev.find((h: any) => h.id === (entrada as any).id) ? prev : [...prev, entrada])
        } catch {
          setHistorial(prev => [...prev, { ...payload.new, email: '—' }])
        }
      })
      .subscribe()

    canalSolicitudRef.current = canal
  }

  const seleccionarSolicitud = async (sol: any) => {
    setSeleccionada(sol)
    seleccionadaRef.current = sol
    setEmailOperativo('')
    setModoReasignar(false)
    setObservacionesTransporte(sol.observaciones_transporte || '')
    setCoordinadorTransporte(sol.coordinador_transporte || '')
    setHistorial([])
    setAsignacionesDB([])
    setStatusUnidades({})

    // Activar suscripcion en tiempo real para esta solicitud
    suscribirSolicitud(sol.id)

    if (!sol.visto_por_transporte) {
      await supabase.from('solicitudes_transporte').update({ visto_por_transporte: true }).eq('id', sol.id)
      setSolicitudes(prev => prev.map((s: any) => s.id === sol.id ? { ...s, visto_por_transporte: true } : s))
    }

    const { data: docs } = await supabase.from('solicitud_documentos').select('*').eq('solicitud_id', sol.id)
    setDocumentos(docs || [])

    await cargarAsignaciones(sol.id)
    await cargarHistorial(sol.id)

    if (sol.operativo_id) {
      const { data: email } = await supabase.rpc('get_user_email', { user_id: sol.operativo_id })
      setEmailOperativo(email || '')
    }
  }

  const cargarAsignaciones = async (solicitudId: string) => {
    const { data: asigs } = await supabase
      .from('solicitud_asignaciones')
      .select('*, proveedores(razon_social), unidades(placa), conductores(nombre_completo), solicitud_unidad_status(*)')
      .eq('solicitud_id', solicitudId).order('orden')
    setAsignacionesDB(asigs || [])

    const statusMap: { [key: string]: string } = {}
    ;(asigs || []).forEach((a: any) => {
      statusMap[a.id] = a.solicitud_unidad_status?.[0]?.status || 'Asignado'
    })
    setStatusUnidades(statusMap)

    if (asigs && asigs.length > 0) {
      const forms = await Promise.all(asigs.map(async (a: any) => {
        const { unidades, conductores } = a.proveedor_id
          ? await cargarUnidadesConductores(a.proveedor_id)
          : { unidades: [], conductores: [] }
        return { proveedor_id: a.proveedor_id || '', unidad_id: a.unidad_id || '', conductor_id: a.conductor_id || '', unidades_proveedor: unidades, conductores_proveedor: conductores }
      }))
      setAsignacionesForm(forms)
    }
  }

  const cargarHistorial = async (solicitudId: string) => {
    const { data: hist } = await supabase.from('solicitud_historial').select('*')
      .eq('solicitud_id', solicitudId).order('created_at', { ascending: true })
    const histConEmails = await Promise.all((hist || []).map(async (h: any) => {
      try {
        const { data: email } = await supabase.rpc('get_user_email', { user_id: h.usuario_id })
        return { ...h, email: email || '—' }
      } catch { return { ...h, email: '—' } }
    }))
    setHistorial(histConEmails)
  }

  const actualizarFormAsignacion = async (idx: number, campo: string, valor: string) => {
    const nuevas = [...asignacionesForm]
    nuevas[idx] = { ...nuevas[idx], [campo]: valor }
    if (campo === 'proveedor_id') {
      nuevas[idx].unidad_id = ''
      nuevas[idx].conductor_id = ''
      if (valor) {
        const { unidades, conductores } = await cargarUnidadesConductores(valor)
        nuevas[idx].unidades_proveedor = unidades
        nuevas[idx].conductores_proveedor = conductores
      } else {
        nuevas[idx].unidades_proveedor = []
        nuevas[idx].conductores_proveedor = []
      }
    }
    setAsignacionesForm(nuevas)
  }

  const registrarHistorial = async (estadoAnterior: string, estadoNuevo: string, comentario?: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !seleccionadaRef.current) return
    await supabase.from('solicitud_historial').insert({
      solicitud_id: seleccionadaRef.current.id,
      usuario_id: session.user.id,
      estado_anterior: estadoAnterior,
      estado_nuevo: estadoNuevo,
      comentario: comentario || null,
    })
  }

  const guardarAsignaciones = async () => {
    const incompletas = asignacionesForm.filter(a => !a.proveedor_id || !a.unidad_id || !a.conductor_id)
    if (incompletas.length > 0) { alert('Completa empresa, unidad y conductor para todas las unidades'); return }
    setGuardando(true)
    const esReasignacion = asignacionesDB.length > 0
    const estadoAnterior = seleccionadaRef.current?.estado || 'pendiente'

    await supabase.from('solicitud_unidad_status').delete().eq('solicitud_id', seleccionada.id)
    await supabase.from('solicitud_asignaciones').delete().eq('solicitud_id', seleccionada.id)

    const { data: nuevasAsigs } = await supabase.from('solicitud_asignaciones').insert(
      asignacionesForm.map((a, idx) => ({
        solicitud_id: seleccionada.id,
        proveedor_id: a.proveedor_id, unidad_id: a.unidad_id,
        conductor_id: a.conductor_id, orden: idx + 1,
      }))
    ).select()

    if (nuevasAsigs && nuevasAsigs.length > 0) {
      await supabase.from('solicitud_unidad_status').insert(
        nuevasAsigs.map((a: any, idx: number) => ({
          solicitud_id: seleccionada.id, asignacion_id: a.id,
          orden: idx + 1, status: 'Asignado',
        }))
      )
    }

    await supabase.from('solicitudes_transporte').update({
      proveedor_id: asignacionesForm[0].proveedor_id,
      unidad_id: asignacionesForm[0].unidad_id,
      conductor_id: asignacionesForm[0].conductor_id,
      observaciones_transporte: observacionesTransporte || null,
      coordinador_transporte: coordinadorTransporte || null,
      estado: 'asignada',
    }).eq('id', seleccionada.id)

    // Registrar en historial con detalle de la asignación
    const detalleAsignacion = asignacionesForm.map((a, idx) => {
      const proveedor = proveedoresHomologados.find(p => p.id === a.proveedor_id)
      return `Unidad ${idx + 1}: ${proveedor?.razon_social || a.proveedor_id}`
    }).join(', ')

    await registrarHistorial(
      estadoAnterior, 'asignada',
      esReasignacion
        ? `Reasignacion de unidades — ${detalleAsignacion}`
        : `Asignacion de unidades — ${detalleAsignacion}`
    )

    setSeleccionada((prev: any) => ({ ...prev, estado: 'asignada', coordinador_transporte: coordinadorTransporte }))
    seleccionadaRef.current = { ...seleccionadaRef.current, estado: 'asignada' }
    await cargarAsignaciones(seleccionada.id)
    await cargarSolicitudes()
    setModoReasignar(false)
    setGuardando(false)
  }

  const actualizarStatusUnidad = async (asignacionId: string, nuevoStatus: string) => {
    if (!nuevoStatus) return
    setGuardando(true)

    const { data: existente } = await supabase.from('solicitud_unidad_status')
      .select('id').eq('asignacion_id', asignacionId).single()

    const ahora = new Date().toISOString()
    const esCompletado = nuevoStatus === 'Servicio completado'

    if (existente) {
      await supabase.from('solicitud_unidad_status').update({
        status: nuevoStatus,
        fecha_entrega: esCompletado ? ahora : null,
        updated_at: ahora,
      }).eq('asignacion_id', asignacionId)
    } else {
      const asig = asignacionesDB.find((a: any) => a.id === asignacionId)
      await supabase.from('solicitud_unidad_status').insert({
        solicitud_id: seleccionada.id,
        asignacion_id: asignacionId,
        orden: asig?.orden || 1,
        status: nuevoStatus,
        fecha_entrega: esCompletado ? ahora : null,
      })
    }

    const nuevoStatusMap = { ...statusUnidades, [asignacionId]: nuevoStatus }
    setStatusUnidades(nuevoStatusMap)

    // Verificar si todas completadas
    const todasCompletadas = Object.keys(nuevoStatusMap).length === asignacionesDB.length &&
      Object.values(nuevoStatusMap).every(s => s === 'Servicio completado')

    if (todasCompletadas) {
      const fechaCulminacion = new Date()
      const deadline = new Date(fechaCulminacion.getTime() + 48 * 60 * 60 * 1000)
      await supabase.from('solicitudes_transporte').update({
        estado: 'entregada',
        fecha_entrega: fechaCulminacion.toISOString(),
        fecha_culminacion: fechaCulminacion.toISOString(),
        deadline_facturacion: deadline.toISOString(),
      }).eq('id', seleccionada.id)
      await registrarHistorial(seleccionadaRef.current?.estado || 'asignada', 'entregada', 'Todas las unidades completaron el servicio')
      setSeleccionada((prev: any) => ({ ...prev, estado: 'entregada', fecha_culminacion: fechaCulminacion.toISOString() }))
      seleccionadaRef.current = { ...seleccionadaRef.current, estado: 'entregada' }
      await cargarSolicitudes()
    }

    await cargarAsignaciones(seleccionada.id)
    setGuardando(false)
  }

  const subirEvidencia = async (archivo: File) => {
    setGuardando(true)
    const ext = archivo.name.split('.').pop()
    const ruta = `solicitudes/${seleccionada.id}/evidencia_entrega.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(ruta, archivo, { upsert: true })
    if (!error) {
      const ahora = new Date()
      const deadline = new Date(ahora.getTime() + 48 * 60 * 60 * 1000)
      await supabase.from('solicitudes_transporte').update({
        evidencia_url: ruta, estado: 'entregada',
        fecha_entrega: ahora.toISOString(),
        fecha_culminacion: ahora.toISOString(),
        deadline_facturacion: deadline.toISOString(),
      }).eq('id', seleccionada.id)
      await registrarHistorial(seleccionadaRef.current?.estado || 'asignada', 'entregada', 'Evidencia de entrega subida')
      setSeleccionada((prev: any) => ({ ...prev, evidencia_url: ruta, estado: 'entregada', fecha_entrega: ahora.toISOString() }))
      seleccionadaRef.current = { ...seleccionadaRef.current, estado: 'entregada' }
      await cargarSolicitudes()
    }
    setGuardando(false)
  }

  const verDocumento = async (url: string) => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const esContenedor = (sol: any) => ['Contenedor 20 HQ', 'Contenedor 40 HQ'].includes(sol?.tipo_carga || '')

  const solicitudesFiltradas = solicitudes.filter((s: any) => {
    const matchEstado = filtroEstado === 'todos' || s.estado === filtroEstado
    const matchBusqueda = busqueda === '' ||
      s.numero?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.bl_awb?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.shipment?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.clientes?.razon_social?.toLowerCase().includes(busqueda.toLowerCase())
    const matchDesde = fechaDesde === '' || s.fecha_recojo >= fechaDesde
    const matchHasta = fechaHasta === '' || s.fecha_recojo <= fechaHasta
    return matchEstado && matchBusqueda && matchDesde && matchHasta
  })

  const nuevasSinVer = solicitudes.filter((s: any) => !s.visto_por_transporte && s.estado === 'pendiente').length
  const tieneAsignaciones = asignacionesDB.length > 0
  const mostrarForm = !tieneAsignaciones || modoReasignar
  const servicioCompletado = seleccionada?.estado === 'entregada'

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
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Panel de transporte</span>
          {nuevasSinVer > 0 && (
            <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, border: '1px solid #FDE68A' }}>
              {nuevasSinVer} nuevo{nuevasSinVer > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMostrarNotif(!mostrarNotif)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px', position: 'relative' }}>
              🔔
              {notificaciones.length > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 0, width: '16px', height: '16px', background: '#C41230', borderRadius: '50%', fontSize: '9px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {notificaciones.length > 9 ? '9+' : notificaciones.length}
                </span>
              )}
            </button>
            {mostrarNotif && (
              <div style={{ position: 'absolute', right: 0, top: '100%', width: '320px', background: 'white', borderRadius: '10px', border: '1px solid #EEEEEE', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Notificaciones</p>
                  {notificaciones.length > 0 && (
                    <button onClick={marcarLeidas} style={{ fontSize: '10px', color: '#C41230', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Marcar como leidas
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {notificaciones.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#AAA', textAlign: 'center', padding: '20px', margin: 0 }}>Sin notificaciones</p>
                  ) : notificaciones.map((n: any) => (
                    <div key={n.id} onClick={() => { setMostrarNotif(false); if (n.link) router.push(n.link) }}
                      style={{ padding: '10px 16px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer', background: '#FFFBEB' }}>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 3px' }}>🚛 {n.mensaje}</p>
                      <p style={{ fontSize: '10px', color: '#AAA', margin: 0 }}>{formatFecha(n.created_at, true)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <BotonAdmin />
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ display: 'flex', height: 'calc(100vh - 59px)' }}>

        {/* Lista izquierda */}
        <div style={{ width: '320px', minWidth: '320px', background: 'white', borderRight: '1px solid #EEEEEE', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0F0F0' }}>
            <input type="text" placeholder="Buscar por numero, BL, shipment..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '11px', outline: 'none', marginBottom: '6px', boxSizing: 'border-box' as const }} />
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '11px', outline: 'none', background: 'white', marginBottom: '6px' }}>
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="asignada">Asignadas</option>
              <option value="entregada">Entregadas</option>
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                style={{ padding: '5px 8px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '10px', outline: 'none' }} />
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                style={{ padding: '5px 8px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '10px', outline: 'none' }} />
            </div>
          </div>
          <div style={{ padding: '6px 12px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>{solicitudesFiltradas.length} solicitudes</p>
            {nuevasSinVer > 0 && <p style={{ fontSize: '10px', color: '#92400E', fontWeight: 600, margin: 0 }}>⚡ {nuevasSinVer} sin revisar</p>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {solicitudesFiltradas.map((sol: any) => {
              const badge = estadoBadgeMap[sol.estado] || estadoBadgeMap.pendiente
              const esNueva = !sol.visto_por_transporte && sol.estado === 'pendiente'
              return (
                <div key={sol.id} onClick={() => seleccionarSolicitud(sol)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer',
                    background: seleccionada?.id === sol.id ? '#FEF2F2' : esNueva ? '#FFFBEB' : 'white',
                    borderLeft: seleccionada?.id === sol.id ? '3px solid #C41230' : esNueva ? '3px solid #F59E0B' : '3px solid transparent',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{sol.numero}</p>
                      {esNueva && <span style={{ fontSize: '8px', background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>NUEVO</span>}
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                  </div>
                  <p style={{ fontSize: '10px', color: '#888', margin: '0 0 2px' }}>
                    {sol.clientes?.razon_social || sol.consignatario || '—'} · {sol.tipo_carga}
                  </p>
                  <p style={{ fontSize: '10px', color: '#AAA', margin: 0 }}>
                    {sol.bl_awb || sol.shipment || '—'} · {formatFecha(sol.fecha_recojo)}
                    {sol.num_unidades > 1 && <span style={{ marginLeft: '4px', color: '#C41230', fontWeight: 600 }}>· {sol.num_unidades} uts</span>}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel derecho */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F7F7F7' }}>
          {!seleccionada ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                {nuevasSinVer > 0 && (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px', padding: '14px 20px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#92400E', margin: '0 0 4px' }}>⚡ {nuevasSinVer} solicitud{nuevasSinVer > 1 ? 'es nuevas' : ' nueva'}</p>
                    <p style={{ fontSize: '11px', color: '#92400E', margin: 0 }}>Haz clic en las marcadas como NUEVO</p>
                  </div>
                )}
                <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>Selecciona una solicitud para atender</p>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '720px' }}>

              {/* Cabecera */}
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' as const }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{seleccionada.numero}</h2>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: seleccionada.tipo_servicio === 'EXPO' ? '#1D4ED8' : '#C41230', background: seleccionada.tipo_servicio === 'EXPO' ? '#EFF6FF' : '#FEF2F2', padding: '2px 8px', borderRadius: '6px' }}>
                    {seleccionada.tipo_servicio || 'IMPO'}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: (estadoBadgeMap[seleccionada.estado] || estadoBadgeMap.pendiente).bg, color: (estadoBadgeMap[seleccionada.estado] || estadoBadgeMap.pendiente).color }}>
                    {(estadoBadgeMap[seleccionada.estado] || estadoBadgeMap.pendiente).texto}
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#888', margin: '0 0 12px' }}>Creada el {formatFecha(seleccionada.created_at, true)}</p>

                <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#C41230', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                    {emailOperativo ? emailOperativo.charAt(0).toUpperCase() : '?'}
                  </div>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{emailOperativo || 'Cargando...'}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: '#F9F9F9', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  {[
                    { label: 'Cliente', valor: seleccionada.clientes?.razon_social || seleccionada.consignatario || '—' },
                    { label: 'Shipment', valor: seleccionada.shipment || '—' },
                    { label: 'BL / AWB', valor: seleccionada.bl_awb || '—' },
                    { label: 'Recojo', valor: seleccionada.direccion_recojo },
                    { label: 'Entrega', valor: seleccionada.direccion_entrega },
                    { label: 'Zona', valor: seleccionada.zona || '—' },
                    { label: 'Tipo de carga', valor: seleccionada.tipo_carga },
                    { label: 'Unidades', valor: seleccionada.num_unidades || 1 },
                    { label: 'Fecha recojo', valor: formatFecha(seleccionada.fecha_recojo) },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>{item.label}</p>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{item.valor}</p>
                    </div>
                  ))}
                </div>

                {servicioCompletado && seleccionada.fecha_culminacion && (
                  <div style={{ background: '#F0FDF4', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Fecha culminacion</p>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#15803D', margin: 0 }}>{formatFecha(seleccionada.fecha_culminacion, true)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Deadline facturacion (48h)</p>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#C41230', margin: 0 }}>
                          {seleccionada.deadline_facturacion ? formatFecha(seleccionada.deadline_facturacion, true) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {seleccionada.observaciones && (
                  <div style={{ background: '#FFF7ED', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                    <p style={{ fontSize: '10px', color: '#C2410C', margin: '0 0 3px', fontWeight: 600 }}>INSTRUCCIONES DEL OPERATIVO</p>
                    <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{seleccionada.observaciones}</p>
                  </div>
                )}

                {documentos.length > 0 && (
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', marginBottom: '6px' }}>Documentos adjuntos</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                      {documentos.map((doc: any) => (
                        <div key={doc.id} onClick={() => verDocumento(doc.url)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#E6F1FB', border: '1px solid #B5D4F4', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                          <span style={{ fontSize: '11px', color: '#185FA5', fontWeight: 600 }}>📄 {doc.nombre}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Servicio completado */}
              {servicioCompletado && (
                <div style={{ background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>📦</span>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#15803D', margin: '0 0 3px' }}>Servicio completado</p>
                      <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                        Culminado el {formatFecha(seleccionada.fecha_entrega, true)}. No se pueden realizar más cambios.
                      </p>
                    </div>
                  </div>
                  {seleccionada.evidencia_url && (
                    <button onClick={() => verDocumento(seleccionada.evidencia_url)}
                      style={{ marginTop: '10px', padding: '8px 16px', background: 'white', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                      Ver evidencia de entrega
                    </button>
                  )}
                </div>
              )}

              {/* Panel asignación / gestión */}
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', background: '#FEF2F2', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🚛</div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>
                        {tieneAsignaciones ? 'Gestión de unidades' : 'Asignar unidades'}
                        <span style={{ fontSize: '11px', color: '#888', fontWeight: 400, marginLeft: '6px' }}>({seleccionada.num_unidades || 1} requerida(s))</span>
                      </p>
                      <p style={{ fontSize: '10px', color: '#15803D', margin: 0 }}>✓ Solo proveedores homologados ({proveedoresHomologados.length})</p>
                    </div>
                  </div>
                  {tieneAsignaciones && !modoReasignar && !servicioCompletado && (
                    <button onClick={() => setModoReasignar(true)}
                      style={{ padding: '6px 14px', background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                      Reasignar
                    </button>
                  )}
                </div>

                {/* Vista con controles de status */}
                {tieneAsignaciones && !mostrarForm && (
                  <div>
                    {asignacionesDB.map((a: any, idx: number) => {
                      const statusActual = statusUnidades[a.id] || a.solicitud_unidad_status?.[0]?.status || 'Asignado'
                      const sc = statusColor[statusActual] || { bg: '#F5F5F5', color: '#666' }
                      const estadosDisponibles = esContenedor(seleccionada) ? ESTADOS_UNIDAD_CONTENEDOR : ESTADOS_UNIDAD_BASE
                      const esCompletada = statusActual === 'Servicio completado'
                      return (
                        <div key={a.id} style={{ background: '#F9F9F9', borderRadius: '8px', padding: '12px', marginBottom: '10px', border: '1px solid #EEEEEE' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <p style={{ fontSize: '10px', color: '#888', margin: 0, fontWeight: 600 }}>UNIDAD {idx + 1}</p>
                            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: sc.bg, color: sc.color }}>
                              {statusActual}
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: esCompletada || servicioCompletado ? '0' : '10px' }}>
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
                          {!esCompletada && !servicioCompletado && (
                            <div>
                              <label style={{ display: 'block', fontSize: '10px', fontWeight: 500, color: '#444', marginBottom: '4px' }}>Actualizar estado</label>
                              <select
                                value=""
                                onChange={(e) => { if (e.target.value) actualizarStatusUnidad(a.id, e.target.value) }}
                                disabled={guardando}
                                style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '11px', outline: 'none', background: 'white', cursor: 'pointer' }}>
                                <option value="">— Selecciona el nuevo estado —</option>
                                {estadosDisponibles.map((est: string) => (
                                  <option key={est} value={est}>{est}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {esCompletada && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                              <span>✅</span>
                              <span style={{ fontSize: '11px', color: '#15803D', fontWeight: 600 }}>Unidad completada</span>
                              {a.solicitud_unidad_status?.[0]?.fecha_entrega && (
                                <span style={{ fontSize: '10px', color: '#888' }}>· {formatFecha(a.solicitud_unidad_status[0].fecha_entrega, true)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {seleccionada.coordinador_transporte && (
                      <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                        <p style={{ fontSize: '10px', color: '#888', margin: '0 0 2px', fontWeight: 600 }}>COORDINADOR</p>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{seleccionada.coordinador_transporte}</p>
                      </div>
                    )}

                    {!servicioCompletado && (
                      <div style={{ marginTop: '12px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#15803D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                          📦 Subir evidencia de entrega
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) subirEvidencia(f) }} />
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* Formulario asignación / reasignación */}
                {mostrarForm && !servicioCompletado && (
                  <div>
                    {asignacionesForm.map((asig: AsignacionForm, idx: number) => (
                      <div key={idx} style={{ border: '1px solid #F0F0F0', borderRadius: '8px', padding: '14px', marginBottom: '10px', background: '#FAFAFA' }}>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#C41230', margin: '0 0 10px' }}>
                          Unidad {idx + 1} de {asignacionesForm.length}
                        </p>
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#444', marginBottom: '4px' }}>Empresa *</label>
                          <select value={asig.proveedor_id}
                            onChange={(e) => actualizarFormAsignacion(idx, 'proveedor_id', e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none', background: 'white' }}>
                            <option value="">Selecciona un proveedor homologado...</option>
                            {proveedoresHomologados.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.razon_social} — RUC {p.ruc}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#444', marginBottom: '4px' }}>Placa *</label>
                            <select value={asig.unidad_id}
                              onChange={(e) => actualizarFormAsignacion(idx, 'unidad_id', e.target.value)}
                              disabled={!asig.proveedor_id}
                              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none', background: 'white', opacity: !asig.proveedor_id ? 0.5 : 1 }}>
                              <option value="">Selecciona placa...</option>
                              {asig.unidades_proveedor.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.placa}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#444', marginBottom: '4px' }}>Conductor *</label>
                            <select value={asig.conductor_id}
                              onChange={(e) => actualizarFormAsignacion(idx, 'conductor_id', e.target.value)}
                              disabled={!asig.proveedor_id}
                              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none', background: 'white', opacity: !asig.proveedor_id ? 0.5 : 1 }}>
                              <option value="">Selecciona conductor...</option>
                              {asig.conductores_proveedor.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.nombre_completo}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Coordinador</label>
                        <input type="text" value={coordinadorTransporte}
                          onChange={(e) => setCoordinadorTransporte(e.target.value)}
                          placeholder="Nombre del coordinador"
                          style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Notas internas</label>
                        <input type="text" value={observacionesTransporte}
                          onChange={(e) => setObservacionesTransporte(e.target.value)}
                          placeholder="Notas para el equipo"
                          style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={guardarAsignaciones} disabled={guardando}
                        style={{ flex: 1, padding: '10px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                        {guardando ? 'Guardando...' : modoReasignar ? 'Confirmar reasignacion →' : 'Asignar unidades →'}
                      </button>
                      {modoReasignar && (
                        <button onClick={() => setModoReasignar(false)}
                          style={{ padding: '10px 16px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Historial en tiempo real */}
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Historial de cambios</p>
                  <span style={{ fontSize: '10px', color: '#15803D', background: '#F0FDF4', padding: '2px 8px', borderRadius: '20px', border: '1px solid #BBF7D0' }}>● En tiempo real</span>
                </div>
                {historial.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#AAA', margin: 0 }}>Sin cambios registrados aún</p>
                ) : (
                  historial.map((h: any, i: number) => {
                    const bAnterior = estadoBadgeMap[h.estado_anterior] || { bg: '#F5F5F5', color: '#666', texto: h.estado_anterior || '—' }
                    const bNuevo = estadoBadgeMap[h.estado_nuevo] || { bg: '#F5F5F5', color: '#666', texto: h.estado_nuevo || '—' }
                    return (
                      <div key={h.id || i} style={{ display: 'flex', gap: '12px', paddingBottom: i < historial.length - 1 ? '14px' : '0', position: 'relative' }}>
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
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}