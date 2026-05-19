'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BotonHub from '../../components/BotonHub'

// ─── Constantes ───────────────────────────────────────────────────────────────

const T  = '#2C2828'
const T2 = '#696869'

const ESTADOS_FINALES = ['Descarga completada', 'Devolución realizada']

const estadoBadge = (estado: string) => {
  if (!estado || estado === 'Pendiente de asignación') return { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente' }
  if (estado === 'Asignado')                            return { bg: '#EEF2FF', color: '#3730A3', texto: 'Asignado' }
  if (ESTADOS_FINALES.includes(estado))                 return { bg: '#F0FDF4', color: '#15803D', texto: 'Completado' }
  return { bg: '#E0F2FE', color: '#0369A1', texto: 'En curso' }
}

const formatFecha = (fecha: string) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Lima',
  })
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 14px',
  border: '1.5px solid #E2DCDC', borderRadius: '8px',
  fontSize: '13px', outline: 'none',
  color: T, background: 'white', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  color: T2, marginBottom: '5px',
  textTransform: 'uppercase', letterSpacing: '0.04em',
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CoordinacionPage() {
  const router = useRouter()
  const [loading, setLoading]       = useState(true)
  const [rolUsuario, setRolUsuario] = useState('')
  const [userId, setUserId]         = useState('')
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [seleccionada, setSeleccionada] = useState<any>(null)
  const [busqueda, setBusqueda]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  // Datos para asignación
  const [operativosTP, setOperativosTP]   = useState<any[]>([])
  const [proveedores, setProveedores]     = useState<any[]>([])
  const [unidades, setUnidades]           = useState<any[]>([])
  const [conductores, setConductores]     = useState<any[]>([])
  const [asignacionDB, setAsignacionDB]   = useState<any>(null)
  const [creadorInfo, setCreadorInfo]     = useState<any>(null)

  // Formulario asignación
  const [opTransporteId, setOpTransporteId] = useState('')
  const [proveedorId, setProveedorId]       = useState('')
  const [unidadId, setUnidadId]             = useState('')
  const [conductorId, setConductorId]       = useState('')
  const [esNoHomologado, setEsNoHomologado] = useState(false)
  const [guardando, setGuardando]           = useState(false)

  // Precio
  const [modoPrecio, setModoPrecio]         = useState<'confirmar' | 'proponer' | null>(null)
  const [inputPrecio, setInputPrecio]       = useState('')
  const [inputMotivo, setInputMotivo]       = useState('')
  const [guardandoPrecio, setGuardandoPrecio] = useState(false)

  const canalRef = useRef<any>(null)
  const iniciado = useRef(false)

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    init()
    return () => { if (canalRef.current) supabase.removeChannel(canalRef.current) }
  }, [])

  // ── Init ──────────────────────────────────────────────────────────────────

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', session.user.id).single()

    const roles = ['transporte', 'operativo_transporte', 'admin']
    if (!roles.includes(perfil?.rol)) { router.push('/hub'); return }

    setRolUsuario(perfil?.rol)
    setUserId(session.user.id)

    await Promise.all([
      cargarSolicitudes(perfil?.rol, session.user.id),
      cargarOperativosTP(),
      cargarProveedores(),
    ])

    supabase.channel('coord-solicitudes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_transporte' },
        () => cargarSolicitudes(perfil?.rol, session.user.id))
      .subscribe()
  }

  // ── Datos ─────────────────────────────────────────────────────────────────

  const cargarSolicitudes = async (rol: string, uid: string) => {
    let query = supabase
      .from('solicitudes_transporte')
      .select(`*, clientes(razon_social), perfiles!operativo_id(nombre, email)`)
      .order('created_at', { ascending: false })

    if (rol === 'operativo_transporte') query = query.eq('operativo_transporte_id', uid)

    const { data } = await query
    setSolicitudes(data || [])
    setLoading(false)
  }

  const cargarOperativosTP = async () => {
    const { data } = await supabase
      .from('perfiles').select('id, nombre, email').eq('rol', 'operativo_transporte')
    setOperativosTP(data || [])
  }

  const cargarProveedores = async () => {
    const { data } = await supabase
      .from('proveedores').select('id, razon_social, ruc, estado, urgente')
      .in('estado', ['homologado', 'pendiente'])
      .order('razon_social')
    setProveedores(data || [])
  }

  const cargarUnidadesConductores = async (pid: string) => {
    const [{ data: u }, { data: c }] = await Promise.all([
      supabase.from('unidades').select('id, placa, pendiente_revision').eq('proveedor_id', pid).eq('activo', true),
      supabase.from('conductores').select('id, nombre_completo, pendiente_revision').eq('proveedor_id', pid).eq('activo', true),
    ])
    setUnidades(u || [])
    setConductores(c || [])
  }

  const cargarAsignacion = async (solicitudId: string) => {
    const { data } = await supabase
      .from('solicitud_asignaciones')
      .select('*, proveedores(razon_social, estado), unidades(placa), conductores(nombre_completo)')
      .eq('solicitud_id', solicitudId)
      .single()
    setAsignacionDB(data || null)

    if (data) {
      setProveedorId(data.proveedor_id || '')
      setUnidadId(data.unidad_id || '')
      setConductorId(data.conductor_id || '')
      if (data.proveedor_id) await cargarUnidadesConductores(data.proveedor_id)
    }
  }

  const seleccionarSolicitud = async (sol: any) => {
    setSeleccionada(sol)
    setModoPrecio(null)
    setInputPrecio('')
    setInputMotivo('')
    setOpTransporteId(sol.operativo_transporte_id || '')
    setProveedorId('')
    setUnidadId('')
    setConductorId('')
    setUnidades([])
    setConductores([])
    setEsNoHomologado(false)
    setAsignacionDB(null)

    await cargarAsignacion(sol.id)

    // Info del creador (para que transporte sepa con quién coordinar)
    if (sol.operativo_id) {
      const { data: creador } = await supabase
        .from('perfiles').select('nombre, email').eq('id', sol.operativo_id).single()
      setCreadorInfo(creador)
    }

    // Suscripción en tiempo real para esta solicitud
    if (canalRef.current) supabase.removeChannel(canalRef.current)
    const canal = supabase.channel(`coord-sol-${sol.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'solicitudes_transporte', filter: `id=eq.${sol.id}` },
        (payload: any) => {
          setSeleccionada((prev: any) => ({ ...prev, ...payload.new }))
          setSolicitudes(prev => prev.map(s => s.id === sol.id ? { ...s, ...payload.new } : s))
        })
      .subscribe()
    canalRef.current = canal
  }

  // ── Asignar operativo_transporte (solo rol transporte) ────────────────────

  const guardarOperativoTP = async () => {
    if (!opTransporteId || !seleccionada) return
    setGuardando(true)

    await supabase.from('solicitudes_transporte')
      .update({ operativo_transporte_id: opTransporteId })
      .eq('id', seleccionada.id)

    const { data: { session } } = await supabase.auth.getSession()
    const opNombre = operativosTP.find(o => o.id === opTransporteId)?.nombre || opTransporteId

    await supabase.from('solicitud_historial').insert({
      solicitud_id:    seleccionada.id,
      usuario_id:      session?.user.id,
      estado_anterior: seleccionada.estado,
      estado_nuevo:    seleccionada.estado,
      comentario:      `Coordinador asignado: ${opNombre}`,
    })

    // Notificar al operativo_transporte
    await supabase.from('notificaciones_internas').insert({
      usuario_id: opTransporteId,
      mensaje:    `Se te asignó la solicitud ${seleccionada.numero} — ${seleccionada.tipo_carga}`,
      link:       '/transporte/coordinacion',
    })

    setSeleccionada((prev: any) => ({ ...prev, operativo_transporte_id: opTransporteId }))
    setGuardando(false)
  }

  // ── Guardar asignación empresa/unidad/conductor ───────────────────────────

  const guardarAsignacion = async () => {
    if (!proveedorId || !unidadId || !conductorId) {
      alert('Selecciona empresa, unidad y conductor'); return
    }
    setGuardando(true)

    const { data: { session } } = await supabase.auth.getSession()
    const prov = proveedores.find(p => p.id === proveedorId)
    const noHomologado = prov?.estado !== 'homologado'

    // Eliminar asignación anterior si existe
    await supabase.from('solicitud_asignaciones').delete().eq('solicitud_id', seleccionada.id)

    // Crear nueva asignación
    const { data: asig } = await supabase.from('solicitud_asignaciones').insert({
      solicitud_id:     seleccionada.id,
      proveedor_id:     proveedorId,
      unidad_id:        unidadId,
      conductor_id:     conductorId,
      es_no_homologado: noHomologado,
      orden:            1,
    }).select().single()

    // Crear estado inicial
    if (asig) {
      await supabase.from('solicitud_unidad_status').insert({
        solicitud_id:  seleccionada.id,
        asignacion_id: asig.id,
        orden:         1,
        status:        'Asignado',
      })
    }

    // Actualizar estado de la solicitud
    await supabase.from('solicitudes_transporte')
      .update({ estado: 'Asignado' })
      .eq('id', seleccionada.id)

    const unidad    = unidades.find(u => u.id === unidadId)
    const conductor = conductores.find(c => c.id === conductorId)

    await supabase.from('solicitud_historial').insert({
      solicitud_id:    seleccionada.id,
      usuario_id:      session?.user.id,
      estado_anterior: seleccionada.estado,
      estado_nuevo:    'Asignado',
      comentario:      `Asignado: ${prov?.razon_social}${noHomologado ? ' ⚠️ No homologado' : ''} · Placa: ${unidad?.placa || '—'} · Conductor: ${conductor?.nombre_completo || '—'}`,
    })

    // Notificar al operativo que creó la solicitud
    if (seleccionada.operativo_id) {
      await supabase.from('notificaciones_internas').insert({
        usuario_id: seleccionada.operativo_id,
        mensaje:    `Tu solicitud ${seleccionada.numero} fue asignada a ${prov?.razon_social}`,
        link:       `/operativo/${seleccionada.id}`,
      })
    }

    await cargarAsignacion(seleccionada.id)
    setSeleccionada((prev: any) => ({ ...prev, estado: 'Asignado' }))
    setSolicitudes(prev => prev.map(s => s.id === seleccionada.id ? { ...s, estado: 'Asignado' } : s))
    setGuardando(false)
  }

  // ── Guardar precio ────────────────────────────────────────────────────────

  const guardarPrecio = async () => {
    if (modoPrecio === 'proponer') {
      if (!inputPrecio || isNaN(parseFloat(inputPrecio))) { alert('Ingresa un monto válido'); return }
      if (!inputMotivo.trim()) { alert('El motivo es obligatorio al proponer un precio diferente'); return }
    }
    setGuardandoPrecio(true)

    const { data: { session } } = await supabase.auth.getSession()
    const confirma = modoPrecio === 'confirmar'
    const precioFinal = confirma
      ? parseFloat(seleccionada.precio_sugerido)
      : parseFloat(inputPrecio)

    const upd: any = {
      precio_transporte: precioFinal,
      precio_comentario: confirma ? null : inputMotivo.trim(),
      precio_procede:    confirma ? true : null,
    }

    await supabase.from('solicitudes_transporte').update(upd).eq('id', seleccionada.id)

    await supabase.from('solicitud_historial').insert({
      solicitud_id:    seleccionada.id,
      usuario_id:      session?.user.id,
      estado_anterior: seleccionada.estado,
      estado_nuevo:    seleccionada.estado,
      comentario:      confirma
        ? `Precio confirmado: S/ ${precioFinal}`
        : `Coordinación propone S/ ${precioFinal} (sugerido: S/ ${seleccionada.precio_sugerido}) — ${inputMotivo}`,
    })

    // Si propone diferente → notificar al operativo
    if (!confirma && seleccionada.operativo_id) {
      await supabase.from('notificaciones_internas').insert({
        usuario_id: seleccionada.operativo_id,
        mensaje:    `Coordinación propone S/ ${precioFinal} en ${seleccionada.numero}. Revisar en tu panel.`,
        link:       `/operativo/${seleccionada.id}`,
      })
    }

    setSeleccionada((prev: any) => ({ ...prev, ...upd }))
    setSolicitudes(prev => prev.map(s => s.id === seleccionada.id ? { ...s, ...upd } : s))
    setModoPrecio(null)
    setInputPrecio('')
    setInputMotivo('')
    setGuardandoPrecio(false)
  }

  // ── Filtros ───────────────────────────────────────────────────────────────

  const solicitudesFiltradas = solicitudes.filter(s => {
    const matchB = busqueda === '' ||
      s.numero?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.clientes?.razon_social?.toLowerCase().includes(busqueda.toLowerCase())
    const matchE = filtroEstado === 'todos' ||
      (filtroEstado === 'pendiente' && s.estado === 'Pendiente de asignación') ||
      (filtroEstado === 'asignado'  && s.estado === 'Asignado') ||
      (filtroEstado === 'en_curso'  && s.estado && !['Pendiente de asignación', 'Asignado', ...ESTADOS_FINALES].includes(s.estado))
    return matchB && matchE
  })

  const nuevasSinVer = solicitudes.filter(s =>
    !s.visto_por_transporte && s.estado === 'Pendiente de asignación'
  ).length

  // ── Derivados de la solicitud seleccionada ────────────────────────────────

  const yaAsignado        = !!asignacionDB
  const tieneOpTP         = !!seleccionada?.operativo_transporte_id
  const tienePrecioTP     = !!seleccionada?.precio_transporte
  const precioMayor       = seleccionada?.precio_transporte > seleccionada?.precio_sugerido
  const puedeAsignarRecursos = rolUsuario === 'operativo_transporte' || rolUsuario === 'admin'
  const puedeAsignarCoord = rolUsuario === 'transporte' || rolUsuario === 'admin'

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F2F2' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #E2DCDC', borderTopColor: '#C41230', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: T2, fontSize: '13px', margin: 0 }}>Cargando...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F4F2F2', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* NAV */}
      <nav style={{ background: '#2C2828', padding: '0 28px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} onClick={() => router.push('/transporte')} />
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <button onClick={() => router.push('/transporte')}
            style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            ← Transporte
          </button>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '16px' }}>›</span>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>Coordinación</span>
          {nuevasSinVer > 0 && (
            <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, border: '1px solid #FDE68A' }}>
              {nuevasSinVer} nueva{nuevasSinVer > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BotonHub />
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#1565C0' }} />

      <div style={{ display: 'flex', height: 'calc(100vh - 55px)' }}>

        {/* ── Panel izquierdo ──────────────────────────────────────────────── */}
        <div style={{ width: '300px', minWidth: '300px', background: 'white', borderRight: '1px solid #E2DCDC', display: 'flex', flexDirection: 'column' }}>

          <div style={{ padding: '12px', borderBottom: '1px solid #F0ECEC' }}>
            <input type="text" placeholder="Buscar..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ ...inp, marginBottom: '8px' }} />
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              style={{ ...inp, background: 'white' }}>
              <option value="todos">Todos</option>
              <option value="pendiente">Pendiente de asignación</option>
              <option value="asignado">Asignado</option>
              <option value="en_curso">En curso</option>
            </select>
          </div>

          <div style={{ padding: '6px 14px', borderBottom: '1px solid #F0ECEC' }}>
            <p style={{ fontSize: '10px', color: T2, margin: 0 }}>{solicitudesFiltradas.length} solicitudes</p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {solicitudesFiltradas.map(sol => {
              const badge  = estadoBadge(sol.estado)
              const esNueva = !sol.visto_por_transporte && sol.estado === 'Pendiente de asignación'
              const creador = sol.perfiles?.nombre || sol.perfiles?.email
              return (
                <div key={sol.id} onClick={() => seleccionarSolicitud(sol)}
                  style={{ padding: '12px 16px', borderBottom: '1px solid #F5F2F2', cursor: 'pointer', background: seleccionada?.id === sol.id ? '#EFF6FF' : esNueva ? '#FFFBEB' : 'white', borderLeft: seleccionada?.id === sol.id ? '3px solid #1565C0' : esNueva ? '3px solid #F59E0B' : '3px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: T, margin: 0 }}>{sol.numero}</p>
                      {esNueva && <span style={{ fontSize: '8px', background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>NUEVO</span>}
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: T2, margin: '0 0 2px' }}>
                    {sol.clientes?.razon_social || '—'} · {sol.tipo_carga}
                  </p>
                  <p style={{ fontSize: '10px', color: '#D1CCCC', margin: '0 0 4px' }}>
                    {formatFecha(sol.fecha_recojo)}
                    {sol.hora_recojo && ` · ${sol.hora_recojo}`}
                  </p>
                  {creador && (
                    <p style={{ fontSize: '10px', color: T2, margin: 0 }}>
                      👤 {creador}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Panel derecho ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F4F2F2' }}>
          {!seleccionada ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                {nuevasSinVer > 0 && (
                  <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '12px', padding: '14px 24px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', margin: '0 0 2px' }}>⚡ {nuevasSinVer} solicitud{nuevasSinVer > 1 ? 'es nuevas' : ' nueva'}</p>
                    <p style={{ fontSize: '12px', color: '#92400E', margin: 0 }}>Pendientes de asignación</p>
                  </div>
                )}
                <p style={{ fontSize: '32px', margin: '0 0 12px' }}>📋</p>
                <p style={{ fontSize: '14px', color: T2, margin: 0, fontWeight: 600 }}>Selecciona una solicitud</p>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '680px' }}>

              {/* ── Info de la solicitud ──────────────────────────────────── */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2DCDC', padding: '20px 24px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: T, margin: '0 0 5px' }}>{seleccionada.numero}</h3>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: estadoBadge(seleccionada.estado).bg, color: estadoBadge(seleccionada.estado).color }}>
                        {estadoBadge(seleccionada.estado).texto}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: '#FEF2F2', color: '#C41230' }}>{seleccionada.tipo_carga}</span>
                    </div>
                  </div>
                  {/* Creador — visible para transporte */}
                  {creadorInfo && (
                    <div style={{ background: '#F8F6F6', borderRadius: '8px', padding: '8px 12px', border: '1px solid #E2DCDC', textAlign: 'right' }}>
                      <p style={{ fontSize: '9px', color: T2, margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 600 }}>Creado por</p>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: T, margin: 0 }}>{creadorInfo.nombre || creadorInfo.email}</p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#F8F6F6', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                  {[
                    { label: 'Cliente',       valor: seleccionada.clientes?.razon_social || '—' },
                    { label: 'Tipo unidad',   valor: seleccionada.tipo_unidad || '—' },
                    { label: 'Descripción',   valor: seleccionada.descripcion_producto || '—' },
                    { label: 'Fecha recojo',  valor: formatFecha(seleccionada.fecha_recojo) },
                    { label: 'Hora recojo',   valor: seleccionada.hora_recojo   || '—' },
                    { label: 'Fecha entrega', valor: formatFecha(seleccionada.fecha_entrega) },
                    { label: 'Hora entrega',  valor: seleccionada.hora_entrega  || '—' },
                    { label: 'Peso',          valor: seleccionada.peso    ? `${seleccionada.peso} TN`    : '—' },
                    { label: 'Volumen',       valor: seleccionada.volumen ? `${seleccionada.volumen} m³` : '—' },
                    ...(seleccionada.depot_vacios ? [{ label: 'DEPOT VACÍOS', valor: seleccionada.depot_vacios }] : []),
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: '9px', color: T2, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{item.label}</p>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: T, margin: 0 }}>{item.valor}</p>
                    </div>
                  ))}
                </div>

                {seleccionada.instrucciones && (
                  <div style={{ background: '#FFF3E0', borderRadius: '8px', padding: '10px 14px', border: '1px solid #FFCC80' }}>
                    <p style={{ fontSize: '9px', color: '#E65100', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase' }}>Instrucciones</p>
                    <p style={{ fontSize: '12px', color: T, margin: 0 }}>{seleccionada.instrucciones}</p>
                  </div>
                )}
              </div>

              {/* ── Asignar coordinador (solo transporte supervisor) ──────── */}
              {puedeAsignarCoord && (
                <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2DCDC', padding: '20px 24px', marginBottom: '14px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: T, margin: '0 0 14px' }}>
                    Asignar coordinador
                  </p>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label style={lbl}>Operativo de coordinación</label>
                      <select value={opTransporteId} onChange={e => setOpTransporteId(e.target.value)} style={{ ...inp, background: 'white' }}>
                        <option value="">Sin asignar</option>
                        {operativosTP.map(o => (
                          <option key={o.id} value={o.id}>{o.nombre || o.email}</option>
                        ))}
                      </select>
                    </div>
                    <button onClick={guardarOperativoTP} disabled={guardando || !opTransporteId}
                      style={{ padding: '9px 20px', background: '#1565C0', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: (!opTransporteId || guardando) ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                      {guardando ? 'Guardando...' : tieneOpTP ? 'Actualizar' : 'Asignar →'}
                    </button>
                  </div>
                  {tieneOpTP && (
                    <div style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F0FDF4', border: '1px solid #A5D6A7', borderRadius: '20px', padding: '4px 12px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2E7D32' }} />
                      <span style={{ fontSize: '11px', color: '#2E7D32', fontWeight: 500 }}>
                        {operativosTP.find(o => o.id === seleccionada.operativo_transporte_id)?.nombre || 'Coordinador asignado'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Asignar empresa / unidad / conductor ─────────────────── */}
              {puedeAsignarRecursos && (
                <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2DCDC', padding: '20px 24px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: T, margin: 0 }}>
                      {yaAsignado ? 'Asignación actual' : 'Asignar empresa / unidad / conductor'}
                    </p>
                    {yaAsignado && (
                      <button onClick={() => setAsignacionDB(null)}
                        style={{ fontSize: '11px', color: '#E65100', background: '#FFF3E0', border: '1px solid #FFCC80', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}>
                        Reasignar
                      </button>
                    )}
                  </div>

                  {/* Vista de asignación existente */}
                  {yaAsignado ? (
                    <div style={{ background: '#F8F6F6', borderRadius: '10px', padding: '14px', border: '1px solid #E2DCDC' }}>
                      {asignacionDB.es_no_homologado && (
                        <div style={{ background: '#FEF3C7', borderRadius: '6px', padding: '6px 10px', marginBottom: '10px', border: '1px solid #FDE68A' }}>
                          <p style={{ fontSize: '11px', color: '#92400E', margin: 0, fontWeight: 600 }}>⚠️ Proveedor no homologado — en proceso de homologación</p>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        <div>
                          <p style={{ fontSize: '9px', color: T2, margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 600 }}>Empresa</p>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: '#2E7D32', margin: 0 }}>{asignacionDB.proveedores?.razon_social || '—'}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '9px', color: T2, margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 600 }}>Placa</p>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: T, margin: 0 }}>{asignacionDB.unidades?.placa || '—'}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: '9px', color: T2, margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 600 }}>Conductor</p>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: T, margin: 0 }}>{asignacionDB.conductores?.nombre_completo || '—'}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Formulario de asignación */
                    <div>
                      {/* Empresa */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={lbl}>Empresa <span style={{ color: '#C41230' }}>*</span></label>
                        <select value={proveedorId}
                          onChange={async e => {
                            const pid = e.target.value
                            setProveedorId(pid)
                            setUnidadId('')
                            setConductorId('')
                            const prov = proveedores.find(p => p.id === pid)
                            setEsNoHomologado(prov?.estado !== 'homologado')
                            if (pid) await cargarUnidadesConductores(pid)
                            else { setUnidades([]); setConductores([]) }
                          }}
                          style={{ ...inp, background: 'white' }}>
                          <option value="">Selecciona una empresa...</option>
                          <optgroup label="✓ Homologadas">
                            {proveedores.filter(p => p.estado === 'homologado').map(p => (
                              <option key={p.id} value={p.id}>{p.razon_social}</option>
                            ))}
                          </optgroup>
                          <optgroup label="⚠️ No homologadas (urgente)">
                            {proveedores.filter(p => p.estado !== 'homologado').map(p => (
                              <option key={p.id} value={p.id}>{p.razon_social} ⚠️</option>
                            ))}
                          </optgroup>
                        </select>
                        {esNoHomologado && proveedorId && (
                          <div style={{ marginTop: '6px', background: '#FEF3C7', borderRadius: '6px', padding: '8px 12px', border: '1px solid #FDE68A' }}>
                            <p style={{ fontSize: '11px', color: '#92400E', margin: 0, fontWeight: 600 }}>
                              ⚠️ Este proveedor no está homologado. El evaluador recibirá una alerta para homologarlo.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Unidad y conductor */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div>
                          <label style={lbl}>Unidad / Placa <span style={{ color: '#C41230' }}>*</span></label>
                          <select value={unidadId} onChange={e => setUnidadId(e.target.value)}
                            disabled={!proveedorId}
                            style={{ ...inp, background: 'white', opacity: !proveedorId ? 0.5 : 1 }}>
                            <option value="">Selecciona placa...</option>
                            {unidades.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.placa}{u.pendiente_revision ? ' ⚠️' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={lbl}>Conductor <span style={{ color: '#C41230' }}>*</span></label>
                          <select value={conductorId} onChange={e => setConductorId(e.target.value)}
                            disabled={!proveedorId}
                            style={{ ...inp, background: 'white', opacity: !proveedorId ? 0.5 : 1 }}>
                            <option value="">Selecciona conductor...</option>
                            {conductores.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.nombre_completo}{c.pendiente_revision ? ' ⚠️' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button onClick={guardarAsignacion} disabled={guardando || !proveedorId || !unidadId || !conductorId}
                        style={{ width: '100%', padding: '11px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (!proveedorId || !unidadId || !conductorId || guardando) ? 0.5 : 1 }}>
                        {guardando ? 'Guardando...' : 'Guardar asignación →'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Precio del servicio ───────────────────────────────────── */}
              {puedeAsignarRecursos && (
                <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2DCDC', padding: '20px 24px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: T, margin: 0 }}>Precio del servicio</p>
                    {tienePrecioTP && (
                      <button onClick={() => { setModoPrecio(null); setInputPrecio(''); setInputMotivo('') }}
                        style={{ fontSize: '11px', color: T2, background: '#F4F2F2', border: '1px solid #E2DCDC', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                        Modificar
                      </button>
                    )}
                  </div>

                  {/* Precio sugerido */}
                  <div style={{ background: '#F8F5FF', borderRadius: '10px', padding: '14px', border: '1px solid #DDD6FE', marginBottom: '12px' }}>
                    <p style={{ fontSize: '9px', color: '#5B21B6', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 700 }}>Precio sugerido por el operativo</p>
                    <p style={{ fontSize: '24px', fontWeight: 800, color: '#5B21B6', margin: 0 }}>S/ {seleccionada.precio_sugerido}</p>
                  </div>

                  {/* Ya tiene precio */}
                  {tienePrecioTP && modoPrecio === null && (
                    <div style={{ background: seleccionada.precio_transporte > seleccionada.precio_sugerido ? '#FEF3C7' : '#F0FDF4', borderRadius: '10px', padding: '14px', border: `1px solid ${seleccionada.precio_transporte > seleccionada.precio_sugerido ? '#FDE68A' : '#A5D6A7'}` }}>
                      <p style={{ fontSize: '9px', color: seleccionada.precio_transporte > seleccionada.precio_sugerido ? '#92400E' : '#15803D', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 700 }}>
                        Tu precio propuesto
                      </p>
                      <p style={{ fontSize: '24px', fontWeight: 800, color: seleccionada.precio_transporte > seleccionada.precio_sugerido ? '#92400E' : '#15803D', margin: '0 0 6px' }}>
                        S/ {seleccionada.precio_transporte}
                      </p>
                      {seleccionada.precio_transporte > seleccionada.precio_sugerido && (
                        <p style={{ fontSize: '11px', color: '#92400E', margin: 0 }}>
                          +S/ {(parseFloat(seleccionada.precio_transporte) - parseFloat(seleccionada.precio_sugerido)).toFixed(2)} sobre lo sugerido — el operativo debe aceptar
                        </p>
                      )}
                      {/* Estado de la respuesta del operativo */}
                      {seleccionada.precio_procede === true && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#F0FDF4', color: '#15803D', padding: '3px 10px', borderRadius: '20px', border: '1px solid #A5D6A7' }}>✓ Operativo aceptó</span>
                        </div>
                      )}
                      {seleccionada.precio_procede === false && (
                        <div style={{ marginTop: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#FFEBEE', color: '#B71C1C', padding: '3px 10px', borderRadius: '20px', border: '1px solid #EF9A9A' }}>✗ Operativo rechazó — modifica el precio</span>
                        </div>
                      )}
                      {precioMayor && seleccionada.precio_procede === null && (
                        <div style={{ marginTop: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#EDE9FE', color: '#5B21B6', padding: '3px 10px', borderRadius: '20px', border: '1px solid #C4B5FD' }}>⏳ Esperando respuesta del operativo</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selector de modo */}
                  {!tienePrecioTP && modoPrecio === null && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <button onClick={() => setModoPrecio('confirmar')}
                        style={{ padding: '12px', background: '#F0FDF4', color: '#2E7D32', border: '2px solid #A5D6A7', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                        ✓ Confirmar S/ {seleccionada.precio_sugerido}<br />
                        <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.8 }}>El precio está ok</span>
                      </button>
                      <button onClick={() => setModoPrecio('proponer')}
                        style={{ padding: '12px', background: '#FFF8F0', color: '#E65100', border: '2px solid #FFCC80', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                        ✎ Proponer diferente<br />
                        <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.8 }}>Indicar otro monto</span>
                      </button>
                    </div>
                  )}

                  {/* Confirmar */}
                  {modoPrecio === 'confirmar' && (
                    <div style={{ background: '#F0FDF4', borderRadius: '10px', padding: '14px', border: '1px solid #A5D6A7' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#2E7D32', margin: '0 0 12px' }}>
                        Confirmar precio de S/ {seleccionada.precio_sugerido}
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={guardarPrecio} disabled={guardandoPrecio}
                          style={{ flex: 1, padding: '10px', background: '#2E7D32', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: guardandoPrecio ? 0.6 : 1 }}>
                          {guardandoPrecio ? 'Guardando...' : `✓ Confirmar S/ ${seleccionada.precio_sugerido}`}
                        </button>
                        <button onClick={() => setModoPrecio(null)}
                          style={{ padding: '10px 16px', background: '#F4F2F2', color: T2, border: '1px solid #E2DCDC', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                          Atrás
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Proponer diferente */}
                  {modoPrecio === 'proponer' && (
                    <div style={{ background: '#FFF8F0', borderRadius: '10px', padding: '14px', border: '1px solid #FFCC80' }}>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ ...lbl, color: '#E65100' }}>Nuevo precio (S/) <span style={{ color: '#C41230' }}>*</span></label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: 700, color: T2 }}>S/</span>
                          <input type="number" min={0} step={0.01}
                            value={inputPrecio}
                            onChange={e => setInputPrecio(e.target.value)}
                            placeholder="0.00" autoFocus
                            style={{ ...inp, paddingLeft: '32px', fontSize: '16px', fontWeight: 700, border: '1.5px solid #FFCC80' }} />
                        </div>
                        {inputPrecio && parseFloat(inputPrecio) > parseFloat(seleccionada.precio_sugerido) && (
                          <p style={{ fontSize: '11px', color: '#C41230', margin: '4px 0 0' }}>
                            ⚠️ Mayor al sugerido — el operativo deberá aceptar este precio
                          </p>
                        )}
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ ...lbl, color: '#E65100' }}>Motivo <span style={{ color: '#C41230' }}>*</span></label>
                        <textarea value={inputMotivo} onChange={e => setInputMotivo(e.target.value)}
                          placeholder="Explica por qué propones un precio diferente..."
                          rows={2}
                          style={{ ...inp, resize: 'none', fontFamily: 'inherit', border: '1.5px solid #FFCC80', lineHeight: '1.5' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={guardarPrecio}
                          disabled={guardandoPrecio || !inputPrecio || !inputMotivo.trim()}
                          style={{ flex: 1, padding: '10px', background: '#E65100', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (!inputPrecio || !inputMotivo.trim() || guardandoPrecio) ? 0.5 : 1 }}>
                          {guardandoPrecio ? 'Guardando...' : '→ Enviar precio'}
                        </button>
                        <button onClick={() => { setModoPrecio(null); setInputPrecio(''); setInputMotivo('') }}
                          style={{ padding: '10px 16px', background: '#F4F2F2', color: T2, border: '1px solid #E2DCDC', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                          Atrás
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}