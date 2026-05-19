'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import BotonHub from '../../components/BotonHub'

const T  = '#2C2828'
const T2 = '#696869'

const ESTADOS_FINALES = ['Descarga completada', 'Devolución realizada']

const estadoBadge = (estado: string) => {
  if (!estado || estado === 'Pendiente de asignación') return { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente de asignación' }
  if (estado === 'Asignado')                            return { bg: '#EEF2FF', color: '#3730A3', texto: 'Asignado' }
  if (ESTADOS_FINALES.includes(estado))                 return { bg: '#F0FDF4', color: '#15803D', texto: estado }
  return { bg: '#E0F2FE', color: '#0369A1', texto: estado }
}

const estadoTarifa = (sol: any) => {
  if (!sol?.precio_transporte)              return 'esperando'
  if (sol.precio_transporte <= sol.precio_sugerido) return 'ok'
  if (sol.precio_procede === null)          return 'revisar'
  if (sol.precio_procede === true)          return 'aceptado'
  return 'rechazado'
}

const tarifaBadge: Record<string, { bg: string; color: string; label: string; border: string }> = {
  esperando: { bg: '#EDE9FE', color: '#5B21B6', label: '⏳ Espera coordinación', border: '#C4B5FD' },
  ok:        { bg: '#F0FDF4', color: '#15803D', label: '✓ Precio confirmado',    border: '#A5D6A7' },
  revisar:   { bg: '#FEF3C7', color: '#92400E', label: '⚠️ Precio por revisar',   border: '#FDE68A' },
  aceptado:  { bg: '#F0FDF4', color: '#15803D', label: '✓ Precio aceptado',      border: '#A5D6A7' },
  rechazado: { bg: '#FFEBEE', color: '#B71C1C', label: '✗ Precio rechazado',     border: '#EF9A9A' },
}

const formatFecha = (fecha: string, conHora = false) => {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(conHora && { hour: '2-digit', minute: '2-digit' }),
    timeZone: 'America/Lima',
  })
}

export default function SolicitudDetallePage() {
  const router   = useRouter()
  const { id }   = useParams()
  const [loading, setLoading]       = useState(true)
  const [sol, setSol]               = useState<any>(null)
  const [historial, setHistorial]   = useState<any[]>([])
  const [adjunto, setAdjunto]       = useState<any>(null)
  const [rolUsuario, setRolUsuario] = useState('')

  // Precio
  const [guardandoPrecio, setGuardandoPrecio] = useState(false)

  const canalRef = useRef<any>(null)
  const iniciado = useRef(false)

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    init()
    return () => { if (canalRef.current) supabase.removeChannel(canalRef.current) }
  }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', session.user.id).single()

    const roles = ['operativo_sli', 'admin_operativo', 'supervisor_sli', 'admin']
    if (!roles.includes(perfil?.rol)) { router.push('/login'); return }

    setRolUsuario(perfil?.rol)
    await cargarSolicitud()
    await cargarHistorial()
    await cargarAdjunto()

    // Tiempo real
    const canal = supabase.channel(`sol-detalle-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'solicitudes_transporte', filter: `id=eq.${id}` },
        (payload: any) => setSol((prev: any) => ({ ...prev, ...payload.new })))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitud_historial', filter: `solicitud_id=eq.${id}` },
        async (payload: any) => {
          const { data: p } = await supabase.from('perfiles').select('nombre, email').eq('id', payload.new.usuario_id).single()
          setHistorial(prev => [...prev, { ...payload.new, perfiles: p }])
        })
      .subscribe()
    canalRef.current = canal
  }

  const cargarSolicitud = async () => {
    const { data } = await supabase
      .from('solicitudes_transporte')
      .select(`
        *,
        clientes(razon_social, ruc),
        perfiles!operativo_transporte_id(nombre, email)
      `)
      .eq('id', id)
      .single()
    setSol(data)
    setLoading(false)
  }

  const cargarHistorial = async () => {
    const { data } = await supabase
      .from('solicitud_historial')
      .select('*, perfiles(nombre, email)')
      .eq('solicitud_id', id)
      .order('created_at', { ascending: true })
    setHistorial(data || [])
  }

  const cargarAdjunto = async () => {
    const { data } = await supabase
      .from('solicitud_documentos')
      .select('*')
      .eq('solicitud_id', id)
      .limit(1)
      .single()
    setAdjunto(data || null)
  }

  const verAdjunto = async () => {
    if (!adjunto) return
    const { data } = await supabase.storage.from('documentos').createSignedUrl(adjunto.url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const responderPrecio = async (procede: boolean) => {
    if (!sol) return
    setGuardandoPrecio(true)

    await supabase.from('solicitudes_transporte')
      .update({ precio_procede: procede })
      .eq('id', sol.id)

    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('solicitud_historial').insert({
      solicitud_id:    sol.id,
      usuario_id:      session?.user.id,
      estado_anterior: sol.estado,
      estado_nuevo:    sol.estado,
      comentario:      procede
        ? `Operativo aceptó precio de transporte: S/ ${sol.precio_transporte}`
        : `Operativo rechazó precio: S/ ${sol.precio_transporte} — requiere revisión`,
    })

    if (!procede && sol.operativo_transporte_id) {
      await supabase.from('notificaciones_internas').insert({
        usuario_id: sol.operativo_transporte_id,
        mensaje:    `El operativo rechazó el precio S/ ${sol.precio_transporte} en ${sol.numero}. Favor revisar.`,
        link:       '/transporte/coordinacion',
      })
    }

    setSol((prev: any) => ({ ...prev, precio_procede: procede }))
    await cargarHistorial()
    setGuardandoPrecio(false)
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F2F2' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #E2DCDC', borderTopColor: '#C41230', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: T2, fontSize: '13px', margin: 0 }}>Cargando...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!sol) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F2F2' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '28px', margin: '0 0 12px' }}>🔍</p>
        <p style={{ fontSize: '14px', color: T2, margin: '0 0 16px' }}>Solicitud no encontrada</p>
        <button onClick={() => router.push('/operativo')}
          style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          ← Volver
        </button>
      </div>
    </div>
  )

  const badge    = estadoBadge(sol.estado)
  const tEstado  = estadoTarifa(sol)
  const tb       = tarifaBadge[tEstado]
  const esRevision = tEstado === 'revisar'
  const coordNombre = sol.perfiles?.nombre || sol.perfiles?.email

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F4F2F2', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* NAV */}
      <nav style={{ background: '#2C2828', padding: '0 28px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} onClick={() => router.push('/operativo')} />
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <button onClick={() => router.push('/operativo')}
            style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            ← Solicitudes
          </button>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '16px' }}>›</span>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{sol.numero}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BotonHub />
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '28px 24px' }}>

        {/* ── Cabecera ──────────────────────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2DCDC', padding: '20px 24px', marginBottom: '14px' }}>

          {/* Título y badges */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: T, margin: '0 0 6px' }}>{sol.numero}</h2>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
                  {badge.texto}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: '#FEF2F2', color: '#C41230' }}>
                  {sol.tipo_carga}
                </span>
                {sol.caracteristicas?.map((c: string) => (
                  <span key={c} style={{ fontSize: '10px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: '#F4F2F2', color: T2 }}>{c}</span>
                ))}
              </div>
            </div>
            <p style={{ fontSize: '11px', color: T2, margin: 0, textAlign: 'right' }}>
              Creada el {formatFecha(sol.created_at, true)}
            </p>
          </div>

          {/* Coordinador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', color: T2 }}>Coordinador:</span>
            {coordNombre ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F4F2F2', border: '1px solid #E2DCDC', borderRadius: '20px', padding: '4px 12px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2E7D32' }} />
                <span style={{ fontSize: '12px', color: T, fontWeight: 500 }}>{coordNombre}</span>
              </div>
            ) : (
              <span style={{ fontSize: '12px', color: '#D1CCCC' }}>Sin asignar aún</span>
            )}
          </div>

          {/* Grid de datos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#F8F6F6', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
            {[
              { label: 'Cliente',       valor: sol.clientes?.razon_social || '—' },
              { label: 'Tipo unidad',   valor: sol.tipo_unidad || '—' },
              { label: 'Descripción',   valor: sol.descripcion_producto || '—' },
              { label: 'Fecha recojo',  valor: formatFecha(sol.fecha_recojo) },
              { label: 'Hora recojo',   valor: sol.hora_recojo  || '—' },
              { label: 'Fecha entrega', valor: formatFecha(sol.fecha_entrega) },
              { label: 'Hora entrega',  valor: sol.hora_entrega || '—' },
              { label: 'Peso',          valor: sol.peso    ? `${sol.peso} TN`  : '—' },
              { label: 'Volumen',       valor: sol.volumen ? `${sol.volumen} m³` : '—' },
              ...(sol.depot_vacios ? [{ label: 'DEPOT VACÍOS', valor: sol.depot_vacios }] : []),
            ].map((item) => (
              <div key={item.label}>
                <p style={{ fontSize: '9px', color: T2, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{item.label}</p>
                <p style={{ fontSize: '12px', fontWeight: 600, color: T, margin: 0 }}>{item.valor}</p>
              </div>
            ))}
          </div>

          {/* Instrucciones */}
          {sol.instrucciones && (
            <div style={{ background: '#FFF3E0', borderRadius: '8px', padding: '10px 14px', border: '1px solid #FFCC80' }}>
              <p style={{ fontSize: '9px', color: '#E65100', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase' }}>Instrucciones</p>
              <p style={{ fontSize: '12px', color: T, margin: 0, lineHeight: '1.5' }}>{sol.instrucciones}</p>
            </div>
          )}
        </div>

        {/* ── Precio ────────────────────────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2DCDC', padding: '20px 24px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: T, margin: 0 }}>Precio del servicio</p>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: tb.bg, color: tb.color, border: `1px solid ${tb.border}` }}>
              {tb.label}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: sol.precio_transporte ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: esRevision ? '16px' : '0' }}>
            <div style={{ background: '#F8F5FF', borderRadius: '10px', padding: '14px', border: '1px solid #DDD6FE' }}>
              <p style={{ fontSize: '9px', color: '#5B21B6', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 700 }}>Tu precio sugerido</p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: '#5B21B6', margin: 0 }}>S/ {sol.precio_sugerido}</p>
            </div>
            {sol.precio_transporte && (
              <div style={{ background: tEstado === 'revisar' ? '#FEF3C7' : '#F8F6F6', borderRadius: '10px', padding: '14px', border: `1px solid ${tEstado === 'revisar' ? '#FDE68A' : '#E2DCDC'}` }}>
                <p style={{ fontSize: '9px', color: tEstado === 'revisar' ? '#92400E' : T2, margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 700 }}>Precio de coordinación</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: tEstado === 'revisar' ? '#92400E' : T, margin: 0 }}>S/ {sol.precio_transporte}</p>
                {sol.precio_transporte > sol.precio_sugerido && (
                  <p style={{ fontSize: '10px', color: '#C41230', margin: '4px 0 0', fontWeight: 600 }}>
                    +S/ {(parseFloat(sol.precio_transporte) - parseFloat(sol.precio_sugerido)).toFixed(2)} sobre lo sugerido
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Comentario de coordinación */}
          {sol.precio_comentario && (
            <div style={{ background: '#FFF8F0', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', border: '1px solid #FFCC80' }}>
              <p style={{ fontSize: '9px', color: '#E65100', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase' }}>Motivo de coordinación</p>
              <p style={{ fontSize: '12px', color: T, margin: 0 }}>{sol.precio_comentario}</p>
            </div>
          )}

          {/* Botones de respuesta */}
          {esRevision && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => responderPrecio(true)} disabled={guardandoPrecio}
                style={{ flex: 1, padding: '11px', background: '#2E7D32', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: guardandoPrecio ? 0.6 : 1 }}>
                ✓ Procede con S/ {sol.precio_transporte}
              </button>
              <button onClick={() => responderPrecio(false)} disabled={guardandoPrecio}
                style={{ flex: 1, padding: '11px', background: '#FFEBEE', color: '#B71C1C', border: '1px solid #EF9A9A', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: guardandoPrecio ? 0.6 : 1 }}>
                ✗ No procede — revisar
              </button>
            </div>
          )}

          {tEstado === 'rechazado' && (
            <div style={{ background: '#FFEBEE', borderRadius: '8px', padding: '10px 14px', border: '1px solid #EF9A9A' }}>
              <p style={{ fontSize: '12px', color: '#B71C1C', margin: 0, fontWeight: 500 }}>
                Rechazaste este precio. Coordinación está revisando una nueva propuesta.
              </p>
            </div>
          )}
        </div>

        {/* ── Estado del servicio ────────────────────────────────────────────── */}
        {sol.estado && sol.estado !== 'Pendiente de asignación' && (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2DCDC', padding: '20px 24px', marginBottom: '14px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: T, margin: '0 0 4px' }}>Estado del servicio</p>
            <p style={{ fontSize: '11px', color: T2, margin: '0 0 12px' }}>Gestionado por el equipo de monitoreo</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: badge.bg, borderRadius: '8px', padding: '10px 16px', border: `1px solid ${badge.color}20` }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: badge.color }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: badge.color }}>{sol.estado}</span>
            </div>
          </div>
        )}

        {/* ── Adjunto ────────────────────────────────────────────────────────── */}
        {adjunto && (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2DCDC', padding: '20px 24px', marginBottom: '14px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: T, margin: '0 0 12px' }}>Adjunto</p>
            <div onClick={verAdjunto}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#E3F2FD', border: '1px solid #90CAF9', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer' }}>
              <span style={{ fontSize: '18px' }}>📄</span>
              <div>
                <p style={{ fontSize: '13px', color: '#1565C0', fontWeight: 600, margin: 0 }}>{adjunto.nombre}</p>
                <p style={{ fontSize: '10px', color: '#1565C0', margin: 0, opacity: 0.7 }}>Haz clic para ver</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Historial de cambios ───────────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2DCDC', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: T, margin: 0 }}>Historial de cambios</p>
            <span style={{ fontSize: '10px', color: '#2E7D32', background: '#F0FDF4', padding: '3px 10px', borderRadius: '20px', border: '1px solid #A5D6A7', fontWeight: 600 }}>● En tiempo real</span>
          </div>

          {historial.length === 0 ? (
            <p style={{ fontSize: '12px', color: T2, margin: 0, textAlign: 'center', padding: '16px 0' }}>Sin cambios registrados aún</p>
          ) : (
            historial.map((h, i) => (
              <div key={h.id || i} style={{ display: 'flex', gap: '12px', paddingBottom: i < historial.length - 1 ? '16px' : '0', position: 'relative' }}>
                {i < historial.length - 1 && (
                  <div style={{ position: 'absolute', left: '9px', top: '24px', width: '2px', height: 'calc(100% - 10px)', background: '#E2DCDC' }} />
                )}
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#F8F6F6', border: '2px solid #E2DCDC', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', zIndex: 1 }}>
                  🔄
                </div>
                <div style={{ flex: 1 }}>
                  {h.comentario && (
                    <p style={{ fontSize: '12px', color: T, margin: '0 0 3px', lineHeight: '1.5' }}>{h.comentario}</p>
                  )}
                  {!h.comentario && h.estado_nuevo && (
                    <p style={{ fontSize: '12px', color: T, margin: '0 0 3px' }}>
                      Estado actualizado a <strong>{h.estado_nuevo}</strong>
                    </p>
                  )}
                  <p style={{ fontSize: '10px', color: T2, margin: 0 }}>
                    {formatFecha(h.created_at, true)}
                    {h.perfiles?.nombre && <span style={{ marginLeft: '6px' }}>· {h.perfiles.nombre}</span>}
                    {!h.perfiles?.nombre && h.perfiles?.email && <span style={{ marginLeft: '6px' }}>· {h.perfiles.email}</span>}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}