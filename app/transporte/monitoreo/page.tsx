'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BotonHub from '../../components/BotonHub'

const ESTADOS = [
  { key: 'asignado',   label: 'Asignado',    color: '#1565C0', bg: '#E3F2FD', icon: '📋' },
  { key: 'en_ruta',    label: 'En ruta',     color: '#E65100', bg: '#FFF3E0', icon: '🚛' },
  { key: 'en_destino', label: 'En destino',  color: '#6A1B9A', bg: '#F3E5F5', icon: '📍' },
  { key: 'entregado',  label: 'Entregado',   color: '#2E7D32', bg: '#E8F5E9', icon: '✅' },
]

const TIPOS_INCIDENCIA = ['Retraso', 'Falla mecánica', 'Accidente', 'Documentación', 'Otro']

function BadgeEstado({ estado }: { estado: string }) {
  const e = ESTADOS.find(e => e.key === estado)
  if (!e) return null
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, background: e.bg, color: e.color, padding: '3px 10px', borderRadius: '20px' }}>
      {e.icon} {e.label}
    </span>
  )
}

export default function MonitoreoPage() {
  const router = useRouter()
  const [perfil,       setPerfil]       = useState<any>(null)
  const [solicitudes,  setSolicitudes]  = useState<any[]>([])
  const [seleccionada, setSeleccionada] = useState<any>(null)
  const selRef = useRef<any>(null)
  const [incidencias,  setIncidencias]  = useState<any[]>([])
  const [filtro,       setFiltro]       = useState<'en_curso' | 'entregado' | 'todos'>('en_curso')
  const [cargando,     setCargando]     = useState(true)

  const [modoIncidencia, setModoIncidencia] = useState(false)
  const [tipoInc,        setTipoInc]        = useState(TIPOS_INCIDENCIA[0])
  const [detalleInc,     setDetalleInc]     = useState('')
  const [guardandoInc,   setGuardandoInc]   = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [subiendoEvidencia, setSubiendoEvidencia] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (!p || !['monitor', 'transporte', 'admin'].includes(p.rol)) { router.push('/hub'); return }
      setPerfil(p)
      cargar()
    }
    init()
  }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('solicitudes_transporte')
      .select(`*, empresa:empresa_id(razon_social), conductor:conductor_id(nombre, telefono), unidad:unidad_id(placa, tipo)`)
      .in('estado', ['asignado', 'en_ruta', 'en_destino', 'entregado'])
      .order('created_at', { ascending: false })
    setSolicitudes(data || [])
    setCargando(false)
  }

  async function seleccionar(sol: any) {
    setSeleccionada(sol)
    selRef.current = sol
    setModoIncidencia(false)
    setDetalleInc('')
    const { data } = await supabase
      .from('incidencias_transporte')
      .select('*, creado_por_perfil:creado_por(nombre)')
      .eq('solicitud_id', sol.id)
      .order('created_at', { ascending: true })
    setIncidencias(data || [])
  }

  async function avanzarEstado() {
    if (!seleccionada) return
    const idx = ESTADOS.findIndex(e => e.key === seleccionada.estado)
    if (idx >= ESTADOS.length - 1) return
    const nuevoEstado = ESTADOS[idx + 1].key
    if (nuevoEstado === 'entregado' && !seleccionada.evidencia_entrega_url) {
      alert('Debes subir la evidencia de entrega antes de marcar como entregado.')
      return
    }
    setCambiandoEstado(true)
    const upd: any = { estado: nuevoEstado }
    if (nuevoEstado === 'entregado') upd.fecha_entrega_real = new Date().toISOString()
    await supabase.from('solicitudes_transporte').update(upd).eq('id', seleccionada.id)
    const updated = { ...seleccionada, ...upd }
    setSeleccionada(updated)
    selRef.current = updated
    setSolicitudes(prev => prev.map(s => s.id === seleccionada.id ? updated : s))
    setCambiandoEstado(false)
  }

  async function guardarIncidencia() {
    if (!detalleInc.trim() || !seleccionada) return
    setGuardandoInc(true)
    const { data: { session } } = await supabase.auth.getSession()
    const { data: inc } = await supabase
      .from('incidencias_transporte')
      .insert({ solicitud_id: seleccionada.id, tipo: tipoInc, detalle: detalleInc.trim(), creado_por: session?.user.id })
      .select('*, creado_por_perfil:creado_por(nombre)')
      .single()
    if (inc) setIncidencias(prev => [...prev, inc])
    setDetalleInc('')
    setTipoInc(TIPOS_INCIDENCIA[0])
    setModoIncidencia(false)
    setGuardandoInc(false)
  }

  async function subirEvidencia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !seleccionada) return
    setSubiendoEvidencia(true)
    const ext  = file.name.split('.').pop()
    const path = `evidencia/${seleccionada.id}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (error) { alert('Error al subir archivo'); setSubiendoEvidencia(false); return }
    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
    await supabase.from('solicitudes_transporte').update({ evidencia_entrega_url: publicUrl, evidencia_entrega_nombre: file.name }).eq('id', seleccionada.id)
    const updated = { ...seleccionada, evidencia_entrega_url: publicUrl, evidencia_entrega_nombre: file.name }
    setSeleccionada(updated)
    setSolicitudes(prev => prev.map(s => s.id === seleccionada.id ? updated : s))
    setSubiendoEvidencia(false)
  }

  const listaFiltrada = solicitudes.filter(s => {
    if (filtro === 'en_curso')  return ['asignado', 'en_ruta', 'en_destino'].includes(s.estado)
    if (filtro === 'entregado') return s.estado === 'entregado'
    return true
  })

  const idxActual = seleccionada ? ESTADOS.findIndex(e => e.key === seleccionada.estado) : -1

  const inp: any = { width: '100%', padding: '9px 12px', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: 'white', color: '#2C2828', outline: 'none', boxSizing: 'border-box' }
  const lbl: any = { fontSize: '11px', fontWeight: 700, color: '#8A9BB0', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }

  if (!perfil) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #EEE', borderTopColor: '#C41230', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* NAV */}
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/hub">
            <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
          </a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <button onClick={() => router.push('/transporte')}
            style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Transporte
          </button>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>›</span>
          <span style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>Monitoreo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', margin: 0, lineHeight: 1.2 }}>{perfil.nombre || perfil.email}</p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', margin: 0, textTransform: 'capitalize' }}>{perfil.rol?.replace('_', ' ')}</p>
          </div>
          <BotonHub />
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ display: 'flex', height: 'calc(100vh - 59px)' }}>

        {/* ── Panel izquierdo ── */}
        <div style={{ width: '300px', minWidth: '300px', background: 'white', borderRight: '1px solid #E8ECF0', display: 'flex', flexDirection: 'column' }}>

          {/* Título panel */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8ECF0' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 12px' }}>📡 Servicios</p>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['en_curso', 'entregado', 'todos'] as const).map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  style={{ flex: 1, padding: '6px 4px', border: `1px solid ${filtro === f ? '#0F1923' : '#E8ECF0'}`, borderRadius: '8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', background: filtro === f ? '#0F1923' : 'white', color: filtro === f ? 'white' : '#8A9BB0' }}>
                  {f === 'en_curso' ? '🚛 Curso' : f === 'entregado' ? '✅ Entregados' : '📋 Todos'}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {cargando ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#8A9BB0', fontSize: '13px' }}>Cargando...</div>
            ) : listaFiltrada.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#8A9BB0', fontSize: '13px' }}>No hay servicios</div>
            ) : listaFiltrada.map(sol => {
              const activo = seleccionada?.id === sol.id
              return (
                <div key={sol.id} onClick={() => seleccionar(sol)}
                  style={{ padding: '14px 20px', borderBottom: '1px solid #E8ECF0', cursor: 'pointer', background: activo ? '#F8F9FA' : 'white', borderLeft: activo ? '3px solid #C41230' : '3px solid transparent', transition: 'all 0.1s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F1923' }}>
                      #{String(sol.id).slice(-6).toUpperCase()}
                    </span>
                    <BadgeEstado estado={sol.estado} />
                  </div>
                  <p style={{ fontSize: '12px', color: '#0F1923', margin: '0 0 4px', fontWeight: 600 }}>{sol.cliente}</p>
                  <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>
                    {sol.empresa?.razon_social || '—'} · {sol.conductor?.nombre || '—'}
                  </p>
                  {sol.fecha_recojo && (
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '4px 0 0' }}>
                      📅 {new Date(sol.fecha_recojo).toLocaleDateString('es-PE')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Panel derecho ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#F0F2F5' }}>
          {!seleccionada ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8A9BB0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📡</div>
              <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px', color: '#0F1923' }}>Selecciona un servicio</p>
              <p style={{ fontSize: '13px', margin: 0 }}>Elige una solicitud de la lista para monitorear</p>
            </div>
          ) : (
            <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Header */}
              <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                      Solicitud #{String(seleccionada.id).slice(-6).toUpperCase()}
                    </p>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F1923', margin: '0 0 8px' }}>{seleccionada.cliente}</h2>
                    <BadgeEstado estado={seleccionada.estado} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '12px', color: '#8A9BB0', lineHeight: '1.8' }}>
                    {seleccionada.fecha_recojo && <div>📅 {new Date(seleccionada.fecha_recojo).toLocaleDateString('es-PE')}</div>}
                    {seleccionada.hora_recojo  && <div>🕐 {seleccionada.hora_recojo}</div>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E8ECF0' }}>
                  {[
                    { label: 'Empresa',   value: seleccionada.empresa?.razon_social, sub: null },
                    { label: 'Conductor', value: seleccionada.conductor?.nombre,     sub: seleccionada.conductor?.telefono ? `📞 ${seleccionada.conductor.telefono}` : null },
                    { label: 'Unidad',    value: seleccionada.unidad?.placa,         sub: seleccionada.unidad?.tipo || null },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ ...lbl }}>{item.label}</p>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: 0 }}>{item.value || '—'}</p>
                      {item.sub && <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '2px 0 0' }}>{item.sub}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Progreso de estados */}
              <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Estado del servicio</h3>
                  {seleccionada.estado !== 'entregado' && (
                    <button onClick={avanzarEstado} disabled={cambiandoEstado}
                      style={{ padding: '8px 18px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: cambiandoEstado ? 0.6 : 1 }}>
                      {cambiandoEstado ? 'Actualizando...' : `→ ${ESTADOS[idxActual + 1]?.label}`}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex' }}>
                  {ESTADOS.map((e, i) => {
                    const done    = i <= idxActual
                    const current = i === idxActual
                    return (
                      <div key={e.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative' }}>
                        {i > 0 && (
                          <div style={{ position: 'absolute', left: '-50%', top: '20px', width: '100%', height: '3px', background: i <= idxActual ? '#C41230' : '#E8ECF0', zIndex: 0 }} />
                        )}
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: current ? '#C41230' : done ? '#FFEBEE' : '#F0F2F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', border: current ? '2px solid #C41230' : '2px solid transparent', position: 'relative', zIndex: 1, boxShadow: current ? '0 0 0 4px rgba(196,18,48,0.12)' : 'none', transition: 'all 0.3s' }}>
                          {e.icon}
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: current ? 700 : 500, color: current ? '#C41230' : done ? '#0F1923' : '#8A9BB0', textAlign: 'center', lineHeight: '1.3' }}>
                          {e.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {seleccionada.estado === 'entregado' && seleccionada.fecha_entrega_real && (
                  <div style={{ marginTop: '16px', padding: '10px 14px', background: '#E8F5E9', borderRadius: '8px', fontSize: '12px', color: '#2E7D32', fontWeight: 600 }}>
                    ✅ Entregado el {new Date(seleccionada.fecha_entrega_real).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>

              {/* Incidencias */}
              <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: 0 }}>
                    Incidencias
                    {incidencias.length > 0 && (
                      <span style={{ fontSize: '11px', background: '#FFF3E0', color: '#E65100', padding: '2px 8px', borderRadius: '12px', marginLeft: '8px' }}>{incidencias.length}</span>
                    )}
                  </h3>
                  {!modoIncidencia && seleccionada.estado !== 'entregado' && (
                    <button onClick={() => setModoIncidencia(true)}
                      style={{ padding: '7px 14px', background: '#FFF3E0', color: '#E65100', border: '1px solid #FFCC80', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      + Agregar incidencia
                    </button>
                  )}
                </div>

                {incidencias.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: modoIncidencia ? '16px' : 0 }}>
                    {incidencias.map(inc => (
                      <div key={inc.id} style={{ padding: '12px 14px', background: '#FFF8F0', borderRadius: '10px', border: '1px solid #FFCC80' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#FFF3E0', color: '#E65100', padding: '2px 8px', borderRadius: '12px' }}>{inc.tipo}</span>
                          <span style={{ fontSize: '10px', color: '#8A9BB0' }}>
                            {new Date(inc.created_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#0F1923', margin: 0, lineHeight: '1.5' }}>{inc.detalle}</p>
                        {inc.creado_por_perfil?.nombre && (
                          <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '4px 0 0' }}>Por: {inc.creado_por_perfil.nombre}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {incidencias.length === 0 && !modoIncidencia && (
                  <p style={{ fontSize: '12px', color: '#8A9BB0', margin: 0 }}>Sin incidencias registradas.</p>
                )}

                {modoIncidencia && (
                  <div style={{ background: '#FFFBF5', borderRadius: '10px', border: '1px solid #FFCC80', padding: '16px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ ...lbl }}>Tipo</label>
                      <select value={tipoInc} onChange={e => setTipoInc(e.target.value)} style={{ ...inp }}>
                        {TIPOS_INCIDENCIA.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ ...lbl }}>Detalle <span style={{ color: '#C41230' }}>*</span></label>
                      <textarea value={detalleInc} onChange={e => setDetalleInc(e.target.value)}
                        rows={3} placeholder="Describe la incidencia..."
                        style={{ ...inp, resize: 'none', fontFamily: 'inherit', lineHeight: '1.5' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={guardarIncidencia} disabled={guardandoInc || !detalleInc.trim()}
                        style={{ flex: 1, padding: '10px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (!detalleInc.trim() || guardandoInc) ? 0.5 : 1 }}>
                        {guardandoInc ? 'Guardando...' : 'Registrar incidencia'}
                      </button>
                      <button onClick={() => { setModoIncidencia(false); setDetalleInc('') }}
                        style={{ padding: '10px 16px', background: '#F0F2F5', color: '#0F1923', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Evidencia de entrega */}
              <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 16px' }}>Evidencia de entrega</h3>

                {seleccionada.evidencia_entrega_url ? (
                  <div style={{ padding: '14px', background: '#E8F5E9', borderRadius: '10px', border: '1px solid #A5D6A7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '24px' }}>📎</span>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#2E7D32', margin: 0 }}>Evidencia cargada</p>
                        <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '2px 0 0' }}>{seleccionada.evidencia_entrega_nombre}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={seleccionada.evidencia_entrega_url} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '7px 14px', background: '#2E7D32', color: 'white', borderRadius: '8px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                        Ver
                      </a>
                      {seleccionada.estado !== 'entregado' && (
                        <button onClick={() => fileRef.current?.click()}
                          style={{ padding: '7px 14px', background: '#F0F2F5', color: '#0F1923', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                          Reemplazar
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div onClick={() => seleccionada.estado !== 'entregado' && fileRef.current?.click()}
                    style={{ border: '2px dashed #E8ECF0', borderRadius: '12px', padding: '32px', textAlign: 'center', cursor: seleccionada.estado === 'entregado' ? 'default' : 'pointer', background: '#FAFBFC' }}>
                    {subiendoEvidencia ? (
                      <p style={{ fontSize: '14px', color: '#8A9BB0', margin: 0 }}>Subiendo...</p>
                    ) : (
                      <>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#0F1923', margin: '0 0 4px' }}>Subir evidencia final</p>
                        <p style={{ fontSize: '12px', color: '#8A9BB0', margin: 0 }}>Foto o PDF de la entrega · JPG, PNG, PDF</p>
                      </>
                    )}
                  </div>
                )}

                <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={subirEvidencia} />

                {!seleccionada.evidencia_entrega_url && seleccionada.estado !== 'entregado' && (
                  <p style={{ fontSize: '11px', color: '#E65100', margin: '8px 0 0', fontWeight: 600 }}>
                    ⚠️ La evidencia es requerida antes de marcar como Entregado
                  </p>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}