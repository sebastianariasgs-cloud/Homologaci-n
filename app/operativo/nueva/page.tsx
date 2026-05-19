'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonHub from '../../components/BotonHub'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_CARGA = ['Contenedor 40HQ', 'Contenedor 20HQ', 'LCL', 'Sobredimensionada']

const TIPOS_UNIDAD = [
  'Semitrailer',
  'Furgón',
  'Furgón ala de gaviota',
  'Camión baranda',
  'Cama baja',
  'Cama cuna',
  'Cisterna',
  'Otro',
]

const CARACTERISTICAS = ['Carga general', 'Carga peligrosa', 'Carga refrigerada']

const TIPOS_CONTENEDOR = ['Contenedor 40HQ', 'Contenedor 20HQ']

// ─── Estilos base ─────────────────────────────────────────────────────────────

const T  = '#2C2828'
const T2 = '#696869'

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 14px',
  border: '1.5px solid #E2DCDC', borderRadius: '8px',
  fontSize: '13px', outline: 'none',
  color: T, background: 'white',
  boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  color: T2, marginBottom: '5px',
  textTransform: 'uppercase', letterSpacing: '0.04em',
}
const sec: React.CSSProperties = {
  background: '#F8F6F6', borderRadius: '10px',
  padding: '16px', marginBottom: '14px',
  border: '1px solid #E2DCDC',
}
const secTitle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: '#C41230',
  margin: '0 0 14px',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function NuevaSolicitudPage() {
  const router = useRouter()
  const [guardando, setGuardando]   = useState(false)
  const [subiendo, setSubiendo]     = useState(false)
  const [clientes, setClientes]     = useState<any[]>([])
  const [modoNuevoCliente, setModoNuevoCliente] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState({ razon_social: '', ruc: '' })
  const [adjunto, setAdjunto]       = useState<File | null>(null)
  const [userId, setUserId]         = useState('')

  const [form, setForm] = useState({
    cliente_id:           '',
    tipo_carga:           'Contenedor 40HQ',
    caracteristicas:      [] as string[],
    tipo_unidad:          'Semitrailer',
    tipo_unidad_detalle:  '',
    descripcion_producto: '',
    peso:                 '',
    volumen:              '',
    fecha_recojo:         '',
    hora_recojo:          '',
    fecha_entrega:        '',
    hora_entrega:         '',
    depot_vacios:         '',
    instrucciones:        '',
    precio_sugerido:      '',
    direccion_recojo:     '',   // ← Agregado
    direccion_entrega:    '',   // ← Agregado
  })

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', session.user.id).single()

    if (!['operativo_sli', 'admin_operativo', 'supervisor_sli', 'admin'].includes(perfil?.rol)) {
      router.push('/login'); return
    }

    setUserId(session.user.id)

    const { data } = await supabase
      .from('clientes').select('id, razon_social, ruc').order('razon_social')
    setClientes(data || [])
  }

  const esContenedor = TIPOS_CONTENEDOR.includes(form.tipo_carga)

  const set = (campo: string, valor: any) => setForm(f => ({ ...f, [campo]: valor }))

  const toggleCaracteristica = (c: string) => {
    setForm(f => ({
      ...f,
      caracteristicas: f.caracteristicas.includes(c)
        ? f.caracteristicas.filter(x => x !== c)
        : [...f.caracteristicas, c],
    }))
  }

  const crearClienteNuevo = async (): Promise<string | null> => {
    if (!nuevoCliente.razon_social.trim()) { alert('Ingresa la razón social'); return null }
    if (nuevoCliente.ruc && nuevoCliente.ruc.length !== 11) { alert('El RUC debe tener 11 dígitos'); return null }
    const { data, error } = await supabase.from('clientes')
      .insert({ razon_social: nuevoCliente.razon_social.trim(), ruc: nuevoCliente.ruc || null })
      .select().single()
    if (error) { alert('Error al crear cliente: ' + error.message); return null }
    setClientes(prev => [...prev, data].sort((a, b) => a.razon_social.localeCompare(b.razon_social)))
    setModoNuevoCliente(false)
    setNuevoCliente({ razon_social: '', ruc: '' })
    return data.id
  }

  const generarNumero = () => {
    const anio = new Date().getFullYear()
    const rand = Math.floor(Math.random() * 9000) + 1000
    return `SOL-${anio}-${rand}`
  }

  const guardar = async () => {
    // Validaciones
    if (!form.tipo_carga)                 { alert('Selecciona el tipo de carga'); return }
    if (!form.tipo_unidad)                { alert('Selecciona el tipo de unidad'); return }
    if (form.tipo_unidad === 'Otro' && !form.tipo_unidad_detalle.trim()) {
      alert('Detalla el tipo de unidad'); return
    }
    if (!form.descripcion_producto.trim()) { alert('Ingresa la descripción del producto'); return }
    
    // Validaciones Direcciones (Actualizado)
    if (!form.direccion_recojo.trim())  { alert('Ingresa el lugar de origen'); return }
    if (!form.direccion_entrega.trim()) { alert('Ingresa el lugar de destino'); return }

    if (!form.fecha_recojo)                { alert('Ingresa la fecha de recojo'); return }
    if (!form.fecha_entrega)               { alert('Ingresa la fecha de entrega'); return }
    
    if (esContenedor && !form.depot_vacios.trim()) {
      alert('Ingresa el almacén de devolución (DEPOT VACÍOS)'); return
    }
    if (!form.precio_sugerido || isNaN(parseFloat(form.precio_sugerido))) {
      alert('Ingresa el precio sugerido'); return
    }

    setGuardando(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    let clienteId = form.cliente_id
    if (modoNuevoCliente) {
      const nuevoId = await crearClienteNuevo()
      if (!nuevoId) { setGuardando(false); return }
      clienteId = nuevoId
    }

    // Crear solicitud
    const { data: sol, error } = await supabase
      .from('solicitudes_transporte')
      .insert({
        numero:               generarNumero(),
        operativo_id:         session.user.id,
        cliente_id:           clienteId || null,
        tipo_carga:           form.tipo_carga,
        caracteristicas:      form.caracteristicas,
        tipo_unidad:          form.tipo_unidad === 'Otro'
                                ? `Otro: ${form.tipo_unidad_detalle}`
                                : form.tipo_unidad,
        descripcion_producto: form.descripcion_producto.trim(),
        direccion_recojo:     form.direccion_recojo.trim(),   // ← Agregado
        direccion_entrega:    form.direccion_entrega.trim(),  // ← Agregado
        peso:                 form.peso    ? parseFloat(form.peso)    : null,
        volumen:              form.volumen ? parseFloat(form.volumen) : null,
        fecha_recojo:         form.fecha_recojo,
        hora_recojo:          form.hora_recojo   || null,
        fecha_entrega:        form.fecha_entrega,
        hora_entrega:         form.hora_entrega  || null,
        depot_vacios:         esContenedor ? form.depot_vacios.trim() : null,
        instrucciones:        form.instrucciones.trim() || null,
        precio_sugerido:      parseFloat(form.precio_sugerido),
        estado:               'Pendiente de asignación',
        visto_por_transporte: false,
      })
      .select().single()

    if (error) { alert('Error al crear la solicitud: ' + error.message); setGuardando(false); return }

    // Registrar en historial
    await supabase.from('solicitud_historial').insert({
      solicitud_id:    sol.id,
      usuario_id:      session.user.id,
      estado_nuevo:    'Pendiente de asignación',
      comentario:      `Solicitud creada — Precio sugerido: S/ ${form.precio_sugerido}`,
    })

    // Subir adjunto si existe
    if (adjunto) {
      setSubiendo(true)
      const ruta = `solicitudes/${sol.id}/${adjunto.name.replace(/\s/g, '_')}`
      const { error: uploadError } = await supabase.storage
        .from('documentos').upload(ruta, adjunto, { upsert: true })
      if (!uploadError) {
        await supabase.from('solicitud_documentos').insert({
          solicitud_id: sol.id,
          nombre:       adjunto.name,
          url:          ruta,
        })
      }
      setSubiendo(false)
    }

    setGuardando(false)
    router.push('/operativo')
  }

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
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
            Nueva solicitud
          </span>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '40px', height: '40px', background: '#FEF2F2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🚛</div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: T, margin: 0 }}>Nueva solicitud de transporte</h2>
            <p style={{ fontSize: '12px', color: T2, margin: 0 }}>Completa los datos del servicio</p>
          </div>
        </div>

        {/* ── 1. Datos del servicio ──────────────────────────────────────── */}
        <div style={sec}>
          <p style={secTitle}>Datos del servicio</p>

          {/* Cliente */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Cliente</label>
              <button type="button" onClick={() => { setModoNuevoCliente(!modoNuevoCliente); set('cliente_id', '') }}
                style={{ fontSize: '10px', color: modoNuevoCliente ? T2 : '#C41230', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {modoNuevoCliente ? '← Seleccionar existente' : '+ Crear nuevo cliente'}
              </button>
            </div>
            {modoNuevoCliente ? (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                <input type="text" value={nuevoCliente.razon_social}
                  onChange={e => setNuevoCliente({ ...nuevoCliente, razon_social: e.target.value })}
                  placeholder="Razón social *"
                  style={{ ...inp, border: '1.5px solid #C41230' }} />
                <input type="text" value={nuevoCliente.ruc} maxLength={11}
                  onChange={e => setNuevoCliente({ ...nuevoCliente, ruc: e.target.value.replace(/\D/g, '') })}
                  placeholder="RUC (opcional)"
                  style={inp} />
              </div>
            ) : (
              <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} style={inp}>
                <option value="">Selecciona un cliente...</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.razon_social}{c.ruc ? ` — ${c.ruc}` : ''}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={lbl}>Tipo de carga <span style={{ color: '#C41230' }}>*</span></label>
              <select value={form.tipo_carga} onChange={e => set('tipo_carga', e.target.value)} style={inp}>
                {TIPOS_CARGA.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Tipo de unidad <span style={{ color: '#C41230' }}>*</span></label>
              <select value={form.tipo_unidad} onChange={e => set('tipo_unidad', e.target.value)} style={inp}>
                {TIPOS_UNIDAD.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {form.tipo_unidad === 'Otro' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={lbl}>Especifica el tipo de unidad <span style={{ color: '#C41230' }}>*</span></label>
              <input type="text" value={form.tipo_unidad_detalle}
                onChange={e => set('tipo_unidad_detalle', e.target.value)}
                placeholder="Describe el tipo de unidad"
                style={inp} />
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={lbl}>Características de la carga</label>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {CARACTERISTICAS.map(c => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: T, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox"
                    checked={form.caracteristicas.includes(c)}
                    onChange={() => toggleCaracteristica(c)}
                    style={{ width: '15px', height: '15px', accentColor: '#C41230', cursor: 'pointer' }} />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={lbl}>Descripción del producto <span style={{ color: '#C41230' }}>*</span></label>
              <input type="text" value={form.descripcion_producto}
                onChange={e => set('descripcion_producto', e.target.value)}
                placeholder="Ej: Maquinaria industrial, textiles, alimentos..."
                style={inp} />
            </div>
            <div>
              <label style={lbl}>Peso (TN)</label>
              <input type="number" min={0} step={0.01} value={form.peso}
                onChange={e => set('peso', e.target.value)}
                placeholder="0.00" style={inp} />
            </div>
            <div>
              <label style={lbl}>Volumen (m³)</label>
              <input type="number" min={0} step={0.01} value={form.volumen}
                onChange={e => set('volumen', e.target.value)}
                placeholder="0.00" style={inp} />
            </div>
          </div>

          {esContenedor && (
            <div style={{ background: '#EFF6FF', borderRadius: '8px', padding: '12px 14px', border: '1px solid #BFDBFE' }}>
              <label style={{ ...lbl, color: '#1565C0', marginBottom: '6px' }}>
                Almacén de devolución — DEPOT VACÍOS <span style={{ color: '#C41230' }}>*</span>
              </label>
              <input type="text" value={form.depot_vacios}
                onChange={e => set('depot_vacios', e.target.value)}
                placeholder="Ej: DEPOT CALLAO, CONTRANS, LIMA DEPOT..."
                style={{ ...inp, border: '1.5px solid #93C5FD' }} />
            </div>
          )}

          {/* Direcciones Origen/Destino */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            <div>
              <label style={lbl}>Lugar de origen <span style={{ color: '#C41230' }}>*</span></label>
              <input type="text" value={form.direccion_recojo}
                onChange={e => set('direccion_recojo', e.target.value)}
                placeholder="Ej: Callao, Terminal Portuario APM"
                style={inp} />
            </div>
            <div>
              <label style={lbl}>Lugar de destino <span style={{ color: '#C41230' }}>*</span></label>
              <input type="text" value={form.direccion_entrega}
                onChange={e => set('direccion_entrega', e.target.value)}
                placeholder="Ej: Ate Vitarte, Almacén cliente"
                style={inp} />
            </div>
          </div>
        </div>

        {/* ── 2. Fechas y horarios ───────────────────────────────────────── */}
        <div style={sec}>
          <p style={secTitle}>Fechas y horarios</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>Fecha de recojo <span style={{ color: '#C41230' }}>*</span></label>
              <input type="date" value={form.fecha_recojo}
                onChange={e => set('fecha_recojo', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Hora de recojo</label>
              <input type="time" value={form.hora_recojo}
                onChange={e => set('hora_recojo', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Fecha de entrega <span style={{ color: '#C41230' }}>*</span></label>
              <input type="date" value={form.fecha_entrega}
                onChange={e => set('fecha_entrega', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Hora de entrega</label>
              <input type="time" value={form.hora_entrega}
                onChange={e => set('hora_entrega', e.target.value)} style={inp} />
            </div>
          </div>
        </div>

        {/* ── 3. Precio sugerido ─────────────────────────────────────────── */}
        <div style={{ background: '#F8F5FF', borderRadius: '10px', padding: '16px', marginBottom: '14px', border: '1.5px solid #DDD6FE' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{ width: '28px', height: '28px', background: '#EDE9FE', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>💰</div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#5B21B6', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Precio sugerido <span style={{ color: '#C41230' }}>*</span>
              </p>
            </div>
          </div>
          <div style={{ position: 'relative', maxWidth: '220px' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: 700, color: T2 }}>S/</span>
            <input type="number" min={0} step={0.01}
              value={form.precio_sugerido}
              onChange={e => set('precio_sugerido', e.target.value)}
              placeholder="0.00"
              style={{ ...inp, paddingLeft: '36px', fontSize: '16px', fontWeight: 700, border: '1.5px solid #C4B5FD' }} />
          </div>
        </div>

        {/* ── 4. Instrucciones ───────────────────────────────────────────── */}
        <div style={sec}>
          <p style={secTitle}>Instrucciones</p>
          <textarea value={form.instrucciones}
            onChange={e => set('instrucciones', e.target.value)}
            placeholder="Instrucciones especiales..."
            rows={3}
            style={{ ...inp, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} />
        </div>

        {/* ── 5. Adjunto ─────────────────────────────────────────────────── */}
        <div style={{ ...sec, marginBottom: '24px' }}>
          <p style={secTitle}>Adjunto</p>
          {adjunto ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#E3F2FD', border: '1px solid #90CAF9', borderRadius: '8px', padding: '10px 14px' }}>
              <span style={{ fontSize: '13px', color: '#1565C0', fontWeight: 500, flex: 1 }}>{adjunto.name}</span>
              <button onClick={() => setAdjunto(null)} style={{ background: 'none', border: 'none', color: '#C41230', cursor: 'pointer' }}>×</button>
            </div>
          ) : (
            <label style={{ display: 'block', border: '2px dashed #D1CCCC', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'white' }}>
              <p style={{ fontSize: '13px', color: T2 }}>Haz clic para adjuntar archivo</p>
              <input type="file" style={{ display: 'none' }} onChange={e => setAdjunto(e.target.files?.[0] || null)} />
            </label>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '16px', borderTop: '1px solid #E2DCDC' }}>
          <button type="button" onClick={() => router.push('/operativo')} style={{ padding: '10px 20px', background: '#F4F2F2', color: T2, border: '1px solid #E2DCDC', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando || subiendo} style={{ padding: '10px 24px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: guardando || subiendo ? 0.7 : 1 }}>
            {guardando ? 'Guardando...' : 'Enviar solicitud →'}
          </button>
        </div>
      </div>
    </div>
  )
}