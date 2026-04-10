'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonAdmin from '../components/BotonAdmin'


const estadoBadgeMap: { [key: string]: { bg: string, color: string, texto: string } } = {
  pendiente: { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente' },
  asignada: { bg: '#EEEDFE', color: '#3C3489', texto: 'Asignada' },
  en_transito: { bg: '#EFF6FF', color: '#1D4ED8', texto: 'En transito' },
  entregada: { bg: '#F0FDF4', color: '#15803D', texto: 'Entregada' },
}

const estadoIconoMap: { [key: string]: string } = {
  pendiente: '⏳', asignada: '✅', en_transito: '🚛', entregada: '📦',
}

const ESTADOS_ORDEN = ['pendiente', 'asignada', 'en_transito', 'entregada']

type Asignacion = {
  proveedor_id: string
  unidad_id: string
  conductor_id: string
  unidades_proveedor: any[]
  conductores_proveedor: any[]
  datos_guardados: any | null
}

const asignacionVacia = (): Asignacion => ({
  proveedor_id: '',
  unidad_id: '',
  conductor_id: '',
  unidades_proveedor: [],
  conductores_proveedor: [],
  datos_guardados: null,
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
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([asignacionVacia()])
  const [asignacionesGuardadas, setAsignacionesGuardadas] = useState<any[]>([])
  const [modoReasignarGlobal, setModoReasignarGlobal] = useState(false)

  useEffect(() => { verificarRol() }, [])

  const verificarRol = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    if (!['transporte', 'admin'].includes(perfil?.rol)) { router.push('/login'); return }

    const { data: provs } = await supabase
      .from('proveedores').select('id, razon_social, ruc').eq('estado', 'homologado').order('razon_social')
    setProveedoresHomologados(provs || [])
    await cargarSolicitudes()
  }

  const cargarSolicitudes = async () => {
    const { data } = await supabase
      .from('solicitudes_transporte')
      .select('*')
      .order('created_at', { ascending: false })
    setSolicitudes(data || [])
    setLoading(false)
  }

  const cargarUnidadesConductores = async (proveedorId: string) => {
    const { data: units } = await supabase
      .from('unidades').select('id, placa').eq('proveedor_id', proveedorId).eq('activo', true)
    const { data: conds } = await supabase
      .from('conductores').select('id, nombre_completo').eq('proveedor_id', proveedorId).eq('activo', true)
    return { unidades: units || [], conductores: conds || [] }
  }

  const seleccionarSolicitud = async (sol: any) => {
    setSeleccionada(sol)
    setEmailOperativo('')
    setModoReasignarGlobal(false)
    setObservacionesTransporte(sol.observaciones_transporte || '')

    const { data: docs } = await supabase
      .from('solicitud_documentos').select('*').eq('solicitud_id', sol.id)
    setDocumentos(docs || [])

    const { data: asigs } = await supabase
      .from('solicitud_asignaciones')
      .select('*, proveedores(razon_social), unidades(placa), conductores(nombre_completo)')
      .eq('solicitud_id', sol.id).order('orden')
    setAsignacionesGuardadas(asigs || [])

    const numUnidades = sol.num_unidades || 1
    if (asigs && asigs.length > 0) {
      const asigsCargadas = await Promise.all(asigs.map(async (a: any) => {
        const { unidades, conductores } = a.proveedor_id ? await cargarUnidadesConductores(a.proveedor_id) : { unidades: [], conductores: [] }
        return {
          proveedor_id: a.proveedor_id || '',
          unidad_id: a.unidad_id || '',
          conductor_id: a.conductor_id || '',
          unidades_proveedor: unidades,
          conductores_proveedor: conductores,
          datos_guardados: a,
        }
      }))
      setAsignaciones(asigsCargadas)
    } else {
      setAsignaciones(Array.from({ length: numUnidades }, () => asignacionVacia()))
    }

    const { data: hist } = await supabase
      .from('solicitud_historial').select('*').eq('solicitud_id', sol.id).order('created_at', { ascending: true })
    const histConEmails = await Promise.all((hist || []).map(async (h) => {
      const { data: email } = await supabase.rpc('get_user_email', { user_id: h.usuario_id })
      return { ...h, email: email || h.usuario_id }
    }))
    setHistorial(histConEmails)

    if (sol.operativo_id) {
      const { data: email } = await supabase.rpc('get_user_email', { user_id: sol.operativo_id })
      setEmailOperativo(email || '')
    }
  }

  const actualizarAsignacion = async (idx: number, campo: string, valor: string) => {
    const nuevas = [...asignaciones]
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
    setAsignaciones(nuevas)
  }

  const registrarHistorial = async (estadoAnterior: string, estadoNuevo: string, comentario?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('solicitud_historial').insert({
      solicitud_id: seleccionada.id,
      usuario_id: user!.id,
      estado_anterior: estadoAnterior,
      estado_nuevo: estadoNuevo,
      comentario: comentario || null,
    })
  }

  const recargarHistorial = async () => {
    const { data: hist } = await supabase
      .from('solicitud_historial').select('*').eq('solicitud_id', seleccionada.id).order('created_at', { ascending: true })
    const histConEmails = await Promise.all((hist || []).map(async (h) => {
      const { data: email } = await supabase.rpc('get_user_email', { user_id: h.usuario_id })
      return { ...h, email: email || h.usuario_id }
    }))
    setHistorial(histConEmails)
  }

  const guardarAsignaciones = async () => {
    const incompletas = asignaciones.filter(a => !a.proveedor_id || !a.unidad_id || !a.conductor_id)
    if (incompletas.length > 0) {
      alert('Completa empresa, unidad y conductor para todas las unidades')
      return
    }
    setGuardando(true)
    const esReasignacion = asignacionesGuardadas.length > 0
    const estadoAnterior = seleccionada.estado

    await supabase.from('solicitud_asignaciones').delete().eq('solicitud_id', seleccionada.id)
    await supabase.from('solicitud_asignaciones').insert(
      asignaciones.map((a, idx) => ({
        solicitud_id: seleccionada.id,
        proveedor_id: a.proveedor_id,
        unidad_id: a.unidad_id,
        conductor_id: a.conductor_id,
        orden: idx + 1,
      }))
    )

    await supabase.from('solicitudes_transporte').update({
      proveedor_id: asignaciones[0].proveedor_id,
      unidad_id: asignaciones[0].unidad_id,
      conductor_id: asignaciones[0].conductor_id,
      observaciones_transporte: observacionesTransporte || null,
      estado: 'asignada',
    }).eq('id', seleccionada.id)

    await registrarHistorial(
      estadoAnterior, 'asignada',
      esReasignacion
        ? `Reasignacion: ${asignaciones.length} unidad(es)`
        : `Asignacion: ${asignaciones.length} unidad(es)`
    )

    const { data: asigs } = await supabase
      .from('solicitud_asignaciones')
      .select('*, proveedores(razon_social), unidades(placa), conductores(nombre_completo)')
      .eq('solicitud_id', seleccionada.id).order('orden')
    setAsignacionesGuardadas(asigs || [])

    setSeleccionada({ ...seleccionada, estado: 'asignada', proveedor_id: asignaciones[0].proveedor_id })
    await cargarSolicitudes()
    await recargarHistorial()
    setModoReasignarGlobal(false)
    setGuardando(false)
  }

  const cambiarEstado = async (estadoNuevo: string, comentario?: string) => {
    setGuardando(true)
    const estadoAnterior = seleccionada.estado
    const update: any = { estado: estadoNuevo }
    if (estadoNuevo === 'entregada') update.fecha_entrega = new Date().toISOString()
    await supabase.from('solicitudes_transporte').update(update).eq('id', seleccionada.id)
    await registrarHistorial(estadoAnterior, estadoNuevo, comentario)
    await cargarSolicitudes()
    setSeleccionada({ ...seleccionada, ...update })
    await recargarHistorial()
    setGuardando(false)
  }

  const subirEvidencia = async (archivo: File) => {
    setGuardando(true)
    const ext = archivo.name.split('.').pop()
    const ruta = `solicitudes/${seleccionada.id}/evidencia_entrega.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(ruta, archivo, { upsert: true })
    if (!error) {
      await supabase.from('solicitudes_transporte').update({
        evidencia_url: ruta, estado: 'entregada', fecha_entrega: new Date().toISOString()
      }).eq('id', seleccionada.id)
      await registrarHistorial(seleccionada.estado, 'entregada', 'Evidencia de entrega subida')
      await cargarSolicitudes()
      setSeleccionada({ ...seleccionada, evidencia_url: ruta, estado: 'entregada' })
      await recargarHistorial()
    }
    setGuardando(false)
  }

  const verDocumento = async (url: string) => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
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
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
          <BotonAdmin />
          Salir
        </button>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ display: 'flex', height: 'calc(100vh - 59px)' }}>

        {/* Lista izquierda */}
        <div style={{ width: '300px', minWidth: '300px', background: 'white', borderRight: '1px solid #EEEEEE', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0F0F0' }}>
            <input type="text" placeholder="Buscar por numero, BL o consignatario..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '11px', outline: 'none', marginBottom: '6px', boxSizing: 'border-box' }} />
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '11px', outline: 'none', background: 'white', marginBottom: '6px' }}>
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="asignada">Asignadas</option>
              <option value="en_transito">En transito</option>
              <option value="entregada">Entregadas</option>
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                style={{ padding: '5px 8px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '10px', outline: 'none' }} />
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                style={{ padding: '5px 8px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '10px', outline: 'none' }} />
            </div>
          </div>
          <div style={{ padding: '6px 12px', borderBottom: '1px solid #F0F0F0' }}>
            <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>{solicitudesFiltradas.length} solicitudes</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {solicitudesFiltradas.map(sol => {
              const badge = estadoBadgeMap[sol.estado] || estadoBadgeMap.pendiente
              return (
                <div key={sol.id} onClick={() => seleccionarSolicitud(sol)}
                  style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer', background: seleccionada?.id === sol.id ? '#FEF2F2' : 'white', borderLeft: seleccionada?.id === sol.id ? '3px solid #C41230' : '3px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{sol.numero}</p>
                    <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                  </div>
                  <p style={{ fontSize: '10px', color: '#888', margin: '0 0 2px' }}>{sol.direccion_recojo} → {sol.direccion_entrega}</p>
                  <p style={{ fontSize: '10px', color: '#AAA', margin: 0 }}>
                    Recojo: {new Date(sol.fecha_recojo).toLocaleDateString('es-PE')} · {sol.tipo_carga}
                    {sol.num_unidades > 1 && <span style={{ marginLeft: '4px', color: '#C41230', fontWeight: 600 }}>· {sol.num_unidades} unidades</span>}
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
                <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>Selecciona una solicitud para atender</p>
                <p style={{ fontSize: '12px', color: '#BBB', marginTop: '6px' }}>Haz clic en cualquier solicitud de la lista</p>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '700px' }}>

              {/* Cabecera */}
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{seleccionada.numero}</h2>
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: (estadoBadgeMap[seleccionada.estado] || estadoBadgeMap.pendiente).bg, color: (estadoBadgeMap[seleccionada.estado] || estadoBadgeMap.pendiente).color }}>
                        {(estadoBadgeMap[seleccionada.estado] || estadoBadgeMap.pendiente).texto}
                      </span>
                      {seleccionada.num_unidades > 1 && (
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: '#FEF2F2', color: '#C41230' }}>
                          {seleccionada.num_unidades} unidades
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                      Creada el {new Date(seleccionada.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Info operativo */}
                <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '10px', color: '#888', margin: '0 0 6px', fontWeight: 600 }}>CREADA POR</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#C41230', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                      {emailOperativo ? emailOperativo.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Operativo SLI</p>
                      <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{emailOperativo || 'Cargando...'}</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: '#F9F9F9', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  {[
                    { label: 'Recojo', valor: seleccionada.direccion_recojo },
                    { label: 'Entrega', valor: seleccionada.direccion_entrega },
                    { label: 'Fecha recojo', valor: new Date(seleccionada.fecha_recojo).toLocaleDateString('es-PE') },
                    { label: 'Tipo de carga', valor: seleccionada.tipo_carga },
                    { label: 'Peso', valor: seleccionada.peso ? `${seleccionada.peso} TN` : '—' },
                    { label: 'Unidades requeridas', valor: seleccionada.num_unidades || 1 },
                    { label: 'BL / AWB', valor: seleccionada.bl_awb || '—' },
                    { label: 'Consignatario', valor: seleccionada.consignatario || '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>{item.label}</p>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{item.valor}</p>
                    </div>
                  ))}
                </div>

                {/* Instrucciones del operativo - solo lectura */}
                {seleccionada.observaciones && (
                  <div style={{ background: '#FFF7ED', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                    <p style={{ fontSize: '10px', color: '#C2410C', margin: '0 0 3px', fontWeight: 600 }}>INSTRUCCIONES DEL OPERATIVO</p>
                    <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{seleccionada.observaciones}</p>
                  </div>
                )}

                {documentos.length > 0 && (
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', marginBottom: '6px' }}>Documentos adjuntos</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {documentos.map(doc => (
                        <div key={doc.id} onClick={() => verDocumento(doc.url)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#E6F1FB', border: '1px solid #B5D4F4', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                          <span style={{ fontSize: '11px', color: '#185FA5', fontWeight: 600 }}>📄 {doc.nombre}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Gestion de estado */}
              {seleccionada.estado !== 'entregada' && (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '14px' }}>Gestionar estado</p>

                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                    {ESTADOS_ORDEN.map((est, i) => {
                      const b = estadoBadgeMap[est]
                      const esCurrent = seleccionada.estado === est
                      const esDone = ESTADOS_ORDEN.indexOf(seleccionada.estado) > i
                      return (
                        <div key={est} style={{ display: 'flex', alignItems: 'center', flex: i < ESTADOS_ORDEN.length - 1 ? 1 : 'none' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', background: esDone ? '#F0FDF4' : esCurrent ? b.bg : '#F5F5F5', border: `2px solid ${esDone ? '#15803D' : esCurrent ? b.color : '#E8E8E8'}` }}>
                              {esDone ? '✓' : estadoIconoMap[est]}
                            </div>
                            <span style={{ fontSize: '9px', color: esDone ? '#15803D' : esCurrent ? b.color : '#AAA', fontWeight: esCurrent || esDone ? 600 : 400, whiteSpace: 'nowrap' }}>{b.texto}</span>
                          </div>
                          {i < ESTADOS_ORDEN.length - 1 && (
                            <div style={{ flex: 1, height: '2px', background: esDone ? '#15803D' : '#E8E8E8', margin: '0 6px', marginBottom: '16px' }} />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {seleccionada.estado === 'pendiente' && (
                      <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Asigna una empresa para continuar</p>
                    )}
                    {seleccionada.estado === 'asignada' && (
                      <>
                        <button onClick={() => cambiarEstado('en_transito')} disabled={guardando}
                          style={{ padding: '10px 20px', background: '#1D4ED8', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: guardando ? 0.7 : 1 }}>
                          🚛 Confirmar recojo — En transito
                        </button>
                        <button onClick={() => cambiarEstado('pendiente')} disabled={guardando}
                          style={{ padding: '10px 16px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                          ← Volver a pendiente
                        </button>
                      </>
                    )}
                    {seleccionada.estado === 'en_transito' && (
                      <>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#15803D', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                          📦 Confirmar entrega con evidencia
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) subirEvidencia(f) }} />
                        </label>
                        <button onClick={() => cambiarEstado('asignada')} disabled={guardando}
                          style={{ padding: '10px 16px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                          ← Volver a asignada
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Servicio concluido */}
              {seleccionada.estado === 'entregada' && (
                <div style={{ background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>📦</span>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#15803D', margin: '0 0 3px' }}>Servicio concluido</p>
                      <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                        Entregado el {seleccionada.fecha_entrega ? new Date(seleccionada.fecha_entrega).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}. No se pueden realizar mas cambios.
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

              {/* Asignacion de unidades */}
              {seleccionada.estado !== 'entregada' && (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', background: '#FEF2F2', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🚛</div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>
                          Asignacion de unidades
                          <span style={{ fontSize: '11px', color: '#888', fontWeight: 400, marginLeft: '6px' }}>({seleccionada.num_unidades || 1} requerida(s))</span>
                        </p>
                        <p style={{ fontSize: '10px', color: '#15803D', margin: 0 }}>✓ Solo proveedores homologados ({proveedoresHomologados.length})</p>
                      </div>
                    </div>
                    {asignacionesGuardadas.length > 0 && !modoReasignarGlobal && (
                      <button onClick={() => setModoReasignarGlobal(true)}
                        style={{ padding: '6px 14px', background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                        Reasignar
                      </button>
                    )}
                  </div>

                  {/* Vista de solo lectura */}
                  {asignacionesGuardadas.length > 0 && !modoReasignarGlobal ? (
                    <div>
                      {asignacionesGuardadas.map((a, idx) => (
                        <div key={a.id} style={{ background: '#F0FDF4', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
                          <p style={{ fontSize: '10px', color: '#888', margin: '0 0 6px', fontWeight: 600 }}>UNIDAD {idx + 1}</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            <div>
                              <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Empresa</p>
                              <p style={{ fontSize: '12px', fontWeight: 600, color: '#15803D', margin: 0 }}>{a.proveedores?.razon_social || '—'}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Placa</p>
                              <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{a.unidades?.placa || '—'}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Conductor</p>
                              <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{a.conductores?.nombre_completo || '—'}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {asignaciones.map((asig, idx) => (
                        <div key={idx} style={{ border: '1px solid #F0F0F0', borderRadius: '8px', padding: '14px', marginBottom: '10px', background: '#FAFAFA' }}>
                          <p style={{ fontSize: '11px', fontWeight: 600, color: '#C41230', margin: '0 0 10px' }}>
                            Unidad {idx + 1} de {asignaciones.length}
                          </p>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#444', marginBottom: '4px' }}>Empresa *</label>
                            <select value={asig.proveedor_id}
                              onChange={(e) => actualizarAsignacion(idx, 'proveedor_id', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none', background: 'white' }}>
                              <option value="">Selecciona un proveedor homologado...</option>
                              {proveedoresHomologados.map(p => (
                                <option key={p.id} value={p.id}>{p.razon_social} — RUC {p.ruc}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#444', marginBottom: '4px' }}>Unidad / Placa *</label>
                              <select value={asig.unidad_id}
                                onChange={(e) => actualizarAsignacion(idx, 'unidad_id', e.target.value)}
                                disabled={!asig.proveedor_id}
                                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none', background: 'white', opacity: !asig.proveedor_id ? 0.5 : 1 }}>
                                <option value="">Selecciona una unidad...</option>
                                {asig.unidades_proveedor.map((u: any) => (
                                  <option key={u.id} value={u.id}>{u.placa}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#444', marginBottom: '4px' }}>Conductor *</label>
                              <select value={asig.conductor_id}
                                onChange={(e) => actualizarAsignacion(idx, 'conductor_id', e.target.value)}
                                disabled={!asig.proveedor_id}
                                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none', background: 'white', opacity: !asig.proveedor_id ? 0.5 : 1 }}>
                                <option value="">Selecciona un conductor...</option>
                                {asig.conductores_proveedor.map((c: any) => (
                                  <option key={c.id} value={c.id}>{c.nombre_completo}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Notas internas de transporte</label>
                        <textarea value={observacionesTransporte}
                          onChange={(e) => setObservacionesTransporte(e.target.value)}
                          placeholder="Coordinar llegada con el almacen, hora de recojo, etc."
                          style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'none', height: '70px', boxSizing: 'border-box' }} />
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={guardarAsignaciones} disabled={guardando}
                          style={{ flex: 1, padding: '10px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                          {guardando ? 'Guardando...' : asignacionesGuardadas.length > 0 ? 'Confirmar reasignacion →' : 'Asignar unidades →'}
                        </button>
                        {modoReasignarGlobal && (
                          <button onClick={() => setModoReasignarGlobal(false)}
                            style={{ padding: '10px 16px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Historial */}
              {historial.length > 0 && (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '14px' }}>Historial de cambios</p>
                  {historial.map((h, i) => {
                    const badgeAnterior = estadoBadgeMap[h.estado_anterior] || estadoBadgeMap.pendiente
                    const badgeNuevo = estadoBadgeMap[h.estado_nuevo] || estadoBadgeMap.pendiente
                    return (
                      <div key={h.id} style={{ display: 'flex', gap: '12px', paddingBottom: i < historial.length - 1 ? '14px' : '0', position: 'relative' }}>
                        {i < historial.length - 1 && (
                          <div style={{ position: 'absolute', left: '11px', top: '24px', width: '2px', height: 'calc(100% - 8px)', background: '#F0F0F0' }} />
                        )}
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#F9F9F9', border: '2px solid #EEEEEE', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', zIndex: 1 }}>
                          {estadoIconoMap[h.estado_nuevo] || '•'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '20px', background: badgeAnterior.bg, color: badgeAnterior.color }}>{badgeAnterior.texto}</span>
                            <span style={{ fontSize: '10px', color: '#888' }}>→</span>
                            <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '20px', background: badgeNuevo.bg, color: badgeNuevo.color }}>{badgeNuevo.texto}</span>
                          </div>
                          {h.comentario && <p style={{ fontSize: '11px', color: '#666', margin: '0 0 2px' }}>{h.comentario}</p>}
                          <p style={{ fontSize: '10px', color: '#AAA', margin: 0 }}>
                            {new Date(h.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {h.email && <span style={{ marginLeft: '6px', color: '#888' }}>· {h.email}</span>}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}