'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Notificaciones from '../../components/Notificaciones'

const DOCS_EMPRESA = [
  { nombre: 'Carta de presentacion', tiene_vencimiento: false, formato: null },
  { nombre: 'Carta de cuentas bancarias', tiene_vencimiento: false, formato: null },
  { nombre: 'Registro de proveedores', tiene_vencimiento: false, formato: '/Registro_de_Proveedores.xlsx' },
  { nombre: 'Acuerdo de seguridad', tiene_vencimiento: false, formato: '/Acuerdo_de_Seguridad.docx' },
  { nombre: 'Declaracion jurada de licitud', tiene_vencimiento: false, formato: '/Declaracion_Jurada_Licitud.docx' },
  { nombre: 'Copia literal', tiene_vencimiento: false, formato: null },
  { nombre: 'Datos de beneficiarios finales', tiene_vencimiento: false, formato: '/DJ_Beneficiario_Final.docx' },
  { nombre: 'Copia DNI representante legal', tiene_vencimiento: false, formato: null },
  { nombre: 'Copia Ficha RUC', tiene_vencimiento: false, formato: null },
  { nombre: 'Acuerdo de confidencialidad', tiene_vencimiento: false, formato: '/Acuerdo_Confidencialidad.docx' },
  { nombre: 'Poliza de seguros contra terceros', tiene_vencimiento: true, formato: null },
]

const DOCS_INFORMATIVOS = [
  { nombre: 'Carta de Compromiso', archivo: '/Carta_Compromiso.pdf', desc: 'Leer antes de iniciar el proceso' },
  { nombre: 'Cartilla Informativa de Seguridad BASC', archivo: '/Cartilla_Seguridad_OMNI.pdf', desc: 'Información sobre el sistema BASC' },
]

const DOCS_CONDUCTOR = [
  { nombre: 'Licencia de conducir', tiene_vencimiento: true },
  { nombre: 'Antecedentes penales y policiales', tiene_vencimiento: true },
  { nombre: 'SCTR', tiene_vencimiento: true },
]

const DOCS_UNIDAD = [
  { nombre: 'SOAT', tiene_vencimiento: true },
  { nombre: 'Revision tecnica', tiene_vencimiento: true },
  { nombre: 'Tarjeta de propiedad', tiene_vencimiento: false },
  { nombre: 'Certificado habilitacion vehicular MTC', tiene_vencimiento: true },
  { nombre: 'Certificado GPS', tiene_vencimiento: false },
  { nombre: 'Mantenimiento preventivo', tiene_vencimiento: false },
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

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: prov } = await supabase
      .from('proveedores').select('*').eq('user_id', user.id).single()
    if (!prov) { router.push('/login'); return }
    setProveedor(prov)
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

  const agregarConductor = async () => {
    if (!nuevoConductor.trim() || !proveedor) return
    setAgregandoConductor(true)
    await supabase.from('conductores').insert({ proveedor_id: proveedor.id, nombre_completo: nuevoConductor.trim() })
    setNuevoConductor('')
    setAgregandoConductor(false)
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
    } else {
      const insertData: any = { ...nuevoDoc }
      insertData[campoId] = valorId
      if (tabla === 'documentos') insertData.tipo = 'empresa'
      const { data: inserted, error } = await supabase.from(tabla).insert(insertData).select().single()
      if (error) { alert('Error al guardar: ' + error.message); setSubiendo(null); return }
      if (tabla === 'documentos') setDocumentos(prev => [...prev, inserted])
      else if (tabla === 'documentos_conductor') setDocsConductor(prev => [...prev, inserted])
      else if (tabla === 'documentos_unidad') setDocsUnidad(prev => [...prev, inserted])
    }
    setSubiendo(null)
  }

  const totalDocs = DOCS_EMPRESA.length + (conductores.length * DOCS_CONDUCTOR.length) + (unidades.length * DOCS_UNIDAD.length)
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
        pendiente: { bg: '#FFF7ED', color: '#C2410C', texto: 'En revisión' },
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
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
                  background: dias <= 5 ? '#FEF2F2' : '#FFF7ED',
                  color: dias <= 5 ? '#C41230' : '#C2410C'
                }}>
                  {dias <= 0 ? '⚠ Vencido' : `⏰ Vence en ${dias} días`}
                </span>
              )}
            </div>

            {/* Botón de descarga de formato */}
            {formato && !estado && (
              <a href={formato} download
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', color: '#185FA5', fontWeight: 600,
                  marginTop: '5px', textDecoration: 'none',
                  background: '#E6F1FB', padding: '3px 10px', borderRadius: '6px'
                }}>
                ↓ Descargar formato
              </a>
            )}

            {doc?.fecha_emision && (
              <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                Emisión: {new Date(doc.fecha_emision).toLocaleDateString('es-PE')}
                {doc.fecha_vencimiento && ` · Vence: ${new Date(doc.fecha_vencimiento).toLocaleDateString('es-PE')}`}
              </p>
            )}
            {estado === 'rechazado' && doc?.comentario && (
              <p style={{ fontSize: '11px', color: '#C41230', marginTop: '4px' }}>
                💬 Motivo: {doc.comentario}
              </p>
            )}
            {estado === 'aprobado' && !puede && (
              <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                🔒 Podrás renovar cuando falten 5 días o menos para el vencimiento
              </p>
            )}
          </div>

          <div style={{ flexShrink: 0 }}>
            {boton ? (
              <label style={{
                cursor: boton.disabled ? 'not-allowed' : 'pointer',
                fontSize: '12px', fontWeight: 600, padding: '7px 14px',
                borderRadius: '7px', background: boton.bg, color: boton.color,
                border: (boton as any).border || 'none', display: 'inline-block',
                opacity: boton.disabled ? 0.6 : 1
              }}>
                {boton.texto}
                <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                  disabled={boton.disabled || (estado === 'aprobado' && !puede)}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubir(f) }} />
              </label>
            ) : (
              <span style={{ fontSize: '12px', fontWeight: 600, padding: '7px 14px', borderRadius: '7px', background: '#F0FDF4', color: '#15803D' }}>
                ✓ Vigente
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

        {/* Documentos informativos */}
        <div style={{ background: '#E6F1FB', borderRadius: '12px', padding: '16px 20px', border: '1px solid #B5D4F4', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '16px' }}>ℹ️</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0C447C' }}>Documentos informativos — Leer antes de comenzar</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {DOCS_INFORMATIVOS.map(doc => (
              <a key={doc.nombre} href={doc.archivo} download
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'white', border: '1px solid #B5D4F4', borderRadius: '8px',
                  padding: '8px 14px', textDecoration: 'none', color: '#0C447C',
                  fontSize: '12px', fontWeight: 600
                }}>
                ↓ {doc.nombre}
                <span style={{ fontSize: '10px', color: '#888', fontWeight: 400 }}>— {doc.desc}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Barra de progreso */}
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

        {/* Documentos empresa */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', border: '1px solid #EEEEEE', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏢</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Documentos de la empresa</h2>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{documentos.length} de {DOCS_EMPRESA.length} cargados · Los formatos con ↓ deben descargarse, llenarse y subirse firmados</p>
            </div>
          </div>
          {DOCS_EMPRESA.map(doc => {
            const docData = documentos.find(d => d.nombre === doc.nombre) || null
            return (
              <FilaDocumento key={doc.nombre} label={doc.nombre}
                tieneVencimiento={doc.tiene_vencimiento} fechaKey={doc.nombre}
                doc={docData} formato={doc.formato}
                onSubir={(f: File) => subirDoc('documentos', doc.nombre, f, 'proveedor_id', proveedor.id, docData)} />
            )
          })}
        </div>

        {/* Conductores */}
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
              <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>No hay conductores registrados aún</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {conductores.map((conductor) => (
              <div key={conductor.id} style={{ border: '1px solid #F0F0F0', borderRadius: '10px', padding: '14px', background: '#FAFAFA' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#C41230', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 700 }}>
                    {conductor.nombre_completo.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{conductor.nombre_completo}</span>
                </div>
                {DOCS_CONDUCTOR.map(doc => {
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

        {/* Unidades */}
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
              placeholder="Placa del vehículo (ej: ABC-123)"
              onKeyDown={(e) => e.key === 'Enter' && agregarUnidad()}
              style={{ flex: 1, padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
            <button onClick={agregarUnidad} disabled={agregandoUnidad}
              style={{ padding: '9px 18px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: agregandoUnidad ? 0.7 : 1 }}>
              {agregandoUnidad ? '...' : '+ Agregar'}
            </button>
          </div>
          {unidades.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', background: '#F9F9F9', borderRadius: '8px' }}>
              <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>No hay unidades registradas aún</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {unidades.map((unidad) => (
              <div key={unidad.id} style={{ border: '1px solid #F0F0F0', borderRadius: '10px', padding: '14px', background: '#FAFAFA' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px' }}>
                    🚛
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>Placa: {unidad.placa}</span>
                </div>
                {DOCS_UNIDAD.map(doc => {
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

      </div>
    </div>
  )
}