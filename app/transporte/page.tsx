'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonAdmin from '../components/BotonAdmin'

const estadoBadgeMap: { [key: string]: { bg: string, color: string, texto: string } } = {
  pendiente:   { bg: '#FFF3E0', color: '#E65100', texto: 'Pendiente' },
  asignada:    { bg: '#EDE7F6', color: '#4527A0', texto: 'Asignada' },
  en_transito: { bg: '#E3F2FD', color: '#1565C0', texto: 'En tránsito' },
  entregada:   { bg: '#E8F5E9', color: '#2E7D32', texto: 'Entregada' },
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
  'Pendiente de asignación': { bg: '#FFF3E0', color: '#E65100' },
  'Asignado':                { bg: '#EDE7F6', color: '#4527A0' },
  'En transito a recojo':    { bg: '#E3F2FD', color: '#1565C0' },
  'Retiro en curso':         { bg: '#EDE7F6', color: '#4527A0' },
  'En transito a entrega':   { bg: '#E3F2FD', color: '#1565C0' },
  'Descarga en curso':       { bg: '#FFF3E0', color: '#E65100' },
  'Descarga Completa':       { bg: '#E8F5E9', color: '#2E7D32' },
  'En transito a almacén de vacíos': { bg: '#F3E5F5', color: '#6A1B9A' },
  'Servicio completado':     { bg: '#E8F5E9', color: '#2E7D32' },
}

const tipoIncidenciaMap: { [key: string]: { bg: string, color: string } } = {
  'Accidente':          { bg: '#FFEBEE', color: '#B71C1C' },
  'Avería mecánica':    { bg: '#FFF3E0', color: '#E65100' },
  'Retraso':            { bg: '#FFF8E1', color: '#F57F17' },
  'Problema de acceso': { bg: '#E8EAF6', color: '#283593' },
  'Carga dañada':       { bg: '#FCE4EC', color: '#880E4F' },
  'Otro':               { bg: '#F5F5F5', color: '#616161' },
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
  nueva_placa?: string; nuevo_conductor?: string
  modo_nueva_unidad?: boolean; modo_nuevo_conductor?: boolean
}

const asignacionVacia = (): AsignacionForm => ({
  proveedor_id: '', unidad_id: '', conductor_id: '',
  unidades_proveedor: [], conductores_proveedor: [],
  nueva_placa: '', nuevo_conductor: '',
  modo_nueva_unidad: false, modo_nuevo_conductor: false,
})

export default function TransportePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [seleccionada, setSeleccionada] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [historial, setHistorial] = useState<any[]>([])
  const [incidencias, setIncidencias] = useState<any[]>([])
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
  const [mostrarFormIncidencia, setMostrarFormIncidencia] = useState(false)
  const [incidenciaForm, setIncidenciaForm] = useState({ tipo: 'Otro', descripcion: '', placa: '' })
  const [guardandoIncidencia, setGuardandoIncidencia] = useState(false)
  const [mostrarFormNuevoProveedor, setMostrarFormNuevoProveedor] = useState(false)
  const [nuevoProveedorForm, setNuevoProveedorForm] = useState({ ruc: '', razon_social: '', placa: '', conductor: '' })
  const [guardandoNuevoProveedor, setGuardandoNuevoProveedor] = useState(false)
  const [rucUrgente, setRucUrgente] = useState<'' | 'buscando' | 'ok' | 'error'>('')
  const canalSolicitudRef = useRef<any>(null)
  const seleccionadaRef = useRef<any>(null)
  const statusUnidadesRef = useRef<{ [key: string]: string }>({})
  const iniciado = useRef(false)

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    init()
    return () => { if (canalSolicitudRef.current) supabase.removeChannel(canalSolicitudRef.current) }
  }, [])

  useEffect(() => { statusUnidadesRef.current = statusUnidades }, [statusUnidades])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single()
    if (!['transporte', 'admin'].includes(perfil?.rol)) { router.push('/dashboard'); return }
    setUserId(session.user.id)
    await cargarProveedoresHomologados()
    await cargarSolicitudes()
    await cargarNotificaciones(session.user.id)
    supabase.channel(`notif-tp-${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${session.user.id}` },
        (payload: any) => { setNotificaciones((prev: any) => [payload.new, ...prev]); cargarSolicitudes() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_transporte' }, () => cargarSolicitudes())
      .subscribe()
  }

  const cargarProveedoresHomologados = async () => {
    const { data: provs } = await supabase
      .from('proveedores').select('id, razon_social, ruc').eq('estado', 'homologado').order('razon_social')
    setProveedoresHomologados(provs || [])
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
      supabase.from('unidades').select('id, placa, pendiente_revision').eq('proveedor_id', proveedorId).eq('activo', true),
      supabase.from('conductores').select('id, nombre_completo, pendiente_revision').eq('proveedor_id', proveedorId).eq('activo', true),
    ])
    return { unidades: units || [], conductores: conds || [] }
  }

  const crearProveedorUrgente = async () => {
    if (!nuevoProveedorForm.ruc || !nuevoProveedorForm.razon_social || !nuevoProveedorForm.placa || !nuevoProveedorForm.conductor) {
      alert('Completa todos los campos')
      return
    }
    setGuardandoNuevoProveedor(true)
    try {
      const res = await fetch('/api/admin/crear-proveedor-urgente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoProveedorForm)
      })
      const data = await res.json()
      if (data.error) { alert('Error: ' + data.error); setGuardandoNuevoProveedor(false); return }

      const { proveedor: prov, unidad, conductor: cond } = data
      const nuevasAsig = [...asignacionesForm]
      nuevasAsig[0] = {
        ...nuevasAsig[0],
        proveedor_id: prov.id,
        unidad_id: unidad?.id || '',
        conductor_id: cond?.id || '',
        unidades_proveedor: unidad ? [unidad] : [],
        conductores_proveedor: cond ? [cond] : [],
      }
      setAsignacionesForm(nuevasAsig)
      setProveedoresHomologados(prev => [...prev, { id: prov.id, razon_social: prov.razon_social + ' ⚠️ URGENTE', ruc: prov.ruc }])
      setMostrarFormNuevoProveedor(false)
      setNuevoProveedorForm({ ruc: '', razon_social: '', placa: '', conductor: '' })
      setRucUrgente('')
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
    setGuardandoNuevoProveedor(false)
  }

  const agregarUnidadAProveedor = async (idx: number, placa: string, proveedorId: string) => {
    if (!placa.trim()) return
    const { data: unidad } = await supabase.from('unidades').insert({
      proveedor_id: proveedorId, placa: placa.toUpperCase(), activo: true, pendiente_revision: true,
    }).select().single()
    if (unidad) {
      const nuevas = [...asignacionesForm]
      nuevas[idx].unidades_proveedor = [...nuevas[idx].unidades_proveedor, unidad]
      nuevas[idx].unidad_id = unidad.id
      nuevas[idx].nueva_placa = ''
      nuevas[idx].modo_nueva_unidad = false
      setAsignacionesForm(nuevas)
    }
  }

  const agregarConductorAProveedor = async (idx: number, nombre: string, proveedorId: string) => {
    if (!nombre.trim()) return
    const { data: conductor } = await supabase.from('conductores').insert({
      proveedor_id: proveedorId, nombre_completo: nombre, activo: true, pendiente_revision: true,
    }).select().single()
    if (conductor) {
      const nuevas = [...asignacionesForm]
      nuevas[idx].conductores_proveedor = [...nuevas[idx].conductores_proveedor, conductor]
      nuevas[idx].conductor_id = conductor.id
      nuevas[idx].nuevo_conductor = ''
      nuevas[idx].modo_nuevo_conductor = false
      setAsignacionesForm(nuevas)
    }
  }

  const suscribirSolicitud = (solicitudId: string) => {
    if (canalSolicitudRef.current) { supabase.removeChannel(canalSolicitudRef.current); canalSolicitudRef.current = null }
    const canal = supabase.channel(`tp-sol-${solicitudId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitud_unidad_status', filter: `solicitud_id=eq.${solicitudId}` },
        () => cargarAsignaciones(solicitudId))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'solicitudes_transporte', filter: `id=eq.${solicitudId}` },
        (payload: any) => { setSeleccionada((prev: any) => ({ ...prev, ...payload.new })); seleccionadaRef.current = { ...seleccionadaRef.current, ...payload.new } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitud_historial', filter: `solicitud_id=eq.${solicitudId}` },
        async (payload: any) => {
          try {
            const { data: email } = await supabase.rpc('get_user_email', { user_id: payload.new.usuario_id })
            const entrada = { ...payload.new, email: email || '—' }
            setHistorial((prev: any) => prev.find((h: any) => h.id === entrada.id) ? prev : [...prev, entrada])
          } catch { setHistorial((prev: any) => [...prev, { ...payload.new, email: '—' }]) }
        })
      .subscribe()
    canalSolicitudRef.current = canal
  }

  const seleccionarSolicitud = async (sol: any) => {
    setSeleccionada(sol)
    seleccionadaRef.current = sol
    setEmailOperativo('')
    setModoReasignar(false)
    setMostrarFormIncidencia(false)
    setMostrarFormNuevoProveedor(false)
    setRucUrgente('')
    setObservacionesTransporte(sol.observaciones_transporte || '')
    setCoordinadorTransporte(sol.coordinador_transporte || '')
    setHistorial([])
    setIncidencias([])
    setAsignacionesDB([])
    setStatusUnidades({})
    statusUnidadesRef.current = {}
    suscribirSolicitud(sol.id)

    if (!sol.visto_por_transporte) {
      await supabase.from('solicitudes_transporte').update({ visto_por_transporte: true }).eq('id', sol.id)
      setSolicitudes((prev: any) => prev.map((s: any) => s.id === sol.id ? { ...s, visto_por_transporte: true } : s))
    }

    const { data: docs } = await supabase.from('solicitud_documentos').select('*').eq('solicitud_id', sol.id)
    setDocumentos(docs || [])
    await cargarAsignaciones(sol.id)
    await cargarHistorial(sol.id)
    await cargarIncidencias(sol.id)

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
    ;(asigs || []).forEach((a: any) => { statusMap[a.id] = a.solicitud_unidad_status?.[0]?.status || 'Asignado' })
    setStatusUnidades(statusMap)
    statusUnidadesRef.current = statusMap

    if (asigs && asigs.length > 0) {
      const forms = await Promise.all(asigs.map(async (a: any) => {
        const { unidades, conductores } = a.proveedor_id ? await cargarUnidadesConductores(a.proveedor_id) : { unidades: [], conductores: [] }
        return { proveedor_id: a.proveedor_id || '', unidad_id: a.unidad_id || '', conductor_id: a.conductor_id || '', unidades_proveedor: unidades, conductores_proveedor: conductores, nueva_placa: '', nuevo_conductor: '', modo_nueva_unidad: false, modo_nuevo_conductor: false }
      }))
      setAsignacionesForm(forms)
    }
  }

  const cargarHistorial = async (solicitudId: string) => {
    const { data: hist } = await supabase.from('solicitud_historial').select('*').eq('solicitud_id', solicitudId).order('created_at', { ascending: true })
    const histConEmails = await Promise.all((hist || []).map(async (h: any) => {
      try { const { data: email } = await supabase.rpc('get_user_email', { user_id: h.usuario_id }); return { ...h, email: email || '—' } }
      catch { return { ...h, email: '—' } }
    }))
    setHistorial(histConEmails)
  }

  const cargarIncidencias = async (solicitudId: string) => {
    const { data } = await supabase.from('solicitud_incidencias').select('*').eq('solicitud_id', solicitudId).order('created_at', { ascending: false })
    setIncidencias(data || [])
  }

  const guardarIncidencia = async () => {
    if (!incidenciaForm.descripcion.trim()) return
    setGuardandoIncidencia(true)
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('solicitud_incidencias').insert({
      solicitud_id: seleccionada.id, usuario_id: session?.user.id,
      tipo: incidenciaForm.tipo, descripcion: incidenciaForm.descripcion, placa: incidenciaForm.placa || null,
    })
    setIncidenciaForm({ tipo: 'Otro', descripcion: '', placa: '' })
    setMostrarFormIncidencia(false)
    await cargarIncidencias(seleccionada.id)
    setGuardandoIncidencia(false)
  }

  const actualizarFormAsignacion = async (idx: number, campo: string, valor: string) => {
    const nuevas = [...asignacionesForm]
    nuevas[idx] = { ...nuevas[idx], [campo]: valor }
    if (campo === 'proveedor_id') {
      nuevas[idx].unidad_id = ''
      nuevas[idx].conductor_id = ''
      nuevas[idx].modo_nueva_unidad = false
      nuevas[idx].modo_nuevo_conductor = false
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
      solicitud_id: seleccionadaRef.current.id, usuario_id: session.user.id,
      estado_anterior: estadoAnterior, estado_nuevo: estadoNuevo, comentario: comentario || null,
    })
  }

  const guardarAsignaciones = async () => {
    const incompletas = asignacionesForm.filter((a: any) => !a.proveedor_id || !a.unidad_id || !a.conductor_id)
    if (incompletas.length > 0) { alert('Completa empresa, unidad y conductor para todas las unidades'); return }
    setGuardando(true)
    const esReasignacion = asignacionesDB.length > 0
    const estadoAnterior = seleccionadaRef.current?.estado || 'pendiente'

    await supabase.from('solicitud_unidad_status').delete().eq('solicitud_id', seleccionada.id)
    await supabase.from('solicitud_asignaciones').delete().eq('solicitud_id', seleccionada.id)

    const { data: nuevasAsigs } = await supabase.from('solicitud_asignaciones').insert(
      asignacionesForm.map((a: any, idx: number) => ({
        solicitud_id: seleccionada.id, proveedor_id: a.proveedor_id,
        unidad_id: a.unidad_id, conductor_id: a.conductor_id, orden: idx + 1,
      }))
    ).select()

    if (nuevasAsigs && nuevasAsigs.length > 0) {
      await supabase.from('solicitud_unidad_status').insert(
        nuevasAsigs.map((a: any, idx: number) => ({
          solicitud_id: seleccionada.id, asignacion_id: a.id, orden: idx + 1, status: 'Asignado',
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

    const detalleAsignacion = asignacionesForm.map((a: any, idx: number) => {
      const proveedor = proveedoresHomologados.find((p: any) => p.id === a.proveedor_id)
      return `Unidad ${idx + 1}: ${proveedor?.razon_social || a.proveedor_id}`
    }).join(', ')

    await registrarHistorial(estadoAnterior, 'asignada',
      esReasignacion ? `Reasignación — ${detalleAsignacion}` : `Asignación — ${detalleAsignacion}`)

    setSeleccionada((prev: any) => ({ ...prev, estado: 'asignada', coordinador_transporte: coordinadorTransporte }))
    seleccionadaRef.current = { ...seleccionadaRef.current, estado: 'asignada' }
    await cargarAsignaciones(seleccionada.id)
    await cargarHistorial(seleccionada.id)
    await cargarSolicitudes()
    setModoReasignar(false)
    setGuardando(false)
  }

  const actualizarStatusUnidad = async (asignacionId: string, nuevoStatus: string) => {
    if (!nuevoStatus) return
    setGuardando(true)
    const statusAnterior = statusUnidadesRef.current[asignacionId] || 'Asignado'
    const ahora = new Date().toISOString()
    const esCompletado = nuevoStatus === 'Servicio completado'
    const { data: existente } = await supabase.from('solicitud_unidad_status').select('id').eq('asignacion_id', asignacionId).single()

    if (existente) {
      await supabase.from('solicitud_unidad_status').update({ status: nuevoStatus, fecha_entrega: esCompletado ? ahora : null, updated_at: ahora }).eq('asignacion_id', asignacionId)
    } else {
      const asig = asignacionesDB.find((a: any) => a.id === asignacionId)
      await supabase.from('solicitud_unidad_status').insert({ solicitud_id: seleccionada.id, asignacion_id: asignacionId, orden: asig?.orden || 1, status: nuevoStatus, fecha_entrega: esCompletado ? ahora : null })
    }

    const asig = asignacionesDB.find((a: any) => a.id === asignacionId)
    const placa = asig?.unidades?.placa || `Unidad ${asig?.orden || ''}`
    await registrarHistorial(statusAnterior, nuevoStatus, `${placa}: ${statusAnterior} → ${nuevoStatus}`)

    const nuevoStatusMap = { ...statusUnidadesRef.current, [asignacionId]: nuevoStatus }
    setStatusUnidades(nuevoStatusMap)
    statusUnidadesRef.current = nuevoStatusMap

    const todasCompletadas = asignacionesDB.length > 0 && asignacionesDB.every((a: any) => nuevoStatusMap[a.id] === 'Servicio completado')

    if (todasCompletadas) {
      const fechaCulminacion = new Date()
      const deadline = new Date(fechaCulminacion.getTime() + 48 * 60 * 60 * 1000)
      await supabase.from('solicitudes_transporte').update({ estado: 'entregada', fecha_entrega: fechaCulminacion.toISOString(), fecha_culminacion: fechaCulminacion.toISOString(), deadline_facturacion: deadline.toISOString() }).eq('id', seleccionada.id)
      await registrarHistorial(seleccionadaRef.current?.estado || 'asignada', 'entregada', 'Todas las unidades completaron el servicio')
      setSeleccionada((prev: any) => ({ ...prev, estado: 'entregada', fecha_culminacion: fechaCulminacion.toISOString() }))
      seleccionadaRef.current = { ...seleccionadaRef.current, estado: 'entregada' }
      await cargarSolicitudes()
    }

    await cargarAsignaciones(seleccionada.id)
    await cargarHistorial(seleccionada.id)
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
      await supabase.from('solicitudes_transporte').update({ evidencia_url: ruta, estado: 'entregada', fecha_entrega: ahora.toISOString(), fecha_culminacion: ahora.toISOString(), deadline_facturacion: deadline.toISOString() }).eq('id', seleccionada.id)
      await registrarHistorial(seleccionadaRef.current?.estado || 'asignada', 'entregada', 'Evidencia de entrega subida')
      setSeleccionada((prev: any) => ({ ...prev, evidencia_url: ruta, estado: 'entregada', fecha_entrega: ahora.toISOString() }))
      seleccionadaRef.current = { ...seleccionadaRef.current, estado: 'entregada' }
      await cargarSolicitudes()
      await cargarHistorial(seleccionada.id)
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

      {/* NAV */}
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/transporte">
            <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
          </a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Panel de transporte</span>
          {nuevasSinVer > 0 && (
            <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, border: '1px solid #FDE68A' }}>
              {nuevasSinVer} nuevo{nuevasSinVer > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMostrarNotif(!mostrarNotif)}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', padding: '6px 10px', position: 'relative', color: 'white' }}>
              🔔
              {notificaciones.length > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', background: '#C41230', borderRadius: '50%', fontSize: '9px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {notificaciones.length > 9 ? '9+' : notificaciones.length}
                </span>
              )}
            </button>
            {mostrarNotif && (
              <div style={{ position: 'absolute', right: 0, top: '110%', width: '320px', background: 'white', borderRadius: '12px', border: '1px solid #E8ECF0', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 100 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Notificaciones</p>
                  {notificaciones.length > 0 && <button onClick={marcarLeidas} style={{ fontSize: '11px', color: '#C41230', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Marcar leídas</button>}
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {notificaciones.length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#8A9BB0', textAlign: 'center', padding: '24px', margin: 0 }}>Sin notificaciones</p>
                  ) : notificaciones.map((n: any) => (
                    <div key={n.id} onClick={() => { setMostrarNotif(false); if (n.link) router.push(n.link) }}
                      style={{ padding: '12px 16px', borderBottom: '1px solid #F5F7FA', cursor: 'pointer', background: '#FFFBEB' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F1923', margin: '0 0 3px' }}>🚛 {n.mensaje}</p>
                      <p style={{ fontSize: '10px', color: '#8A9BB0', margin: 0 }}>{formatFecha(n.created_at, true)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <BotonAdmin />
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ display: 'flex', height: 'calc(100vh - 59px)' }}>

        {/* Lista izquierda */}
        <div style={{ width: '300px', minWidth: '300px', background: 'white', borderRight: '1px solid #E8ECF0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px', borderBottom: '1px solid #F0F2F5' }}>
            <input type="text" placeholder="Buscar por número, BL, shipment..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' as const, color: '#0F1923' }} />
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              style={{ width: '100%', padding: '7px 12px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', outline: 'none', background: 'white', marginBottom: '8px', color: '#0F1923' }}>
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="asignada">Asignadas</option>
              <option value="entregada">Entregadas</option>
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                style={{ padding: '6px 8px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '11px', outline: 'none', color: '#0F1923' }} />
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                style={{ padding: '6px 8px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '11px', outline: 'none', color: '#0F1923' }} />
            </div>
          </div>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0, fontWeight: 500 }}>{solicitudesFiltradas.length} solicitudes</p>
            {nuevasSinVer > 0 && <p style={{ fontSize: '10px', color: '#E65100', fontWeight: 700, margin: 0 }}>⚡ {nuevasSinVer} sin revisar</p>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {solicitudesFiltradas.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: '#8A9BB0', margin: 0 }}>Sin resultados</p>
              </div>
            ) : solicitudesFiltradas.map((sol: any) => {
              const badge = estadoBadgeMap[sol.estado] || estadoBadgeMap.pendiente
              const esNueva = !sol.visto_por_transporte && sol.estado === 'pendiente'
              return (
                <div key={sol.id} onClick={() => seleccionarSolicitud(sol)}
                  style={{ padding: '12px 16px', borderBottom: '1px solid #F5F7FA', cursor: 'pointer', background: seleccionada?.id === sol.id ? '#FEF2F2' : esNueva ? '#FFFBEB' : 'white', borderLeft: seleccionada?.id === sol.id ? '3px solid #C41230' : esNueva ? '3px solid #F59E0B' : '3px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F1923', margin: 0 }}>{sol.numero}</p>
                      {esNueva && <span style={{ fontSize: '8px', background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>NUEVO</span>}
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 2px' }}>
                    {sol.clientes?.razon_social || sol.consignatario || '—'} · {sol.tipo_carga}
                  </p>
                  <p style={{ fontSize: '10px', color: '#BCC6D0', margin: 0 }}>
                    {sol.bl_awb || sol.shipment || '—'} · {formatFecha(sol.fecha_recojo)}
                    {sol.num_unidades > 1 && <span style={{ marginLeft: '4px', color: '#C41230', fontWeight: 700 }}>· {sol.num_unidades} uts</span>}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel derecho */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F0F2F5' }}>
          {!seleccionada ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                {nuevasSinVer > 0 && (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '16px 24px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', margin: '0 0 4px' }}>⚡ {nuevasSinVer} solicitud{nuevasSinVer > 1 ? 'es nuevas' : ' nueva'}</p>
                    <p style={{ fontSize: '12px', color: '#92400E', margin: 0 }}>Haz clic en las marcadas como NUEVO</p>
                  </div>
                )}
                <p style={{ fontSize: '32px', margin: '0 0 12px' }}>🚛</p>
                <p style={{ fontSize: '14px', color: '#8A9BB0', margin: 0, fontWeight: 600 }}>Selecciona una solicitud para atender</p>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '720px' }}>

              {/* Cabecera */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', padding: '20px 24px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' as const }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F1923', margin: 0 }}>{seleccionada.numero}</h2>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: seleccionada.tipo_servicio === 'EXPO' ? '#1565C0' : '#C41230', background: seleccionada.tipo_servicio === 'EXPO' ? '#E3F2FD' : '#FFEBEE', padding: '2px 8px', borderRadius: '6px' }}>
                    {seleccionada.tipo_servicio || 'IMPO'}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: (estadoBadgeMap[seleccionada.estado] || estadoBadgeMap.pendiente).bg, color: (estadoBadgeMap[seleccionada.estado] || estadoBadgeMap.pendiente).color }}>
                    {(estadoBadgeMap[seleccionada.estado] || estadoBadgeMap.pendiente).texto}
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 16px' }}>Creada el {formatFecha(seleccionada.created_at, true)}</p>
                <div style={{ background: '#F8F9FA', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#C41230', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                    {emailOperativo ? emailOperativo.charAt(0).toUpperCase() : '?'}
                  </div>
                  <p style={{ fontSize: '12px', color: '#8A9BB0', margin: 0 }}>{emailOperativo || 'Sin operativo asignado'}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#F8F9FA', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                  {[
                    { label: 'Cliente', valor: seleccionada.clientes?.razon_social || seleccionada.consignatario || '—' },
                    { label: 'Shipment', valor: seleccionada.shipment || '—' },
                    { label: 'BL / AWB', valor: seleccionada.bl_awb || '—' },
                    { label: 'Recojo', valor: seleccionada.direccion_recojo || '—' },
                    { label: 'Entrega', valor: seleccionada.direccion_entrega || '—' },
                    { label: 'Zona', valor: seleccionada.zona || '—' },
                    { label: 'Tipo de carga', valor: seleccionada.tipo_carga || '—' },
                    { label: 'Unidades', valor: seleccionada.num_unidades || 1 },
                    { label: 'Fecha recojo', valor: formatFecha(seleccionada.fecha_recojo) },
                  ].map((item: any) => (
                    <div key={item.label}>
                      <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</p>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F1923', margin: 0 }}>{item.valor}</p>
                    </div>
                  ))}
                </div>
                {servicioCompletado && seleccionada.fecha_culminacion && (
                  <div style={{ background: '#E8F5E9', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', border: '1px solid #A5D6A7' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '0 0 2px', textTransform: 'uppercase' }}>Fecha culminación</p>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#2E7D32', margin: 0 }}>{formatFecha(seleccionada.fecha_culminacion, true)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '0 0 2px', textTransform: 'uppercase' }}>Deadline facturación (48h)</p>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#C41230', margin: 0 }}>{seleccionada.deadline_facturacion ? formatFecha(seleccionada.deadline_facturacion, true) : '—'}</p>
                      </div>
                    </div>
                  </div>
                )}
                {seleccionada.observaciones && (
                  <div style={{ background: '#FFF3E0', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', border: '1px solid #FFCC80' }}>
                    <p style={{ fontSize: '10px', color: '#E65100', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase' }}>Instrucciones del operativo</p>
                    <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{seleccionada.observaciones}</p>
                  </div>
                )}
                {documentos.length > 0 && (
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F1923', marginBottom: '8px' }}>Documentos adjuntos</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                      {documentos.map((doc: any) => (
                        <div key={doc.id} onClick={() => verDocumento(doc.url)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#E3F2FD', border: '1px solid #90CAF9', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer' }}>
                          <span style={{ fontSize: '12px', color: '#1565C0', fontWeight: 600 }}>📄 {doc.nombre}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Servicio completado */}
              {servicioCompletado && (
                <div style={{ background: '#E8F5E9', borderRadius: '14px', border: '1px solid #A5D6A7', padding: '18px 24px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>📦</span>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#2E7D32', margin: '0 0 3px' }}>Servicio completado</p>
                      <p style={{ fontSize: '12px', color: '#8A9BB0', margin: 0 }}>Culminado el {formatFecha(seleccionada.fecha_entrega, true)}.</p>
                    </div>
                  </div>
                  {seleccionada.evidencia_url && (
                    <button onClick={() => verDocumento(seleccionada.evidencia_url)}
                      style={{ marginTop: '12px', padding: '8px 18px', background: 'white', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      Ver evidencia de entrega
                    </button>
                  )}
                </div>
              )}

              {/* Panel asignación */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', padding: '20px 24px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', background: '#FFEBEE', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🚛</div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>
                        {tieneAsignaciones ? 'Gestión de unidades' : 'Asignar unidades'}
                        <span style={{ fontSize: '11px', color: '#8A9BB0', fontWeight: 400, marginLeft: '6px' }}>({seleccionada.num_unidades || 1} requerida(s))</span>
                      </p>
                      <p style={{ fontSize: '11px', color: '#2E7D32', margin: 0, fontWeight: 500 }}>✓ Proveedores homologados ({proveedoresHomologados.length})</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {mostrarForm && !servicioCompletado && (
                      <button onClick={() => setMostrarFormNuevoProveedor(!mostrarFormNuevoProveedor)}
                        style={{ padding: '7px 14px', background: mostrarFormNuevoProveedor ? '#F0F2F5' : '#FFEBEE', color: mostrarFormNuevoProveedor ? '#8A9BB0' : '#B71C1C', border: `1px solid ${mostrarFormNuevoProveedor ? '#E8ECF0' : '#EF9A9A'}`, borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        {mostrarFormNuevoProveedor ? 'Cancelar' : '+ Proveedor urgente'}
                      </button>
                    )}
                    {tieneAsignaciones && !modoReasignar && !servicioCompletado && (
                      <button onClick={() => setModoReasignar(true)}
                        style={{ padding: '7px 16px', background: '#FFF3E0', color: '#E65100', border: '1px solid #FFCC80', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        Reasignar
                      </button>
                    )}
                  </div>
                </div>

                {/* Formulario nuevo proveedor urgente */}
                {mostrarFormNuevoProveedor && mostrarForm && (
                  <div style={{ background: '#FFF5F5', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: '2px solid #EF9A9A' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '16px' }}>🚨</span>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#B71C1C', margin: 0 }}>Registrar proveedor urgente</p>
                    </div>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 14px' }}>
                      El proveedor quedará en estado <strong>pendiente urgente</strong> y el evaluador recibirá una alerta inmediata.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      {/* RUC con validación SUNAT */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '4px', textTransform: 'uppercase' }}>RUC *</label>
                        <div style={{ position: 'relative' }}>
                          <input type="text" maxLength={11} value={nuevoProveedorForm.ruc}
                            onChange={async (e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 11)
                              setNuevoProveedorForm({ ...nuevoProveedorForm, ruc: val, razon_social: '' })
                              setRucUrgente('')
                              if (val.length === 11) {
                                setRucUrgente('buscando')
                                try {
                                  const res = await fetch(`/api/validar-ruc?ruc=${val}`)
                                  const data = await res.json()
                                  if (data.nombre) {
                                    setNuevoProveedorForm(prev => ({ ...prev, ruc: val, razon_social: data.nombre }))
                                    setRucUrgente('ok')
                                  } else {
                                    setRucUrgente('error')
                                  }
                                } catch { setRucUrgente('error') }
                              }
                            }}
                            placeholder="20xxxxxxxxx"
                            style={{ width: '100%', padding: '8px 12px', paddingRight: '36px', border: `1.5px solid ${rucUrgente === 'ok' ? '#A5D6A7' : rucUrgente === 'error' ? '#EF9A9A' : '#E8ECF0'}`, borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const, color: '#0F1923' }} />
                          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}>
                            {rucUrgente === 'buscando' ? '⏳' : rucUrgente === 'ok' ? '✅' : rucUrgente === 'error' ? '❌' : ''}
                          </span>
                        </div>
                        {rucUrgente === 'buscando' && <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '3px 0 0' }}>Consultando SUNAT...</p>}
                        {rucUrgente === 'error' && <p style={{ fontSize: '10px', color: '#B71C1C', margin: '3px 0 0' }}>RUC no encontrado en SUNAT</p>}
                      </div>

                      {/* Razón social */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '4px', textTransform: 'uppercase' }}>Razón social *</label>
                        <input type="text" value={nuevoProveedorForm.razon_social}
                          onChange={(e) => setNuevoProveedorForm({ ...nuevoProveedorForm, razon_social: e.target.value })}
                          placeholder="Se llena automáticamente"
                          style={{ width: '100%', padding: '8px 12px', border: `1.5px solid ${rucUrgente === 'ok' ? '#A5D6A7' : '#E8ECF0'}`, borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const, color: '#0F1923', background: rucUrgente === 'ok' ? '#F1F8F1' : 'white' }} />
                      </div>

                      {/* Placa */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '4px', textTransform: 'uppercase' }}>Placa *</label>
                        <input type="text" value={nuevoProveedorForm.placa}
                          onChange={(e) => setNuevoProveedorForm({ ...nuevoProveedorForm, placa: e.target.value })}
                          placeholder="ABC-123"
                          style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const, color: '#0F1923' }} />
                      </div>

                      {/* Conductor */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '4px', textTransform: 'uppercase' }}>Conductor *</label>
                        <input type="text" value={nuevoProveedorForm.conductor}
                          onChange={(e) => setNuevoProveedorForm({ ...nuevoProveedorForm, conductor: e.target.value })}
                          placeholder="Nombre completo"
                          style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const, color: '#0F1923' }} />
                      </div>
                    </div>
                    <button onClick={crearProveedorUrgente} disabled={guardandoNuevoProveedor}
                      style={{ padding: '9px 20px', background: '#B71C1C', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: guardandoNuevoProveedor ? 0.6 : 1 }}>
                      {guardandoNuevoProveedor ? 'Registrando...' : '🚨 Registrar y usar este proveedor'}
                    </button>
                  </div>
                )}

                {tieneAsignaciones && !mostrarForm && (
                  <div>
                    {asignacionesDB.map((a: any, idx: number) => {
                      const statusActual = statusUnidades[a.id] || a.solicitud_unidad_status?.[0]?.status || 'Asignado'
                      const sc = statusColor[statusActual] || { bg: '#F5F5F5', color: '#666' }
                      const estadosDisponibles = esContenedor(seleccionada) ? ESTADOS_UNIDAD_CONTENEDOR : ESTADOS_UNIDAD_BASE
                      const esCompletada = statusActual === 'Servicio completado'
                      return (
                        <div key={a.id} style={{ background: '#F8F9FA', borderRadius: '10px', padding: '14px', marginBottom: '10px', border: '1px solid #E8ECF0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>Unidad {idx + 1}</p>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: sc.bg, color: sc.color }}>{statusActual}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: esCompletada || servicioCompletado ? '0' : '12px' }}>
                            <div>
                              <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '0 0 2px', textTransform: 'uppercase' }}>Empresa</p>
                              <p style={{ fontSize: '12px', fontWeight: 700, color: '#2E7D32', margin: 0 }}>{a.proveedores?.razon_social || '—'}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '0 0 2px', textTransform: 'uppercase' }}>Placa</p>
                              <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F1923', margin: 0 }}>{a.unidades?.placa || '—'}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '0 0 2px', textTransform: 'uppercase' }}>Conductor</p>
                              <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F1923', margin: 0 }}>{a.conductores?.nombre_completo || '—'}</p>
                            </div>
                          </div>
                          {!esCompletada && !servicioCompletado && (
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '6px', textTransform: 'uppercase' }}>Actualizar estado</label>
                              <select value="" onChange={(e) => { if (e.target.value) actualizarStatusUnidad(a.id, e.target.value) }} disabled={guardando}
                                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', outline: 'none', background: 'white', cursor: 'pointer', color: '#0F1923' }}>
                                <option value="">— Selecciona el nuevo estado —</option>
                                {estadosDisponibles.map((est: string) => <option key={est} value={est}>{est}</option>)}
                              </select>
                            </div>
                          )}
                          {esCompletada && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                              <span>✅</span>
                              <span style={{ fontSize: '12px', color: '#2E7D32', fontWeight: 600 }}>Unidad completada</span>
                              {a.solicitud_unidad_status?.[0]?.fecha_entrega && (
                                <span style={{ fontSize: '11px', color: '#8A9BB0' }}>· {formatFecha(a.solicitud_unidad_status[0].fecha_entrega, true)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {seleccionada.coordinador_transporte && (
                      <div style={{ background: '#F8F9FA', borderRadius: '10px', padding: '12px 16px', marginBottom: '10px', border: '1px solid #E8ECF0' }}>
                        <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '0 0 3px', fontWeight: 700, textTransform: 'uppercase' }}>Coordinador</p>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>{seleccionada.coordinador_transporte}</p>
                      </div>
                    )}
                    {!servicioCompletado && (
                      <div style={{ marginTop: '14px' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#2E7D32', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                          📦 Subir evidencia de entrega
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) subirEvidencia(f) }} />
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {mostrarForm && !servicioCompletado && (
                  <div>
                    {asignacionesForm.map((asig: AsignacionForm, idx: number) => (
                      <div key={idx} style={{ border: '1px solid #E8ECF0', borderRadius: '10px', padding: '16px', marginBottom: '12px', background: '#F8F9FA' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#C41230', margin: '0 0 12px', textTransform: 'uppercase' }}>
                          Unidad {idx + 1} de {asignacionesForm.length}
                        </p>
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '5px', textTransform: 'uppercase' }}>Empresa *</label>
                          <select value={asig.proveedor_id} onChange={(e) => actualizarFormAsignacion(idx, 'proveedor_id', e.target.value)}
                            style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', color: '#0F1923' }}>
                            <option value="">Selecciona un proveedor homologado...</option>
                            {proveedoresHomologados.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.razon_social} — RUC {p.ruc}</option>
                            ))}
                          </select>
                        </div>

                        {/* Placa */}
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#8A9BB0', textTransform: 'uppercase' }}>Placa *</label>
                            {asig.proveedor_id && (
                              <button onClick={() => { const n = [...asignacionesForm]; n[idx].modo_nueva_unidad = !n[idx].modo_nueva_unidad; setAsignacionesForm(n) }}
                                style={{ fontSize: '10px', color: '#1565C0', background: '#E3F2FD', border: 'none', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}>
                                {asig.modo_nueva_unidad ? 'Cancelar' : '+ Nueva placa'}
                              </button>
                            )}
                          </div>
                          {asig.modo_nueva_unidad ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input type="text" value={asig.nueva_placa || ''} placeholder="Ej: ABC-123"
                                onChange={(e) => { const n = [...asignacionesForm]; n[idx].nueva_placa = e.target.value; setAsignacionesForm(n) }}
                                style={{ flex: 1, padding: '9px 14px', border: '1.5px solid #90CAF9', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#0F1923' }} />
                              <button onClick={() => agregarUnidadAProveedor(idx, asig.nueva_placa || '', asig.proveedor_id)}
                                style={{ padding: '9px 16px', background: '#1565C0', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                Agregar
                              </button>
                            </div>
                          ) : (
                            <select value={asig.unidad_id} onChange={(e) => actualizarFormAsignacion(idx, 'unidad_id', e.target.value)}
                              disabled={!asig.proveedor_id}
                              style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', opacity: !asig.proveedor_id ? 0.5 : 1, color: '#0F1923' }}>
                              <option value="">Selecciona placa...</option>
                              {asig.unidades_proveedor.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.placa}{u.pendiente_revision ? ' ⚠️' : ''}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Conductor */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 600, color: '#8A9BB0', textTransform: 'uppercase' }}>Conductor *</label>
                            {asig.proveedor_id && (
                              <button onClick={() => { const n = [...asignacionesForm]; n[idx].modo_nuevo_conductor = !n[idx].modo_nuevo_conductor; setAsignacionesForm(n) }}
                                style={{ fontSize: '10px', color: '#1565C0', background: '#E3F2FD', border: 'none', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}>
                                {asig.modo_nuevo_conductor ? 'Cancelar' : '+ Nuevo conductor'}
                              </button>
                            )}
                          </div>
                          {asig.modo_nuevo_conductor ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input type="text" value={asig.nuevo_conductor || ''} placeholder="Nombre completo"
                                onChange={(e) => { const n = [...asignacionesForm]; n[idx].nuevo_conductor = e.target.value; setAsignacionesForm(n) }}
                                style={{ flex: 1, padding: '9px 14px', border: '1.5px solid #90CAF9', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#0F1923' }} />
                              <button onClick={() => agregarConductorAProveedor(idx, asig.nuevo_conductor || '', asig.proveedor_id)}
                                style={{ padding: '9px 16px', background: '#1565C0', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                Agregar
                              </button>
                            </div>
                          ) : (
                            <select value={asig.conductor_id} onChange={(e) => actualizarFormAsignacion(idx, 'conductor_id', e.target.value)}
                              disabled={!asig.proveedor_id}
                              style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', opacity: !asig.proveedor_id ? 0.5 : 1, color: '#0F1923' }}>
                              <option value="">Selecciona conductor...</option>
                              {asig.conductores_proveedor.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.nombre_completo}{c.pendiente_revision ? ' ⚠️' : ''}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    ))}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '5px', textTransform: 'uppercase' }}>Coordinador</label>
                        <input type="text" value={coordinadorTransporte} onChange={(e) => setCoordinadorTransporte(e.target.value)}
                          placeholder="Nombre del coordinador"
                          style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const, color: '#0F1923' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '5px', textTransform: 'uppercase' }}>Notas internas</label>
                        <input type="text" value={observacionesTransporte} onChange={(e) => setObservacionesTransporte(e.target.value)}
                          placeholder="Notas para el equipo"
                          style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const, color: '#0F1923' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={guardarAsignaciones} disabled={guardando}
                        style={{ flex: 1, padding: '12px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                        {guardando ? 'Guardando...' : modoReasignar ? 'Confirmar reasignación →' : 'Asignar unidades →'}
                      </button>
                      {modoReasignar && (
                        <button onClick={() => setModoReasignar(false)}
                          style={{ padding: '12px 18px', background: '#F0F2F5', color: '#8A9BB0', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* INCIDENCIAS */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', padding: '20px 24px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: incidencias.length > 0 || mostrarFormIncidencia ? '16px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', background: '#FFF3E0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>⚠️</div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>
                        Incidencias
                        {incidencias.length > 0 && <span style={{ fontSize: '11px', color: '#E65100', fontWeight: 700, marginLeft: '8px', background: '#FFF3E0', padding: '2px 8px', borderRadius: '20px' }}>{incidencias.length}</span>}
                      </p>
                      <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>Registra cualquier novedad durante el servicio</p>
                    </div>
                  </div>
                  <button onClick={() => setMostrarFormIncidencia(!mostrarFormIncidencia)}
                    style={{ padding: '7px 16px', background: mostrarFormIncidencia ? '#F0F2F5' : '#FFF3E0', color: mostrarFormIncidencia ? '#8A9BB0' : '#E65100', border: `1px solid ${mostrarFormIncidencia ? '#E8ECF0' : '#FFCC80'}`, borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {mostrarFormIncidencia ? 'Cancelar' : '+ Agregar incidencia'}
                  </button>
                </div>
                {mostrarFormIncidencia && (
                  <div style={{ background: '#FFF8F0', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: '1px solid #FFCC80' }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#E65100', margin: '0 0 12px', textTransform: 'uppercase' }}>Nueva incidencia</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '5px', textTransform: 'uppercase' }}>Tipo</label>
                        <select value={incidenciaForm.tipo} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, tipo: e.target.value })}
                          style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', color: '#0F1923' }}>
                          {Object.keys(tipoIncidenciaMap).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '5px', textTransform: 'uppercase' }}>Placa afectada (opcional)</label>
                        <input type="text" value={incidenciaForm.placa} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, placa: e.target.value })}
                          placeholder="Ej: ABC-123"
                          style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const, color: '#0F1923' }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A9BB0', marginBottom: '5px', textTransform: 'uppercase' }}>Descripción *</label>
                      <textarea value={incidenciaForm.descripcion} onChange={(e) => setIncidenciaForm({ ...incidenciaForm, descripcion: e.target.value })}
                        placeholder="Describe la incidencia..." rows={3}
                        style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const, color: '#0F1923', fontFamily: 'inherit' }} />
                    </div>
                    <button onClick={guardarIncidencia} disabled={guardandoIncidencia || !incidenciaForm.descripcion.trim()}
                      style={{ padding: '9px 20px', background: '#E65100', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: !incidenciaForm.descripcion.trim() ? 0.5 : 1 }}>
                      {guardandoIncidencia ? 'Guardando...' : 'Registrar incidencia'}
                    </button>
                  </div>
                )}
                {incidencias.length === 0 && !mostrarFormIncidencia ? (
                  <p style={{ fontSize: '12px', color: '#8A9BB0', margin: 0, textAlign: 'center', padding: '12px 0' }}>Sin incidencias registradas</p>
                ) : incidencias.map((inc: any, i: number) => {
                  const tc = tipoIncidenciaMap[inc.tipo] || tipoIncidenciaMap['Otro']
                  return (
                    <div key={inc.id} style={{ background: '#FAFBFC', borderRadius: '10px', padding: '14px', marginBottom: i < incidencias.length - 1 ? '10px' : '0', border: '1px solid #E8ECF0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: tc.bg, color: tc.color }}>{inc.tipo}</span>
                          {inc.placa && <span style={{ fontSize: '10px', color: '#8A9BB0', fontWeight: 600 }}>🚛 {inc.placa}</span>}
                        </div>
                        <p style={{ fontSize: '10px', color: '#BCC6D0', margin: 0 }}>{formatFecha(inc.created_at, true)}</p>
                      </div>
                      <p style={{ fontSize: '12px', color: '#0F1923', margin: 0, lineHeight: '1.5' }}>{inc.descripcion}</p>
                    </div>
                  )
                })}
              </div>

              {/* Historial */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Historial de cambios</p>
                  <span style={{ fontSize: '10px', color: '#2E7D32', background: '#E8F5E9', padding: '3px 10px', borderRadius: '20px', border: '1px solid #A5D6A7', fontWeight: 600 }}>● En tiempo real</span>
                </div>
                {historial.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <p style={{ fontSize: '12px', color: '#8A9BB0', margin: 0 }}>Sin cambios registrados aún</p>
                  </div>
                ) : historial.map((h: any, i: number) => {
                  const bAnterior = estadoBadgeMap[h.estado_anterior] || { bg: '#F5F5F5', color: '#616161', texto: h.estado_anterior || '—' }
                  const bNuevo = estadoBadgeMap[h.estado_nuevo] || { bg: '#F5F5F5', color: '#616161', texto: h.estado_nuevo || '—' }
                  return (
                    <div key={h.id || i} style={{ display: 'flex', gap: '12px', paddingBottom: i < historial.length - 1 ? '16px' : '0', position: 'relative' }}>
                      {i < historial.length - 1 && (
                        <div style={{ position: 'absolute', left: '11px', top: '26px', width: '2px', height: 'calc(100% - 10px)', background: '#E8ECF0' }} />
                      )}
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#F8F9FA', border: '2px solid #E8ECF0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', zIndex: 1 }}>🔄</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' as const }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: bAnterior.bg, color: bAnterior.color }}>{bAnterior.texto}</span>
                          <span style={{ fontSize: '10px', color: '#8A9BB0' }}>→</span>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: bNuevo.bg, color: bNuevo.color }}>{bNuevo.texto}</span>
                        </div>
                        {h.comentario && <p style={{ fontSize: '12px', color: '#666', margin: '0 0 3px' }}>{h.comentario}</p>}
                        <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>
                          {formatFecha(h.created_at, true)}
                          {h.email && h.email !== '—' && <span style={{ marginLeft: '6px' }}>· {h.email}</span>}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}