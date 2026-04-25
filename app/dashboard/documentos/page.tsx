'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Notificaciones from '../../components/Notificaciones'

const DOCS_FORMATOS: { [key: string]: string } = {
  'Registro de proveedores': '/Registro_de_Proveedores.xlsx',
  'Acuerdo de seguridad': '/Acuerdo_de_Seguridad.docx',
  'Declaración jurada de licitud': '/Declaracion_Jurada_Licitud.docx',
  'Datos de beneficiarios finales': '/DJ_Beneficiario_Final.docx',
  'Acuerdo de confidencialidad': '/Acuerdo_Confidencialidad.docx',
}

const DOCS_INFORMATIVOS = [
  { nombre: 'Carta de Compromiso', archivo: '/Carta_Compromiso.pdf', desc: 'Leer antes de iniciar' },
  { nombre: 'Cartilla BASC', archivo: '/Cartilla_Seguridad_OMNI.pdf', desc: 'Sistema de seguridad' },
]

const DOCS_CONDUCTOR = [
  'Licencia de conducir',
  'Antecedentes penales y policiales',
  'SCTR',
]

const DOCS_UNIDAD = [
  'SOAT',
  'Revision tecnica',
  'Tarjeta de propiedad',
  'Mantenimiento preventivo',
  'Poliza de seguros contra terceros',
]

const TIPOS_UNIDAD = [
  'Furgón', 'Semitrailer', 'Trailer', 'Cisterna',
  'Volquete', 'Camión baranda', 'Cama baja', 'Cama cuna', 'Otro',
]

const diasParaVencer = (fechaVencimiento: string | null) => {
  if (!fechaVencimiento) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const vence = new Date(fechaVencimiento); vence.setHours(0, 0, 0, 0)
  return Math.ceil((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

const puedeReemplazar = (doc: any) => {
  if (!doc) return true
  if (doc.estado === 'rechazado') return true
  if (doc.estado === 'pendiente') return true
  if (doc.estado !== 'aprobado') return true
  if (!doc.fecha_vencimiento) return false
  const dias = diasParaVencer(doc.fecha_vencimiento)
  return dias !== null && dias <= 5
}

export default function DocumentosPage() {
  const router = useRouter()
  const [proveedor, setProveedor] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [conductores, setConductores] = useState<any[]>([])
  const [unidades, setUnidades] = useState<any[]>([])
  const [docsConductor, setDocsConductor] = useState<any[]>([])
  const [docsUnidad, setDocsUnidad] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [nuevoConductor, setNuevoConductor] = useState('')
  const [nuevaPlaca, setNuevaPlaca] = useState('')
  const [nuevoTipoUnidad, setNuevoTipoUnidad] = useState('Semitrailer')
  const [agregandoConductor, setAgregandoConductor] = useState(false)
  const [agregandoUnidad, setAgregandoUnidad] = useState(false)
  const [docsRequeridos, setDocsRequeridos] = useState<any[]>([])
  const [necesitaConductores, setNecesitaConductores] = useState(false)
  const [necesitaUnidades, setNecesitaUnidades] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prov } = await supabase.from('proveedores').select('*').eq('user_id', user.id).single()
    if (!prov) { router.push('/login'); return }
    setProveedor(prov)

    const { data: tiposProv } = await supabase.from('proveedor_tipos').select('tipo_id').eq('proveedor_id', prov.id)

    let docsReq: any[] = []
    if (tiposProv && tiposProv.length > 0) {
      const tipoIds = tiposProv.map((t: any) => t.tipo_id)
      const { data: docs } = await supabase.from('documentos_requeridos').select('*').in('tipo_proveedor_id', tipoIds).eq('activo', true)
      const nombresVistos = new Set()
      docsReq = (docs || []).filter((d: any) => { if (nombresVistos.has(d.nombre)) return false; nombresVistos.add(d.nombre); return true })
    } else if (prov.tipo_id) {
      const { data: docs } = await supabase.from('documentos_requeridos').select('*').eq('tipo_proveedor_id', prov.tipo_id).eq('activo', true)
      docsReq = docs || []
    }

    setDocsRequeridos(docsReq)
    const nombresDocs = docsReq.map((d: any) => d.nombre)
    setNecesitaConductores(DOCS_CONDUCTOR.some(d => nombresDocs.includes(d)))
    setNecesitaUnidades(DOCS_UNIDAD.some(d => nombresDocs.includes(d)))

    const { data: docs } = await supabase.from('documentos').select('*').eq('proveedor_id', prov.id)
    setDocumentos(docs || [])

    const { data: conds } = await supabase.from('conductores').select('*').eq('proveedor_id', prov.id).eq('activo', true)
    setConductores(conds || [])

    const { data: units } = await supabase.from('unidades').select('*').eq('proveedor_id', prov.id).eq('activo', true)
    setUnidades(units || [])

    if (conds && conds.length > 0) {
      const { data: dc } = await supabase.from('documentos_conductor').select('*').in('conductor_id', conds.map((c: any) => c.id))
      setDocsConductor(dc || [])
    }

    if (units && units.length > 0) {
      const { data: du } = await supabase.from('documentos_unidad').select('*').in('unidad_id', units.map((u: any) => u.id))
      setDocsUnidad(du || [])
    }

    setLoading(false)
  }

  const notificarEvaluador = async (nombreDoc: string, esActualizacion: boolean) => {
    if (!proveedor) return
    const hoyInicio = new Date(); hoyInicio.setHours(0, 0, 0, 0)
    const mensaje = esActualizacion
      ? `${proveedor.razon_social} actualizó "${nombreDoc}"`
      : `${proveedor.razon_social} subió "${nombreDoc}"`
    const { data: yaHoy } = await supabase.from('notificaciones').select('id').eq('proveedor_id', proveedor.id).eq('mensaje', mensaje).gte('created_at', hoyInicio.toISOString())
    if (!yaHoy || yaHoy.length === 0) {
      await supabase.from('notificaciones').insert({
        proveedor_id: proveedor.id,
        titulo: esActualizacion ? 'Documento actualizado' : 'Nuevo documento cargado',
        mensaje, tipo: 'info', leida: false,
        link: `/evaluador?proveedor=${proveedor.id}`,
      })
    }
  }

  const agregarConductor = async () => {
    if (!nuevoConductor.trim() || !proveedor) return
    setAgregandoConductor(true)
    await supabase.from('conductores').insert({ proveedor_id: proveedor.id, nombre_completo: nuevoConductor.trim() })
    setNuevoConductor('')
    setAgregandoConductor(false)
    await cargarDatos()
  }

  const eliminarConductor = async (id: string) => {
    if (!confirm('¿Deseas eliminar este conductor y todos sus documentos?')) return
    await supabase.from('documentos_conductor').delete().eq('conductor_id', id)
    await supabase.from('conductores').update({ activo: false }).eq('id', id)
    await cargarDatos()
  }

  const agregarUnidad = async () => {
    if (!nuevaPlaca.trim() || !proveedor) return
    setAgregandoUnidad(true)
    await supabase.from('unidades').insert({ proveedor_id: proveedor.id, placa: nuevaPlaca.trim().toUpperCase(), tipo: nuevoTipoUnidad })
    setNuevaPlaca('')
    setNuevoTipoUnidad('Semitrailer')
    setAgregandoUnidad(false)
    await cargarDatos()
  }

  const eliminarUnidad = async (id: string) => {
    if (!confirm('¿Deseas eliminar esta unidad y todos sus documentos?')) return
    await supabase.from('documentos_unidad').delete().eq('unidad_id', id)
    await supabase.from('unidades').update({ activo: false }).eq('id', id)
    await cargarDatos()
  }

  const subirDoc = async (tabla: string, nombreDoc: string, archivo: File, campoId: string, valorId: string, docExistente: any) => {
    if (docExistente && !puedeReemplazar(docExistente)) return
    const key = campoId === 'proveedor_id' ? nombreDoc : `${valorId}-${nombreDoc}`
    setSubiendo(key)
    const ext = archivo.name.split('.').pop()
    const carpeta = campoId === 'proveedor_id' ? 'empresa' : tabla
    const ruta = `${proveedor.id}/${carpeta}/${valorId}/${nombreDoc.replace(/\s/g, '_')}.${ext}`
    const { error: uploadError } = await supabase.storage.from('documentos').upload(ruta, archivo, { upsert: true })
    if (uploadError) { alert('Error al subir: ' + uploadError.message); setSubiendo(null); return }
    const nuevoDoc = { nombre: nombreDoc, url: ruta, estado: 'pendiente', fecha_emision: null, fecha_vencimiento: null, fechas_bloqueadas: false, comentario: null }
    if (docExistente) {
      await supabase.from(tabla).update(nuevoDoc).eq('id', docExistente.id)
      if (tabla === 'documentos') setDocumentos(prev => prev.map(d => d.id === docExistente.id ? { ...d, ...nuevoDoc } : d))
      else if (tabla === 'documentos_conductor') setDocsConductor(prev => prev.map(d => d.id === docExistente.id ? { ...d, ...nuevoDoc } : d))
      else if (tabla === 'documentos_unidad') setDocsUnidad(prev => prev.map(d => d.id === docExistente.id ? { ...d, ...nuevoDoc } : d))
      await notificarEvaluador(nombreDoc, true)
    } else {
      const insertData: any = { ...nuevoDoc }
      insertData[campoId] = valorId
      if (tabla === 'documentos') insertData.tipo = 'empresa'
      const { data: inserted } = await supabase.from(tabla).insert(insertData).select().single()
      if (tabla === 'documentos') setDocumentos(prev => [...prev, inserted])
      else if (tabla === 'documentos_conductor') setDocsConductor(prev => [...prev, inserted])
      else if (tabla === 'documentos_unidad') setDocsUnidad(prev => [...prev, inserted])
      await notificarEvaluador(nombreDoc, false)
    }
    setSubiendo(null)
  }

  const docsEmpresa = docsRequeridos.filter((d: any) => !DOCS_CONDUCTOR.includes(d.nombre) && !DOCS_UNIDAD.includes(d.nombre))
  const docsConductorReq = docsRequeridos.filter((d: any) => DOCS_CONDUCTOR.includes(d.nombre))
  const docsUnidadReq = docsRequeridos.filter((d: any) => DOCS_UNIDAD.includes(d.nombre))

  const totalDocs = docsEmpresa.length + (conductores.length * docsConductorReq.length) + (unidades.length * docsUnidadReq.length)
  const docsSubidos = documentos.length + docsConductor.length + docsUnidad.length
  const progreso = totalDocs > 0 ? Math.round((docsSubidos / totalDocs) * 100) : 0

  const FilaDocumento = ({ label, tieneVencimiento, doc, onSubir, fechaKey, formato }: any) => {
    const estado = doc?.estado || null
    const estaSubiendo = subiendo === fechaKey
    const puede = puedeReemplazar(doc)
    const dias = doc?.fecha_vencimiento ? diasParaVencer(doc.fecha_vencimiento) : null

    const getBoton = () => {
      if (estaSubiendo) return { texto: 'Subiendo...', bg: '#F5F5F5', color: '#AAA', disabled: true }
      if (!estado) return { texto: '↑ Subir archivo', bg: '#C41230', color: 'white', disabled: false }
      if (estado === 'rechazado') return { texto: '↑ Subir de nuevo', bg: '#FFEBEE', color: '#B71C1C', border: '1px solid #EF9A9A', disabled: false }
      if (estado === 'pendiente') return { texto: '↺ Reemplazar', bg: '#FFF3E0', color: '#E65100', border: '1px solid #FFCC80', disabled: false }
      if (estado === 'aprobado' && puede) return { texto: '↺ Renovar', bg: '#C41230', color: 'white', disabled: false }
      return null
    }

    const boton = getBoton()

    const getBadge = () => {
      if (!estado) return null
      const badges: { [key: string]: { bg: string, color: string, texto: string } } = {
        pendiente: { bg: '#FFF3E0', color: '#E65100', texto: '⏳ En revisión' },
        aprobado:  { bg: '#E8F5E9', color: '#2E7D32', texto: '✅ Aprobado' },
        rechazado: { bg: '#FFEBEE', color: '#B71C1C', texto: '❌ Rechazado' },
      }
      return badges[estado] || null
    }

    const badge = getBadge()

    return (
      <div style={{ padding: '14px 0', borderBottom: '1px solid #F0F2F5' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as any, marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', color: '#0F1923', fontWeight: 600 }}>{label}</span>
              {tieneVencimiento && !estado && (
                <span style={{ fontSize: '10px', background: '#F0F2F5', color: '#8A9BB0', padding: '2px 8px', borderRadius: '20px' }}>Con vencimiento</span>
              )}
              {badge && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
                  {badge.texto}
                </span>
              )}
              {estado === 'aprobado' && dias !== null && dias <= 30 && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: dias <= 5 ? '#FFEBEE' : '#FFF3E0', color: dias <= 5 ? '#B71C1C' : '#E65100' }}>
                  {dias <= 0 ? '⚠ Vencido' : `⚠ Vence en ${dias} días`}
                </span>
              )}
            </div>
            {formato && !estado && (
              <a href={formato} download style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#1565C0', fontWeight: 600, textDecoration: 'none', background: '#E3F2FD', padding: '3px 10px', borderRadius: '6px' }}>
                ↓ Descargar formato
              </a>
            )}
            {doc?.fecha_emision && (
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '4px 0 0' }}>
                Emisión: {new Date(doc.fecha_emision).toLocaleDateString('es-PE')}
                {doc.fecha_vencimiento && ` · Vence: ${new Date(doc.fecha_vencimiento).toLocaleDateString('es-PE')}`}
              </p>
            )}
            {estado === 'rechazado' && doc?.comentario && (
              <p style={{ fontSize: '11px', color: '#B71C1C', margin: '4px 0 0', background: '#FFEBEE', padding: '4px 8px', borderRadius: '6px' }}>
                💬 {doc.comentario}
              </p>
            )}
          </div>
          <div style={{ flexShrink: 0 }}>
            {boton ? (
              <label style={{ cursor: boton.disabled ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600, padding: '7px 14px', borderRadius: '8px', background: boton.bg, color: boton.color, border: (boton as any).border || 'none', display: 'inline-block', opacity: boton.disabled ? 0.6 : 1 }}>
                {boton.texto}
                <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                  disabled={boton.disabled}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubir(f) }} />
              </label>
            ) : (
              <span style={{ fontSize: '12px', fontWeight: 600, padding: '7px 14px', borderRadius: '8px', background: '#E8F5E9', color: '#2E7D32', display: 'inline-block' }}>
                Vigente ✓
              </span>
            )}
          </div>
        </div>
      </div>
    )
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

  if (docsRequeridos.length === 0) return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/dashboard">
          <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
        </a>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 24px', textAlign: 'center' as any }}>
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', padding: '48px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <p style={{ fontSize: '32px', margin: '0 0 16px' }}>📋</p>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#0F1923', margin: '0 0 8px' }}>Primero selecciona tu tipo de proveedor</p>
          <p style={{ fontSize: '13px', color: '#8A9BB0', margin: '0 0 24px' }}>Para ver los documentos requeridos debes indicar el tipo de servicios que brinda tu empresa.</p>
          <a href="/dashboard/perfil" style={{ display: 'inline-block', padding: '12px 28px', background: '#C41230', color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
            Ir a Mi perfil →
          </a>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* NAV */}
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/dashboard">
            <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
          </a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <a href="/dashboard" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Inicio</a>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Mis documentos</span>
        </div>
        {proveedor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Notificaciones proveedorId={proveedor?.id} />
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{proveedor?.razon_social}</span>
          </div>
        )}
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Documentos informativos */}
        <div style={{ background: '#E3F2FD', borderRadius: '14px', padding: '16px 20px', border: '1px solid #90CAF9', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '16px' }}>ℹ️</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1565C0' }}>Documentos informativos — Lee antes de comenzar</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as any }}>
            {DOCS_INFORMATIVOS.map(doc => (
              <a key={doc.nombre} href={doc.archivo} download
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'white', border: '1px solid #90CAF9', borderRadius: '8px', padding: '8px 14px', textDecoration: 'none', color: '#1565C0', fontSize: '12px', fontWeight: 600 }}>
                ↓ {doc.nombre}
                <span style={{ fontSize: '10px', color: '#8A9BB0', fontWeight: 400 }}>· {doc.desc}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Progreso */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '18px 24px', border: '1px solid #E8ECF0', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923' }}>Progreso de documentación</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#C41230' }}>{docsSubidos} / {totalDocs} documentos · {progreso}%</span>
          </div>
          <div style={{ height: '8px', background: '#F0F2F5', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: progreso === 100 ? '#2E7D32' : '#C41230', borderRadius: '4px', width: `${progreso}%`, transition: 'width 0.5s' }} />
          </div>
        </div>

        {/* Documentos de la empresa */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '20px 24px', border: '1px solid #E8ECF0', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '36px', height: '36px', background: '#FFEBEE', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🏢</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Documentos de la empresa</h2>
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>{documentos.length} de {docsEmpresa.length} cargados</p>
            </div>
          </div>
          {docsEmpresa.map((doc: any) => {
            const docData = documentos.find(d => d.nombre === doc.nombre) || null
            return (
              <FilaDocumento key={doc.nombre} label={doc.nombre}
                tieneVencimiento={doc.tiene_vencimiento} fechaKey={doc.nombre}
                doc={docData} formato={DOCS_FORMATOS[doc.nombre] || null}
                onSubir={(f: File) => subirDoc('documentos', doc.nombre, f, 'proveedor_id', proveedor.id, docData)} />
            )
          })}
        </div>

        {/* Conductores */}
        {necesitaConductores && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '20px 24px', border: '1px solid #E8ECF0', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', background: '#F3E5F5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>👤</div>
              <div>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Conductores</h2>
                <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>{conductores.length} registrado{conductores.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input type="text" value={nuevoConductor} onChange={(e) => setNuevoConductor(e.target.value)}
                placeholder="Nombre completo del conductor"
                onKeyDown={(e) => e.key === 'Enter' && agregarConductor()}
                style={{ flex: 1, padding: '9px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#0F1923' }} />
              <button onClick={agregarConductor} disabled={agregandoConductor || !nuevoConductor.trim()}
                style={{ padding: '9px 18px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: agregandoConductor || !nuevoConductor.trim() ? 0.6 : 1 }}>
                {agregandoConductor ? '...' : '+ Agregar'}
              </button>
            </div>
            {conductores.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', background: '#F8F9FA', borderRadius: '10px' }}>
                <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>No hay conductores registrados aún</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {conductores.map((conductor: any) => (
                  <div key={conductor.id} style={{ border: '1px solid #E8ECF0', borderRadius: '12px', padding: '16px', background: '#FAFBFC' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#C41230', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 700 }}>
                          {conductor.nombre_completo.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923' }}>{conductor.nombre_completo}</span>
                      </div>
                      <button onClick={() => eliminarConductor(conductor.id)}
                        style={{ fontSize: '11px', color: '#B71C1C', background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                        Eliminar
                      </button>
                    </div>
                    {docsConductorReq.map((doc: any) => {
                      const key = `${conductor.id}-${doc.nombre}`
                      const docData = docsConductor.find(d => d.conductor_id === conductor.id && d.nombre === doc.nombre) || null
                      return (
                        <FilaDocumento key={doc.nombre} label={doc.nombre}
                          tieneVencimiento={doc.tiene_vencimiento} fechaKey={key}
                          doc={docData} formato={null}
                          onSubir={(f: File) => subirDoc('documentos_conductor', doc.nombre, f, 'conductor_id', conductor.id, docData)} />
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Unidades */}
        {necesitaUnidades && (
          <div style={{ background: 'white', borderRadius: '14px', padding: '20px 24px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', background: '#E0F7FA', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🚛</div>
              <div>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Unidades vehiculares</h2>
                <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>{unidades.length} registrada{unidades.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '16px' }}>
              <input type="text" value={nuevaPlaca} onChange={(e) => setNuevaPlaca(e.target.value)}
                placeholder="Placa (ej: ABC-123)"
                onKeyDown={(e) => e.key === 'Enter' && agregarUnidad()}
                style={{ padding: '9px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#0F1923' }} />
              <select value={nuevoTipoUnidad} onChange={(e) => setNuevoTipoUnidad(e.target.value)}
                style={{ padding: '9px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', color: '#0F1923' }}>
                {TIPOS_UNIDAD.map(t => <option key={t}>{t}</option>)}
              </select>
              <button onClick={agregarUnidad} disabled={agregandoUnidad || !nuevaPlaca.trim()}
                style={{ padding: '9px 18px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as any, opacity: agregandoUnidad || !nuevaPlaca.trim() ? 0.6 : 1 }}>
                {agregandoUnidad ? '...' : '+ Agregar'}
              </button>
            </div>
            {unidades.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', background: '#F8F9FA', borderRadius: '10px' }}>
                <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>No hay unidades registradas aún</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {unidades.map((unidad: any) => (
                  <div key={unidad.id} style={{ border: '1px solid #E8ECF0', borderRadius: '12px', padding: '16px', background: '#FAFBFC' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0F1923', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '14px' }}>🚛</div>
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923' }}>Placa: {unidad.placa}</span>
                          {unidad.tipo && <span style={{ fontSize: '11px', color: '#8A9BB0', marginLeft: '8px', background: '#F0F2F5', padding: '2px 8px', borderRadius: '20px' }}>{unidad.tipo}</span>}
                        </div>
                      </div>
                      <button onClick={() => eliminarUnidad(unidad.id)}
                        style={{ fontSize: '11px', color: '#B71C1C', background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                        Eliminar
                      </button>
                    </div>
                    {docsUnidadReq.map((doc: any) => {
                      const key = `${unidad.id}-${doc.nombre}`
                      const docData = docsUnidad.find(d => d.unidad_id === unidad.id && d.nombre === doc.nombre) || null
                      return (
                        <FilaDocumento key={doc.nombre} label={doc.nombre}
                          tieneVencimiento={doc.tiene_vencimiento} fechaKey={key}
                          doc={docData} formato={null}
                          onSubir={(f: File) => subirDoc('documentos_unidad', doc.nombre, f, 'unidad_id', unidad.id, docData)} />
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}