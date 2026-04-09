'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Notificaciones from '../../components/Notificaciones'

const DOCS_FORMATOS: { [key: string]: string } = {
  'Registro de proveedores': '/Registro_de_Proveedores.xlsx',
  'Acuerdo de seguridad': '/Acuerdo_de_Seguridad.docx',
  'Declaracion jurada de licitud': '/Declaracion_Jurada_Licitud.docx',
  'Datos de beneficiarios finales': '/DJ_Beneficiario_Final.docx',
  'Acuerdo de confidencialidad': '/Acuerdo_Confidencialidad.docx',
}

const DOCS_INFORMATIVOS = [
  { nombre: 'Carta de Compromiso', archivo: '/Carta_Compromiso.pdf', desc: 'Leer antes de iniciar el proceso' },
  { nombre: 'Cartilla Informativa de Seguridad BASC', archivo: '/Cartilla_Seguridad_OMNI.pdf', desc: 'Informacion sobre el sistema BASC' },
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
  'Certificado habilitacion vehicular MTC',
  'Certificado GPS',
  'Mantenimiento preventivo',
  'Poliza de seguros contra terceros',
]

const diasParaVencer = (fechaVencimiento: string | null) => {
  if (!fechaVencimiento) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vence = new Date(fechaVencimiento)
  vence.setHours(0, 0, 0, 0)
  return Math.ceil((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

const puedeReemplazar = (doc: any) => {
  if (!doc) return true
  if (doc.estado === 'rechazado') return true
  if (doc.estado === 'pendiente') return true
  if (doc.estado !== 'aprobado') return true
  if (!doc.fecha_vencimiento) return false
  const dias = diasParaVencer(doc.fecha_vencimiento)
  if (dias === null) return false
  return dias <= 5
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
  const [nuevaUnidad, setNuevaUnidad] = useState('')
  const [agregandoConductor, setAgregandoConductor] = useState(false)
  const [agregandoUnidad, setAgregandoUnidad] = useState(false)
  const [docsRequeridos, setDocsRequeridos] = useState<any[]>([])
  const [necesitaConductores, setNecesitaConductores] = useState(false)
  const [necesitaUnidades, setNecesitaUnidades] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prov } = await supabase
      .from('proveedores').select('*').eq('user_id', user.id).single()
    if (!prov) { router.push('/login'); return }
    setProveedor(prov)

    const { data: tiposProv } = await supabase
      .from('proveedor_tipos').select('tipo_id').eq('proveedor_id', prov.id)

    let docsReq: any[] = []

    if (tiposProv && tiposProv.length > 0) {
      const tipoIds = tiposProv.map((t: any) => t.tipo_id)
      const { data: docs } = await supabase
        .from('documentos_requeridos')
        .select('*')
        .in('tipo_proveedor_id', tipoIds)
        .eq('activo', true)

      const nombresVistos = new Set()
      docsReq = (docs || []).filter(d => {
        if (nombresVistos.has(d.nombre)) return false
        nombresVistos.add(d.nombre)
        return true
      })
    } else if (prov.tipo_id) {
      const { data: docs } = await supabase
        .from('documentos_requeridos')
        .select('*')
        .eq('tipo_proveedor_id', prov.tipo_id)
        .eq('activo', true)
      docsReq = docs || []
    }

    setDocsRequeridos(docsReq)

    const nombresDocs = docsReq.map(d => d.nombre)
    setNecesitaConductores(DOCS_CONDUCTOR.some(d => nombresDocs.includes(d)))
    setNecesitaUnidades(DOCS_UNIDAD.some(d => nombresDocs.includes(d)))

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

    setLoading(false)
  }

  const notificarEvaluador = async (nombreDoc: string, esActualizacion: boolean) => {
    if (!proveedor) return

    const hoyInicio = new Date()
    hoyInicio.setHours(0, 0, 0, 0)

    const titulo = esActualizacion ? 'Documento actualizado' : 'Nuevo documento cargado'
    const mensaje = esActualizacion
      ? `${proveedor.razon_social} actualizo "${nombreDoc}"`
      : `${proveedor.razon_social} subio "${nombreDoc}"`

    // Verificar si ya existe una notificacion de hoy por este mismo documento
    const { data: yaHoy } = await supabase
      .from('notificaciones')
      .select('id')
      .eq('proveedor_id', proveedor.id)
      .eq('mensaje', mensaje)
      .gte('created_at', hoyInicio.toISOString())

    if (!yaHoy || yaHoy.length === 0) {
      await supabase.from('notificaciones').insert({
        proveedor_id: proveedor.id,
        titulo,
        mensaje,
        tipo: 'info',
        leida: false,
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
    if (!confirm('Seguro que deseas eliminar este conductor y todos sus documentos?')) return
    await supabase.from('documentos_conductor').delete().eq('conductor_id', id)
    await supabase.from('conductores').update({ activo: false }).eq('id', id)
    await cargarDatos()
  }

  const agregarUnidad = async () => {
    if (!nuevaUnidad.trim() || !proveedor) return
    setAgregandoUnidad(true)
    await supabase.from('unidades').insert({ proveedor_id: proveedor.id, placa: nuevaUnidad.trim().toUpperCase() })
    setNuevaUnidad('')
    setAgregandoUnidad(false)
    await cargarDatos()
  }

  const eliminarUnidad = async (id: string) => {
    if (!confirm('Seguro que deseas eliminar esta unidad y todos sus documentos?')) return
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
      const { error } = await supabase.from(tabla).update(nuevoDoc).eq('id', docExistente.id)
      if (error) { alert('Error: ' + error.message); setSubiendo(null); return }
      if (tabla === 'documentos') setDocumentos(prev => prev.map(d => d.id === docExistente.id ? { ...d, ...nuevoDoc } : d))
      else if (tabla === 'documentos_conductor') setDocsConductor(prev => prev.map(d => d.id === docExistente.id ? { ...d, ...nuevoDoc } : d))
      else if (tabla === 'documentos_unidad') setDocsUnidad(prev => prev.map(d => d.id === docExistente.id ? { ...d, ...nuevoDoc } : d))
      await notificarEvaluador(nombreDoc, true)
    } else {
      const insertData: any = { ...nuevoDoc }
      insertData[campoId] = valorId
      if (tabla === 'documentos') insertData.tipo = 'empresa'
      const { data: inserted, error } = await supabase.from(tabla).insert(insertData).select().single()
      if (error) { alert('Error al guardar: ' + error.message); setSubiendo(null); return }
      if (tabla === 'documentos') setDocumentos(prev => [...prev, inserted])
      else if (tabla === 'documentos_conductor') setDocsConductor(prev => [...prev, inserted])
      else if (tabla === 'documentos_unidad') setDocsUnidad(prev => [...prev, inserted])
      await notificarEvaluador(nombreDoc, false)
    }
    setSubiendo(null)
  }

  const docsEmpresa = docsRequeridos.filter(d =>
    !DOCS_CONDUCTOR.includes(d.nombre) && !DOCS_UNIDAD.includes(d.nombre)
  )
  const docsConductorReq = docsRequeridos.filter(d => DOCS_CONDUCTOR.includes(d.nombre))
  const docsUnidadReq = docsRequeridos.filter(d => DOCS_UNIDAD.includes(d.nombre))

  const totalDocs = docsEmpresa.length +
    (conductores.length * docsConductorReq.length) +
    (unidades.length * docsUnidadReq.length)
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
      if (estado === 'rechazado') return { texto: '↑ Subir de nuevo', bg: '#FEF2F2', color: '#C41230', border: '1px solid #FECACA', disabled: false }
      if (estado === 'pendiente') return { texto: '↺ Reemplazar', bg: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', disabled: false }
      if (estado === 'aprobado' && puede) return { texto: '↺ Renovar', bg: '#C41230', color: 'white', disabled: false }
      return null
    }

    const boton = getBoton()

    const getBadge = () => {
      if (!estado) return null
      const badges: { [key: string]: { bg: string, color: string, texto: string } } = {
        pendiente: { bg: '#FFF7ED', color: '#C2410C', texto: 'En revision' },
        aprobado: { bg: '#F0FDF4', color: '#15803D', texto: 'Aprobado' },
        rechazado: { bg: '#FEF2F2', color: '#C41230', texto: 'Rechazado' },
      }
      return badges[estado] || null
    }

    const badge = getBadge()

    return (
      <div style={{ padding: '12px 0', borderBottom: '1px solid #F5F5F5' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>{label}</span>
              {tieneVencimiento && !estado && (
                <span style={{ fontSize: '11px', background: '#F5F5F5', color: '#888', padding: '2px 8px', borderRadius: '20px' }}>Con vencimiento</span>
              )}
              {badge && (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
                  {badge.texto}
                </span>
              )}
              {estado === 'aprobado' && dias !== null && dias <= 30 && (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: dias <= 5 ? '#FEF2F2' : '#FFF7ED', color: dias <= 5 ? '#C41230' : '#C2410C' }}>
                  {dias <= 0 ? 'Vencido' : `Vence en ${dias} dias`}
                </span>
              )}
            </div>
            {formato && !estado && (
              <a href={formato} download style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#185FA5', fontWeight: 600, marginTop: '5px', textDecoration: 'none', background: '#E6F1FB', padding: '3px 10px', borderRadius: '6px' }}>
                ↓ Descargar formato
              </a>
            )}
            {doc?.fecha_emision && (
              <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                Emision: {new Date(doc.fecha_emision).toLocaleDateString('es-PE')}
                {doc.fecha_vencimiento && ` · Vence: ${new Date(doc.fecha_vencimiento).toLocaleDateString('es-PE')}`}
              </p>
            )}
            {estado === 'rechazado' && doc?.comentario && (
              <p style={{ fontSize: '11px', color: '#C41230', marginTop: '4px' }}>Motivo: {doc.comentario}</p>
            )}
            {estado === 'aprobado' && !puede && (
              <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>Podras renovar cuando falten 5 dias o menos para el vencimiento</p>
            )}
          </div>
          <div style={{ flexShrink: 0 }}>
            {boton ? (
              <label style={{ cursor: boton.disabled ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 600, padding: '7px 14px', borderRadius: '7px', background: boton.bg, color: boton.color, border: (boton as any).border || 'none', display: 'inline-block', opacity: boton.disabled ? 0.6 : 1 }}>
                {boton.texto}
                <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                  disabled={boton.disabled || (estado === 'aprobado' && !puede)}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubir(f) }} />
              </label>
            ) : (
              <span style={{ fontSize: '12px', fontWeight: 600, padding: '7px 14px', borderRadius: '7px', background: '#F0FDF4', color: '#15803D' }}>
                Vigente
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
    </div>
  )

  if (docsRequeridos.length === 0) return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <a href="/dashboard" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>Dashboard</a>
          <span style={{ color: '#DDD' }}>›</span>
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Mis documentos</span>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '40px' }}>
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '8px' }}>Primero selecciona tu tipo de proveedor</p>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>Para ver los documentos requeridos, primero debes indicar el tipo de servicios que brinda tu empresa.</p>
          <a href="/dashboard/perfil" style={{ display: 'inline-block', padding: '10px 24px', background: '#C41230', color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
            Ir a Mi perfil
          </a>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <a href="/dashboard" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>Dashboard</a>
          <span style={{ color: '#DDD' }}>›</span>
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Mis documentos</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Notificaciones proveedorId={proveedor?.id} />
          <span style={{ fontSize: '13px', color: '#888' }}>{proveedor?.razon_social}</span>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '28px 24px' }}>

        <div style={{ background: '#E6F1FB', borderRadius: '12px', padding: '16px 20px', border: '1px solid #B5D4F4', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '16px' }}>ℹ️</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0C447C' }}>Documentos informativos — Leer antes de comenzar</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {DOCS_INFORMATIVOS.map(doc => (
              <a key={doc.nombre} href={doc.archivo} download
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'white', border: '1px solid #B5D4F4', borderRadius: '8px', padding: '8px 14px', textDecoration: 'none', color: '#0C447C', fontSize: '12px', fontWeight: 600 }}>
                ↓ {doc.nombre}
                <span style={{ fontSize: '10px', color: '#888', fontWeight: 400 }}>— {doc.desc}</span>
              </a>
            ))}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>Progreso de carga documental</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#C41230' }}>{docsSubidos} / {totalDocs} documentos</span>
          </div>
          <div style={{ height: '8px', background: '#F0F0F0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#C41230', borderRadius: '4px', width: `${progreso}%`, transition: 'width 0.5s' }} />
          </div>
          <p style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>{progreso}% completado</p>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏢</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Documentos de la empresa</h2>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{documentos.length} de {docsEmpresa.length} cargados · Los formatos con ↓ deben descargarse, llenarse y subirse firmados</p>
            </div>
          </div>
          {docsEmpresa.map(doc => {
            const docData = documentos.find(d => d.nombre === doc.nombre) || null
            return (
              <FilaDocumento key={doc.nombre} label={doc.nombre}
                tieneVencimiento={doc.tiene_vencimiento} fechaKey={doc.nombre}
                doc={docData} formato={DOCS_FORMATOS[doc.nombre] || null}
                onSubir={(f: File) => subirDoc('documentos', doc.nombre, f, 'proveedor_id', proveedor.id, docData)} />
            )
          })}
        </div>

        {necesitaConductores && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👤</div>
              <div>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Conductores</h2>
                <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{conductores.length} registrados</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input type="text" value={nuevoConductor} onChange={(e) => setNuevoConductor(e.target.value)}
                placeholder="Nombre completo del conductor"
                onKeyDown={(e) => e.key === 'Enter' && agregarConductor()}
                style={{ flex: 1, padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
              <button onClick={agregarConductor} disabled={agregandoConductor}
                style={{ padding: '9px 18px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: agregandoConductor ? 0.7 : 1 }}>
                {agregandoConductor ? '...' : '+ Agregar'}
              </button>
            </div>
            {conductores.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', background: '#F9F9F9', borderRadius: '8px' }}>
                <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>No hay conductores registrados aun</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {conductores.map((conductor) => (
                <div key={conductor.id} style={{ border: '1px solid #F0F0F0', borderRadius: '10px', padding: '14px', background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#C41230', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 700 }}>
                        {conductor.nombre_completo.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{conductor.nombre_completo}</span>
                    </div>
                    <button onClick={() => eliminarConductor(conductor.id)}
                      style={{ fontSize: '11px', color: '#C41230', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  </div>
                  {docsConductorReq.map(doc => {
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
          </div>
        )}

        {necesitaUnidades && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', border: '1px solid #EEEEEE' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🚛</div>
              <div>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Unidades vehiculares</h2>
                <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{unidades.length} registradas</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input type="text" value={nuevaUnidad} onChange={(e) => setNuevaUnidad(e.target.value)}
                placeholder="Placa del vehiculo (ej: ABC-123)"
                onKeyDown={(e) => e.key === 'Enter' && agregarUnidad()}
                style={{ flex: 1, padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
              <button onClick={agregarUnidad} disabled={agregandoUnidad}
                style={{ padding: '9px 18px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: agregandoUnidad ? 0.7 : 1 }}>
                {agregandoUnidad ? '...' : '+ Agregar'}
              </button>
            </div>
            {unidades.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', background: '#F9F9F9', borderRadius: '8px' }}>
                <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>No hay unidades registradas aun</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {unidades.map((unidad) => (
                <div key={unidad.id} style={{ border: '1px solid #F0F0F0', borderRadius: '10px', padding: '14px', background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px' }}>
                        🚛
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>Placa: {unidad.placa}</span>
                    </div>
                    <button onClick={() => eliminarUnidad(unidad.id)}
                      style={{ fontSize: '11px', color: '#C41230', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  </div>
                  {docsUnidadReq.map(doc => {
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
          </div>
        )}

      </div>
    </div>
  )
}