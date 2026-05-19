'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BotonHub from '../../../components/BotonHub'

const T  = '#0F1923'
const T2 = '#8A9BB0'
const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1.5px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', outline: 'none', color: T, background: 'white', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: T2, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }
const sec: React.CSSProperties = { background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const secTit: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: '#C41230', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.06em' }

export default function NuevaAnticipoPage() {
  const router  = useRouter()
  const [userId, setUserId] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Proveedor
  const [busquedaProv,    setBusquedaProv]    = useState('')
  const [resultados,      setResultados]      = useState<any[]>([])
  const [provSeleccionado, setProvSeleccionado] = useState<any>(null)
  const [modoNuevoProv,   setModoNuevoProv]   = useState(false)
  const [buscando,        setBuscando]        = useState(false)
  const [dropdownAbierto, setDropdownAbierto] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const [nuevoProv, setNuevoProv] = useState({
    ruc: '', razon_social: '', contacto: '', banco: '', cuenta_bancaria: '', codigo_pago: '',
  })

  // Formulario anticipo
  const [form, setForm] = useState({
    moneda:         'USD',
    monto:          '',
    facturado_a:    'Omni Logistics',
    factura_numero: '',
    descripcion:    '',
    shipment:       '',
    bk_bl:          '',
    comentarios:    '',
  })

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single()
      if (!p || !['operativo_sli', 'admin_operativo', 'supervisor_sli', 'admin'].includes(p.rol)) {
        router.push('/hub'); return
      }
      setUserId(session.user.id)
    }
    init()

    // Cerrar dropdown al click fuera
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Buscar proveedores en ambas tablas
  useEffect(() => {
    if (!busquedaProv.trim()) { setResultados([]); return }
    const timer = setTimeout(async () => {
      setBuscando(true)
      const q = busquedaProv.toLowerCase()

      const [{ data: homologados }, { data: pagos }] = await Promise.all([
        supabase.from('proveedores').select('id, razon_social, ruc').ilike('razon_social', `%${q}%`).limit(5),
        supabase.from('proveedores_pago').select('*').ilike('razon_social', `%${q}%`).limit(5),
      ])

      const resultHomologados = (homologados || []).map(p => ({ ...p, origen: 'homologado' }))
      const resultPagos       = (pagos       || []).map(p => ({ ...p, origen: 'pago'       }))
      setResultados([...resultHomologados, ...resultPagos])
      setBuscando(false)
      setDropdownAbierto(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [busquedaProv])

  const seleccionarProveedor = (prov: any) => {
    setProvSeleccionado(prov)
    setBusquedaProv(prov.razon_social)
    setDropdownAbierto(false)
    setModoNuevoProv(false)
  }

  const limpiarProveedor = () => {
    setProvSeleccionado(null)
    setBusquedaProv('')
    setResultados([])
    setModoNuevoProv(false)
  }

  const crearProveedor = async (): Promise<any> => {
    if (!nuevoProv.razon_social.trim()) { alert('Ingresa la razón social'); return null }
    if (nuevoProv.ruc && nuevoProv.ruc.length !== 11) { alert('El RUC debe tener 11 dígitos'); return null }
    const { data, error } = await supabase.from('proveedores_pago')
      .insert({ ...nuevoProv, created_by: userId })
      .select().single()
    if (error) { alert('Error al crear proveedor: ' + error.message); return null }
    return data
  }

  const set = (campo: string, valor: string) => setForm(f => ({ ...f, [campo]: valor }))
  const setNP = (campo: string, valor: string) => setNuevoProv(f => ({ ...f, [campo]: valor }))

  const generarNumero = () => {
    const anio = new Date().getFullYear()
    const rand = Math.floor(Math.random() * 9000) + 1000
    return `ANT-${anio}-${rand}`
  }

  const guardar = async () => {
    if (!provSeleccionado && !modoNuevoProv)    { alert('Selecciona o crea un proveedor'); return }
    if (!form.monto || isNaN(parseFloat(form.monto))) { alert('Ingresa un monto válido'); return }
    if (!form.descripcion.trim())               { alert('Ingresa la descripción'); return }

    setGuardando(true)

    let provId     = provSeleccionado?.id
    let provNombre = provSeleccionado?.razon_social
    let banco      = provSeleccionado?.banco      || ''
    let cuenta     = provSeleccionado?.cuenta_bancaria || ''
    let codigo     = provSeleccionado?.codigo_pago || ''

    // Si es nuevo proveedor, crearlo
    if (modoNuevoProv) {
      const nuevo = await crearProveedor()
      if (!nuevo) { setGuardando(false); return }
      provId     = nuevo.id
      provNombre = nuevo.razon_social
      banco      = nuevo.banco      || ''
      cuenta     = nuevo.cuenta_bancaria || ''
      codigo     = nuevo.codigo_pago || ''
    }

    // Si viene de homologados (sin banco en esa tabla), usar lo del nuevo proveedor si aplica
    const { error } = await supabase.from('anticipos').insert({
      numero:           generarNumero(),
      solicitante_id:   userId,
      fecha:            new Date().toISOString().split('T')[0],
      moneda:           form.moneda,
      monto:            parseFloat(form.monto),
      proveedor:        provNombre,
      proveedor_pago_id: provSeleccionado?.origen === 'pago' ? provId : (modoNuevoProv ? provId : null),
      facturado_a:      form.facturado_a.trim(),
      factura_numero:   form.factura_numero.trim() || null,
      descripcion:      form.descripcion.trim(),
      shipment:         form.shipment.trim() || null,
      bk_bl:            form.bk_bl.trim() || null,
      banco:            banco,
      cuenta_bancaria:  cuenta,
      codigo_pago:      codigo || null,
      comentarios:      form.comentarios.trim() || null,
      estado:           'pendiente_firma',
    })

    if (error) { alert('Error: ' + error.message); setGuardando(false); return }
    router.push('/finanzas/anticipos')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/hub"><img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} /></a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <button onClick={() => router.push('/finanzas/anticipos')} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Anticipos</button>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>Nueva solicitud</span>
        </div>
        <BotonHub />
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '28px 24px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '40px', height: '40px', background: '#F3E5F5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>💸</div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: T, margin: 0 }}>Nueva solicitud de anticipo</h2>
            <p style={{ fontSize: '12px', color: T2, margin: 0 }}>Completa los datos del pago adelantado</p>
          </div>
        </div>

        {/* ── Proveedor ─────────────────────────────────── */}
        <div style={sec}>
          <p style={secTit}>Proveedor</p>

          {provSeleccionado && !modoNuevoProv ? (
            /* Proveedor seleccionado */
            <div style={{ background: '#F8F9FA', borderRadius: '10px', padding: '14px 16px', border: '1.5px solid #E8ECF0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: T, margin: 0 }}>{provSeleccionado.razon_social}</p>
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                    background: provSeleccionado.origen === 'homologado' ? '#E8F5E9' : '#F3E5F5',
                    color:      provSeleccionado.origen === 'homologado' ? '#2E7D32' : '#6A1B9A' }}>
                    {provSeleccionado.origen === 'homologado' ? 'Homologado' : 'Pago'}
                  </span>
                </div>
                {provSeleccionado.ruc && <p style={{ fontSize: '11px', color: T2, margin: '0 0 2px' }}>RUC: {provSeleccionado.ruc}</p>}
                {provSeleccionado.banco && <p style={{ fontSize: '11px', color: T2, margin: 0 }}>{provSeleccionado.banco} · {provSeleccionado.cuenta_bancaria}</p>}
              </div>
              <button onClick={limpiarProveedor}
                style={{ padding: '6px 12px', background: '#FFEBEE', color: '#B71C1C', border: '1px solid #EF9A9A', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                Cambiar
              </button>
            </div>
          ) : !modoNuevoProv ? (
            /* Buscador */
            <div ref={dropRef} style={{ position: 'relative' }}>
              <input
                value={busquedaProv}
                onChange={e => { setBusquedaProv(e.target.value); setDropdownAbierto(true) }}
                onFocus={() => busquedaProv && setDropdownAbierto(true)}
                placeholder="Buscar por razón social o RUC..."
                style={inp} />

              {dropdownAbierto && (busquedaProv.length > 0) && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #E8ECF0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden', marginTop: '4px' }}>
                  {buscando ? (
                    <div style={{ padding: '14px 16px', fontSize: '12px', color: T2 }}>Buscando...</div>
                  ) : resultados.length === 0 ? (
                    <div style={{ padding: '14px 16px', fontSize: '12px', color: T2 }}>No encontrado — puedes crearlo abajo</div>
                  ) : resultados.map(r => (
                    <div key={r.id} onClick={() => seleccionarProveedor(r)}
                      style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8F9FA')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: T, margin: '0 0 2px' }}>{r.razon_social}</p>
                        {r.ruc && <p style={{ fontSize: '11px', color: T2, margin: 0 }}>RUC: {r.ruc}</p>}
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                        background: r.origen === 'homologado' ? '#E8F5E9' : '#F3E5F5',
                        color:      r.origen === 'homologado' ? '#2E7D32' : '#6A1B9A' }}>
                        {r.origen === 'homologado' ? 'Homologado' : 'Pago'}
                      </span>
                    </div>
                  ))}
                  <div onClick={() => { setModoNuevoProv(true); setDropdownAbierto(false); setNuevoProv(prev => ({ ...prev, razon_social: busquedaProv })) }}
                    style={{ padding: '12px 16px', cursor: 'pointer', background: '#F8F9FA', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F3E5F5')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#F8F9FA')}>
                    <span style={{ fontSize: '16px' }}>＋</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#6A1B9A' }}>Crear nuevo proveedor</span>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Formulario nuevo proveedor */}
          {modoNuevoProv && (
            <div style={{ background: '#FDFBFF', borderRadius: '10px', border: '1.5px solid #CE93D8', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#6A1B9A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nuevo proveedor</p>
                <button onClick={() => { setModoNuevoProv(false); setBusquedaProv('') }}
                  style={{ fontSize: '11px', color: T2, background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={lbl}>RUC</label>
                  <input value={nuevoProv.ruc} onChange={e => setNP('ruc', e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="20xxxxxxxxx" style={inp} maxLength={11} />
                </div>
                <div>
                  <label style={lbl}>Razón social <span style={{ color: '#C41230' }}>*</span></label>
                  <input value={nuevoProv.razon_social} onChange={e => setNP('razon_social', e.target.value)}
                    placeholder="Nombre o razón social" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Contacto</label>
                  <input value={nuevoProv.contacto} onChange={e => setNP('contacto', e.target.value)}
                    placeholder="Nombre o teléfono" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Banco</label>
                  <input value={nuevoProv.banco} onChange={e => setNP('banco', e.target.value)}
                    placeholder="Ej: BBVA, BCP, CITIBANK" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Cuenta bancaria</label>
                  <input value={nuevoProv.cuenta_bancaria} onChange={e => setNP('cuenta_bancaria', e.target.value)}
                    placeholder="Número de cuenta" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Código de pago</label>
                  <input value={nuevoProv.codigo_pago} onChange={e => setNP('codigo_pago', e.target.value)}
                    placeholder="CCI u otro" style={inp} />
                </div>
              </div>
              <p style={{ fontSize: '10px', color: '#8A9BB0', margin: 0 }}>
                Este proveedor quedará guardado para futuras solicitudes de anticipo.
              </p>
            </div>
          )}
        </div>

        {/* ── Datos del pago ─────────────────────────────── */}
        <div style={sec}>
          <p style={secTit}>Datos del pago</p>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={lbl}>Moneda <span style={{ color: '#C41230' }}>*</span></label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)} style={inp}>
                <option value="USD">USD</option>
                <option value="PEN">PEN</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Monto <span style={{ color: '#C41230' }}>*</span></label>
              <input type="number" min={0} step={0.01} value={form.monto}
                onChange={e => set('monto', e.target.value)} placeholder="0.00" style={inp} />
            </div>
            <div>
              <label style={lbl}>Facturado a</label>
              <input value={form.facturado_a} onChange={e => set('facturado_a', e.target.value)} style={inp} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Descripción <span style={{ color: '#C41230' }}>*</span></label>
              <input value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
                placeholder="Ej: Flete internacional, Descarga, THC..." style={inp} />
            </div>
            <div>
              <label style={lbl}>N° Factura</label>
              <input value={form.factura_numero} onChange={e => set('factura_numero', e.target.value)}
                placeholder="Si ya la tiene (opcional)" style={inp} />
            </div>
          </div>
        </div>

        {/* ── Referencia operativa ───────────────────────── */}
        <div style={sec}>
          <p style={secTit}>Referencia operativa</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Shipment</label>
              <input value={form.shipment} onChange={e => set('shipment', e.target.value)}
                placeholder="Ej: SPEL01092208" style={inp} />
            </div>
            <div>
              <label style={lbl}>BK / BL</label>
              <input value={form.bk_bl} onChange={e => set('bk_bl', e.target.value)}
                placeholder="Número de BL o booking" style={inp} />
            </div>
          </div>
        </div>

        {/* ── Comentarios ────────────────────────────────── */}
        <div style={sec}>
          <p style={secTit}>Comentarios</p>
          <textarea value={form.comentarios} onChange={e => set('comentarios', e.target.value)}
            rows={3} placeholder="Instrucciones especiales, aclaraciones, etc."
            style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} />
        </div>

        {/* ── Botones ─────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
          <button onClick={() => router.push('/finanzas/anticipos')}
            style={{ padding: '10px 20px', background: '#F0F2F5', color: T2, border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando}
            style={{ padding: '10px 24px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.7 : 1 }}>
            {guardando ? 'Enviando...' : 'Enviar solicitud →'}
          </button>
        </div>

      </div>
    </div>
  )
}