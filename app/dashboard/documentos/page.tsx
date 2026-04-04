'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
  const [fechas, setFechas] = useState<{ [key: string]: string }>({})
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
    }

    if (units && units.length > 0) {
      const ids = units.map((u: any) => u.id)
      const { data: du } = await supabase
        .from('documentos_unidad').select('*').in('unidad_id', ids)
      setDocsUnidad(du || [])
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

  const subirDocEmpresa = async (nombreDoc: string, archivo: File, tieneVencimiento: boolean) => {
    if (!proveedor) return
    setSubiendo(nombreDoc)
    const ext = archivo.name.split('.').pop()
    const ruta = `${proveedor.id}/empresa/${nombreDoc.replace(/\s/g, '_')}.${ext}`
    await supabase.storage.from('documentos').upload(ruta, archivo, { upsert: true })
    const docExistente = documentos.find(d => d.nombre === nombreDoc)
    if (docExistente) {
      await supabase.from('documentos').update({
        url: ruta, estado: 'pendiente',
        fecha_vencimiento: tieneVencimiento ? (fechas[nombreDoc] || null) : null,
      }).eq('id', docExistente.id)
    } else {
      await supabase.from('documentos').insert({
        proveedor_id: proveedor.id, nombre: nombreDoc,
        tipo: 'empresa', url: ruta, estado: 'pendiente',
        fecha_vencimiento: tieneVencimiento ? (fechas[nombreDoc] || null) : null,
      })
    }
    await cargarDatos()
    setSubiendo(null)
  }

  const subirDocConductor = async (conductorId: string, nombreDoc: string, archivo: File, tieneVencimiento: boolean) => {
    setSubiendo(`${conductorId}-${nombreDoc}`)
    const ext = archivo.name.split('.').pop()
    const ruta = `${proveedor.id}/conductores/${conductorId}/${nombreDoc.replace(/\s/g, '_')}.${ext}`
    await supabase.storage.from('documentos').upload(ruta, archivo, { upsert: true })
    const key = `${conductorId}-${nombreDoc}`
    const docExistente = docsConductor.find(d => d.conductor_id === conductorId && d.nombre === nombreDoc)
    if (docExistente) {
      await supabase.from('documentos_conductor').update({
        url: ruta, estado: 'pendiente',
        fecha_vencimiento: tieneVencimiento ? (fechas[key] || null) : null,
      }).eq('id', docExistente.id)
    } else {
      await supabase.from('documentos_conductor').insert({
        conductor_id: conductorId, nombre: nombreDoc,
        url: ruta, estado: 'pendiente',
        fecha_vencimiento: tieneVencimiento ? (fechas[key] || null) : null,
      })
    }
    await cargarDatos()
    setSubiendo(null)
  }

  const subirDocUnidad = async (unidadId: string, nombreDoc: string, archivo: File, tieneVencimiento: boolean) => {
    setSubiendo(`${unidadId}-${nombreDoc}`)
    const ext = archivo.name.split('.').pop()
    const ruta = `${proveedor.id}/unidades/${unidadId}/${nombreDoc.replace(/\s/g, '_')}.${ext}`
    await supabase.storage.from('documentos').upload(ruta, archivo, { upsert: true })
    const key = `${unidadId}-${nombreDoc}`
    const docExistente = docsUnidad.find(d => d.unidad_id === unidadId && d.nombre === nombreDoc)
    if (docExistente) {
      await supabase.from('documentos_unidad').update({
        url: ruta, estado: 'pendiente',
        fecha_vencimiento: tieneVencimiento ? (fechas[key] || null) : null,
      }).eq('id', docExistente.id)
    } else {
      await supabase.from('documentos_unidad').insert({
        unidad_id: unidadId, nombre: nombreDoc,
        url: ruta, estado: 'pendiente',
        fecha_vencimiento: tieneVencimiento ? (fechas[key] || null) : null,
      })
    }
    await cargarDatos()
    setSubiendo(null)
  }

  const getEstadoDoc = (lista: any[], key: string, valor: string, nombreDoc: string) => {
    return lista.find(d => d[key] === valor && d.nombre === nombreDoc)?.estado || null
  }

  const estadoStyle: { [key: string]: string } = {
    pendiente: 'bg-amber-50 text-amber-700',
    aprobado: 'bg-green-50 text-green-700',
    rechazado: 'bg-red-50 text-red-700',
  }

  const FilaDocumento = ({ label, tieneVencimiento, onSubir, estado, fechaKey }: any) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">{label}</span>
        {tieneVencimiento && (
          <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Vence</span>
        )}
        {estado && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoStyle[estado]}`}>
            {estado === 'pendiente' ? 'En revisión' : estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {tieneVencimiento && (
          <input
            type="date"
            value={fechas[fechaKey] || ''}
            onChange={(e) => setFechas({ ...fechas, [fechaKey]: e.target.value })}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        <label className={`cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg transition
          ${subiendo === fechaKey ? 'bg-gray-100 text-gray-400' :
            estado === 'aprobado' ? 'bg-green-50 text-green-700' :
            'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {subiendo === fechaKey ? 'Subiendo...' : estado ? 'Reemplazar' : 'Subir'}
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
            disabled={subiendo === fechaKey}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubir(f) }} />
        </label>
      </div>
    </div>
  )

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
        <p className="text-xs text-gray-400">{proveedor?.razon_social}</p>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Documentos de la empresa */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Documentos de la empresa</h2>
          {DOCS_EMPRESA.map(doc => (
            <FilaDocumento key={doc.nombre}
              label={doc.nombre}
              tieneVencimiento={doc.tiene_vencimiento}
              fechaKey={doc.nombre}
              estado={getEstadoDoc(documentos, 'proveedor_id', proveedor?.id, doc.nombre)}
              onSubir={(f: File) => subirDocEmpresa(doc.nombre, f, doc.tiene_vencimiento)}
            />
          ))}
        </div>

        {/* Conductores */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Conductores</h2>
            <span className="text-xs text-gray-400">{conductores.length} registrados</span>
          </div>

          {/* Agregar conductor */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={nuevoConductor}
              onChange={(e) => setNuevoConductor(e.target.value)}
              placeholder="Nombre completo del conductor"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && agregarConductor()}
            />
            <button onClick={agregarConductor} disabled={agregandoConductor}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
              {agregandoConductor ? '...' : '+ Agregar'}
            </button>
          </div>

          {/* Lista de conductores */}
          {conductores.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No hay conductores registrados aún</p>
          )}

          <div className="space-y-4">
            {conductores.map((conductor) => (
              <div key={conductor.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-blue-50 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-blue-600">
                      {conductor.nombre_completo.charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{conductor.nombre_completo}</span>
                </div>
                {DOCS_CONDUCTOR.map(doc => {
                  const key = `${conductor.id}-${doc.nombre}`
                  return (
                    <FilaDocumento key={doc.nombre}
                      label={doc.nombre}
                      tieneVencimiento={doc.tiene_vencimiento}
                      fechaKey={key}
                      estado={getEstadoDoc(docsConductor, 'conductor_id', conductor.id, doc.nombre)}
                      onSubir={(f: File) => subirDocConductor(conductor.id, doc.nombre, f, doc.tiene_vencimiento)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Unidades */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Unidades vehiculares</h2>
            <span className="text-xs text-gray-400">{unidades.length} registradas</span>
          </div>

          {/* Agregar unidad */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={nuevaUnidad}
              onChange={(e) => setNuevaUnidad(e.target.value)}
              placeholder="Placa del vehículo (ej: ABC-123)"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && agregarUnidad()}
            />
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
                  <div className="w-7 h-7 bg-green-50 rounded-full flex items-center justify-center">
                    <span className="text-xs">🚛</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Placa: {unidad.placa}</span>
                </div>
                {DOCS_UNIDAD.map(doc => {
                  const key = `${unidad.id}-${doc.nombre}`
                  return (
                    <FilaDocumento key={doc.nombre}
                      label={doc.nombre}
                      tieneVencimiento={doc.tiene_vencimiento}
                      fechaKey={key}
                      estado={getEstadoDoc(docsUnidad, 'unidad_id', unidad.id, doc.nombre)}
                      onSubir={(f: File) => subirDocUnidad(unidad.id, doc.nombre, f, doc.tiene_vencimiento)}
                    />
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