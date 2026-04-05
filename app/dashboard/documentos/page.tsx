'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Notificaciones from '../../components/Notificaciones'

const DOCS_EMPRESA = [
  { nombre: 'Relacion de unidades y conductores', tiene_vencimiento: false },
  { nombre: 'Seguro de carga', tiene_vencimiento: true },
  { nombre: 'Permiso de circulacion MTC', tiene_vencimiento: true },
]

const DOCS_CONDUCTOR = [
  { nombre: 'SCTR', tiene_vencimiento: true },
  { nombre: 'Licencia de conducir', tiene_vencimiento: true },
  { nombre: 'Antecedentes penales', tiene_vencimiento: true },
]

const DOCS_UNIDAD = [
  { nombre: 'SOAT', tiene_vencimiento: true },
  { nombre: 'Tarjeta de propiedad', tiene_vencimiento: false },
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
    } else {
      setDocsConductor([])
    }

    if (units && units.length > 0) {
      const ids = units.map((u: any) => u.id)
      const { data: du } = await supabase
        .from('documentos_unidad').select('*').in('unidad_id', ids)
      setDocsUnidad(du || [])
    } else {
      setDocsUnidad([])
    }

    setLoading(false)
  }

  const agregarConductor = async () => {
    if (!nuevoConductor.trim() || !proveedor) return
    setAgregandoConductor(true)
    await supabase.from('conductores').insert({
      proveedor_id: proveedor.id,
      nombre_completo: nuevoConductor.trim(),
    })
    setNuevoConductor('')
    setAgregandoConductor(false)
    await cargarDatos()
  }

  const agregarUnidad = async () => {
    if (!nuevaUnidad.trim() || !proveedor) return
    setAgregandoUnidad(true)
    await supabase.from('unidades').insert({
      proveedor_id: proveedor.id,
      placa: nuevaUnidad.trim().toUpperCase(),
    })
    setNuevaUnidad('')
    setAgregandoUnidad(false)
    await cargarDatos()
  }

  const subirDoc = async (
    tabla: string,
    nombreDoc: string,
    archivo: File,
    campoId: string,
    valorId: string,
    docExistente: any
  ) => {
    if (docExistente && !puedeReemplazar(docExistente)) return

    const key = campoId === 'proveedor_id' ? nombreDoc : `${valorId}-${nombreDoc}`
    setSubiendo(key)

    const ext = archivo.name.split('.').pop()
    const carpeta = campoId === 'proveedor_id' ? 'empresa' : tabla
    const ruta = `${proveedor.id}/${carpeta}/${valorId}/${nombreDoc.replace(/\s/g, '_')}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(ruta, archivo, { upsert: true })

    if (uploadError) {
      alert('Error al subir el archivo: ' + uploadError.message)
      setSubiendo(null)
      return
    }

    const nuevoDoc = {
      nombre: nombreDoc,
      url: ruta,
      estado: 'pendiente',
      fecha_emision: null,
      fecha_vencimiento: null,
      fechas_bloqueadas: false,
      comentario: null,
    }

    if (docExistente) {
      const { error: updateError } = await supabase
        .from(tabla)
        .update(nuevoDoc)
        .eq('id', docExistente.id)

      if (updateError) {
        alert('Error al actualizar: ' + updateError.message)
        setSubiendo(null)
        return
      }

      // Actualizar estado local inmediatamente
      if (tabla === 'documentos') {
        setDocumentos(prev => prev.map(d =>
          d.id === docExistente.id ? { ...d, ...nuevoDoc } : d
        ))
      } else if (tabla === 'documentos_conductor') {
        setDocsConductor(prev => prev.map(d =>
          d.id === docExistente.id ? { ...d, ...nuevoDoc } : d
        ))
      } else if (tabla === 'documentos_unidad') {
        setDocsUnidad(prev => prev.map(d =>
          d.id === docExistente.id ? { ...d, ...nuevoDoc } : d
        ))
      }

    } else {
      const insertData: any = { ...nuevoDoc }
      insertData[campoId] = valorId
      if (tabla === 'documentos') insertData.tipo = 'empresa'

      const { data: inserted, error: insertError } = await supabase
        .from(tabla)
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        alert('Error al guardar: ' + insertError.message)
        setSubiendo(null)
        return
      }

      // Agregar al estado local inmediatamente
      if (tabla === 'documentos') {
        setDocumentos(prev => [...prev, inserted])
      } else if (tabla === 'documentos_conductor') {
        setDocsConductor(prev => [...prev, inserted])
      } else if (tabla === 'documentos_unidad') {
        setDocsUnidad(prev => [...prev, inserted])
      }
    }

    setSubiendo(null)
  }

  const estadoStyle: { [key: string]: string } = {
    pendiente: 'bg-amber-50 text-amber-700',
    aprobado: 'bg-green-50 text-green-700',
    rechazado: 'bg-red-50 text-red-700',
  }

  const FilaDocumento = ({ label, tieneVencimiento, doc, onSubir, fechaKey }: any) => {
    const estado = doc?.estado || null
    const estaSubiendo = subiendo === fechaKey
    const puede = puedeReemplazar(doc)
    const dias = doc?.fecha_vencimiento ? diasParaVencer(doc.fecha_vencimiento) : null

    const textoBoton = () => {
      if (estaSubiendo) return 'Subiendo...'
      if (!estado) return '↑ Subir archivo'
      if (estado === 'rechazado') return '↑ Subir de nuevo'
      if (estado === 'pendiente') return '↺ Reemplazar'
      if (estado === 'aprobado' && puede) return '↺ Renovar'
      return null
    }

    const estiloBoton = () => {
      if (estaSubiendo) return 'bg-gray-100 text-gray-400 cursor-not-allowed'
      if (!estado) return 'bg-blue-600 text-white hover:bg-blue-700'
      if (estado === 'rechazado') return 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
      if (estado === 'pendiente') return 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
      if (estado === 'aprobado' && puede) return 'bg-blue-600 text-white hover:bg-blue-700'
      return ''
    }

    return (
      <div className="flex items-start justify-between py-3 border-b border-gray-50 last:border-0 gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-700">{label}</span>
            {tieneVencimiento && !estado && (
              <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Con vencimiento</span>
            )}
            {estado && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoStyle[estado]}`}>
                {estado === 'pendiente' ? 'En revisión' : estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
              </span>
            )}
            {estado === 'aprobado' && dias !== null && dias <= 30 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                ${dias <= 5 ? 'bg-red-50 text-red-700' :
                  dias <= 15 ? 'bg-orange-50 text-orange-700' :
                  'bg-amber-50 text-amber-700'}`}>
                {dias <= 0 ? 'Vencido' : `Vence en ${dias} días`}
              </span>
            )}
          </div>
          {doc?.fecha_emision && (
            <p className="text-xs text-gray-400 mt-1">
              Emisión: {new Date(doc.fecha_emision).toLocaleDateString('es-PE')}
              {doc.fecha_vencimiento && ` · Vence: ${new Date(doc.fecha_vencimiento).toLocaleDateString('es-PE')}`}
            </p>
          )}
          {estado === 'rechazado' && doc?.comentario && (
            <p className="text-xs text-red-500 mt-1">Motivo: {doc.comentario}</p>
          )}
          {estado === 'aprobado' && !puede && (
            <p className="text-xs text-gray-400 mt-1">
              🔒 Podrás renovar cuando falten 5 días o menos para el vencimiento
            </p>
          )}
        </div>

        <div className="flex-shrink-0">
          {textoBoton() ? (
            <label className={`cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg transition ${estiloBoton()}`}>
              {textoBoton()}
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                disabled={estaSubiendo || (estado === 'aprobado' && !puede)}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubir(f) }} />
            </label>
          ) : (
            <span className="text-xs bg-green-50 text-green-700 font-medium px-3 py-1.5 rounded-lg">
              ✓ Vigente
            </span>
          )}
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
          <span className="text-gray-200">/</span>
          <h1 className="text-sm font-semibold text-gray-900">Mis documentos</h1>
        </div>
        <div className="flex items-center gap-3">
          <Notificaciones proveedorId={proveedor?.id} />
          <p className="text-xs text-gray-400">{proveedor?.razon_social}</p>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Documentos de la empresa</h2>
          {DOCS_EMPRESA.map(doc => {
            const docData = documentos.find(d => d.nombre === doc.nombre) || null
            return (
              <FilaDocumento key={doc.nombre} label={doc.nombre}
                tieneVencimiento={doc.tiene_vencimiento}
                fechaKey={doc.nombre} doc={docData}
                onSubir={(f: File) => subirDoc('documentos', doc.nombre, f, 'proveedor_id', proveedor.id, docData)} />
            )
          })}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Conductores</h2>
            <span className="text-xs text-gray-400">{conductores.length} registrados</span>
          </div>
          <div className="flex gap-2 mb-4">
            <input type="text" value={nuevoConductor}
              onChange={(e) => setNuevoConductor(e.target.value)}
              placeholder="Nombre completo del conductor"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && agregarConductor()} />
            <button onClick={agregarConductor} disabled={agregandoConductor}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
              {agregandoConductor ? '...' : '+ Agregar'}
            </button>
          </div>
          {conductores.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No hay conductores registrados aún</p>
          )}
          <div className="space-y-4">
            {conductores.map((conductor) => (
              <div key={conductor.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-blue-50 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-600">{conductor.nombre_completo.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{conductor.nombre_completo}</span>
                </div>
                {DOCS_CONDUCTOR.map(doc => {
                  const key = `${conductor.id}-${doc.nombre}`
                  const docData = docsConductor.find(d => d.conductor_id === conductor.id && d.nombre === doc.nombre) || null
                  return (
                    <FilaDocumento key={doc.nombre} label={doc.nombre}
                      tieneVencimiento={doc.tiene_vencimiento}
                      fechaKey={key} doc={docData}
                      onSubir={(f: File) => subirDoc('documentos_conductor', doc.nombre, f, 'conductor_id', conductor.id, docData)} />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Unidades vehiculares</h2>
            <span className="text-xs text-gray-400">{unidades.length} registradas</span>
          </div>
          <div className="flex gap-2 mb-4">
            <input type="text" value={nuevaUnidad}
              onChange={(e) => setNuevaUnidad(e.target.value)}
              placeholder="Placa del vehículo (ej: ABC-123)"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && agregarUnidad()} />
            <button onClick={agregarUnidad} disabled={agregandoUnidad}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
              {agregandoUnidad ? '...' : '+ Agregar'}
            </button>
          </div>
          {unidades.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No hay unidades registradas aún</p>
          )}
          <div className="space-y-4">
            {unidades.map((unidad) => (
              <div key={unidad.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">🚛</span>
                  <span className="text-sm font-medium text-gray-900">Placa: {unidad.placa}</span>
                </div>
                {DOCS_UNIDAD.map(doc => {
                  const key = `${unidad.id}-${doc.nombre}`
                  const docData = docsUnidad.find(d => d.unidad_id === unidad.id && d.nombre === doc.nombre) || null
                  return (
                    <FilaDocumento key={doc.nombre} label={doc.nombre}
                      tieneVencimiento={doc.tiene_vencimiento}
                      fechaKey={key} doc={docData}
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