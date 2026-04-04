'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
  const [comentario, setComentario] = useState<{ [key: string]: string }>({})
  const [procesando, setProcesando] = useState<string | null>(null)

  useEffect(() => {
    verificarRol()
  }, [])

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
      .from('proveedores')
      .select('*')
      .order('created_at', { ascending: false })
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
    }

    if (units && units.length > 0) {
      const ids = units.map((u: any) => u.id)
      const { data: du } = await supabase
        .from('documentos_unidad').select('*').in('unidad_id', ids)
      setDocsUnidad(du || [])
    }
  }

  const verDocumento = async (url: string) => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const actualizarDoc = async (tabla: string, id: string, estado: string, key: string) => {
    setProcesando(key)
    await supabase.from(tabla).update({
      estado,
      ...(comentario[key] ? { comentario: comentario[key] } : {})
    }).eq('id', id)
    await seleccionarProveedor(seleccionado)
    setProcesando(null)
  }

  const actualizarEstadoProveedor = async (estado: string) => {
    await supabase.from('proveedores').update({ estado }).eq('id', seleccionado.id)
    await cargarProveedores()
    setSeleccionado({ ...seleccionado, estado })
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

  const FilaDoc = ({ doc, tabla, idKey, keyPrefix }: any) => {
    const key = `${keyPrefix}-${doc.nombre}`
    return (
      <div className="border border-gray-100 rounded-lg p-3 mb-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm text-gray-800">{doc.nombre}</span>
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

        <div className="flex items-center gap-2 flex-wrap">
          {doc.url && (
            <button onClick={() => verDocumento(doc.url)}
              className="text-xs text-blue-600 border border-blue-200 px-3 py-1 rounded-lg hover:bg-blue-50 transition">
              Ver archivo
            </button>
          )}
          <input
            type="text"
            placeholder="Comentario (opcional)"
            value={comentario[key] || ''}
            onChange={(e) => setComentario({ ...comentario, [key]: e.target.value })}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            disabled={procesando === key || !doc.url}
            onClick={() => actualizarDoc(tabla, doc.id, 'aprobado', key)}
            className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition disabled:opacity-40">
            Aprobar
          </button>
          <button
            disabled={procesando === key || !doc.url}
            onClick={() => actualizarDoc(tabla, doc.id, 'rechazado', key)}
            className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition disabled:opacity-40">
            Rechazar
          </button>
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
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Panel del evaluador</h1>
          <p className="text-xs text-gray-400">Revisión de proveedores</p>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          className="text-sm text-gray-400 hover:text-red-500 transition">
          Salir
        </button>
      </nav>

      <div className="flex h-[calc(100vh-53px)]">

        {/* Lista de proveedores */}
        <div className="w-72 bg-white border-r border-gray-100 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500">{proveedores.length} proveedores registrados</p>
          </div>
          {proveedores.map((prov) => (
            <div key={prov.id}
              onClick={() => seleccionarProveedor(prov)}
              className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition
                ${seleccionado?.id === prov.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-900 truncate">{prov.razon_social}</p>
              </div>
              <p className="text-xs text-gray-400">RUC {prov.ruc}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${estadoColor[prov.estado] || estadoColor.pendiente}`}>
                {estadoTexto[prov.estado] || 'Pendiente'}
              </span>
            </div>
          ))}
        </div>

        {/* Panel de revisión */}
        <div className="flex-1 overflow-y-auto p-6">
          {!seleccionado ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-sm">Selecciona un proveedor para revisar</p>
            </div>
          ) : (
            <div className="max-w-2xl">

              {/* Header proveedor */}
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
                <div className="flex gap-2">
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

              {/* Documentos empresa */}
              {documentos.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Documentos de la empresa</h3>
                  {documentos.map(doc => (
                    <FilaDoc key={doc.id} doc={doc} tabla="documentos" idKey="proveedor_id" keyPrefix={`empresa-${doc.proveedor_id}`} />
                  ))}
                </div>
              )}

              {/* Conductores */}
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
                      {docsConductor
                        .filter(d => d.conductor_id === conductor.id)
                        .map(doc => (
                          <FilaDoc key={doc.id} doc={doc} tabla="documentos_conductor" idKey="conductor_id" keyPrefix={`conductor-${conductor.id}`} />
                        ))}
                      {docsConductor.filter(d => d.conductor_id === conductor.id).length === 0 && (
                        <p className="text-xs text-gray-400 ml-8">Sin documentos cargados aún</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Unidades */}
              {unidades.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Unidades vehiculares</h3>
                  {unidades.map(unidad => (
                    <div key={unidad.id} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">🚛</span>
                        <span className="text-sm font-medium text-gray-800">Placa: {unidad.placa}</span>
                      </div>
                      {docsUnidad
                        .filter(d => d.unidad_id === unidad.id)
                        .map(doc => (
                          <FilaDoc key={doc.id} doc={doc} tabla="documentos_unidad" idKey="unidad_id" keyPrefix={`unidad-${unidad.id}`} />
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