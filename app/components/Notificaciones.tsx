'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Notificaciones({ proveedorId, esEvaluador = false }: { proveedorId?: string, esEvaluador?: boolean }) {
  const router = useRouter()
  const [notificaciones, setNotificaciones] = useState<any[]>([])
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (proveedorId || esEvaluador) {
      cargarNotificaciones()
      if (proveedorId) verificarVencimientos()
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
    const hoyInicio = new Date()
    hoyInicio.setHours(0, 0, 0, 0)

    const { data: docs } = await supabase
      .from('documentos')
      .select('*')
      .eq('proveedor_id', proveedorId)
      .not('fecha_vencimiento', 'is', null)

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
        mensaje = `"${doc.nombre}" vencio hace ${Math.abs(diasRestantes)} dias`
      } else if (diasRestantes <= 7) {
        tipo = 'peligro'
        titulo = 'Documento por vencer'
        mensaje = `"${doc.nombre}" vence en ${diasRestantes} dias`
      } else if (diasRestantes <= 15) {
        tipo = 'advertencia'
        titulo = 'Documento por vencer'
        mensaje = `"${doc.nombre}" vence en ${diasRestantes} dias`
      } else if (diasRestantes <= 30) {
        tipo = 'info'
        titulo = 'Documento proximo a vencer'
        mensaje = `"${doc.nombre}" vence en ${diasRestantes} dias`
      }

      if (tipo) {
        const { data: existente } = await supabase
          .from('notificaciones')
          .select('id')
          .eq('proveedor_id', proveedorId)
          .eq('mensaje', mensaje)
          .eq('leida', false)

        if (!existente || existente.length === 0) {
          const { data: yaHoy } = await supabase
            .from('notificaciones')
            .select('id')
            .eq('proveedor_id', proveedorId)
            .eq('mensaje', mensaje)
            .gte('created_at', hoyInicio.toISOString())

          if (!yaHoy || yaHoy.length === 0) {
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
    }

    await cargarNotificaciones()
  }

  const marcarLeida = async (id: string, link?: string) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    setNotificaciones(notificaciones.map(n => n.id === id ? { ...n, leida: true } : n))
    setAbierto(false)
    if (link) router.push(link)
  }

  const marcarTodasLeidas = async () => {
    const ids = notificaciones.filter(n => !n.leida).map(n => n.id)
    for (const id of ids) {
      await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    }
    setNotificaciones(notificaciones.map(n => ({ ...n, leida: true })))
  }

  const noLeidas = notificaciones.filter(n => !n.leida).length

  const tipoIcono: { [key: string]: string } = {
    critico: '🔴',
    peligro: '🟠',
    advertencia: '🟡',
    info: '🔵',
  }

  const tipoEstilo: { [key: string]: { bg: string, border: string, color: string } } = {
    critico: { bg: '#FEF2F2', border: '#FECACA', color: '#C41230' },
    peligro: { bg: '#FFF7ED', border: '#FED7AA', color: '#C2410C' },
    advertencia: { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E' },
    info: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1D4ED8' },
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setAbierto(!abierto)}
        style={{
          width: '34px', height: '34px', borderRadius: '8px',
          border: '1px solid #E8E8E8', background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative'
        }}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M7.5 1.5a4 4 0 014 4v2.5l1 1.5H2l1-1.5V5.5a4 4 0 014-4z" stroke="#666" strokeWidth="1.2"/>
          <path d="M6 12a1.5 1.5 0 003 0" stroke="#666" strokeWidth="1.2"/>
        </svg>
        {noLeidas > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            width: '16px', height: '16px', background: '#C41230',
            color: 'white', fontSize: '9px', fontWeight: 700,
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div style={{
          position: 'absolute', right: 0, top: '42px', width: '320px',
          background: 'white', border: '1px solid #EEEEEE', borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid #F0F0F0'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>
              Notificaciones {noLeidas > 0 && <span style={{ color: '#C41230' }}>({noLeidas})</span>}
            </span>
            {noLeidas > 0 && (
              <button onClick={marcarTodasLeidas}
                style={{ fontSize: '11px', color: '#C41230', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                Marcar todas como leidas
              </button>
            )}
          </div>

          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {loading && (
              <p style={{ fontSize: '12px', color: '#888', textAlign: 'center', padding: '20px' }}>Cargando...</p>
            )}
            {!loading && notificaciones.length === 0 && (
              <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>Sin notificaciones</p>
                <p style={{ fontSize: '11px', color: '#BBB', marginTop: '4px' }}>Todo esta al dia</p>
              </div>
            )}
            {notificaciones.map(n => {
              const estilo = tipoEstilo[n.tipo] || tipoEstilo.info
              const tieneLink = !!n.link
              return (
                <div key={n.id}
                  onClick={() => marcarLeida(n.id, n.link)}
                  style={{
                    padding: '10px 16px', borderBottom: '1px solid #F5F5F5',
                    cursor: tieneLink ? 'pointer' : 'default',
                    background: n.leida ? 'white' : '#FAFAFA',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                      background: estilo.bg, border: `1px solid ${estilo.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px'
                    }}>
                      {tipoIcono[n.tipo] || '🔵'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{n.titulo}</p>
                        {tieneLink && <span style={{ fontSize: '10px', color: '#C41230' }}>→ Ver</span>}
                      </div>
                      <p style={{ fontSize: '11px', color: '#666', marginTop: '2px', lineHeight: 1.4 }}>{n.mensaje}</p>
                      <p style={{ fontSize: '10px', color: '#AAA', marginTop: '3px' }}>
                        {new Date(n.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.leida && (
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#C41230', flexShrink: 0, marginTop: '6px' }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}