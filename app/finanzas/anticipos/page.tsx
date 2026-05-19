'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BotonHub from '../../components/BotonHub'

const ESTADOS: Record<string, { bg: string; color: string; label: string }> = {
  pendiente_firma: { bg: '#FFF3E0', color: '#E65100',  label: 'Pendiente de firma' },
  firmado:         { bg: '#E3F2FD', color: '#1565C0',  label: 'Firmado'            },
  pagado:          { bg: '#E8F5E9', color: '#2E7D32',  label: 'Pagado'             },
  regularizado:    { bg: '#F3E5F5', color: '#6A1B9A',  label: 'Regularizado'       },
  observado:       { bg: '#FFEBEE', color: '#B71C1C',  label: 'Observado'          },
}

function BadgeEstado({ estado }: { estado: string }) {
  const e = ESTADOS[estado] || { bg: '#F0F2F5', color: '#8A9BB0', label: estado }
  return <span style={{ fontSize: '10px', fontWeight: 700, background: e.bg, color: e.color, padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' as const }}>{e.label}</span>
}

export default function AnticiposPage() {
  const router = useRouter()
  const [perfil,      setPerfil]      = useState<any>(null)
  const [anticipos,   setAnticipos]   = useState<any[]>([])
  const [seleccionado, setSeleccionado] = useState<any>(null)
  const [cargando,    setCargando]    = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda,    setBusqueda]    = useState('')

  // Panel finanzas
  const [nuevoEstado,      setNuevoEstado]      = useState('')
  const [obsFinanzas,      setObsFinanzas]      = useState('')
  const [movBancario,      setMovBancario]      = useState('')
  const [guardando,        setGuardando]        = useState(false)
  const [subiendoComp,     setSubiendoComp]     = useState(false)
  const [subiendoFact,     setSubiendoFact]     = useState(false)
  const compRef = useRef<HTMLInputElement>(null)
  const factRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (!p || !['operativo_sli', 'admin_operativo', 'supervisor_sli', 'finanzas', 'admin'].includes(p.rol)) {
        router.push('/hub'); return
      }
      setPerfil(p)
      await cargar(p)
    }
    init()
  }, [])

  const cargar = async (p?: any) => {
    const perfActual = p || perfil
    setCargando(true)
    let query = supabase
      .from('anticipos')
      .select('*, solicitante:solicitante_id(nombre, email)')
      .order('created_at', { ascending: false })

    if (['operativo_sli', 'admin_operativo', 'supervisor_sli'].includes(perfActual?.rol)) {
      const { data: { session } } = await supabase.auth.getSession()
      query = query.eq('solicitante_id', session?.user.id)
    }

    const { data } = await query
    setAnticipos(data || [])
    setCargando(false)
  }

  const seleccionar = (ant: any) => {
    setSeleccionado(ant)
    setNuevoEstado(ant.estado)
    setObsFinanzas(ant.observacion_finanzas || '')
    setMovBancario(ant.mov_bancario || '')
  }

  const esFinanzas  = perfil && ['finanzas', 'admin'].includes(perfil.rol)
  const esOperativo = perfil && ['operativo_sli', 'admin_operativo', 'supervisor_sli', 'admin'].includes(perfil.rol)

  const guardarCambios = async () => {
    if (!seleccionado) return
    setGuardando(true)
    await supabase.from('anticipos').update({
      estado:               nuevoEstado,
      observacion_finanzas: obsFinanzas || null,
      mov_bancario:         movBancario || null,
    }).eq('id', seleccionado.id)
    const updated = { ...seleccionado, estado: nuevoEstado, observacion_finanzas: obsFinanzas, mov_bancario: movBancario }
    setSeleccionado(updated)
    setAnticipos(prev => prev.map(a => a.id === seleccionado.id ? updated : a))
    setGuardando(false)
  }

  const subirArchivo = async (file: File, tipo: 'comprobante' | 'factura') => {
    if (!seleccionado || !file) return
    tipo === 'comprobante' ? setSubiendoComp(true) : setSubiendoFact(true)
    const ext  = file.name.split('.').pop()
    const path = `anticipos/${seleccionado.id}/${tipo}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (error) { alert('Error al subir archivo'); tipo === 'comprobante' ? setSubiendoComp(false) : setSubiendoFact(false); return }
    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
    const upd = tipo === 'comprobante'
      ? { comprobante_url: publicUrl, comprobante_nombre: file.name }
      : { factura_url: publicUrl, factura_nombre: file.name, fecha_regularizacion: new Date().toISOString().split('T')[0] }
    await supabase.from('anticipos').update(upd).eq('id', seleccionado.id)
    const updated = { ...seleccionado, ...upd }
    setSeleccionado(updated)
    setAnticipos(prev => prev.map(a => a.id === seleccionado.id ? updated : a))
    tipo === 'comprobante' ? setSubiendoComp(false) : setSubiendoFact(false)
  }

  const listaFiltrada = anticipos.filter(a => {
    const matchEstado  = filtroEstado === 'todos' || a.estado === filtroEstado
    const matchBusqueda = !busqueda ||
      a.numero?.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.proveedor?.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.solicitante?.nombre?.toLowerCase().includes(busqueda.toLowerCase())
    return matchEstado && matchBusqueda
  })

  const inp: any = { width: '100%', padding: '9px 12px', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: 'white', color: '#0F1923', outline: 'none', boxSizing: 'border-box' }
  const lbl: any = { fontSize: '11px', fontWeight: 700, color: '#8A9BB0', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }

  if (!perfil) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #EEE', borderTopColor: '#C41230', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/hub"><img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} /></a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <button onClick={() => router.push('/finanzas')} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Finanzas</button>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>Anticipos</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {esOperativo && (
            <button onClick={() => router.push('/finanzas/anticipos/nueva')}
              style={{ padding: '7px 16px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              + Nueva solicitud
            </button>
          )}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', margin: 0 }}>{perfil.nombre || perfil.email}</p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', margin: 0, textTransform: 'capitalize' }}>{perfil.rol?.replace('_', ' ')}</p>
          </div>
          <BotonHub />
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ display: 'flex', height: 'calc(100vh - 59px)' }}>

        {/* ── Panel izquierdo ── */}
        <div style={{ width: '320px', minWidth: '320px', background: 'white', borderRight: '1px solid #E8ECF0', display: 'flex', flexDirection: 'column' }}>

          <div style={{ padding: '14px 16px', borderBottom: '1px solid #E8ECF0' }}>
            <input placeholder="Buscar proveedor, número..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ ...inp, marginBottom: '10px' }} />
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {['todos', ...Object.keys(ESTADOS)].map(f => (
                <button key={f} onClick={() => setFiltroEstado(f)}
                  style={{ padding: '4px 10px', border: `1px solid ${filtroEstado === f ? '#0F1923' : '#E8ECF0'}`, borderRadius: '20px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', background: filtroEstado === f ? '#0F1923' : 'white', color: filtroEstado === f ? 'white' : '#8A9BB0' }}>
                  {f === 'todos' ? 'Todos' : ESTADOS[f].label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {cargando ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#8A9BB0', fontSize: '13px' }}>Cargando...</div>
            ) : listaFiltrada.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#8A9BB0', fontSize: '13px' }}>
                <p style={{ fontSize: '28px', margin: '0 0 8px' }}>💸</p>
                Sin solicitudes
              </div>
            ) : listaFiltrada.map(ant => (
              <div key={ant.id} onClick={() => seleccionar(ant)}
                style={{ padding: '14px 16px', borderBottom: '1px solid #E8ECF0', cursor: 'pointer', background: seleccionado?.id === ant.id ? '#F8F9FA' : 'white', borderLeft: seleccionado?.id === ant.id ? '3px solid #C41230' : '3px solid transparent', transition: 'all 0.1s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F1923' }}>{ant.numero}</span>
                  <BadgeEstado estado={ant.estado} />
                </div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F1923', margin: '0 0 3px' }}>{ant.proveedor}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: '#8A9BB0' }}>{ant.moneda} {parseFloat(ant.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                  <span style={{ fontSize: '10px', color: '#8A9BB0' }}>{new Date(ant.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</span>
                </div>
                {esFinanzas && ant.solicitante && (
                  <p style={{ fontSize: '10px', color: '#BCC6D0', margin: '3px 0 0' }}>Por: {ant.solicitante.nombre || ant.solicitante.email}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Panel derecho ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#F0F2F5' }}>
          {!seleccionado ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8A9BB0' }}>
              <p style={{ fontSize: '48px', margin: '0 0 12px' }}>💸</p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#0F1923', margin: '0 0 4px' }}>Selecciona una solicitud</p>
              <p style={{ fontSize: '13px', margin: 0 }}>Elige un anticipo de la lista para ver el detalle</p>
            </div>
          ) : (
            <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Header */}
              <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{seleccionado.numero}</p>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F1923', margin: '0 0 8px' }}>{seleccionado.proveedor}</h2>
                    <BadgeEstado estado={seleccionado.estado} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '24px', fontWeight: 800, color: '#6A1B9A', margin: 0 }}>
                      {seleccionado.moneda} {parseFloat(seleccionado.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </p>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '4px 0 0' }}>
                      {new Date(seleccionado.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E8ECF0' }}>
                  {[
                    { label: 'Solicitante',  value: seleccionado.solicitante?.nombre || seleccionado.solicitante?.email },
                    { label: 'Facturado a',  value: seleccionado.facturado_a },
                    { label: 'Descripción',  value: seleccionado.descripcion },
                    { label: 'Shipment',     value: seleccionado.shipment || '—' },
                    { label: 'BK/BL',        value: seleccionado.bk_bl || '—' },
                    { label: 'N° Factura',   value: seleccionado.factura_numero || 'Sin factura' },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ ...lbl }}>{item.label}</p>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: 0 }}>{item.value || '—'}</p>
                    </div>
                  ))}
                </div>

                {/* Datos bancarios */}
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #E8ECF0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {[
                    { label: 'Banco',           value: seleccionado.banco },
                    { label: 'Cuenta bancaria', value: seleccionado.cuenta_bancaria },
                    { label: 'Código de pago',  value: seleccionado.codigo_pago },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ ...lbl }}>{item.label}</p>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: 0 }}>{item.value || '—'}</p>
                    </div>
                  ))}
                </div>

                {seleccionado.comentarios && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', background: '#F8F9FA', borderRadius: '8px', fontSize: '12px', color: '#0F1923' }}>
                    <strong>Comentarios:</strong> {seleccionado.comentarios}
                  </div>
                )}
              </div>

              {/* Panel finanzas — gestión */}
              {esFinanzas && (
                <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 16px' }}>Gestión de pago</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ ...lbl }}>Estado</label>
                      <select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)} style={{ ...inp }}>
                        {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lbl }}>MOV Bancario</label>
                      <input value={movBancario} onChange={e => setMovBancario(e.target.value)}
                        placeholder="Número de movimiento" style={{ ...inp }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ ...lbl }}>Observación</label>
                    <textarea value={obsFinanzas} onChange={e => setObsFinanzas(e.target.value)}
                      rows={2} placeholder="Observaciones de finanzas..."
                      style={{ ...inp, resize: 'none', fontFamily: 'inherit', lineHeight: '1.5' }} />
                  </div>
                  <button onClick={guardarCambios} disabled={guardando}
                    style={{ padding: '10px 20px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>

                  {seleccionado.mov_bancario && (
                    <div style={{ marginTop: '12px', padding: '8px 14px', background: '#E8F5E9', borderRadius: '8px', fontSize: '12px', color: '#2E7D32', fontWeight: 600 }}>
                      ✓ MOV: {seleccionado.mov_bancario}
                    </div>
                  )}
                </div>
              )}

              {/* Comprobante de pago */}
              <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 16px' }}>Comprobante de pago</h3>
                {seleccionado.comprobante_url ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#E8F5E9', borderRadius: '10px', border: '1px solid #A5D6A7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>📎</span>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#2E7D32', margin: 0 }}>Comprobante cargado</p>
                        <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '2px 0 0' }}>{seleccionado.comprobante_nombre}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={seleccionado.comprobante_url} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '6px 14px', background: '#2E7D32', color: 'white', borderRadius: '8px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>Ver</a>
                      {esFinanzas && (
                        <button onClick={() => compRef.current?.click()}
                          style={{ padding: '6px 14px', background: '#F0F2F5', color: '#0F1923', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                          Reemplazar
                        </button>
                      )}
                    </div>
                  </div>
                ) : esFinanzas ? (
                  <div onClick={() => compRef.current?.click()}
                    style={{ border: '2px dashed #E8ECF0', borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: '#FAFBFC' }}>
                    {subiendoComp ? <p style={{ color: '#8A9BB0', margin: 0 }}>Subiendo...</p> : (
                      <>
                        <p style={{ fontSize: '28px', margin: '0 0 6px' }}>📤</p>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: '0 0 4px' }}>Subir comprobante de pago</p>
                        <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>PDF, JPG o PNG</p>
                      </>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: '#8A9BB0', margin: 0 }}>Pendiente de carga por finanzas.</p>
                )}
                <input ref={compRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && subirArchivo(e.target.files[0], 'comprobante')} />
              </div>

              {/* Regularización */}
              <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>Regularización con factura</h3>
                <p style={{ fontSize: '12px', color: '#8A9BB0', margin: '0 0 16px' }}>
                  El operativo debe subir la factura una vez que el proveedor la emita.
                </p>
                {seleccionado.factura_url ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#F3E5F5', borderRadius: '10px', border: '1px solid #CE93D8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>🧾</span>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#6A1B9A', margin: 0 }}>Factura cargada</p>
                        <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '2px 0 0' }}>
                          {seleccionado.factura_nombre} · {seleccionado.fecha_regularizacion && new Date(seleccionado.fecha_regularizacion).toLocaleDateString('es-PE')}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={seleccionado.factura_url} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '6px 14px', background: '#6A1B9A', color: 'white', borderRadius: '8px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>Ver</a>
                      <button onClick={() => factRef.current?.click()}
                        style={{ padding: '6px 14px', background: '#F0F2F5', color: '#0F1923', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                        Reemplazar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => factRef.current?.click()}
                    style={{ border: '2px dashed #E8ECF0', borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: '#FAFBFC' }}>
                    {subiendoFact ? <p style={{ color: '#8A9BB0', margin: 0 }}>Subiendo...</p> : (
                      <>
                        <p style={{ fontSize: '28px', margin: '0 0 6px' }}>🧾</p>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: '0 0 4px' }}>Subir factura de regularización</p>
                        <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>PDF, JPG o PNG</p>
                      </>
                    )}
                  </div>
                )}
                <input ref={factRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && subirArchivo(e.target.files[0], 'factura')} />
              </div>

            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}