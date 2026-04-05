'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Notificaciones from '../components/Notificaciones'

const construirFecha = (dia: string, mes: string, anio: string) => {
  if (dia && mes && anio && anio.length === 4) {
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  }
  return ''
}

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
  return construirFecha(partes[0], partes[1], partes[2])
}

const estadoColor: { [key: string]: string } = {
  pendiente: 'bg-amber-50 text-amber-700',
  aprobado: 'bg-green-50 text-green-700',
  rechazado: 'bg-red-50 text-red-700',
  homologado: 'bg-blue-50 text-blue-700',
}

const estadoTexto: { [key: string]: string } = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  homologado: 'Homologado',
}

// ── Componente de fecha fuera del render principal ──
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
        setError('Fecha inválida')
      }
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <input type="text" placeholder="DD/MM/AAAA" value={inputVal}
        maxLength={10} onChange={handleChange}
        className={`w-28 text-xs border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500
          ${error ? 'border-red-400' : 'border-gray-200'}`} />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

// ── Componente de fila fuera del render principal ──
function FilaDoc({ doc, tabla, tieneVencimiento, keyPrefix, procesando, onAprobar, onRechazar, onVerDoc }: any) {
  const [comentario, setComentario] = useState('')
  const [fechaEmision, setFechaEmision] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const key = `${keyPrefix}-${doc.nombre}`
  const esProcesando = procesando === key

  const handleFechaUpdate = (docKey: string, tipo: string, valor: string) => {
    if (tipo === 'emision') setFechaEmision(valor)
    if (tipo === 'vencimiento') setFechaVencimiento(valor)
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 mb-2">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <span className="text-sm font-medium text-gray-800">{doc.nombre}</span>
          {doc.fecha_emision && (
            <span className="ml-2 text-xs text-gray-400">
              Emisión: {new Date(doc.fecha_emision).toLocaleDateString('es-PE')}
            </span>
          )}
          {doc.fecha_vencimiento && (
            <span className="ml-2 text-xs text-gray-400">
              Vence: {new Date(doc.fecha_vencimiento).toLocaleDateString('es-PE')}
            </span>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${estadoColor[doc.estado] || estadoColor.pendiente}`}>
          {estadoTexto[doc.estado] || 'En revisión'}
        </span>
      </div>

      {tieneVencimiento && (
        <div className="flex items-center gap-4 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Emisión:</span>
            <CampoFecha docKey={key} tipo="emision" onUpdate={handleFechaUpdate} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Vencimiento:</span>
            <CampoFecha docKey={key} tipo="vencimiento" onUpdate={handleFechaUpdate} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {doc.url && (
          <button onClick={() => onVerDoc(doc.url)}
            className="text-xs text-blue-600 border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50 transition">
            Ver archivo
          </button>
        )}
        <input
          type="text"
          placeholder="Comentario (obligatorio para rechazar)"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          className="flex-1 min-w-32 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          disabled={esProcesando || !doc.url}
          onClick={() => onAprobar(tabla, doc, key, tieneVencimiento, fechaEmision, fechaVencimiento, comentario)}
          className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition disabled:opacity-40">
          {esProcesando ? '...' : 'Aprobar'}
        </button>
        <button
          disabled={esProcesando || !doc.url || !comentario}
          onClick={() => onRechazar(tabla, doc, key, comentario)}
          className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition disabled:opacity-40">
          {esProcesando ? '...' : 'Rechazar'}
        </button>
      </div>
      {!comentario && (
        <p className="text-xs text-gray-400 mt-1">* Comentario obligatorio para rechazar</p>
      )}
    </div>
  )
}

export default function EvaluadorPage() {
  const router = useRouter()
  const [proveedores, setProveedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionado, setSeleccionado] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [conductores, setConductores] = useState<any[]>([])
  const [unidades, setUnidades] = useState<any[]>([])
  const [docsConductor, setDocsConductor] = useState<any[]>([])
  const [docsUnidad, setDocsUnidad] = useState<any[]>([])
  const [procesando, setProcesando] = useState<string | null>(null)

  useEffect(() => { verificarRol() }, [])

  const verificarRol = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    if (perfil?.rol !== 'evaluador') { router.push('/dashboard'); return }
    await cargarProveedores()
  }

  const cargarProveedores = async () => {
    const { data } = await supabase
      .from('proveedores').select('*').order('created_at', { ascending: false })
    setProveedores(data || [])
    setLoading(false)
  }

  const seleccionarProveedor = async (prov: any) => {
    setSeleccionado(prov)

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
        alert('Ingresa fechas válidas (DD/MM/AAAA) antes de aprobar')
        return
      }
      const emision = parsearFecha(fechaEmision)
      const vencimiento = parsearFecha(fechaVencimiento)
      if (emision && vencimiento && emision >= vencimiento) {
        alert('La fecha de vencimiento debe ser posterior a la de emisión')
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
      tipo: 'info',
      leida: false,
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

    const updateData = {
      estado: 'rechazado',
      comentario,
      fecha_emision: null,
      fecha_vencimiento: null,
      fechas_bloqueadas: false,
    }

    const { error } = await supabase.from(tabla).update(updateData).eq('id', doc.id)
    if (error) { alert('Error: ' + error.message); setProcesando(null); return }

    await supabase.from('notificaciones').insert({
      proveedor_id: seleccionado.id,
      titulo: 'Documento rechazado',
      mensaje: `Tu documento "${doc.nombre}" fue rechazado: ${comentario}`,
      tipo: 'peligro',
      leida: false,
    })

    const docActualizado = { ...doc, ...updateData }
    if (tabla === 'documentos') setDocumentos(prev => prev.map(d => d.id === doc.id ? docActualizado : d))
    else if (tabla === 'documentos_conductor') setDocsConductor(prev => prev.map(d => d.id === doc.id ? docActualizado : d))
    else if (tabla === 'documentos_unidad') setDocsUnidad(prev => prev.map(d => d.id === doc.id ? docActualizado : d))

    setProcesando(null)
  }, [seleccionado])

  const actualizarEstadoProveedor = async (estado: string) => {
    await supabase.from('proveedores').update({ estado }).eq('id', seleccionado.id)
    await cargarProveedores()
    setSeleccionado({ ...seleccionado, estado })
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Panel del evaluador</h1>
          <p className="text-xs text-gray-400">Revisión de proveedores</p>
        </div>
        <div className="flex items-center gap-3">
          <Notificaciones esEvaluador={true} />
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            className="text-sm text-gray-400 hover:text-red-500 transition">
            Salir
          </button>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-53px)]">
        <div className="w-72 bg-white border-r border-gray-100 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500">{proveedores.length} proveedores registrados</p>
          </div>
          {proveedores.map((prov) => (
            <div key={prov.id} onClick={() => seleccionarProveedor(prov)}
              className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition
                ${seleccionado?.id === prov.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}>
              <p className="text-sm font-medium text-gray-900 truncate">{prov.razon_social}</p>
              <p className="text-xs text-gray-400">RUC {prov.ruc}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${estadoColor[prov.estado] || estadoColor.pendiente}`}>
                {estadoTexto[prov.estado] || 'Pendiente'}
              </span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!seleccionado ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-sm">Selecciona un proveedor para revisar</p>
            </div>
          ) : (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{seleccionado.razon_social}</h2>
                    <p className="text-xs text-gray-400">RUC {seleccionado.ruc}</p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${estadoColor[seleccionado.estado] || estadoColor.pendiente}`}>
                    {estadoTexto[seleccionado.estado] || 'Pendiente'}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => actualizarEstadoProveedor('homologado')}
                    className="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                    Homologar proveedor
                  </button>
                  <button onClick={() => actualizarEstadoProveedor('rechazado')}
                    className="bg-red-500 text-white text-xs px-4 py-2 rounded-lg hover:bg-red-600 transition">
                    Rechazar proveedor
                  </button>
                  <button onClick={() => actualizarEstadoProveedor('pendiente')}
                    className="border border-gray-200 text-gray-600 text-xs px-4 py-2 rounded-lg hover:bg-gray-50 transition">
                    Marcar pendiente
                  </button>
                </div>
              </div>

              {documentos.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Documentos de la empresa</h3>
                  {documentos.map(doc => {
                    const tieneVencimiento = ['Seguro de carga', 'Permiso de circulacion MTC'].includes(doc.nombre)
                    return (
                      <FilaDoc key={doc.id} doc={doc} tabla="documentos"
                        tieneVencimiento={tieneVencimiento}
                        keyPrefix={`empresa-${doc.proveedor_id}`}
                        procesando={procesando}
                        onAprobar={aprobarDoc}
                        onRechazar={rechazarDoc}
                        onVerDoc={verDocumento} />
                    )
                  })}
                </div>
              )}

              {conductores.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Conductores</h3>
                  {conductores.map(conductor => (
                    <div key={conductor.id} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-600">{conductor.nombre_completo.charAt(0)}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-800">{conductor.nombre_completo}</span>
                      </div>
                      {docsConductor.filter(d => d.conductor_id === conductor.id).map(doc => (
                        <FilaDoc key={doc.id} doc={doc} tabla="documentos_conductor"
                          tieneVencimiento={true}
                          keyPrefix={`conductor-${conductor.id}`}
                          procesando={procesando}
                          onAprobar={aprobarDoc}
                          onRechazar={rechazarDoc}
                          onVerDoc={verDocumento} />
                      ))}
                      {docsConductor.filter(d => d.conductor_id === conductor.id).length === 0 && (
                        <p className="text-xs text-gray-400 ml-8">Sin documentos cargados aún</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {unidades.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Unidades vehiculares</h3>
                  {unidades.map(unidad => (
                    <div key={unidad.id} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">🚛</span>
                        <span className="text-sm font-medium text-gray-800">Placa: {unidad.placa}</span>
                      </div>
                      {docsUnidad.filter(d => d.unidad_id === unidad.id).map(doc => (
                        <FilaDoc key={doc.id} doc={doc} tabla="documentos_unidad"
                          tieneVencimiento={['SOAT'].includes(doc.nombre)}
                          keyPrefix={`unidad-${unidad.id}`}
                          procesando={procesando}
                          onAprobar={aprobarDoc}
                          onRechazar={rechazarDoc}
                          onVerDoc={verDocumento} />
                      ))}
                      {docsUnidad.filter(d => d.unidad_id === unidad.id).length === 0 && (
                        <p className="text-xs text-gray-400 ml-8">Sin documentos cargados aún</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {documentos.length === 0 && conductores.length === 0 && unidades.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                  <p className="text-gray-400 text-sm">Este proveedor aún no ha cargado documentos</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}