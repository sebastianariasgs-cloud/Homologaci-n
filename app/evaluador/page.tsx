'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Notificaciones from '../components/Notificaciones'
import BotonAdmin from '../components/BotonAdmin'

const DOCS_CON_VENCIMIENTO = [
  'SOAT',
  'Revision tecnica',
  'Poliza de seguros contra terceros',
  'Licencia de conducir',
  'SCTR',
  'Certificado habilitacion vehicular MTC',
]

const validarFecha = (valor: string) => {
  if (!valor || valor.length < 10) return false
  const partes = valor.split('/')
  if (partes.length !== 3) return false
  const dia = parseInt(partes[0]), mes = parseInt(partes[1]), anio = parseInt(partes[2])
  if (isNaN(dia) || isNaN(mes) || isNaN(anio)) return false
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || anio < 2000 || anio > 2100) return false
  const fecha = new Date(anio, mes - 1, dia)
  return fecha.getDate() === dia && fecha.getMonth() === mes - 1
}

const parsearFecha = (valor: string) => {
  if (!validarFecha(valor)) return null
  const partes = valor.split('/')
  return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`
}

const estadoBadge: { [key: string]: { bg: string, color: string } } = {
  pendiente:  { bg: '#FFF3E0', color: '#E65100' },
  aprobado:   { bg: '#E8F5E9', color: '#2E7D32' },
  rechazado:  { bg: '#FFEBEE', color: '#B71C1C' },
  homologado: { bg: '#E3F2FD', color: '#1565C0' },
}

const estadoTexto: { [key: string]: string } = {
  pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado', homologado: 'Homologado',
}

function CampoFecha({ docKey, tipo, onUpdate }: { docKey: string, tipo: 'emision' | 'vencimiento', onUpdate: (docKey: string, tipo: string, valor: string) => void }) {
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
      if (validarFecha(formatted)) onUpdate(docKey, tipo, formatted)
      else setError('Fecha inválida')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <input type="text" placeholder="DD/MM/AAAA" value={inputVal} maxLength={10} onChange={handleChange}
        style={{ width: '110px', fontSize: '11px', border: `1.5px solid ${error ? '#EF9A9A' : '#E8ECF0'}`, borderRadius: '6px', padding: '5px 8px', outline: 'none', color: '#0F1923' }} />
      {error && <span style={{ fontSize: '10px', color: '#B71C1C' }}>{error}</span>}
    </div>
  )
}

function FilaDoc({ doc, tabla, tieneVencimiento, keyPrefix, procesando, onAprobar, onRechazar, onVerDoc }: any) {
  const [comentario, setComentario] = useState('')
  const [fechaEmision, setFechaEmision] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const key = `${keyPrefix}-${doc.nombre}`
  const esProcesando = procesando === key
  const badge = estadoBadge[doc.estado] || estadoBadge.pendiente

  return (
    <div style={{ border: '1px solid #E8ECF0', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap' as any, gap: '8px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F1923' }}>{doc.nombre}</span>
          {doc.fecha_emision && <span style={{ fontSize: '10px', color: '#8A9BB0', marginLeft: '8px' }}>Emisión: {new Date(doc.fecha_emision).toLocaleDateString('es-PE')}</span>}
          {doc.fecha_vencimiento && <span style={{ fontSize: '10px', color: '#8A9BB0', marginLeft: '6px' }}>Vence: {new Date(doc.fecha_vencimiento).toLocaleDateString('es-PE')}</span>}
        </div>
        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 10px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
          {estadoTexto[doc.estado] || 'En revisión'}
        </span>
      </div>
      {tieneVencimiento && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' as any }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#8A9BB0' }}>Emisión:</span>
            <CampoFecha docKey={key} tipo="emision" onUpdate={(k, t, v) => { if (t === 'emision') setFechaEmision(v) }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: '#8A9BB0' }}>Vencimiento:</span>
            <CampoFecha docKey={key} tipo="vencimiento" onUpdate={(k, t, v) => { if (t === 'vencimiento') setFechaVencimiento(v) }} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' as any }}>
        {doc.url && (
          <button onClick={() => onVerDoc(doc.url)}
            style={{ fontSize: '11px', color: '#1565C0', background: '#E3F2FD', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
            Ver archivo
          </button>
        )}
        <input type="text" placeholder="Comentario (obligatorio para rechazar)" value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          style={{ flex: 1, minWidth: '160px', fontSize: '11px', border: '1.5px solid #E8ECF0', borderRadius: '6px', padding: '5px 10px', outline: 'none', color: '#0F1923' }} />
        <button disabled={esProcesando || !doc.url}
          onClick={() => onAprobar(tabla, doc, key, tieneVencimiento, fechaEmision, fechaVencimiento, comentario)}
          style={{ fontSize: '11px', background: '#2E7D32', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, opacity: (esProcesando || !doc.url) ? 0.4 : 1 }}>
          {esProcesando ? '...' : 'Aprobar'}
        </button>
        <button disabled={esProcesando || !doc.url || !comentario}
          onClick={() => onRechazar(tabla, doc, key, comentario)}
          style={{ fontSize: '11px', background: '#C41230', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, opacity: (esProcesando || !doc.url || !comentario) ? 0.4 : 1 }}>
          {esProcesando ? '...' : 'Rechazar'}
        </button>
      </div>
      {!comentario && <p style={{ fontSize: '10px', color: '#BCC6D0', marginTop: '4px', margin: '4px 0 0' }}>* Comentario obligatorio para rechazar</p>}
    </div>
  )
}

function EvaluadorContent() {
  const router = useRouter()
  const [vista, setVista] = useState<'dashboard' | 'evaluacion'>('dashboard')
  const [proveedores, setProveedores] = useState<any[]>([])
  const [proveedoresConPendientes, setProveedoresConPendientes] = useState<Set<string>>(new Set())
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
    if (proveedores.length === 0 || !proveedorIdParam) return
    const prov = proveedores.find((p: any) => p.id === proveedorIdParam)
    if (prov) { seleccionarProveedor(prov); setVista('evaluacion') }
  }, [proveedores, proveedorIdParam])

  const verificarRol = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single()
    if (!['evaluador', 'admin'].includes(perfil?.rol)) { router.push('/dashboard'); return }
    const params = new URLSearchParams(window.location.search)
    const id = params.get('proveedor')
    if (id) setProveedorIdParam(id)
    await cargarProveedores()
  }

  const cargarProveedores = async () => {
    const { data } = await supabase.from('proveedores').select('*').order('created_at', { ascending: false })
    setProveedores(data || [])

    // Cargar proveedores con unidades o conductores pendientes de revisión
    const { data: unidadesPendientes } = await supabase
      .from('unidades').select('proveedor_id').eq('pendiente_revision', true).eq('activo', true)
    const { data: conductoresPendientes } = await supabase
      .from('conductores').select('proveedor_id').eq('pendiente_revision', true).eq('activo', true)

    const idsPendientes = new Set<string>([
      ...(unidadesPendientes || []).map((u: any) => u.proveedor_id),
      ...(conductoresPendientes || []).map((c: any) => c.proveedor_id),
    ])
    setProveedoresConPendientes(idsPendientes)
    setLoading(false)
  }

  const pendientes = proveedores.filter((p: any) => p.estado === 'pendiente')
  const homologados = proveedores.filter((p: any) => p.estado === 'homologado')
  const rechazados = proveedores.filter((p: any) => p.estado === 'rechazado')
  const conNuevosElementos = proveedores.filter((p: any) => proveedoresConPendientes.has(p.id) && p.estado === 'homologado')

  const proveedoresFiltrados = proveedores.filter((p: any) => {
    const matchBusqueda = busqueda === '' || p.razon_social.toLowerCase().includes(busqueda.toLowerCase()) || p.ruc.includes(busqueda)
    const matchEstado = filtroEstado === 'todos' || p.estado === filtroEstado
    return matchBusqueda && matchEstado
  })

  const seleccionarProveedor = async (prov: any) => {
    setSeleccionado(prov)
    setAlmacenes([])
    setTipoProveedor('')
    const { data: docs } = await supabase.from('documentos').select('*').eq('proveedor_id', prov.id)
    setDocumentos(docs || [])
    const { data: conds } = await supabase.from('conductores').select('*').eq('proveedor_id', prov.id).eq('activo', true)
    setConductores(conds || [])
    const { data: units } = await supabase.from('unidades').select('*').eq('proveedor_id', prov.id).eq('activo', true)
    setUnidades(units || [])
    if (conds && conds.length > 0) {
      const { data: dc } = await supabase.from('documentos_conductor').select('*').in('conductor_id', conds.map((c: any) => c.id))
      setDocsConductor(dc || [])
    } else setDocsConductor([])
    if (units && units.length > 0) {
      const { data: du } = await supabase.from('documentos_unidad').select('*').in('unidad_id', units.map((u: any) => u.id))
      setDocsUnidad(du || [])
    } else setDocsUnidad([])
    const { data: alms } = await supabase.from('almacenes_proveedor').select('nombre').eq('proveedor_id', prov.id)
    setAlmacenes(alms || [])
    const { data: tiposProv } = await supabase.from('proveedor_tipos').select('tipos_proveedor(nombre)').eq('proveedor_id', prov.id)
    if (tiposProv && tiposProv.length > 0) {
      setTipoProveedor(tiposProv.map((t: any) => t.tipos_proveedor?.nombre).filter(Boolean).join(', '))
    } else if (prov.tipo_id) {
      const { data: tipo } = await supabase.from('tipos_proveedor').select('nombre').eq('id', prov.tipo_id).single()
      setTipoProveedor(tipo?.nombre || 'No especificado')
    } else setTipoProveedor('No especificado')
  }

  const marcarElementoRevisado = async (tabla: string, id: string) => {
    await supabase.from(tabla).update({ pendiente_revision: false }).eq('id', id)
    if (tabla === 'unidades') {
      setUnidades(prev => prev.map((u: any) => u.id === id ? { ...u, pendiente_revision: false } : u))
    } else {
      setConductores(prev => prev.map((c: any) => c.id === id ? { ...c, pendiente_revision: false } : c))
    }
    // Actualizar el set de pendientes
    await cargarProveedores()
  }

  const verDocumento = async (url: string) => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const aprobarDoc = useCallback(async (tabla: string, doc: any, key: string, tieneVencimiento: boolean, fechaEmision: string, fechaVencimiento: string, comentario: string) => {
    if (tieneVencimiento) {
      if (!validarFecha(fechaEmision) || !validarFecha(fechaVencimiento)) { alert('Ingresa fechas válidas (DD/MM/AAAA) antes de aprobar'); return }
      const emision = parsearFecha(fechaEmision), vencimiento = parsearFecha(fechaVencimiento)
      if (emision && vencimiento && emision >= vencimiento) { alert('La fecha de vencimiento debe ser posterior a la de emisión'); return }
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
    await supabase.from('notificaciones').insert({ proveedor_id: seleccionado.id, titulo: 'Documento aprobado', mensaje: `Tu documento "${doc.nombre}" fue aprobado`, tipo: 'info', leida: false })
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
    await supabase.from('notificaciones').insert({ proveedor_id: seleccionado.id, titulo: 'Documento rechazado', mensaje: `Tu documento "${doc.nombre}" fue rechazado: ${comentario}`, tipo: 'peligro', leida: false })
    const docActualizado = { ...doc, ...updateData }
    if (tabla === 'documentos') setDocumentos(prev => prev.map(d => d.id === doc.id ? docActualizado : d))
    else if (tabla === 'documentos_conductor') setDocsConductor(prev => prev.map(d => d.id === doc.id ? docActualizado : d))
    else if (tabla === 'documentos_unidad') setDocsUnidad(prev => prev.map(d => d.id === doc.id ? docActualizado : d))
    setProcesando(null)
  }, [seleccionado])

  const actualizarEstadoProveedor = async (estado: string) => {
    const updateData: any = { estado }
    if (estado === 'homologado') updateData.fecha_homologacion = new Date().toISOString()
    await supabase.from('proveedores').update(updateData).eq('id', seleccionado.id)
    await cargarProveedores()
    setSeleccionado({ ...seleccionado, ...updateData })
  }

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
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/evaluador">
            <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
          </a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Panel del evaluador</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setVista('dashboard')}
            style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: vista === 'dashboard' ? 'rgba(255,255,255,0.15)' : 'transparent', color: vista === 'dashboard' ? 'white' : 'rgba(255,255,255,0.5)' }}>
            Dashboard
          </button>
          <button onClick={() => setVista('evaluacion')}
            style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: vista === 'evaluacion' ? 'rgba(255,255,255,0.15)' : 'transparent', color: vista === 'evaluacion' ? 'white' : 'rgba(255,255,255,0.5)', position: 'relative' }}>
            Evaluación
            {(pendientes.length > 0 || conNuevosElementos.length > 0) && (
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', background: '#C41230', borderRadius: '50%', fontSize: '9px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {pendientes.length + conNuevosElementos.length}
              </span>
            )}
          </button>
          <Notificaciones esEvaluador={true} />
          <BotonAdmin />
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      {/* DASHBOARD */}
      {vista === 'dashboard' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>

          <div style={{ marginBottom: '28px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>Panel de homologación</h1>
            <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {[
              { label: 'Total proveedores', valor: proveedores.length, icon: '🏢', bg: 'white', color: '#0F1923', border: '#E8ECF0' },
              { label: 'Pendientes', valor: pendientes.length, icon: '⏳', bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' },
              { label: 'Homologados', valor: homologados.length, icon: '✅', bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
              { label: 'Nuevos elementos', valor: conNuevosElementos.length, icon: '⚠️', bg: '#FFF8E1', color: '#F57F17', border: '#FFE082' },
            ].map((kpi: any) => (
              <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '14px', padding: '20px', border: `1px solid ${kpi.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <span style={{ fontSize: '22px' }}>{kpi.icon}</span>
                <p style={{ fontSize: '32px', fontWeight: 800, color: kpi.color, margin: '10px 0 4px', lineHeight: 1 }}>{kpi.valor}</p>
                <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Proveedores con nuevos elementos */}
          {conNuevosElementos.length > 0 && (
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #FFE082', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: '20px' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #FFF8E1', background: '#FFF8E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px' }}>⚠️</span>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#F57F17', margin: 0 }}>Proveedores homologados con nuevas unidades/conductores ({conNuevosElementos.length})</p>
                </div>
              </div>
              {conNuevosElementos.map((p: any, i: number) => (
                <div key={p.id}
                  onClick={() => { seleccionarProveedor(p); setVista('evaluacion') }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: i < conNuevosElementos.length - 1 ? '1px solid #F5F7FA' : 'none', cursor: 'pointer', background: 'white' }}
                  onMouseEnter={(e: any) => e.currentTarget.style.background = '#F5F7FA'}
                  onMouseLeave={(e: any) => e.currentTarget.style.background = 'white'}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: '0 0 3px' }}>{p.razon_social}</p>
                      <span style={{ fontSize: '9px', fontWeight: 700, background: '#FFF8E1', color: '#F57F17', padding: '2px 7px', borderRadius: '20px', border: '1px solid #FFE082' }}>⚠️ NUEVO</span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>RUC {p.ruc}</p>
                  </div>
                  <span style={{ fontSize: '12px', color: '#F57F17', fontWeight: 600 }}>Revisar →</span>
                </div>
              ))}
            </div>
          )}

          {/* Pendientes */}
          {pendientes.length > 0 && (
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: '20px' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF3E0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px' }}>⚠️</span>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#E65100', margin: 0 }}>Proveedores pendientes de evaluación ({pendientes.length})</p>
                </div>
                <button onClick={() => setVista('evaluacion')}
                  style={{ fontSize: '12px', fontWeight: 600, color: 'white', background: '#E65100', border: 'none', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer' }}>
                  Evaluar ahora →
                </button>
              </div>
              {pendientes.slice(0, 5).map((p: any, i: number) => (
                <div key={p.id}
                  onClick={() => { seleccionarProveedor(p); setVista('evaluacion') }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: i < Math.min(pendientes.length, 5) - 1 ? '1px solid #F5F7FA' : 'none', cursor: 'pointer', background: 'white' }}
                  onMouseEnter={(e: any) => e.currentTarget.style.background = '#F5F7FA'}
                  onMouseLeave={(e: any) => e.currentTarget.style.background = 'white'}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: '0 0 3px' }}>{p.razon_social}</p>
                      {p.urgente && <span style={{ fontSize: '9px', fontWeight: 700, background: '#FFEBEE', color: '#B71C1C', padding: '2px 7px', borderRadius: '20px', border: '1px solid #EF9A9A' }}>🚨 URGENTE</span>}
                    </div>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>RUC {p.ruc} · Registrado {new Date(p.created_at).toLocaleDateString('es-PE')}</p>
                  </div>
                  <span style={{ fontSize: '12px', color: '#E65100', fontWeight: 600 }}>Revisar →</span>
                </div>
              ))}
              {pendientes.length > 5 && (
                <div style={{ padding: '12px 24px', background: '#FAFBFC', textAlign: 'center' }}>
                  <button onClick={() => { setFiltroEstado('pendiente'); setVista('evaluacion') }}
                    style={{ fontSize: '12px', color: '#E65100', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Ver {pendientes.length - 5} más →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Últimos homologados y rechazados */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Últimos homologados</p>
                <button onClick={() => { setFiltroEstado('homologado'); setVista('evaluacion') }}
                  style={{ fontSize: '11px', color: '#C41230', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver todos →</button>
              </div>
              {homologados.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#BCC6D0', textAlign: 'center', padding: '24px', margin: 0 }}>Sin proveedores homologados aún</p>
              ) : homologados.slice(0, 5).map((p: any, i: number) => (
                <div key={p.id} onClick={() => { seleccionarProveedor(p); setVista('evaluacion') }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < Math.min(homologados.length, 5) - 1 ? '1px solid #F5F7FA' : 'none', cursor: 'pointer' }}
                  onMouseEnter={(e: any) => e.currentTarget.style.background = '#F5F7FA'}
                  onMouseLeave={(e: any) => e.currentTarget.style.background = 'white'}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F1923', margin: '0 0 2px' }}>{p.razon_social}</p>
                      {proveedoresConPendientes.has(p.id) && (
                        <span style={{ fontSize: '9px', fontWeight: 700, background: '#FFF8E1', color: '#F57F17', padding: '2px 6px', borderRadius: '20px', border: '1px solid #FFE082' }}>⚠️ Nuevo</span>
                      )}
                    </div>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>RUC {p.ruc}</p>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: '#E8F5E9', color: '#2E7D32' }}>Homologado</span>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Rechazados</p>
                <button onClick={() => { setFiltroEstado('rechazado'); setVista('evaluacion') }}
                  style={{ fontSize: '11px', color: '#C41230', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver todos →</button>
              </div>
              {rechazados.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#BCC6D0', textAlign: 'center', padding: '24px', margin: 0 }}>Sin proveedores rechazados</p>
              ) : rechazados.slice(0, 5).map((p: any, i: number) => (
                <div key={p.id} onClick={() => { seleccionarProveedor(p); setVista('evaluacion') }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < Math.min(rechazados.length, 5) - 1 ? '1px solid #F5F7FA' : 'none', cursor: 'pointer' }}
                  onMouseEnter={(e: any) => e.currentTarget.style.background = '#F5F7FA'}
                  onMouseLeave={(e: any) => e.currentTarget.style.background = 'white'}>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F1923', margin: '0 0 2px' }}>{p.razon_social}</p>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>RUC {p.ruc}</p>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: '#FFEBEE', color: '#B71C1C' }}>Rechazado</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* EVALUACIÓN */}
      {vista === 'evaluacion' && (
        <div style={{ display: 'flex', height: 'calc(100vh - 59px)' }}>

          {/* Lista izquierda */}
          <div style={{ width: '280px', minWidth: '280px', background: 'white', borderRight: '1px solid #E8ECF0', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px', borderBottom: '1px solid #F0F2F5' }}>
              <input type="text" placeholder="Buscar por nombre o RUC..." value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' as any, color: '#0F1923' }} />
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
                style={{ width: '100%', padding: '7px 12px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', outline: 'none', background: 'white', color: '#0F1923' }}>
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="homologado">Homologados</option>
                <option value="rechazado">Rechazados</option>
              </select>
            </div>
            <div style={{ padding: '8px 14px', borderBottom: '1px solid #F0F2F5' }}>
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0, fontWeight: 500 }}>{proveedoresFiltrados.length} proveedores</p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {proveedoresFiltrados.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#8A9BB0', textAlign: 'center', padding: '24px', margin: 0 }}>Sin resultados</p>
              ) : proveedoresFiltrados.map((prov: any) => {
                const badge = estadoBadge[prov.estado] || estadoBadge.pendiente
                const tieneNuevos = proveedoresConPendientes.has(prov.id)
                return (
                  <div key={prov.id} onClick={() => seleccionarProveedor(prov)}
                    style={{ padding: '12px 16px', borderBottom: '1px solid #F5F7FA', cursor: 'pointer', background: seleccionado?.id === prov.id ? '#FEF2F2' : tieneNuevos ? '#FFFDE7' : 'white', borderLeft: seleccionado?.id === prov.id ? '3px solid #C41230' : tieneNuevos ? '3px solid #F57F17' : '3px solid transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F1923', margin: 0 }}>{prov.razon_social}</p>
                      {prov.urgente && <span style={{ fontSize: '8px', fontWeight: 700, background: '#FFEBEE', color: '#B71C1C', padding: '1px 5px', borderRadius: '4px' }}>🚨</span>}
                    </div>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 6px' }}>RUC {prov.ruc}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
                        {estadoTexto[prov.estado] || 'Pendiente'}
                      </span>
                      {tieneNuevos && (
                        <span style={{ fontSize: '9px', fontWeight: 700, background: '#FFF8E1', color: '#F57F17', padding: '2px 7px', borderRadius: '20px', border: '1px solid #FFE082' }}>
                          ⚠️ Nuevo
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Panel derecho */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#F0F2F5' }}>
            {!seleccionado ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '32px', margin: '0 0 12px' }}>🏢</p>
                  <p style={{ fontSize: '14px', color: '#8A9BB0', margin: '0 0 6px', fontWeight: 600 }}>Selecciona un proveedor para revisar</p>
                  <p style={{ fontSize: '12px', color: '#BCC6D0', margin: 0 }}>Haz clic en cualquier proveedor de la lista</p>
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: '720px' }}>

                {/* Cabecera proveedor */}
                <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', padding: '20px 24px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0F1923', margin: 0 }}>{seleccionado.razon_social}</h2>
                        {seleccionado.urgente && <span style={{ fontSize: '10px', fontWeight: 700, background: '#FFEBEE', color: '#B71C1C', padding: '3px 10px', borderRadius: '20px', border: '1px solid #EF9A9A' }}>🚨 URGENTE</span>}
                        {proveedoresConPendientes.has(seleccionado.id) && <span style={{ fontSize: '10px', fontWeight: 700, background: '#FFF8E1', color: '#F57F17', padding: '3px 10px', borderRadius: '20px', border: '1px solid #FFE082' }}>⚠️ Nuevos elementos</span>}
                      </div>
                      <p style={{ fontSize: '12px', color: '#8A9BB0', margin: 0 }}>RUC {seleccionado.ruc}</p>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: (estadoBadge[seleccionado.estado] || estadoBadge.pendiente).bg, color: (estadoBadge[seleccionado.estado] || estadoBadge.pendiente).color }}>
                      {estadoTexto[seleccionado.estado] || 'Pendiente'}
                    </span>
                  </div>

                  <div style={{ background: '#F8F9FA', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' as any }}>
                      <div>
                        <span style={{ fontSize: '10px', color: '#8A9BB0', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Tipo de proveedor</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923' }}>{tipoProveedor}</span>
                      </div>
                      {almacenes.length > 0 && (
                        <div>
                          <span style={{ fontSize: '10px', color: '#8A9BB0', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Almacenes con acceso</span>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as any }}>
                            {almacenes.map((a: any) => (
                              <span key={a.nombre} style={{ fontSize: '11px', background: '#E8F5E9', color: '#2E7D32', padding: '2px 8px', borderRadius: '20px', border: '1px solid #A5D6A7' }}>{a.nombre}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as any }}>
                    <button onClick={() => actualizarEstadoProveedor('homologado')}
                      style={{ background: '#C41230', color: 'white', fontSize: '12px', fontWeight: 600, padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                      ✅ Homologar proveedor
                    </button>
                    <button onClick={() => actualizarEstadoProveedor('rechazado')}
                      style={{ background: '#FFEBEE', color: '#B71C1C', fontSize: '12px', fontWeight: 600, padding: '8px 18px', borderRadius: '8px', border: '1px solid #EF9A9A', cursor: 'pointer' }}>
                      ❌ Rechazar proveedor
                    </button>
                    <button onClick={() => actualizarEstadoProveedor('pendiente')}
                      style={{ background: '#F0F2F5', color: '#8A9BB0', fontSize: '12px', padding: '8px 18px', borderRadius: '8px', border: '1px solid #E8ECF0', cursor: 'pointer' }}>
                      Marcar pendiente
                    </button>
                  </div>
                </div>

                {/* Documentos empresa */}
                {documentos.length > 0 && (
                  <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', padding: '18px 24px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: '0 0 14px' }}>📄 Documentos de la empresa</h3>
                    {documentos.map((doc: any) => (
                      <FilaDoc key={doc.id} doc={doc} tabla="documentos"
                        tieneVencimiento={DOCS_CON_VENCIMIENTO.includes(doc.nombre)}
                        keyPrefix={`empresa-${doc.proveedor_id}`}
                        procesando={procesando} onAprobar={aprobarDoc} onRechazar={rechazarDoc} onVerDoc={verDocumento} />
                    ))}
                  </div>
                )}

                {/* Conductores */}
                {conductores.length > 0 && (
                  <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', padding: '18px 24px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: '0 0 14px' }}>👤 Conductores</h3>
                    {conductores.map((conductor: any) => (
                      <div key={conductor.id} style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '8px 12px', background: conductor.pendiente_revision ? '#FFF8E1' : '#F8F9FA', borderRadius: '8px', border: conductor.pendiente_revision ? '1px solid #FFE082' : '1px solid transparent' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#C41230', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                              {conductor.nombre_completo.charAt(0)}
                            </div>
                            <div>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923' }}>{conductor.nombre_completo}</span>
                              {conductor.pendiente_revision && <span style={{ fontSize: '9px', fontWeight: 700, background: '#FFF8E1', color: '#F57F17', padding: '2px 7px', borderRadius: '20px', border: '1px solid #FFE082', marginLeft: '8px' }}>⚠️ NUEVO</span>}
                            </div>
                          </div>
                          {conductor.pendiente_revision && (
                            <button onClick={() => marcarElementoRevisado('conductores', conductor.id)}
                              style={{ fontSize: '10px', color: '#2E7D32', background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>
                              ✓ Marcar revisado
                            </button>
                          )}
                        </div>
                        {docsConductor.filter((d: any) => d.conductor_id === conductor.id).map((doc: any) => (
                          <FilaDoc key={doc.id} doc={doc} tabla="documentos_conductor"
                            tieneVencimiento={DOCS_CON_VENCIMIENTO.includes(doc.nombre)}
                            keyPrefix={`conductor-${conductor.id}`}
                            procesando={procesando} onAprobar={aprobarDoc} onRechazar={rechazarDoc} onVerDoc={verDocumento} />
                        ))}
                        {docsConductor.filter((d: any) => d.conductor_id === conductor.id).length === 0 && (
                          <p style={{ fontSize: '11px', color: '#BCC6D0', marginLeft: '38px' }}>Sin documentos cargados aún</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Unidades */}
                {unidades.length > 0 && (
                  <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', padding: '18px 24px', marginBottom: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: '0 0 14px' }}>🚛 Unidades vehiculares</h3>
                    {unidades.map((unidad: any) => (
                      <div key={unidad.id} style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '8px 12px', background: unidad.pendiente_revision ? '#FFF8E1' : '#F8F9FA', borderRadius: '8px', border: unidad.pendiente_revision ? '1px solid #FFE082' : '1px solid transparent' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0F1923', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>🚛</div>
                            <div>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923' }}>Placa: {unidad.placa}</span>
                              {unidad.pendiente_revision && <span style={{ fontSize: '9px', fontWeight: 700, background: '#FFF8E1', color: '#F57F17', padding: '2px 7px', borderRadius: '20px', border: '1px solid #FFE082', marginLeft: '8px' }}>⚠️ NUEVO</span>}
                            </div>
                          </div>
                          {unidad.pendiente_revision && (
                            <button onClick={() => marcarElementoRevisado('unidades', unidad.id)}
                              style={{ fontSize: '10px', color: '#2E7D32', background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>
                              ✓ Marcar revisado
                            </button>
                          )}
                        </div>
                        {docsUnidad.filter((d: any) => d.unidad_id === unidad.id).map((doc: any) => (
                          <FilaDoc key={doc.id} doc={doc} tabla="documentos_unidad"
                            tieneVencimiento={DOCS_CON_VENCIMIENTO.includes(doc.nombre)}
                            keyPrefix={`unidad-${unidad.id}`}
                            procesando={procesando} onAprobar={aprobarDoc} onRechazar={rechazarDoc} onVerDoc={verDocumento} />
                        ))}
                        {docsUnidad.filter((d: any) => d.unidad_id === unidad.id).length === 0 && (
                          <p style={{ fontSize: '11px', color: '#BCC6D0', marginLeft: '38px' }}>Sin documentos cargados aún</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {documentos.length === 0 && conductores.length === 0 && unidades.length === 0 && (
                  <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', padding: '48px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <p style={{ fontSize: '28px', margin: '0 0 12px' }}>📭</p>
                    <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>Este proveedor aún no ha cargado documentos</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function EvaluadorPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #EEEEEE', borderTopColor: '#C41230', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ color: '#999', fontSize: '13px', margin: 0 }}>Cargando...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <EvaluadorContent />
    </Suspense>
  )
}