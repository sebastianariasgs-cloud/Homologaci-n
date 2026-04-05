'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Notificaciones({ proveedorId, esEvaluador = false }: { proveedorId?: string, esEvaluador?: boolean }) {
  const [notificaciones, setNotificaciones] = useState<any[]>([])
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (proveedorId || esEvaluador) {
      cargarNotificaciones()
      verificarVencimientos()
    }
  }, [proveedorId])

  const cargarNotificaciones = async () => {
    let query = supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (!esEvaluador && proveedorId) {
      query = query.eq('proveedor_id', proveedorId)
    }

    const { data } = await query
    setNotificaciones(data || [])
    setLoading(false)
  }

  const verificarVencimientos = async () => {
    if (!proveedorId) return

    const hoy = new Date()

    // Verificar documentos de empresa
    const { data: docs } = await supabase
      .from('documentos')
      .select('*')
      .eq('proveedor_id', proveedorId)
      .not('fecha_vencimiento', 'is', null)

    // Verificar documentos de conductores
    const { data: conductores } = await supabase
      .from('conductores')
      .select('id')
      .eq('proveedor_id', proveedorId)

    let docsConductor: any[] = []
    if (conductores && conductores.length > 0) {
      const ids = conductores.map((c: any) => c.id)
      const { data: dc } = await supabase
        .from('documentos_conductor')
        .select('*')
        .in('conductor_id', ids)
        .not('fecha_vencimiento', 'is', null)
      docsConductor = dc || []
    }

    // Verificar documentos de unidades
    const { data: unidades } = await supabase
      .from('unidades')
      .select('id')
      .eq('proveedor_id', proveedorId)

    let docsUnidad: any[] = []
    if (unidades && unidades.length > 0) {
      const ids = unidades.map((u: any) => u.id)
      const { data: du } = await supabase
        .from('documentos_unidad')
        .select('*')
        .in('unidad_id', ids)
        .not('fecha_vencimiento', 'is', null)
      docsUnidad = du || []
    }

    const todosLosDocs = [...(docs || []), ...docsConductor, ...docsUnidad]

    for (const doc of todosLosDocs) {
      const vencimiento = new Date(doc.fecha_vencimiento)
      const diasRestantes = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))

      let tipo = ''
      let titulo = ''
      let mensaje = ''

      if (diasRestantes < 0) {
        tipo = 'critico'
        titulo = 'Documento vencido'
        mensaje = `"${doc.nombre}" venció hace ${Math.abs(diasRestantes)} días`
      } else if (diasRestantes <= 7) {
        tipo = 'peligro'
        titulo = 'Documento por vencer'
        mensaje = `"${doc.nombre}" vence en ${diasRestantes} días`
      } else if (diasRestantes <= 15) {
        tipo = 'advertencia'
        titulo = 'Documento por vencer'
        mensaje = `"${doc.nombre}" vence en ${diasRestantes} días`
      } else if (diasRestantes <= 30) {
        tipo = 'info'
        titulo = 'Documento próximo a vencer'
        mensaje = `"${doc.nombre}" vence en ${diasRestantes} días`
      }

      if (tipo) {
        // Verificar si ya existe notificación para este doc
        const { data: existente } = await supabase
          .from('notificaciones')
          .select('id')
          .eq('proveedor_id', proveedorId)
          .eq('mensaje', mensaje)
          .eq('leida', false)

        if (!existente || existente.length === 0) {
          await supabase.from('notificaciones').insert({
            proveedor_id: proveedorId,
            titulo,
            mensaje,
            tipo,
            leida: false,
          })
        }
      }
    }

    await cargarNotificaciones()
  }

  const marcarLeida = async (id: string) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    setNotificaciones(notificaciones.map(n => n.id === id ? { ...n, leida: true } : n))
  }

  const marcarTodasLeidas = async () => {
    const ids = notificaciones.filter(n => !n.leida).map(n => n.id)
    for (const id of ids) {
      await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    }
    setNotificaciones(notificaciones.map(n => ({ ...n, leida: true })))
  }

  const noLeidas = notificaciones.filter(n => !n.leida).length

  const tipoEstilo: { [key: string]: string } = {
    critico: 'bg-red-50 border-red-200 text-red-800',
    peligro: 'bg-orange-50 border-orange-200 text-orange-800',
    advertencia: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  const tipoIcono: { [key: string]: string } = {
    critico: '🔴',
    peligro: '🟠',
    advertencia: '🟡',
    info: '🔵',
  }

  return (
    <div className="relative">
      {/* Botón campana */}
      <button
        onClick={() => setAbierto(!abierto)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition"
      >
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {noLeidas}
          </span>
        )}
      </button>

      {/* Panel de notificaciones */}
      {abierto && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
            {noLeidas > 0 && (
              <button onClick={marcarTodasLeidas}
                className="text-xs text-blue-600 hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="text-xs text-gray-400 text-center py-6">Cargando...</p>
            )}
            {!loading && notificaciones.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">Sin notificaciones</p>
            )}
            {notificaciones.map(n => (
              <div key={n.id}
                className={`p-3 border-b border-gray-50 cursor-pointer transition hover:opacity-80 ${!n.leida ? 'bg-gray-50' : ''}`}
                onClick={() => marcarLeida(n.id)}>
                <div className="flex items-start gap-2">
                  <span className="text-sm">{tipoIcono[n.tipo] || '🔵'}</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-900">{n.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.mensaje}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleDateString('es-PE')}
                    </p>
                  </div>
                  {!n.leida && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}