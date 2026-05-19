'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonHub from '../components/BotonHub'

// ─── Constantes ───────────────────────────────────────────────────────────────

const T  = '#2C2828'
const T2 = '#696869'

const ESTADOS_FINALES = ['Descarga completada', 'Devolución realizada']

const estadoBadge = (estado: string) => {
  if (!estado || estado === 'Pendiente de asignación')
    return { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente' }
  if (estado === 'Asignado')
    return { bg: '#EEF2FF', color: '#3730A3', texto: 'Asignado' }
  if (ESTADOS_FINALES.includes(estado))
    return { bg: '#F0FDF4', color: '#15803D', texto: 'Completado' }
  return { bg: '#E0F2FE', color: '#0369A1', texto: 'En curso' }
}

// Estado de la tarifa
const estadoTarifa = (sol: any) => {
  if (!sol.precio_transporte) return 'esperando'           // transporte no ha respondido
  if (sol.precio_transporte <= sol.precio_sugerido) return 'ok'  // auto-confirmado
  if (sol.precio_procede === null) return 'revisar'        // operativo debe decidir
  if (sol.precio_procede === true) return 'aceptado'
  return 'rechazado'                                       // transporte debe modificar
}

const tarifaBadge: Record<string, { bg: string; color: string; label: string; border: string }> = {
  esperando: { bg: '#EDE9FE', color: '#5B21B6', label: '⏳ Espera coordinación', border: '#C4B5FD' },
  ok:        { bg: '#F0FDF4', color: '#15803D', label: '✓ Precio ok',            border: '#A5D6A7' },
  revisar:   { bg: '#FEF3C7', color: '#92400E', label: '⚠️ Revisar precio',       border: '#FDE68A' },
  aceptado:  { bg: '#F0FDF4', color: '#15803D', label: '✓ Aceptado',             border: '#A5D6A7' },
  rechazado: { bg: '#FFEBEE', color: '#B71C1C', label: '✗ Rechazado',            border: '#EF9A9A' },
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function OperativoPage() {
  const router = useRouter()
  const [loading, setLoading]         = useState(true)
  const [errorAcceso, setErrorAcceso] = useState<string | null>(null)
  const [rolUsuario, setRolUsuario]   = useState('')
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [busqueda, setBusqueda]       = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  // Modal revisión de precio
  const [modalPrecio, setModalPrecio]   = useState<any>(null)
  const [guardandoPrecio, setGuardandoPrecio] = useState(false)

  const rolRef    = useRef('')
  const userIdRef = useRef('')
  const iniciado  = useRef(false)

  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    init()
  }, [])

  // ── Init ──────────────────────────────────────────────────────────────────

  const init = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: perfil, error } = await supabase
        .from('perfiles').select('rol, nombre').eq('id', session.user.id).single()

      if (error || !perfil) {
        setErrorAcceso(`No se encontró tu perfil. Error: ${error?.message}`)
        setLoading(false); return
      }

      const rolesPermitidos = ['operativo_sli', 'admin_operativo', 'supervisor_sli', 'admin']
      if (!rolesPermitidos.includes(perfil.rol)) {
        setErrorAcceso(`Tu rol "${perfil.rol}" no tiene acceso a este módulo.`)
        setLoading(false); return
      }

      setRolUsuario(perfil.rol)
      rolRef.current    = perfil.rol
      userIdRef.current = session.user.id

      await cargarSolicitudes(perfil.rol, session.user.id)

      // Suscripción en tiempo real
      supabase.channel('op-solicitudes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_transporte' },
          () => cargarSolicitudes(rolRef.current, userIdRef.current))
        .subscribe()

    } catch (e: any) {
      setErrorAcceso(`Error inesperado: ${e?.message}`)
      setLoading(false)
    }
  }

  // ── Datos ─────────────────────────────────────────────────────────────────

const cargarSolicitudes = async (rol: string, userId: string) => {
  let query = supabase
    .from('solicitudes_transporte')
    .select(`*, clientes(razon_social)`)
    .order('created_at', { ascending: false })

  if (rol === 'operativo_sli') query = query.eq('operativo_id', userId)

  const { data, error } = await query
  if (error) {
    setErrorAcceso(`Error cargando solicitudes: ${error.message}`)
    setLoading(false); return
  }

  // Obtener nombres de coordinadores por separado
  const ids = [...new Set((data || []).map((s: any) => s.operativo_transporte_id).filter(Boolean))]
  let perfilesMap: Record<string, any> = {}

  if (ids.length > 0) {
    const { data: perfs } = await supabase
      .from('perfiles')
      .select('id, nombre, email')
      .in('id', ids)
    ;(perfs || []).forEach((p: any) => { perfilesMap[p.id] = p })
  }

  const solicitudesConPerfil = (data || []).map((s: any) => ({
    ...s,
    perfiles: perfilesMap[s.operativo_transporte_id] || null,
  }))

  setSolicitudes(solicitudesConPerfil)
  setLoading(false)
}

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const totalSols    = solicitudes.length
  const pendientes   = solicitudes.filter(s => s.estado === 'Pendiente de asignación').length
  const enCurso      = solicitudes.filter(s => s.estado && s.estado !== 'Pendiente de asignación' && !ESTADOS_FINALES.includes(s.estado)).length
  const completadas  = solicitudes.filter(s => ESTADOS_FINALES.includes(s.estado)).length
  const porRevisar   = solicitudes.filter(s => estadoTarifa(s) === 'revisar').length

  // ── Filtros ───────────────────────────────────────────────────────────────

  const solicitudesFiltradas = solicitudes.filter(s => {
    const matchBusqueda = busqueda === '' ||
      s.numero?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.clientes?.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.descripcion_producto?.toLowerCase().includes(busqueda.toLowerCase())

    const matchEstado = filtroEstado === 'todos' ||
      (filtroEstado === 'pendiente'  && s.estado === 'Pendiente de asignación') ||
      (filtroEstado === 'en_curso'   && s.estado && s.estado !== 'Pendiente de asignación' && !ESTADOS_FINALES.includes(s.estado)) ||
      (filtroEstado === 'completado' && ESTADOS_FINALES.includes(s.estado)) ||
      (filtroEstado === 'revisar'    && estadoTarifa(s) === 'revisar')

    return matchBusqueda && matchEstado
  })

  // ── Revisión de precio ────────────────────────────────────────────────────

  const responderPrecio = async (procede: boolean) => {
    if (!modalPrecio) return
    setGuardandoPrecio(true)

    await supabase.from('solicitudes_transporte')
      .update({ precio_procede: procede })
      .eq('id', modalPrecio.id)

    // Historial
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('solicitud_historial').insert({
      solicitud_id:    modalPrecio.id,
      usuario_id:      session?.user.id,
      estado_anterior: modalPrecio.estado,
      estado_nuevo:    modalPrecio.estado,
      comentario:      procede
        ? `Operativo aceptó precio de transporte: S/ ${modalPrecio.precio_transporte}`
        : `Operativo rechazó precio de transporte: S/ ${modalPrecio.precio_transporte} — requiere revisión`,
    })

    // Notificar a coordinación si rechaza
    if (!procede && modalPrecio.operativo_transporte_id) {
      await supabase.from('notificaciones_internas').insert({
        usuario_id: modalPrecio.operativo_transporte_id,
        mensaje:    `El operativo rechazó el precio S/ ${modalPrecio.precio_transporte} en ${modalPrecio.numero}. Favor revisar.`,
        link:       '/transporte/coordinacion',
      })
    }

    await cargarSolicitudes(rolRef.current, userIdRef.current)
    setGuardandoPrecio(false)
    setModalPrecio(null)
  }

  // ── Export Excel (supervisor_sli) ─────────────────────────────────────────

  const exportarExcel = useCallback(async () => {
    if (!['supervisor_sli', 'admin'].includes(rolUsuario)) return
    const XLSX = await import('xlsx')
    const datos = solicitudesFiltradas.map(s => ({
      'N° Solicitud':       s.numero,
      'Cliente':            s.clientes?.razon_social || '—',
      'Tipo carga':         s.tipo_carga,
      'Descripción':        s.descripcion_producto,
      'Fecha recojo':       s.fecha_recojo,
      'Hora recojo':        s.hora_recojo || '',
      'Fecha entrega':      s.fecha_entrega,
      'Hora entrega':       s.hora_entrega || '',
      'DEPOT VACÍOS':       s.depot_vacios || '',
      'Estado':             s.estado,
      'Coordinador':        s.perfiles?.nombre || s.perfiles?.email || '—',
      'Precio sugerido':    s.precio_sugerido || '',
      'Precio transporte':  s.precio_transporte || '',
      'Estado precio':      tarifaBadge[estadoTarifa(s)]?.label?.replace(/[⏳⚠️✓✗]/g, '').trim() || '',
      'Peso (TN)':          s.peso || '',
      'Volumen (m³)':       s.volumen || '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datos)
    ws['!cols'] = Array(Object.keys(datos[0]).length).fill({ wch: 18 })
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitudes')
    XLSX.writeFile(wb, `Solicitudes_${new Date().toISOString().split('T')[0]}.xlsx`)
  }, [rolUsuario, solicitudesFiltradas])

  // ── Pantalla de error ─────────────────────────────────────────────────────

  if (!loading && errorAcceso) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F2F2', fontFamily: "'Segoe UI', sans-serif", padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #E2DCDC', padding: '32px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: T, marginBottom: '8px' }}>Sin acceso</h2>
        <div style={{ background: '#F8F6F6', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
          <pre style={{ fontSize: '11px', color: '#C41230', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>{errorAcceso}</pre>
        </div>
        <button onClick={() => router.push('/hub')}
          style={{ width: '100%', padding: '10px', background: '#2C2828', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          ← Volver al hub
        </button>
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F2F2' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #E2DCDC', borderTopColor: '#C41230', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: T2, fontSize: '13px', margin: 0 }}>Cargando...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // ── Render principal ──────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#F4F2F2', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* MODAL REVISIÓN DE PRECIO */}
      {modalPrecio && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,40,40,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

            <div style={{ background: '#2C2828', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'white', margin: '0 0 2px' }}>⚠️ Revisar precio de transporte</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>{modalPrecio.numero}</p>
              </div>
              <button onClick={() => setModalPrecio(null)}
                style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: '14px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>
            <div style={{ height: '3px', background: '#C41230' }} />

            <div style={{ padding: '24px' }}>
              <p style={{ fontSize: '12px', color: T2, margin: '0 0 20px' }}>
                Coordinación propone un precio mayor al sugerido. Revisa el detalle y decide si procede.
              </p>

              {/* Comparativa */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div style={{ background: '#F8F6F6', borderRadius: '10px', padding: '14px', border: '1px solid #E2DCDC' }}>
                  <p style={{ fontSize: '9px', fontWeight: 700, color: T2, textTransform: 'uppercase', margin: '0 0 4px' }}>Tu precio sugerido</p>
                  <p style={{ fontSize: '22px', fontWeight: 800, color: T, margin: 0 }}>S/ {modalPrecio.precio_sugerido}</p>
                </div>
                <div style={{ background: '#FEF3C7', borderRadius: '10px', padding: '14px', border: '1px solid #FDE68A' }}>
                  <p style={{ fontSize: '9px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', margin: '0 0 4px' }}>Precio de transporte</p>
                  <p style={{ fontSize: '22px', fontWeight: 800, color: '#92400E', margin: 0 }}>S/ {modalPrecio.precio_transporte}</p>
                </div>
              </div>

              {/* Diferencia */}
              <div style={{ background: '#F8F6F6', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' }}>
                <p style={{ fontSize: '12px', color: T, margin: 0 }}>
                  Diferencia:&nbsp;
                  <strong style={{ color: '#C41230' }}>
                    +S/ {(parseFloat(modalPrecio.precio_transporte) - parseFloat(modalPrecio.precio_sugerido)).toFixed(2)}
                  </strong>
                  &nbsp;({(((parseFloat(modalPrecio.precio_transporte) - parseFloat(modalPrecio.precio_sugerido)) / parseFloat(modalPrecio.precio_sugerido)) * 100).toFixed(1)}% más)
                </p>
              </div>

              {/* Comentario de coordinación */}
              {modalPrecio.precio_comentario && (
                <div style={{ background: '#FFF8F0', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', border: '1px solid #FFCC80' }}>
                  <p style={{ fontSize: '9px', fontWeight: 700, color: '#E65100', textTransform: 'uppercase', margin: '0 0 4px' }}>Motivo de coordinación</p>
                  <p style={{ fontSize: '12px', color: T, margin: 0 }}>{modalPrecio.precio_comentario}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => responderPrecio(true)} disabled={guardandoPrecio}
                  style={{ flex: 1, padding: '11px', background: '#2E7D32', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: guardandoPrecio ? 0.6 : 1 }}>
                  ✓ Procede
                </button>
                <button onClick={() => responderPrecio(false)} disabled={guardandoPrecio}
                  style={{ flex: 1, padding: '11px', background: '#FFEBEE', color: '#B71C1C', border: '1px solid #EF9A9A', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: guardandoPrecio ? 0.6 : 1 }}>
                  ✗ No procede
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{ background: '#2C2828', padding: '0 28px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} onClick={() => router.push('/hub')} />
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>Solicitudes de transporte</span>
          {rolUsuario === 'supervisor_sli' && (
            <span style={{ fontSize: '10px', background: 'rgba(196,18,48,0.3)', color: '#FCA5A5', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, border: '1px solid rgba(196,18,48,0.4)' }}>
              Supervisor SLI
            </span>
          )}
          {rolUsuario === 'admin_operativo' && (
            <span style={{ fontSize: '10px', background: 'rgba(196,18,48,0.3)', color: '#FCA5A5', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, border: '1px solid rgba(196,18,48,0.4)' }}>
              Admin Operativo
            </span>
          )}
          {porRevisar > 0 && (
            <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, border: '1px solid #FDE68A' }}>
              ⚠️ {porRevisar} precio{porRevisar > 1 ? 's' : ''} por revisar
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {['supervisor_sli', 'admin'].includes(rolUsuario) && (
            <button onClick={exportarExcel}
              style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '7px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              ↓ Exportar Excel
            </button>
          )}
          <button onClick={() => router.push('/operativo/nueva')}
            style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '7px', padding: '6px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            + Nueva solicitud
          </button>
          <BotonHub />
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      {/* HERO + KPIs */}
      <div style={{ background: '#2C2828' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 28px 0' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'white', margin: '0 0 2px' }}>
            {rolUsuario === 'operativo_sli' ? 'Mis solicitudes' : 'Todas las solicitudes'}
          </h1>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              { label: 'Total',             valor: totalSols,   first: true },
              { label: 'Pendientes',        valor: pendientes,  first: false },
              { label: 'En curso',          valor: enCurso,     first: false },
              { label: 'Completadas',       valor: completadas, first: false },
              { label: 'Precios por revisar', valor: porRevisar, first: false, alert: porRevisar > 0 },
            ].map((kpi, i) => (
              <div key={kpi.label} style={{
                padding: '16px 20px',
                borderTop: kpi.first ? '3px solid #C41230' : '3px solid transparent',
                borderRight: i < 4 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              }}>
                <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px', fontWeight: 600 }}>{kpi.label}</p>
                <p style={{ fontSize: '26px', fontWeight: 800, color: kpi.alert ? '#FDE68A' : 'white', margin: 0, lineHeight: 1 }}>{kpi.valor}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 28px' }}>

        {/* Alerta precios por revisar */}
        {porRevisar > 0 && (
          <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', margin: '0 0 2px' }}>
                {porRevisar} solicitud{porRevisar > 1 ? 'es tienen' : ' tiene'} un precio mayor al sugerido
              </p>
              <p style={{ fontSize: '11px', color: '#92400E', margin: 0 }}>
                Haz clic en la columna de precio para revisar y decidir si procede.
              </p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #E2DCDC', padding: '12px 16px', marginBottom: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="text" placeholder="Buscar por número, cliente o descripción..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ flex: 1, padding: '7px 12px', border: '1.5px solid #E2DCDC', borderRadius: '7px', fontSize: '12px', outline: 'none', color: T }} />
          {(['todos', 'pendiente', 'en_curso', 'completado', 'revisar'] as const).map(f => (
            <button key={f} onClick={() => setFiltroEstado(f)}
              style={{
                fontSize: '11px', fontWeight: 600, padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                background: filtroEstado === f ? '#2C2828' : '#F4F2F2',
                color:      filtroEstado === f ? 'white'  : T2,
              }}>
              {{ todos: 'Todos', pendiente: 'Pendientes', en_curso: 'En curso', completado: 'Completadas', revisar: '⚠️ Por revisar' }[f]}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2DCDC', overflow: 'hidden' }}>

          {/* Cabecera */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 110px 120px 120px 90px', gap: '8px', padding: '10px 20px', background: '#F8F6F6', borderBottom: '1px solid #E2DCDC', fontSize: '10px', fontWeight: 700, color: T2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <span>Solicitud</span>
            <span>Tipo carga</span>
            <span>Coordinador</span>
            <span>Precio sug.</span>
            <span>Estado</span>
            <span>Precio</span>
            <span></span>
          </div>

          {solicitudesFiltradas.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ fontSize: '28px', margin: '0 0 12px' }}>📭</p>
              <p style={{ fontSize: '14px', color: T2, margin: '0 0 16px', fontWeight: 600 }}>Sin solicitudes</p>
              <button onClick={() => router.push('/operativo/nueva')}
                style={{ background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                + Nueva solicitud
              </button>
            </div>
          ) : solicitudesFiltradas.map((sol, i) => {
            const badge   = estadoBadge(sol.estado)
            const tEstado = estadoTarifa(sol)
            const tb      = tarifaBadge[tEstado]
            const esRevision = tEstado === 'revisar'
            const coordNombre = sol.perfiles?.nombre || sol.perfiles?.email

            return (
              <div key={sol.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 130px 110px 120px 120px 90px',
                  gap: '8px',
                  padding: '13px 20px',
                  borderBottom: i < solicitudesFiltradas.length - 1 ? '1px solid #F5F2F2' : 'none',
                  background: esRevision ? '#FFFBEB' : i % 2 === 0 ? 'white' : '#FAFAFA',
                  alignItems: 'center',
                  borderLeft: esRevision ? '3px solid #F59E0B' : '3px solid transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8F6F6')}
                onMouseLeave={e => (e.currentTarget.style.background = esRevision ? '#FFFBEB' : i % 2 === 0 ? 'white' : '#FAFAFA')}>

                {/* Info principal */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: T }}>{sol.numero}</span>
                    {esRevision && <span style={{ fontSize: '9px', background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>PRECIO</span>}
                  </div>
                  <p style={{ fontSize: '11px', color: T2, margin: '0 0 1px' }}>
                    {sol.clientes?.razon_social || '—'}
                  </p>
                  <p style={{ fontSize: '10px', color: '#D1CCCC', margin: 0 }}>
                    {sol.descripcion_producto || '—'} · {sol.fecha_recojo ? new Date(sol.fecha_recojo).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '—'}
                  </p>
                </div>

                {/* Tipo carga */}
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: T }}>
                    {sol.tipo_carga}
                  </span>
                  {sol.caracteristicas && sol.caracteristicas.length > 0 && (
                    <p style={{ fontSize: '10px', color: T2, margin: '2px 0 0' }}>
                      {sol.caracteristicas.slice(0, 2).join(', ')}
                    </p>
                  )}
                </div>

                {/* Coordinador */}
                <div>
                  {coordNombre ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F4F2F2', border: '1px solid #E2DCDC', borderRadius: '20px', padding: '3px 10px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2E7D32', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: T, fontWeight: 500 }}>{coordNombre}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#D1CCCC' }}>Sin asignar</span>
                  )}
                </div>

                {/* Precio sugerido */}
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#5B21B6' }}>
                  S/ {sol.precio_sugerido || '—'}
                </span>

                {/* Estado */}
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', background: badge.bg, color: badge.color, whiteSpace: 'nowrap' as const }}>
                  {badge.texto}
                </span>

                {/* Precio / tarifa */}
                <div>
                  <span
                    onClick={esRevision ? () => setModalPrecio(sol) : undefined}
                    style={{
                      fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px',
                      background: tb.bg, color: tb.color, border: `1px solid ${tb.border}`,
                      whiteSpace: 'nowrap' as const,
                      cursor: esRevision ? 'pointer' : 'default',
                      display: 'inline-block',
                    }}>
                    {tb.label}
                  </span>
                  {sol.precio_transporte && (
                    <p style={{ fontSize: '10px', color: T2, margin: '3px 0 0' }}>S/ {sol.precio_transporte}</p>
                  )}
                </div>

                {/* Acción */}
                <button onClick={() => router.push(`/operativo/${sol.id}`)}
                  style={{ fontSize: '11px', background: '#F4F2F2', color: T, border: '1px solid #E2DCDC', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
                  Ver →
                </button>
              </div>
            )
          })}

          {/* Footer */}
          {solicitudesFiltradas.length > 0 && (
            <div style={{ padding: '10px 20px', borderTop: '1px solid #E2DCDC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA' }}>
              <span style={{ fontSize: '11px', color: T2 }}>
                {solicitudesFiltradas.length} solicitud{solicitudesFiltradas.length !== 1 ? 'es' : ''}
                {solicitudesFiltradas.length !== solicitudes.length && ` (de ${solicitudes.length} total)`}
              </span>
              {['supervisor_sli', 'admin'].includes(rolUsuario) && (
                <button onClick={exportarExcel}
                  style={{ fontSize: '11px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}>
                  ↓ Exportar Excel
                </button>
              )}
            </div>
          )}
        </div>

        {!['supervisor_sli', 'admin'].includes(rolUsuario) && rolUsuario && (
          <p style={{ fontSize: '11px', color: '#D1CCCC', textAlign: 'center', marginTop: '12px' }}>
            La exportación de reportes está disponible para el Supervisor SLI
          </p>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}