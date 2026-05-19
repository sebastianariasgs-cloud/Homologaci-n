'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonHub from '../components/BotonHub'

const DOCS_CON_VENCIMIENTO = [
  'SOAT', 'Revision tecnica', 'Poliza de seguros contra terceros',
  'Licencia de conducir', 'SCTR', 'Certificado habilitacion vehicular MTC',
]

const estadoBadge: { [key: string]: { bg: string; color: string } } = {
  pendiente:  { bg: '#FFF3E0', color: '#E65100' },
  aprobado:   { bg: '#E8F5E9', color: '#2E7D32' },
  rechazado:  { bg: '#FFEBEE', color: '#B71C1C' },
  homologado: { bg: '#E3F2FD', color: '#1565C0' },
}
const estadoTexto: { [key: string]: string } = {
  pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado', homologado: 'Homologado',
}

// ─── texto principal: gris oscuro (no negro) ───
const T = '#374151'
const T2 = '#8A9BB0'

const validarFecha = (v: string) => {
  if (!v || v.length < 10) return false
  const p = v.split('/'); if (p.length !== 3) return false
  const d = parseInt(p[0]), m = parseInt(p[1]), a = parseInt(p[2])
  if (isNaN(d)||isNaN(m)||isNaN(a)||m<1||m>12||d<1||d>31||a<2000||a>2100) return false
  const f = new Date(a, m-1, d); return f.getDate()===d && f.getMonth()===m-1
}
const parsearFecha = (v: string) => {
  if (!validarFecha(v)) return null
  const p = v.split('/'); return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`
}

function CampoFecha({ docKey, tipo, onUpdate }: {
  docKey: string; tipo: 'emision'|'vencimiento'
  onUpdate: (k: string, t: string, v: string) => void
}) {
  const [val, setVal] = useState(''); const [err, setErr] = useState('')
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g,'').slice(0,8)
    let f = ''
    if (raw.length<=2) f=raw
    else if (raw.length<=4) f=raw.slice(0,2)+'/'+raw.slice(2)
    else f=raw.slice(0,2)+'/'+raw.slice(2,4)+'/'+raw.slice(4)
    setVal(f); setErr('')
    if (f.length===10) { if (validarFecha(f)) onUpdate(docKey,tipo,f); else setErr('Fecha inválida') }
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
      <input type="text" placeholder="DD/MM/AAAA" value={val} maxLength={10} onChange={handleChange}
        style={{ width:'110px', fontSize:'11px', border:`1.5px solid ${err?'#EF9A9A':'#E8ECF0'}`, borderRadius:'6px', padding:'5px 8px', outline:'none', color: T }} />
      {err && <span style={{ fontSize:'10px', color:'#B71C1C' }}>{err}</span>}
    </div>
  )
}

function FilaDoc({ doc, tabla, tieneVencimiento, keyPrefix, procesando, onAprobar, onRechazar, onVerDoc }: any) {
  const [comentario, setComentario] = useState('')
  const [fe, setFe] = useState(''); const [fv, setFv] = useState('')
  const key = `${keyPrefix}-${doc.nombre}`
  const ep = procesando === key
  const badge = estadoBadge[doc.estado] || estadoBadge.pendiente
  return (
    <div style={{ border:'1px solid #E8ECF0', borderRadius:'10px', padding:'12px 16px', marginBottom:'8px', background:'white' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px', flexWrap:'wrap' as any, gap:'8px' }}>
        <div>
          <span style={{ fontSize:'12px', fontWeight:600, color: T }}>{doc.nombre}</span>
          {doc.fecha_emision && <span style={{ fontSize:'10px', color: T2, marginLeft:'8px' }}>Emisión: {new Date(doc.fecha_emision).toLocaleDateString('es-PE')}</span>}
          {doc.fecha_vencimiento && <span style={{ fontSize:'10px', color: T2, marginLeft:'6px' }}>Vence: {new Date(doc.fecha_vencimiento).toLocaleDateString('es-PE')}</span>}
        </div>
        <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 10px', borderRadius:'20px', background:badge.bg, color:badge.color }}>
          {estadoTexto[doc.estado] || 'En revisión'}
        </span>
      </div>
      {tieneVencimiento && (
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px', flexWrap:'wrap' as any }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ fontSize:'10px', color: T2 }}>Emisión:</span>
            <CampoFecha docKey={key} tipo="emision" onUpdate={(_k,t,v) => { if(t==='emision') setFe(v) }} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ fontSize:'10px', color: T2 }}>Vencimiento:</span>
            <CampoFecha docKey={key} tipo="vencimiento" onUpdate={(_k,t,v) => { if(t==='vencimiento') setFv(v) }} />
          </div>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' as any }}>
        {doc.url && (
          <button onClick={() => onVerDoc(doc.url)}
            style={{ fontSize:'11px', color:'#1565C0', background:'#E3F2FD', border:'none', padding:'5px 10px', borderRadius:'6px', cursor:'pointer', fontWeight:600 }}>
            Ver archivo
          </button>
        )}
        <input type="text" placeholder="Comentario (obligatorio para rechazar)" value={comentario}
          onChange={e => setComentario(e.target.value)}
          style={{ flex:1, minWidth:'160px', fontSize:'11px', border:'1.5px solid #E8ECF0', borderRadius:'6px', padding:'5px 10px', outline:'none', color: T }} />
        <button disabled={ep||!doc.url}
          onClick={() => onAprobar(tabla,doc,key,tieneVencimiento,fe,fv,comentario)}
          style={{ fontSize:'11px', background:'#2E7D32', color:'white', border:'none', padding:'5px 12px', borderRadius:'6px', cursor:'pointer', fontWeight:600, opacity:(ep||!doc.url)?0.4:1 }}>
          {ep ? '...' : 'Aprobar'}
        </button>
        <button disabled={ep||!doc.url||!comentario}
          onClick={() => onRechazar(tabla,doc,key,comentario)}
          style={{ fontSize:'11px', background:'#C41230', color:'white', border:'none', padding:'5px 12px', borderRadius:'6px', cursor:'pointer', fontWeight:600, opacity:(ep||!doc.url||!comentario)?0.4:1 }}>
          {ep ? '...' : 'Rechazar'}
        </button>
      </div>
      {!comentario && <p style={{ fontSize:'10px', color:'#BCC6D0', margin:'4px 0 0' }}>* Comentario obligatorio para rechazar</p>}
    </div>
  )
}

// ─── Modal de Reportes ────────────────────────────────────────────────────────
function ModalReportes({ proveedores, onCerrar }: { proveedores: any[]; onCerrar: () => void }) {
  const [filtro, setFiltro] = useState('todos')
  const [cargando, setCargando] = useState(false)

  const filtrados = proveedores.filter(p =>
    filtro === 'todos' || p.estado === filtro
  )

  const descargarExcel = async () => {
    setCargando(true)
    try {
      // Traer tipos, unidades y conductores en paralelo
      const ids = filtrados.map(p => p.id)

      const { data: tiposRel } = await supabase
        .from('proveedor_tipos')
        .select('proveedor_id, tipos_proveedor(nombre)')
        .in('proveedor_id', ids)

      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('proveedor_id')
        .in('proveedor_id', ids)
        .eq('activo', true)

      const { data: conductoresData } = await supabase
        .from('conductores')
        .select('proveedor_id')
        .in('proveedor_id', ids)
        .eq('activo', true)

      // Indexar
      const tiposMap: { [k: string]: string[] } = {}
      ;(tiposRel || []).forEach((t: any) => {
        if (!tiposMap[t.proveedor_id]) tiposMap[t.proveedor_id] = []
        if (t.tipos_proveedor?.nombre) tiposMap[t.proveedor_id].push(t.tipos_proveedor.nombre)
      })
      const unidadesCount: { [k: string]: number } = {}
      ;(unidadesData || []).forEach((u: any) => {
        unidadesCount[u.proveedor_id] = (unidadesCount[u.proveedor_id] || 0) + 1
      })
      const conductoresCount: { [k: string]: number } = {}
      ;(conductoresData || []).forEach((c: any) => {
        conductoresCount[c.proveedor_id] = (conductoresCount[c.proveedor_id] || 0) + 1
      })

      // Construir filas
      const encabezado = ['Razón Social', 'RUC', 'Tipo de Proveedor', 'Estado', 'Fecha Registro', 'Fecha Homologación', 'Unidades Activas', 'Conductores Activos']
      const filas = filtrados.map(p => [
        p.razon_social,
        p.ruc,
        tiposMap[p.id]?.join(', ') || 'No especificado',
        estadoTexto[p.estado] || p.estado,
        p.created_at ? new Date(p.created_at).toLocaleDateString('es-PE') : '',
        p.fecha_homologacion ? new Date(p.fecha_homologacion).toLocaleDateString('es-PE') : '',
        unidadesCount[p.id] || 0,
        conductoresCount[p.id] || 0,
      ])

      const csv = [encabezado, ...filas]
        .map(fila => fila.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_proveedores_${filtro}_${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Error al generar el reporte')
    }
    setCargando(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,25,35,0.55)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'680px', maxHeight:'80vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #E8ECF0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <p style={{ fontSize:'15px', fontWeight:700, color: T, margin:'0 0 2px' }}>Reportes de proveedores</p>
            <p style={{ fontSize:'12px', color: T2, margin:0 }}>Filtra y descarga como Excel (.csv)</p>
          </div>
          <button onClick={onCerrar}
            style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid #E8ECF0', background:'#F0F2F5', cursor:'pointer', fontSize:'16px', color: T2, display:'flex', alignItems:'center', justifyContent:'center' }}>
            ✕
          </button>
        </div>

        {/* Filtros + botón */}
        <div style={{ padding:'16px 24px', borderBottom:'1px solid #F0F2F5', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' as any }}>
          {(['todos','pendiente','homologado','rechazado'] as const).map(op => (
            <button key={op} onClick={() => setFiltro(op)}
              style={{ fontSize:'11px', fontWeight:600, padding:'6px 14px', borderRadius:'20px', border:'none', cursor:'pointer',
                background: filtro===op ? '#0F1923' : '#F0F2F5',
                color: filtro===op ? 'white' : T2 }}>
              {op === 'todos' ? 'Todos' : estadoTexto[op]}
            </button>
          ))}
          <div style={{ marginLeft:'auto' }}>
            <button onClick={descargarExcel} disabled={cargando || filtrados.length === 0}
              style={{ fontSize:'12px', fontWeight:600, padding:'8px 18px', borderRadius:'8px', border:'none', cursor:'pointer', background:'#C41230', color:'white', opacity: (cargando || filtrados.length===0) ? 0.5 : 1, display:'flex', alignItems:'center', gap:'6px' }}>
              {cargando ? '⏳ Generando...' : `⬇️ Descargar Excel (${filtrados.length})`}
            </button>
          </div>
        </div>

        {/* Tabla preview */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {filtrados.length === 0 ? (
            <p style={{ fontSize:'12px', color: T2, textAlign:'center', padding:'32px', margin:0 }}>Sin proveedores para este filtro</p>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ background:'#F8F9FA', position:'sticky', top:0 }}>
                  {['Razón Social', 'RUC', 'Estado', 'Registro', 'Homologación'].map(h => (
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'10px', fontWeight:700, color: T2, textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #E8ECF0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p: any, i: number) => {
                  const badge = estadoBadge[p.estado] || estadoBadge.pendiente
                  return (
                    <tr key={p.id} style={{ borderBottom: i < filtrados.length-1 ? '1px solid #F5F7FA' : 'none' }}>
                      <td style={{ padding:'10px 16px', color: T, fontWeight:500 }}>{p.razon_social}</td>
                      <td style={{ padding:'10px 16px', color: T2, fontFamily:'monospace', fontSize:'11px' }}>{p.ruc}</td>
                      <td style={{ padding:'10px 16px' }}>
                        <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'20px', background:badge.bg, color:badge.color }}>
                          {estadoTexto[p.estado] || p.estado}
                        </span>
                      </td>
                      <td style={{ padding:'10px 16px', color: T2, fontSize:'11px' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('es-PE') : '—'}
                      </td>
                      <td style={{ padding:'10px 16px', color: T2, fontSize:'11px' }}>
                        {p.fecha_homologacion ? new Date(p.fecha_homologacion).toLocaleDateString('es-PE') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 24px', borderTop:'1px solid #F0F2F5', background:'#FAFBFC' }}>
          <p style={{ fontSize:'11px', color: T2, margin:0 }}>
            El archivo descargado incluye: Razón Social, RUC, Tipo de Proveedor, Estado, Fecha Registro, Fecha Homologación, Unidades Activas, Conductores Activos.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
function EvaluadorContent() {
  const router = useRouter()
  const [vista, setVista] = useState<'dashboard'|'evaluacion'>('dashboard')
  const [proveedores, setProveedores] = useState<any[]>([])
  const [proveedoresConPendientes, setProveedoresConPendientes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [conductores, setConductores] = useState<any[]>([])
  const [unidades, setUnidades] = useState<any[]>([])
  const [docsConductor, setDocsConductor] = useState<any[]>([])
  const [docsUnidad, setDocsUnidad] = useState<any[]>([])
  const [procesando, setProcesando] = useState<string|null>(null)
  const [almacenes, setAlmacenes] = useState<any[]>([])
  const [tipoProveedor, setTipoProveedor] = useState<string>('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [proveedorIdParam, setProveedorIdParam] = useState<string|null>(null)
  const [mostrarReportes, setMostrarReportes] = useState(false)

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
    if (!['evaluador','admin'].includes(perfil?.rol)) { router.push('/dashboard'); return }
    const params = new URLSearchParams(window.location.search)
    const id = params.get('proveedor'); if (id) setProveedorIdParam(id)
    await cargarProveedores()
  }

  const cargarProveedores = async () => {
    const { data } = await supabase.from('proveedores').select('*').order('created_at', { ascending: false })
    setProveedores(data || [])
    const { data: up } = await supabase.from('unidades').select('proveedor_id').eq('pendiente_revision', true).eq('activo', true)
    const { data: cp } = await supabase.from('conductores').select('proveedor_id').eq('pendiente_revision', true).eq('activo', true)
    setProveedoresConPendientes(new Set<string>([
      ...(up || []).map((u: any) => u.proveedor_id),
      ...(cp || []).map((c: any) => c.proveedor_id),
    ]))
    setLoading(false)
  }

  // ── KPIs: TODOS los proveedores (incluyendo carga masiva) ─────────────────
  const pendientes    = proveedores.filter((p: any) => p.estado === 'pendiente')
  const homologados   = proveedores.filter((p: any) => p.estado === 'homologado')
  const conNuevosElem = proveedores.filter((p: any) => proveedoresConPendientes.has(p.id))

  // ── Dashboard listas: excluir carga masiva (user_id === null) ─────────────
  // Los 119 ya están homologados directamente, no requieren evaluación de usuario
  const proveedoresPortal = proveedores.filter((p: any) => p.user_id !== null)
  const pendientesPortal  = proveedoresPortal.filter((p: any) => p.estado === 'pendiente')
  const nuevosElemPortal  = proveedoresPortal.filter((p: any) => proveedoresConPendientes.has(p.id))

  const requierenAtencion = [
    ...pendientesPortal,
    ...nuevosElemPortal.filter((p: any) => p.estado !== 'pendiente'),
  ].sort((a: any, b: any) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0)).slice(0, 5)

  const ultimosHomologados = [...homologados]
    .filter((p: any) => p.user_id !== null)
    .sort((a: any, b: any) =>
      new Date(b.fecha_homologacion || b.created_at).getTime() -
      new Date(a.fecha_homologacion || a.created_at).getTime()
    ).slice(0, 5)

  const proveedoresFiltrados = proveedores.filter((p: any) => {
    const mb = busqueda === '' || p.razon_social.toLowerCase().includes(busqueda.toLowerCase()) || p.ruc.includes(busqueda)
    const me = filtroEstado === 'todos' || p.estado === filtroEstado
    return mb && me
  })

  const seleccionarProveedor = async (prov: any) => {
    setSeleccionado(prov); setAlmacenes([]); setTipoProveedor('')
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
    const { data: tp } = await supabase.from('proveedor_tipos').select('tipos_proveedor(nombre)').eq('proveedor_id', prov.id)
    if (tp && tp.length > 0) setTipoProveedor(tp.map((t: any) => t.tipos_proveedor?.nombre).filter(Boolean).join(', '))
    else if (prov.tipo_id) {
      const { data: t } = await supabase.from('tipos_proveedor').select('nombre').eq('id', prov.tipo_id).single()
      setTipoProveedor(t?.nombre || 'No especificado')
    } else setTipoProveedor('No especificado')
  }

  // ── FIX: setState funcional para evitar stale closure ────────────────────
  const marcarElementoRevisado = async (tabla: string, id: string) => {
    const { error } = await supabase.from(tabla).update({ pendiente_revision: false }).eq('id', id)
    if (error) { alert('Error: ' + error.message); return }

    if (tabla === 'unidades') {
      setUnidades(prev => {
        const updated = prev.map((u: any) => u.id === id ? { ...u, pendiente_revision: false } : u)
        const sigueConPendientes = updated.some((u: any) => u.pendiente_revision) ||
          conductores.some((c: any) => c.pendiente_revision)
        if (!sigueConPendientes && seleccionado) {
          setProveedoresConPendientes(p => { const n = new Set(p); n.delete(seleccionado.id); return n })
        }
        return updated
      })
    } else {
      setConductores(prev => {
        const updated = prev.map((c: any) => c.id === id ? { ...c, pendiente_revision: false } : c)
        const sigueConPendientes = unidades.some((u: any) => u.pendiente_revision) ||
          updated.some((c: any) => c.pendiente_revision)
        if (!sigueConPendientes && seleccionado) {
          setProveedoresConPendientes(p => { const n = new Set(p); n.delete(seleccionado.id); return n })
        }
        return updated
      })
    }
  }

  const verDocumento = async (url: string) => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const aprobarDoc = useCallback(async (tabla: string, doc: any, key: string, tieneVenc: boolean, fe: string, fv: string, comentario: string) => {
    if (tieneVenc) {
      if (!validarFecha(fe) || !validarFecha(fv)) { alert('Ingresa fechas válidas (DD/MM/AAAA)'); return }
      const em = parsearFecha(fe), ve = parsearFecha(fv)
      if (em && ve && em >= ve) { alert('Vencimiento debe ser posterior a emisión'); return }
    }
    setProcesando(key)
    const upd: any = { estado: 'aprobado', comentario: comentario || null }
    if (tieneVenc) { upd.fecha_emision = parsearFecha(fe); upd.fecha_vencimiento = parsearFecha(fv); upd.fechas_bloqueadas = true }
    const { error } = await supabase.from(tabla).update(upd).eq('id', doc.id)
    if (error) { alert('Error: ' + error.message); setProcesando(null); return }
    await supabase.from('notificaciones').insert({ proveedor_id: seleccionado.id, titulo: 'Documento aprobado', mensaje: `Tu documento "${doc.nombre}" fue aprobado`, tipo: 'info', leida: false })
    const da = { ...doc, ...upd }
    if (tabla === 'documentos') setDocumentos(p => p.map(d => d.id === doc.id ? da : d))
    else if (tabla === 'documentos_conductor') setDocsConductor(p => p.map(d => d.id === doc.id ? da : d))
    else if (tabla === 'documentos_unidad') setDocsUnidad(p => p.map(d => d.id === doc.id ? da : d))
    setProcesando(null)
  }, [seleccionado])

  const rechazarDoc = useCallback(async (tabla: string, doc: any, key: string, comentario: string) => {
    if (!comentario) { alert('El comentario es obligatorio para rechazar'); return }
    setProcesando(key)
    const upd = { estado: 'rechazado', comentario, fecha_emision: null, fecha_vencimiento: null, fechas_bloqueadas: false }
    const { error } = await supabase.from(tabla).update(upd).eq('id', doc.id)
    if (error) { alert('Error: ' + error.message); setProcesando(null); return }
    await supabase.from('notificaciones').insert({ proveedor_id: seleccionado.id, titulo: 'Documento rechazado', mensaje: `Tu documento "${doc.nombre}" fue rechazado: ${comentario}`, tipo: 'peligro', leida: false })
    const da = { ...doc, ...upd }
    if (tabla === 'documentos') setDocumentos(p => p.map(d => d.id === doc.id ? da : d))
    else if (tabla === 'documentos_conductor') setDocsConductor(p => p.map(d => d.id === doc.id ? da : d))
    else if (tabla === 'documentos_unidad') setDocsUnidad(p => p.map(d => d.id === doc.id ? da : d))
    setProcesando(null)
  }, [seleccionado])

  const actualizarEstadoProveedor = async (estado: string) => {
    const upd: any = { estado }
    if (estado === 'homologado') upd.fecha_homologacion = new Date().toISOString()
    await supabase.from('proveedores').update(upd).eq('id', seleccionado.id)
    await cargarProveedores()
    setSeleccionado({ ...seleccionado, ...upd })
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F0F2F5' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:'40px', height:'40px', border:'3px solid #EEEEEE', borderTopColor:'#C41230', borderRadius:'50%', margin:'0 auto 16px', animation:'spin 0.8s linear infinite' }} />
        <p style={{ color:'#999', fontSize:'13px', margin:0 }}>Cargando...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F0F2F5', fontFamily:"'Segoe UI', Roboto, sans-serif" }}>

      {/* Modal Reportes */}
      {mostrarReportes && (
        <ModalReportes proveedores={proveedores} onCerrar={() => setMostrarReportes(false)} />
      )}

      {/* NAV */}
      <nav style={{ background:'#0F1923', padding:'0 28px', height:'56px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px', cursor:'pointer' }} onClick={() => setVista('dashboard')}>
          <img src="/LogoOmni.png" alt="Omni" style={{ height:'28px', filter:'brightness(0) invert(1)' }} />
          <div style={{ width:'1px', height:'18px', background:'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.8)', fontWeight:500 }}>Panel del evaluador</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <BotonHub />
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize:'12px', color:'rgba(255,255,255,0.5)', background:'none', border:'none', cursor:'pointer', padding:'6px 8px' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height:'3px', background:'#C41230' }} />

      {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
      {vista === 'dashboard' && (
        <div>
          {/* Hero navy + KPIs */}
          <div style={{ background:'#0F1923' }}>
            <div style={{ maxWidth:'960px', margin:'0 auto', padding:'36px 32px 0' }}>
              <h1 style={{ fontSize:'22px', fontWeight:800, color:'white', margin:'0 0 4px' }}>Panel de homologación</h1>
              <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.45)', margin:0 }}>
                {new Date().toLocaleDateString('es-PE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', marginTop:'28px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
                {[
                  { label:'Total registrados', valor: proveedores.length },
                  { label:'Pendientes',         valor: pendientes.length },
                  { label:'Homologados',        valor: homologados.length },
                  { label:'Nuevos elementos',   valor: conNuevosElem.length },
                ].map((kpi, i) => (
                  <div key={kpi.label} style={{ padding:'20px 24px', borderTop: i===0 ? '3px solid #C41230' : '3px solid transparent', borderRight: i<3 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                    <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.08em', margin:'0 0 6px', fontWeight:600 }}>{kpi.label}</p>
                    <p style={{ fontSize:'28px', fontWeight:800, color:'white', margin:0, lineHeight:1 }}>{kpi.valor}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ maxWidth:'960px', margin:'0 auto', padding:'28px 32px' }}>

            {/* 3 cards de acceso */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'28px' }}>

              {/* Evaluación */}
              <div onClick={() => setVista('evaluacion')}
                style={{ background:'white', borderRadius:'14px', border:'1px solid #E8ECF0', borderTop:'3px solid #C41230', padding:'20px', cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', transition:'all 0.15s' }}
                onMouseEnter={(e: any) => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(196,18,48,0.12)'; e.currentTarget.style.border='1px solid #C41230'; e.currentTarget.style.borderTop='3px solid #C41230' }}
                onMouseLeave={(e: any) => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.border='1px solid #E8ECF0'; e.currentTarget.style.borderTop='3px solid #C41230' }}>
                <div style={{ width:'40px', height:'40px', background:'#FEF2F2', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', marginBottom:'12px' }}>📋</div>
                <p style={{ fontSize:'14px', fontWeight:700, color: T, margin:'0 0 4px' }}>Evaluación</p>
                <p style={{ fontSize:'12px', color: T2, margin:'0 0 20px' }}>Revisar y aprobar proveedores</p>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  {pendientesPortal.length + nuevosElemPortal.length > 0
                    ? <span style={{ fontSize:'10px', fontWeight:700, background:'#FFF3E0', color:'#E65100', padding:'3px 10px', borderRadius:'20px', border:'1px solid #FFCC80' }}>{pendientesPortal.length + nuevosElemPortal.length} requieren atención</span>
                    : <span style={{ fontSize:'10px', fontWeight:600, background:'#E8F5E9', color:'#2E7D32', padding:'3px 10px', borderRadius:'20px' }}>Al día ✓</span>}
                  <span style={{ color:'#C41230', fontWeight:700, fontSize:'16px' }}>→</span>
                </div>
              </div>

              {/* Usuarios */}
              <a href="/evaluador/usuarios" style={{ textDecoration:'none' }}>
                <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E8ECF0', borderTop:'3px solid #0F1923', padding:'20px', cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', transition:'all 0.15s', height:'100%', boxSizing:'border-box' as any }}
                  onMouseEnter={(e: any) => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(15,25,35,0.12)'; e.currentTarget.style.border='1px solid #0F1923'; e.currentTarget.style.borderTop='3px solid #0F1923' }}
                  onMouseLeave={(e: any) => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.border='1px solid #E8ECF0'; e.currentTarget.style.borderTop='3px solid #0F1923' }}>
                  <div style={{ width:'40px', height:'40px', background:'#F0F2F5', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', marginBottom:'12px' }}>👤</div>
                  <p style={{ fontSize:'14px', fontWeight:700, color: T, margin:'0 0 4px' }}>Usuarios</p>
                  <p style={{ fontSize:'12px', color: T2, margin:'0 0 20px' }}>Crear y gestionar proveedores</p>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'10px', color: T2, fontWeight:500 }}>Crear cuentas proveedor</span>
                    <span style={{ color: T, fontWeight:700, fontSize:'16px' }}>→</span>
                  </div>
                </div>
              </a>

              {/* Reportes — ahora funcional */}
              <div onClick={() => setMostrarReportes(true)}
                style={{ background:'white', borderRadius:'14px', border:'1px solid #E8ECF0', borderTop:'3px solid #8A9BB0', padding:'20px', cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', transition:'all 0.15s' }}
                onMouseEnter={(e: any) => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(138,155,176,0.2)'; e.currentTarget.style.border='1px solid #8A9BB0'; e.currentTarget.style.borderTop='3px solid #8A9BB0' }}
                onMouseLeave={(e: any) => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'; e.currentTarget.style.border='1px solid #E8ECF0'; e.currentTarget.style.borderTop='3px solid #8A9BB0' }}>
                <div style={{ width:'40px', height:'40px', background:'#F0F2F5', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', marginBottom:'12px' }}>📊</div>
                <p style={{ fontSize:'14px', fontWeight:700, color: T, margin:'0 0 4px' }}>Reportes</p>
                <p style={{ fontSize:'12px', color: T2, margin:'0 0 20px' }}>Exportar y descargar reportes</p>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'10px', fontWeight:600, background:'#F0F2F5', color: T2, padding:'3px 10px', borderRadius:'20px' }}>⬇️ Excel disponible</span>
                  <span style={{ color: T2, fontWeight:700, fontSize:'16px' }}>→</span>
                </div>
              </div>
            </div>

            {/* Requieren atención */}
            {requierenAtencion.length > 0 && (
              <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', marginBottom:'20px' }}>
                <div style={{ padding:'14px 24px', borderBottom:'1px solid #F0F2F5', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#C41230' }} />
                    <p style={{ fontSize:'13px', fontWeight:700, color: T, margin:0 }}>Requieren atención</p>
                    <span style={{ fontSize:'11px', fontWeight:700, background:'#FFEBEE', color:'#C41230', padding:'2px 8px', borderRadius:'20px' }}>{requierenAtencion.length}</span>
                  </div>
                  <button onClick={() => setVista('evaluacion')}
                    style={{ fontSize:'12px', fontWeight:600, color:'white', background:'#C41230', border:'none', borderRadius:'8px', padding:'6px 16px', cursor:'pointer' }}>
                    Ver todos →
                  </button>
                </div>
                {requierenAtencion.map((p: any, i: number) => {
                  const esNE = p.estado === 'homologado' && proveedoresConPendientes.has(p.id)
                  const esP  = p.estado === 'pendiente'
                  return (
                    <div key={p.id} onClick={() => { seleccionarProveedor(p); setVista('evaluacion') }}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 24px', borderBottom: i < requierenAtencion.length-1 ? '1px solid #F5F7FA' : 'none', cursor:'pointer', background:'white' }}
                      onMouseEnter={(e: any) => e.currentTarget.style.background='#F5F7FA'}
                      onMouseLeave={(e: any) => e.currentTarget.style.background='white'}>
                      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                        <div style={{ width:'36px', height:'36px', borderRadius:'10px', background: esP ? '#FFF3E0' : '#FFF8E1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>
                          {esP ? '⏳' : '⚠️'}
                        </div>
                        <div>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'2px' }}>
                            <span style={{ fontSize:'13px', fontWeight:600, color: T }}>{p.razon_social}</span>
                            {p.urgente && <span style={{ fontSize:'9px', fontWeight:700, background:'#FFEBEE', color:'#B71C1C', padding:'2px 7px', borderRadius:'20px', border:'1px solid #EF9A9A' }}>🚨 URGENTE</span>}
                            {esNE && <span style={{ fontSize:'9px', fontWeight:700, background:'#FFF8E1', color:'#F57F17', padding:'2px 7px', borderRadius:'20px', border:'1px solid #FFE082' }}>⚠️ Nuevos elementos</span>}
                          </div>
                          <span style={{ fontSize:'11px', color: T2 }}>
                            RUC {p.ruc}{esP && ` · Registrado ${new Date(p.created_at).toLocaleDateString('es-PE')}`}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize:'12px', color:'#C41230', fontWeight:600 }}>Revisar →</span>
                    </div>
                  )
                })}
                {pendientesPortal.length + nuevosElemPortal.length > 5 && (
                  <div style={{ padding:'12px 24px', background:'#FAFBFC', borderTop:'1px solid #F0F2F5', textAlign:'center' }}>
                    <button onClick={() => setVista('evaluacion')} style={{ fontSize:'12px', color:'#C41230', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                      Ver {pendientesPortal.length + nuevosElemPortal.length - 5} más →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Últimos homologados */}
            <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ padding:'14px 24px', borderBottom:'1px solid #F0F2F5', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={{ fontSize:'13px', fontWeight:700, color: T, margin:0 }}>Últimos homologados</p>
                <button onClick={() => { setFiltroEstado('homologado'); setVista('evaluacion') }}
                  style={{ fontSize:'11px', color:'#C41230', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Ver todos →</button>
              </div>
              {ultimosHomologados.length === 0
                ? <p style={{ fontSize:'12px', color:'#BCC6D0', textAlign:'center', padding:'32px', margin:0 }}>Sin proveedores homologados aún</p>
                : ultimosHomologados.map((p: any, i: number) => (
                  <div key={p.id} onClick={() => { seleccionarProveedor(p); setVista('evaluacion') }}
                    style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 24px', borderBottom: i < ultimosHomologados.length-1 ? '1px solid #F5F7FA' : 'none', cursor:'pointer' }}
                    onMouseEnter={(e: any) => e.currentTarget.style.background='#F5F7FA'}
                    onMouseLeave={(e: any) => e.currentTarget.style.background='white'}>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'#E8F5E9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', flexShrink:0 }}>✅</div>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'1px' }}>
                          <span style={{ fontSize:'13px', fontWeight:600, color: T }}>{p.razon_social}</span>
                          {proveedoresConPendientes.has(p.id) && <span style={{ fontSize:'9px', fontWeight:700, background:'#FFF8E1', color:'#F57F17', padding:'2px 7px', borderRadius:'20px', border:'1px solid #FFE082' }}>⚠️ Nuevo</span>}
                        </div>
                        <span style={{ fontSize:'11px', color: T2 }}>
                          RUC {p.ruc}{p.fecha_homologacion && ` · Homologado ${new Date(p.fecha_homologacion).toLocaleDateString('es-PE')}`}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize:'10px', fontWeight:700, padding:'3px 10px', borderRadius:'20px', background:'#E8F5E9', color:'#2E7D32' }}>Homologado</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── EVALUACIÓN ────────────────────────────────────────────────────── */}
      {vista === 'evaluacion' && (
        <div style={{ display:'flex', height:'calc(100vh - 59px)' }}>

          {/* Lista izquierda */}
          <div style={{ width:'280px', minWidth:'280px', background:'white', borderRight:'1px solid #E8ECF0', overflowY:'auto', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid #F0F2F5' }}>
              <button onClick={() => setVista('dashboard')}
                style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color: T2, background:'none', border:'none', cursor:'pointer', padding:'4px 0', fontWeight:500 }}>
                ← Volver al dashboard
              </button>
            </div>
            <div style={{ padding:'12px', borderBottom:'1px solid #F0F2F5' }}>
              <input type="text" placeholder="Buscar por nombre o RUC..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                style={{ width:'100%', padding:'8px 12px', border:'1.5px solid #E8ECF0', borderRadius:'8px', fontSize:'12px', outline:'none', marginBottom:'8px', boxSizing:'border-box' as any, color: T }} />
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                style={{ width:'100%', padding:'7px 12px', border:'1.5px solid #E8ECF0', borderRadius:'8px', fontSize:'12px', outline:'none', background:'white', color: T }}>
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="homologado">Homologados</option>
                <option value="rechazado">Rechazados</option>
              </select>
            </div>
            <div style={{ padding:'8px 14px', borderBottom:'1px solid #F0F2F5' }}>
              <p style={{ fontSize:'11px', color: T2, margin:0, fontWeight:500 }}>{proveedoresFiltrados.length} proveedores</p>
            </div>
            <div style={{ flex:1, overflowY:'auto' }}>
              {proveedoresFiltrados.length === 0
                ? <p style={{ fontSize:'12px', color: T2, textAlign:'center', padding:'24px', margin:0 }}>Sin resultados</p>
                : proveedoresFiltrados.map((prov: any) => {
                  const badge = estadoBadge[prov.estado] || estadoBadge.pendiente
                  const tieneNuevos = proveedoresConPendientes.has(prov.id)
                  return (
                    <div key={prov.id} onClick={() => seleccionarProveedor(prov)}
                      style={{ padding:'12px 16px', borderBottom:'1px solid #F5F7FA', cursor:'pointer', background: seleccionado?.id===prov.id ? '#FEF2F2' : tieneNuevos ? '#FFFDE7' : 'white', borderLeft: seleccionado?.id===prov.id ? '3px solid #C41230' : tieneNuevos ? '3px solid #F57F17' : '3px solid transparent' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                        <p style={{ fontSize:'12px', fontWeight:600, color: T, margin:0 }}>{prov.razon_social}</p>
                        {prov.urgente && <span style={{ fontSize:'8px', fontWeight:700, background:'#FFEBEE', color:'#B71C1C', padding:'1px 5px', borderRadius:'4px' }}>🚨</span>}
                      </div>
                      <p style={{ fontSize:'11px', color: T2, margin:'0 0 6px' }}>RUC {prov.ruc}</p>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'20px', background:badge.bg, color:badge.color }}>
                          {estadoTexto[prov.estado] || 'Pendiente'}
                        </span>
                        {tieneNuevos && <span style={{ fontSize:'9px', fontWeight:700, background:'#FFF8E1', color:'#F57F17', padding:'2px 7px', borderRadius:'20px', border:'1px solid #FFE082' }}>⚠️ Nuevo</span>}
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>

          {/* Panel derecho */}
          <div style={{ flex:1, overflowY:'auto', padding:'24px', background:'#F0F2F5' }}>
            {!seleccionado ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
                <div style={{ textAlign:'center' }}>
                  <p style={{ fontSize:'32px', margin:'0 0 12px' }}>🏢</p>
                  <p style={{ fontSize:'14px', color: T2, margin:'0 0 6px', fontWeight:600 }}>Selecciona un proveedor para revisar</p>
                  <p style={{ fontSize:'12px', color:'#BCC6D0', margin:0 }}>Haz clic en cualquier proveedor de la lista</p>
                </div>
              </div>
            ) : (
              <div style={{ maxWidth:'720px' }}>
                {/* Cabecera proveedor */}
                <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E8ECF0', padding:'20px 24px', marginBottom:'16px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'14px' }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                        <h2 style={{ fontSize:'16px', fontWeight:800, color: T, margin:0 }}>{seleccionado.razon_social}</h2>
                        {seleccionado.urgente && <span style={{ fontSize:'10px', fontWeight:700, background:'#FFEBEE', color:'#B71C1C', padding:'3px 10px', borderRadius:'20px', border:'1px solid #EF9A9A' }}>🚨 URGENTE</span>}
                        {proveedoresConPendientes.has(seleccionado.id) && <span style={{ fontSize:'10px', fontWeight:700, background:'#FFF8E1', color:'#F57F17', padding:'3px 10px', borderRadius:'20px', border:'1px solid #FFE082' }}>⚠️ Nuevos elementos</span>}
                      </div>
                      <p style={{ fontSize:'12px', color: T2, margin:0 }}>RUC {seleccionado.ruc}</p>
                    </div>
                    <span style={{ fontSize:'11px', fontWeight:700, padding:'4px 12px', borderRadius:'20px', background:(estadoBadge[seleccionado.estado]||estadoBadge.pendiente).bg, color:(estadoBadge[seleccionado.estado]||estadoBadge.pendiente).color }}>
                      {estadoTexto[seleccionado.estado] || 'Pendiente'}
                    </span>
                  </div>
                  <div style={{ background:'#F8F9FA', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', gap:'24px', flexWrap:'wrap' as any }}>
                      <div>
                        <span style={{ fontSize:'10px', color: T2, display:'block', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Tipo de proveedor</span>
                        <span style={{ fontSize:'13px', fontWeight:600, color: T }}>{tipoProveedor}</span>
                      </div>
                      {almacenes.length > 0 && (
                        <div>
                          <span style={{ fontSize:'10px', color: T2, display:'block', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'4px' }}>Almacenes con acceso</span>
                          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' as any }}>
                            {almacenes.map((a: any) => <span key={a.nombre} style={{ fontSize:'11px', background:'#E8F5E9', color:'#2E7D32', padding:'2px 8px', borderRadius:'20px', border:'1px solid #A5D6A7' }}>{a.nombre}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' as any }}>
                    <button onClick={() => actualizarEstadoProveedor('homologado')} style={{ background:'#C41230', color:'white', fontSize:'12px', fontWeight:600, padding:'8px 18px', borderRadius:'8px', border:'none', cursor:'pointer' }}>✅ Homologar proveedor</button>
                    <button onClick={() => actualizarEstadoProveedor('rechazado')} style={{ background:'#FFEBEE', color:'#B71C1C', fontSize:'12px', fontWeight:600, padding:'8px 18px', borderRadius:'8px', border:'1px solid #EF9A9A', cursor:'pointer' }}>❌ Rechazar proveedor</button>
                    <button onClick={() => actualizarEstadoProveedor('pendiente')} style={{ background:'#F0F2F5', color: T2, fontSize:'12px', padding:'8px 18px', borderRadius:'8px', border:'1px solid #E8ECF0', cursor:'pointer' }}>Marcar pendiente</button>
                  </div>
                </div>

                {/* Documentos empresa */}
                {documentos.length > 0 && (
                  <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E8ECF0', padding:'18px 24px', marginBottom:'14px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ fontSize:'13px', fontWeight:700, color: T, margin:'0 0 14px' }}>📄 Documentos de la empresa</h3>
                    {documentos.map((doc: any) => (
                      <FilaDoc key={doc.id} doc={doc} tabla="documentos" tieneVencimiento={DOCS_CON_VENCIMIENTO.includes(doc.nombre)} keyPrefix={`empresa-${doc.proveedor_id}`} procesando={procesando} onAprobar={aprobarDoc} onRechazar={rechazarDoc} onVerDoc={verDocumento} />
                    ))}
                  </div>
                )}

                {/* Conductores */}
                {conductores.length > 0 && (
                  <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E8ECF0', padding:'18px 24px', marginBottom:'14px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ fontSize:'13px', fontWeight:700, color: T, margin:'0 0 14px' }}>👤 Conductores</h3>
                    {conductores.map((c: any) => (
                      <div key={c.id} style={{ marginBottom:'16px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px', padding:'8px 12px', background: c.pendiente_revision ? '#FFF8E1' : '#F8F9FA', borderRadius:'8px', border: c.pendiente_revision ? '1px solid #FFE082' : '1px solid transparent' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                            <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'#C41230', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:700, flexShrink:0 }}>{c.nombre_completo.charAt(0)}</div>
                            <div>
                              <span style={{ fontSize:'13px', fontWeight:600, color: T }}>{c.nombre_completo}</span>
                              {c.pendiente_revision && <span style={{ fontSize:'9px', fontWeight:700, background:'#FFF8E1', color:'#F57F17', padding:'2px 7px', borderRadius:'20px', border:'1px solid #FFE082', marginLeft:'8px' }}>⚠️ NUEVO</span>}
                            </div>
                          </div>
                          {c.pendiente_revision && (
                            <button onClick={() => marcarElementoRevisado('conductores', c.id)}
                              style={{ fontSize:'10px', color:'#2E7D32', background:'#E8F5E9', border:'1px solid #A5D6A7', borderRadius:'6px', padding:'3px 10px', cursor:'pointer', fontWeight:600 }}>
                              ✓ Marcar revisado
                            </button>
                          )}
                        </div>
                        {docsConductor.filter((d: any) => d.conductor_id === c.id).map((doc: any) => (
                          <FilaDoc key={doc.id} doc={doc} tabla="documentos_conductor" tieneVencimiento={DOCS_CON_VENCIMIENTO.includes(doc.nombre)} keyPrefix={`conductor-${c.id}`} procesando={procesando} onAprobar={aprobarDoc} onRechazar={rechazarDoc} onVerDoc={verDocumento} />
                        ))}
                        {docsConductor.filter((d: any) => d.conductor_id === c.id).length === 0 && (
                          <p style={{ fontSize:'11px', color:'#BCC6D0', marginLeft:'38px' }}>Sin documentos cargados aún</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Unidades */}
                {unidades.length > 0 && (
                  <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E8ECF0', padding:'18px 24px', marginBottom:'14px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                    <h3 style={{ fontSize:'13px', fontWeight:700, color: T, margin:'0 0 14px' }}>🚛 Unidades vehiculares</h3>
                    {unidades.map((u: any) => (
                      <div key={u.id} style={{ marginBottom:'16px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px', padding:'8px 12px', background: u.pendiente_revision ? '#FFF8E1' : '#F8F9FA', borderRadius:'8px', border: u.pendiente_revision ? '1px solid #FFE082' : '1px solid transparent' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                            <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'#8A9BB0', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', flexShrink:0 }}>🚛</div>
                            <div>
                              <span style={{ fontSize:'13px', fontWeight:600, color: T }}>Placa: {u.placa}</span>
                              {u.tipo && <span style={{ fontSize:'11px', color: T2, marginLeft:'8px' }}>{u.tipo}</span>}
                              {u.pendiente_revision && <span style={{ fontSize:'9px', fontWeight:700, background:'#FFF8E1', color:'#F57F17', padding:'2px 7px', borderRadius:'20px', border:'1px solid #FFE082', marginLeft:'8px' }}>⚠️ NUEVO</span>}
                            </div>
                          </div>
                          {u.pendiente_revision && (
                            <button onClick={() => marcarElementoRevisado('unidades', u.id)}
                              style={{ fontSize:'10px', color:'#2E7D32', background:'#E8F5E9', border:'1px solid #A5D6A7', borderRadius:'6px', padding:'3px 10px', cursor:'pointer', fontWeight:600 }}>
                              ✓ Marcar revisado
                            </button>
                          )}
                        </div>
                        {docsUnidad.filter((d: any) => d.unidad_id === u.id).map((doc: any) => (
                          <FilaDoc key={doc.id} doc={doc} tabla="documentos_unidad" tieneVencimiento={DOCS_CON_VENCIMIENTO.includes(doc.nombre)} keyPrefix={`unidad-${u.id}`} procesando={procesando} onAprobar={aprobarDoc} onRechazar={rechazarDoc} onVerDoc={verDocumento} />
                        ))}
                        {docsUnidad.filter((d: any) => d.unidad_id === u.id).length === 0 && (
                          <p style={{ fontSize:'11px', color:'#BCC6D0', marginLeft:'38px' }}>Sin documentos cargados aún</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {documentos.length === 0 && conductores.length === 0 && unidades.length === 0 && (
                  <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E8ECF0', padding:'48px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                    <p style={{ fontSize:'28px', margin:'0 0 12px' }}>📭</p>
                    <p style={{ fontSize:'13px', color: T2, margin:0 }}>Este proveedor aún no ha cargado documentos</p>
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
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#F0F2F5' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:'40px', height:'40px', border:'3px solid #EEEEEE', borderTopColor:'#C41230', borderRadius:'50%', margin:'0 auto 16px', animation:'spin 0.8s linear infinite' }} />
          <p style={{ color:'#999', fontSize:'13px', margin:0 }}>Cargando...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <EvaluadorContent />
    </Suspense>
  )
}