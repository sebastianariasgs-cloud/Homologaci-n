'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function TransportePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [seleccionada, setSeleccionada] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [proveedoresHomologados, setProveedoresHomologados] = useState<any[]>([])
  const [unidadesProveedor, setUnidadesProveedor] = useState<any[]>([])
  const [conductoresProveedor, setConductoresProveedor] = useState<any[]>([])
  const [guardando, setGuardando] = useState(false)
  const [asignacion, setAsignacion] = useState({
    proveedor_id: '',
    unidad_id: '',
    conductor_id: '',
    observaciones_transporte: '',
  })

  useEffect(() => { verificarRol() }, [])

  useEffect(() => {
    if (asignacion.proveedor_id) cargarUnidadesConductores(asignacion.proveedor_id)
    else { setUnidadesProveedor([]); setConductoresProveedor([]) }
  }, [asignacion.proveedor_id])

  const verificarRol = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    if (!['transporte', 'admin'].includes(perfil?.rol)) { router.push('/login'); return }

    const { data: provs } = await supabase
      .from('proveedores')
      .select('id, razon_social, ruc')
      .eq('estado', 'homologado')
      .order('razon_social')
    setProveedoresHomologados(provs || [])

    await cargarSolicitudes()
  }

  const cargarSolicitudes = async () => {
    const { data } = await supabase
      .from('solicitudes_transporte')
      .select('*, proveedores(razon_social), unidades(placa), conductores(nombre_completo)')
      .order('created_at', { ascending: false })
    setSolicitudes(data || [])
    setLoading(false)
  }

  const cargarUnidadesConductores = async (proveedorId: string) => {
    const { data: units } = await supabase
      .from('unidades')
      .select('id, placa')
      .eq('proveedor_id', proveedorId)
      .eq('activo', true)
    setUnidadesProveedor(units || [])

    const { data: conds } = await supabase
      .from('conductores')
      .select('id, nombre_completo')
      .eq('proveedor_id', proveedorId)
      .eq('activo', true)
    setConductoresProveedor(conds || [])
    setAsignacion(prev => ({ ...prev, unidad_id: '', conductor_id: '' }))
  }

  const seleccionarSolicitud = async (sol: any) => {
    setSeleccionada(sol)
    setAsignacion({
      proveedor_id: sol.proveedor_id || '',
      unidad_id: sol.unidad_id || '',
      conductor_id: sol.conductor_id || '',
      observaciones_transporte: sol.observaciones_transporte || '',
    })
    if (sol.proveedor_id) await cargarUnidadesConductores(sol.proveedor_id)

    const { data: docs } = await supabase
      .from('solicitud_documentos')
      .select('*')
      .eq('solicitud_id', sol.id)
    setDocumentos(docs || [])
  }

  const asignar = async () => {
    if (!asignacion.proveedor_id || !asignacion.unidad_id || !asignacion.conductor_id) {
      alert('Selecciona empresa, unidad y conductor')
      return
    }
    setGuardando(true)
    const { error } = await supabase
      .from('solicitudes_transporte')
      .update({
        proveedor_id: asignacion.proveedor_id,
        unidad_id: asignacion.unidad_id,
        conductor_id: asignacion.conductor_id,
        observaciones_transporte: asignacion.observaciones_transporte || null,
        estado: 'asignada',
      })
      .eq('id', seleccionada.id)

    if (error) { alert('Error: ' + error.message); setGuardando(false); return }
    await cargarSolicitudes()
    setSeleccionada({ ...seleccionada, estado: 'asignada', proveedor_id: asignacion.proveedor_id, unidad_id: asignacion.unidad_id, conductor_id: asignacion.conductor_id })
    setGuardando(false)
  }

  const cambiarEstado = async (estado: string) => {
    setGuardando(true)
    const update: any = { estado }
    if (estado === 'entregada') update.fecha_entrega = new Date().toISOString()
    await supabase.from('solicitudes_transporte').update(update).eq('id', seleccionada.id)
    await cargarSolicitudes()
    setSeleccionada({ ...seleccionada, ...update })
    setGuardando(false)
  }

  const subirEvidencia = async (archivo: File) => {
    setGuardando(true)
    const ext = archivo.name.split('.').pop()
    const ruta = `solicitudes/${seleccionada.id}/evidencia_entrega.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(ruta, archivo, { upsert: true })
    if (!error) {
      await supabase.from('solicitudes_transporte').update({ evidencia_url: ruta, estado: 'entregada', fecha_entrega: new Date().toISOString() }).eq('id', seleccionada.id)
      await cargarSolicitudes()
      setSeleccionada({ ...seleccionada, evidencia_url: ruta, estado: 'entregada' })
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
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Panel de transporte</span>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
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
              const badge = estadoBadge[sol.estado] || estadoBadge.pendiente
              return (
                <div key={sol.id} onClick={() => seleccionarSolicitud(sol)}
                  style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer', background: seleccionada?.id === sol.id ? '#FEF2F2' : 'white', borderLeft: seleccionada?.id === sol.id ? '3px solid #C41230' : '3px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{sol.numero}</p>
                    <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                  </div>
                  <p style={{ fontSize: '10px', color: '#888', margin: '0 0 2px' }}>{sol.direccion_recojo} → {sol.direccion_entrega}</p>
                  <p style={{ fontSize: '10px', color: '#AAA', margin: 0 }}>Recojo: {new Date(sol.fecha_recojo).toLocaleDateString('es-PE')} · {sol.tipo_carga}</p>
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
            <div style={{ maxWidth: '680px' }}>

              {/* Cabecera solicitud */}
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{seleccionada.numero}</h2>
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: (estadoBadge[seleccionada.estado] || estadoBadge.pendiente).bg, color: (estadoBadge[seleccionada.estado] || estadoBadge.pendiente).color }}>
                        {(estadoBadge[seleccionada.estado] || estadoBadge.pendiente).texto}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Creada el {new Date(seleccionada.created_at).toLocaleDateString('es-PE')}</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: '#F9F9F9', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                  {[
                    { label: 'Recojo', valor: seleccionada.direccion_recojo },
                    { label: 'Entrega', valor: seleccionada.direccion_entrega },
                    { label: 'Fecha recojo', valor: new Date(seleccionada.fecha_recojo).toLocaleDateString('es-PE') },
                    { label: 'Tipo de carga', valor: seleccionada.tipo_carga },
                    { label: 'Peso', valor: seleccionada.peso ? `${seleccionada.peso} TN` : '—' },
                    { label: 'BL / AWB', valor: seleccionada.bl_awb || '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>{item.label}</p>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{item.valor}</p>
                    </div>
                  ))}
                </div>

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

              {/* Asignacion */}
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ width: '28px', height: '28px', background: '#FEF2F2', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🚛</div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Asignar empresa de transporte</p>
                    <p style={{ fontSize: '10px', color: '#15803D', margin: 0 }}>✓ Solo se muestran proveedores homologados ({proveedoresHomologados.length} disponibles)</p>
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Empresa <span style={{ color: '#C41230' }}>*</span></label>
                  <select value={asignacion.proveedor_id}
                    onChange={(e) => setAsignacion({ ...asignacion, proveedor_id: e.target.value })}
                    style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white' }}>
                    <option value="">Selecciona un proveedor homologado...</option>
                    {proveedoresHomologados.map(p => (
                      <option key={p.id} value={p.id}>{p.razon_social} — RUC {p.ruc}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Unidad / Placa <span style={{ color: '#C41230' }}>*</span></label>
                    <select value={asignacion.unidad_id}
                      onChange={(e) => setAsignacion({ ...asignacion, unidad_id: e.target.value })}
                      disabled={!asignacion.proveedor_id}
                      style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', opacity: !asignacion.proveedor_id ? 0.5 : 1 }}>
                      <option value="">Selecciona una unidad...</option>
                      {unidadesProveedor.map(u => (
                        <option key={u.id} value={u.id}>{u.placa}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Conductor <span style={{ color: '#C41230' }}>*</span></label>
                    <select value={asignacion.conductor_id}
                      onChange={(e) => setAsignacion({ ...asignacion, conductor_id: e.target.value })}
                      disabled={!asignacion.proveedor_id}
                      style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', opacity: !asignacion.proveedor_id ? 0.5 : 1 }}>
                      <option value="">Selecciona un conductor...</option>
                      {conductoresProveedor.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre_completo}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Observaciones</label>
                  <textarea value={asignacion.observaciones_transporte}
                    onChange={(e) => setAsignacion({ ...asignacion, observaciones_transporte: e.target.value })}
                    placeholder="Coordinar llegada con el almacen..."
                    style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'none', height: '70px', boxSizing: 'border-box' }} />
                </div>

                <button onClick={asignar} disabled={guardando || !asignacion.proveedor_id || !asignacion.unidad_id || !asignacion.conductor_id}
                  style={{ width: '100%', padding: '10px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: guardando || !asignacion.proveedor_id || !asignacion.unidad_id || !asignacion.conductor_id ? 0.6 : 1 }}>
                  {guardando ? 'Guardando...' : 'Asignar y notificar →'}
                </button>
              </div>

              {/* Cambiar estado y evidencia */}
              {seleccionada.estado !== 'pendiente' && (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>Actualizar estado</p>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {seleccionada.estado === 'asignada' && (
                      <button onClick={() => cambiarEstado('en_transito')} disabled={guardando}
                        style={{ padding: '8px 16px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        Confirmar recojo → En transito
                      </button>
                    )}
                    {seleccionada.estado === 'en_transito' && !seleccionada.evidencia_url && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        Confirmar entrega con evidencia
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                          style={{ display: 'none' }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) subirEvidencia(f) }} />
                      </label>
                    )}
                    {seleccionada.estado === 'entregada' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#15803D', fontWeight: 600 }}>✓ Entrega confirmada</span>
                        {seleccionada.evidencia_url && (
                          <button onClick={() => verDocumento(seleccionada.evidencia_url)}
                            style={{ padding: '6px 12px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '7px', fontSize: '11px', cursor: 'pointer' }}>
                            Ver evidencia
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}