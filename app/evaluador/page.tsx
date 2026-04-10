'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Notificaciones from '../components/Notificaciones'
import BotonAdmin from '../components/BotonAdmin'

const DOCS_CON_VENCIMIENTO = [
  'Poliza de seguros contra terceros',
  'SOAT',
  'Licencia de conducir',
  'SCTR',
  'Revision tecnica',
]

const validarFecha = (valor: string) => {
  if (!valor || valor.length < 10) return false
  const partes = valor.split('/')
  if (partes.length !== 3) return false
  const dia = parseInt(partes[0])
  const mes = parseInt(partes[1])
  const anio = parseInt(partes[2])
  if (isNaN(dia) || isNaN(mes) || isNaN(anio)) return false
  if (mes < 1 || mes > 12) return false
  if (dia < 1 || dia > 31) return false
  if (anio < 2000 || anio > 2100) return false
  const fecha = new Date(anio, mes - 1, dia)
  return fecha.getDate() === dia && fecha.getMonth() === mes - 1
}

const parsearFecha = (valor: string) => {
  if (!validarFecha(valor)) return null
  const partes = valor.split('/')
  return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`
}

const estadoBadge: { [key: string]: { bg: string, color: string } } = {
  pendiente: { bg: '#FFF7ED', color: '#C2410C' },
  aprobado: { bg: '#F0FDF4', color: '#15803D' },
  rechazado: { bg: '#FEF2F2', color: '#C41230' },
  homologado: { bg: '#EFF6FF', color: '#1D4ED8' },
}

const estadoTexto: { [key: string]: string } = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  homologado: 'Homologado',
}

function CampoFecha({ docKey, tipo, onUpdate }: {
  docKey: string
  tipo: 'emision' | 'vencimiento'
  onUpdate: (docKey: string, tipo: string, valor: string) => void
}) {
  const [inputVal, setInputVal] = useState('')
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 8)
    let formatted = ''
    if (raw.length <= 2) formatted = raw
    else if (raw.length <= 4) formatted = raw.slice(0, 2) + '/' + raw.slice(2)
    else formatted = raw.slice(0, 2) + '/' + raw.slice(2, 4) + '/' + raw.slice(4)
    setInputVal(formatted)
    setError('')
    if (formatted.length === 10) {
      if (validarFecha(formatted)) {
        onUpdate(docKey, tipo, formatted)
      } else {
        setError('Fecha invalida')
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <input type="text" placeholder="DD/MM/AAAA" value={inputVal}
        maxLength={10} onChange={handleChange}
        style={{ width: '110px', fontSize: '11px', border: `1px solid ${error ? '#FECACA' : '#E8E8E8'}`, borderRadius: '6px', padding: '4px 8px', outline: 'none' }} />
      {error && <span style={{ fontSize: '10px', color: '#C41230' }}>{error}</span>}
    </div>
  )
}

function FilaDoc({ doc, tabla, tieneVencimiento, keyPrefix, procesando, onAprobar, onRechazar, onVerDoc }: any) {
  const [comentario, setComentario] = useState('')
  const [fechaEmision, setFechaEmision] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const key = `${keyPrefix}-${doc.nombre}`
  const esProcesando = procesando === key

  const handleFechaUpdate = (_: string, tipo: string, valor: string) => {
    if (tipo === 'emision') setFechaEmision(valor)
    if (tipo === 'vencimiento') setFechaVencimiento(valor)
  }

  const badge = estadoBadge[doc.estado] || estadoBadge.pendiente

  return (
    <div style={{ border: '1px solid #F0F0F0', borderRadius: '8px', padding: '12px', marginBottom: '8px', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{doc.nombre}</span>
          {doc.fecha_emision && (
            <span style={{ fontSize: '10px', color: '#888', marginLeft: '8px' }}>
              Emision: {new Date(doc.fecha_emision).toLocaleDateString('es-PE')}
            </span>
          )}
          {doc.fecha_vencimiento && (
            <span style={{ fontSize: '10px', color: '#888', marginLeft: '6px' }}>
              Vence: {new Date(doc.fecha_vencimiento).toLocaleDateString('es-PE')}
            </span>
          )}
        </div>
        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
          {estadoTexto[doc.estado] || 'En revision'}
        </span>
      </div>

      {tieneVencimiento && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#888' }}>Emision:</span>
            <CampoFecha docKey={key} tipo="emision" onUpdate={handleFechaUpdate} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#888' }}>Vencimiento:</span>
            <CampoFecha docKey={key} tipo="vencimiento" onUpdate={handleFechaUpdate} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {doc.url && (
          <button onClick={() => onVerDoc(doc.url)}
            style={{ fontSize: '11px', color: '#185FA5', background: '#E6F1FB', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
            Ver archivo
          </button>
        )}
        <input type="text" placeholder="Comentario (obligatorio para rechazar)"
          value={comentario} onChange={(e) => setComentario(e.target.value)}
          style={{ flex: 1, minWidth: '160px', fontSize: '11px', border: '1px solid #E8E8E8', borderRadius: '6px', padding: '5px 10px', outline: 'none' }} />
        <button disabled={esProcesando || !doc.url}
          onClick={() => onAprobar(tabla, doc, key, tieneVencimiento, fechaEmision, fechaVencimiento, comentario)}
          style={{ fontSize: '11px', background: '#16A34A', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, opacity: (esProcesando || !doc.url) ? 0.4 : 1 }}>
          {esProcesando ? '...' : 'Aprobar'}
        </button>
        <button disabled={esProcesando || !doc.url || !comentario}
          onClick={() => onRechazar(tabla, doc, key, comentario)}
          style={{ fontSize: '11px', background: '#C41230', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, opacity: (esProcesando || !doc.url || !comentario) ? 0.4 : 1 }}>
          {esProcesando ? '...' : 'Rechazar'}
        </button>
      </div>
      {!comentario && (
        <p style={{ fontSize: '10px', color: '#AAA', marginTop: '4px' }}>* Comentario obligatorio para rechazar</p>
      )}
    </div>
  )
}

function EvaluadorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [proveedores, setProveedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [conductores, setConductores] = useState<any[]>([])
  const [unidades, setUnidades] = useState<any[]>([])
  const [docsConductor, setDocsConductor] = useState<any[]>([])
  const [docsUnidad, setDocsUnidad] = useState<any[]>([])
  const [procesando, setProcesando] = useState<string | null>(null)
  const [almacenes, setAlmacenes] = useState<any[]>([])
  const [tipoProveedor, setTipoProveedor] = useState<string>('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [proveedorIdParam, setProveedorIdParam] = useState<string | null>(null)

  useEffect(() => { verificarRol() }, [])

  useEffect(() => {
    if (proveedores.length === 0) return
    if (!proveedorIdParam) return
    const prov = proveedores.find((p: any) => p.id === proveedorIdParam)
    if (prov) seleccionarProveedor(prov)
  }, [proveedores, proveedorIdParam])

  const verificarRol = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { router.push('/login'); return }
  const { data: perfil } = await supabase
    .from('perfiles').select('rol').eq('id', user.id).single()
  if (!['evaluador', 'admin'].includes(perfil?.rol)) { router.push('/dashboard'); return }
  
  // Leer el parámetro directamente desde window.location
  const params = new URLSearchParams(window.location.search)
  const id = params.get('proveedor')
  if (id) setProveedorIdParam(id)
  
  await cargarProveedores()
}


  const cargarProveedores = async () => {
    const { data } = await supabase
      .from('proveedores').select('*').order('created_at', { ascending: false })
    setProveedores(data || [])
    setLoading(false)
  }

  const proveedoresFiltrados = proveedores.filter(p => {
    const matchBusqueda = busqueda === '' ||
      p.razon_social.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.ruc.includes(busqueda)
    const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado
    return matchBusqueda && matchEstado
  })

  const seleccionarProveedor = async (prov: any) => {
    setSeleccionado(prov)
    setAlmacenes([])
    setTipoProveedor('')

    const { data: docs } = await supabase
      .from('documentos').select('*').eq('proveedor_id', prov.id)
    setDocumentos(docs || [])

    const { data: conds } = await supabase
      .from('conductores').select('*').eq('proveedor_id', prov.id).eq('activo', true)
    setConductores(conds || [])

    const { data: units } = await supabase
      .from('unidades').select('*').eq('proveedor_id', prov.id).eq('activo', true)
    setUnidades(units || [])

    if (conds && conds.length > 0) {
      const ids = conds.map((c: any) => c.id)
      const { data: dc } = await supabase
        .from('documentos_conductor').select('*').in('conductor_id', ids)
      setDocsConductor(dc || [])
    } else { setDocsConductor([]) }

    if (units && units.length > 0) {
      const ids = units.map((u: any) => u.id)
      const { data: du } = await supabase
        .from('documentos_unidad').select('*').in('unidad_id', ids)
      setDocsUnidad(du || [])
    } else { setDocsUnidad([]) }

    const { data: alms } = await supabase
      .from('almacenes_proveedor').select('nombre').eq('proveedor_id', prov.id)
    setAlmacenes(alms || [])

    const { data: tiposProv } = await supabase
      .from('proveedor_tipos')
      .select('tipos_proveedor(nombre)')
      .eq('proveedor_id', prov.id)

    if (tiposProv && tiposProv.length > 0) {
      const nombres = tiposProv.map((t: any) => t.tipos_proveedor?.nombre).filter(Boolean)
      setTipoProveedor(nombres.join(', '))
    } else if (prov.tipo_id) {
      const { data: tipo } = await supabase
        .from('tipos_proveedor').select('nombre').eq('id', prov.tipo_id).single()
      setTipoProveedor(tipo?.nombre || 'No especificado')
    } else {
      setTipoProveedor('No especificado')
    }
  }

  const verDocumento = async (url: string) => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const aprobarDoc = useCallback(async (
    tabla: string, doc: any, key: string,
    tieneVencimiento: boolean, fechaEmision: string,
    fechaVencimiento: string, comentario: string
  ) => {
    if (tieneVencimiento) {
      if (!validarFecha(fechaEmision) || !validarFecha(fechaVencimiento)) {
        alert('Ingresa fechas validas (DD/MM/AAAA) antes de aprobar')
        return
      }
      const emision = parsearFecha(fechaEmision)
      const vencimiento = parsearFecha(fechaVencimiento)
      if (emision && vencimiento && emision >= vencimiento) {
        alert('La fecha de vencimiento debe ser posterior a la de emision')
        return
      }
    }

    setProcesando(key)
    const updateData: any = { estado: 'aprobado', comentario: comentario || null }
    if (tieneVencimiento) {
      updateData.fecha_emision = parsearFecha(fechaEmision)
      updateData.fecha_vencimiento = parsearFecha(fechaVencimiento)
      updateData.fechas_bloqueadas = true
    }

    const { error } = await supabase.from(tabla).update(updateData).eq('id', doc.id)
    if (error) { alert('Error: ' + error.message); setProcesando(null); return }

    await supabase.from('notificaciones').insert({
      proveedor_id: seleccionado.id,
      titulo: 'Documento aprobado',
      mensaje: `Tu documento "${doc.nombre}" fue aprobado`,
      tipo: 'info', leida: false,
    })

    const docActualizado = { ...doc, ...updateData }
    if (tabla === 'documentos') setDocumentos(prev => prev.map(d => d.id === doc.id ? docActualizado : d))
    else if (tabla === 'documentos_conductor') setDocsConductor(prev => prev.map(d => d.id === doc.id ? docActualizado : d))
    else if (tabla === 'documentos_unidad') setDocsUnidad(prev => prev.map(d => d.id === doc.id ? docActualizado : d))
    setProcesando(null)
  }, [seleccionado])

  const rechazarDoc = useCallback(async (tabla: string, doc: any, key: string, comentario: string) => {
    if (!comentario) { alert('El comentario es obligatorio para rechazar'); return }
    setProcesando(key)

    const updateData = { estado: 'rechazado', comentario, fecha_emision: null, fecha_vencimiento: null, fechas_bloqueadas: false }
    const { error } = await supabase.from(tabla).update(updateData).eq('id', doc.id)
    if (error) { alert('Error: ' + error.message); setProcesando(null); return }

    await supabase.from('notificaciones').insert({
      proveedor_id: seleccionado.id,
      titulo: 'Documento rechazado',
      mensaje: `Tu documento "${doc.nombre}" fue rechazado: ${comentario}`,
      tipo: 'peligro', leida: false,
    })

    const docActualizado = { ...doc, ...updateData }
    if (tabla === 'documentos') setDocumentos(prev => prev.map(d => d.id === doc.id ? docActualizado : d))
    else if (tabla === 'documentos_conductor') setDocsConductor(prev => prev.map(d => d.id === doc.id ? docActualizado : d))
    else if (tabla === 'documentos_unidad') setDocsUnidad(prev => prev.map(d => d.id === doc.id ? docActualizado : d))
    setProcesando(null)
  }, [seleccionado])

  const actualizarEstadoProveedor = async (estado: string) => {
    const updateData: any = { estado }
    if (estado === 'homologado') {
      updateData.fecha_homologacion = new Date().toISOString()
    }
    await supabase.from('proveedores').update(updateData).eq('id', seleccionado.id)
    await cargarProveedores()
    setSeleccionado({ ...seleccionado, ...updateData })
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
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Panel del evaluador</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <a href="/evaluador/dashboard"
            style={{ fontSize: '12px', color: '#666', fontWeight: 600, textDecoration: 'none', background: '#F5F5F5', padding: '6px 14px', borderRadius: '7px', border: '1px solid #E8E8E8' }}>
            Dashboard
          </a>
          <a href="/evaluador/reportes"
            style={{ fontSize: '12px', color: '#C41230', fontWeight: 600, textDecoration: 'none', background: '#FEF2F2', padding: '6px 14px', borderRadius: '7px', border: '1px solid #FECACA' }}>
            Reportes
          </a>
          <Notificaciones esEvaluador={true} />
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            <BotonAdmin />
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ display: 'flex', height: 'calc(100vh - 59px)' }}>
        <div style={{ width: '260px', minWidth: '260px', background: 'white', borderRight: '1px solid #EEEEEE', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0F0F0' }}>
            <input type="text" placeholder="Buscar por nombre o RUC..."
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '11px', outline: 'none', marginBottom: '6px', boxSizing: 'border-box' }} />
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              style={{ width: '100%', padding: '6px 10px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '11px', outline: 'none', background: 'white' }}>
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="homologado">Homologados</option>
              <option value="rechazado">Rechazados</option>
            </select>
          </div>
          <div style={{ padding: '6px 12px', borderBottom: '1px solid #F0F0F0' }}>
            <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>{proveedoresFiltrados.length} proveedores</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {proveedoresFiltrados.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Sin resultados</p>
              </div>
            )}
            {proveedoresFiltrados.map((prov) => {
              const badge = estadoBadge[prov.estado] || estadoBadge.pendiente
              return (
                <div key={prov.id} onClick={() => seleccionarProveedor(prov)}
                  style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer', background: seleccionado?.id === prov.id ? '#FEF2F2' : 'white', borderLeft: seleccionado?.id === prov.id ? '3px solid #C41230' : '3px solid transparent' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px' }}>{prov.razon_social}</p>
                  <p style={{ fontSize: '10px', color: '#888', margin: '0 0 6px' }}>RUC {prov.ruc}</p>
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
                    {estadoTexto[prov.estado] || 'Pendiente'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F7F7F7' }}>
          {!seleccionado ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>Selecciona un proveedor para revisar</p>
                <p style={{ fontSize: '12px', color: '#BBB', marginTop: '6px' }}>Haz clic en cualquier proveedor de la lista</p>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '700px' }}>
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' }}>{seleccionado.razon_social}</h2>
                    <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>RUC {seleccionado.ruc}</p>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: (estadoBadge[seleccionado.estado] || estadoBadge.pendiente).bg, color: (estadoBadge[seleccionado.estado] || estadoBadge.pendiente).color }}>
                    {estadoTexto[seleccionado.estado] || 'Pendiente'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '14px', padding: '10px 14px', background: '#F9F9F9', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#888', display: 'block' }}>Tipo de proveedor</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{tipoProveedor}</span>
                  </div>
                  {almacenes.length > 0 && (
                    <div>
                      <span style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '4px' }}>Almacenes con acceso</span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {almacenes.map((a: any) => (
                          <span key={a.nombre} style={{ fontSize: '11px', background: '#F0FDF4', color: '#15803D', padding: '2px 8px', borderRadius: '20px', border: '1px solid #BBF7D0' }}>
                            {a.nombre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => actualizarEstadoProveedor('homologado')}
                    style={{ background: '#C41230', color: 'white', fontSize: '11px', fontWeight: 600, padding: '7px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer' }}>
                    Homologar proveedor
                  </button>
                  <button onClick={() => actualizarEstadoProveedor('rechazado')}
                    style={{ background: '#FEF2F2', color: '#C41230', fontSize: '11px', fontWeight: 600, padding: '7px 14px', borderRadius: '7px', border: '1px solid #FECACA', cursor: 'pointer' }}>
                    Rechazar proveedor
                  </button>
                  <button onClick={() => actualizarEstadoProveedor('pendiente')}
                    style={{ background: 'white', color: '#666', fontSize: '11px', padding: '7px 14px', borderRadius: '7px', border: '1px solid #E8E8E8', cursor: 'pointer' }}>
                    Marcar pendiente
                  </button>
                </div>
              </div>

              {documentos.length > 0 && (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>Documentos de la empresa</h3>
                  {documentos.map(doc => (
                    <FilaDoc key={doc.id} doc={doc} tabla="documentos"
                      tieneVencimiento={DOCS_CON_VENCIMIENTO.includes(doc.nombre)}
                      keyPrefix={`empresa-${doc.proveedor_id}`}
                      procesando={procesando}
                      onAprobar={aprobarDoc} onRechazar={rechazarDoc} onVerDoc={verDocumento} />
                  ))}
                </div>
              )}

              {conductores.length > 0 && (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>Conductores</h3>
                  {conductores.map(conductor => (
                    <div key={conductor.id} style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#C41230', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                          {conductor.nombre_completo.charAt(0)}
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{conductor.nombre_completo}</span>
                      </div>
                      {docsConductor.filter(d => d.conductor_id === conductor.id).map(doc => (
                        <FilaDoc key={doc.id} doc={doc} tabla="documentos_conductor"
                          tieneVencimiento={DOCS_CON_VENCIMIENTO.includes(doc.nombre)}
                          keyPrefix={`conductor-${conductor.id}`}
                          procesando={procesando}
                          onAprobar={aprobarDoc} onRechazar={rechazarDoc} onVerDoc={verDocumento} />
                      ))}
                      {docsConductor.filter(d => d.conductor_id === conductor.id).length === 0 && (
                        <p style={{ fontSize: '11px', color: '#AAA', marginLeft: '34px' }}>Sin documentos cargados aun</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {unidades.length > 0 && (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>Unidades vehiculares</h3>
                  {unidades.map(unidad => (
                    <div key={unidad.id} style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#4A4A4A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                          🚛
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>Placa: {unidad.placa}</span>
                      </div>
                      {docsUnidad.filter(d => d.unidad_id === unidad.id).map(doc => (
                        <FilaDoc key={doc.id} doc={doc} tabla="documentos_unidad"
                          tieneVencimiento={DOCS_CON_VENCIMIENTO.includes(doc.nombre)}
                          keyPrefix={`unidad-${unidad.id}`}
                          procesando={procesando}
                          onAprobar={aprobarDoc} onRechazar={rechazarDoc} onVerDoc={verDocumento} />
                      ))}
                      {docsUnidad.filter(d => d.unidad_id === unidad.id).length === 0 && (
                        <p style={{ fontSize: '11px', color: '#AAA', marginLeft: '34px' }}>Sin documentos cargados aun</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {documentos.length === 0 && conductores.length === 0 && unidades.length === 0 && (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '40px', textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>Este proveedor aun no ha cargado documentos</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EvaluadorPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
        <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
      </div>
    }>
      <EvaluadorContent />
    </Suspense>
  )
}