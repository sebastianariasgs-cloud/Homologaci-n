'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonAdmin from '../../components/BotonAdmin'

const EVENTOS_CRITICOS = [
  'Ninguno', 'Sin liberación', 'Sin citas de retiro', 'Sin citas de devolución',
  'Perdida de citas', 'Sin unidades de transporte', 'Contenedores bajados',
  'Uso de área', 'Sobreestadía', 'Siniestro',
]

const TIPOS_CARGA = [
  'Contenedor 20 HQ', 'Contenedor 40 HQ', 'General', 'Refrigerada', 'Peligrosa', 'Sobredimensionada',
]

// Fecha actual en hora Peru (UTC-5)
const ahoraLima = () => {
  const ahora = new Date()
  return new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Lima' }))
}

export default function NuevaSolicitudPage() {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [documentos, setDocumentos] = useState<{ nombre: string, archivo: File }[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [rolUsuario, setRolUsuario] = useState('')
  const [clientes, setClientes] = useState<any[]>([])
  const [modoNuevoCliente, setModoNuevoCliente] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState({ razon_social: '', ruc: '' })

  const [form, setForm] = useState({
    tipo_servicio: 'IMPO',
    cliente_id: '',
    shipment: '',
    bl_awb: '',
    num_unidades: 1,
    tipo_carga: 'Contenedor 20 HQ',
    direccion_recojo: '',
    direccion_entrega: '',
    fecha_recojo: '',
    zona: '',
    almacen_devolucion: '',
    peso: '',
    volumen: '',
    evento_critico_1: 'Ninguno',
    evento_critico_2: 'Ninguno',
    comentarios_operativo: '',
    observaciones: '',
  })

  useEffect(() => { verificarRol() }, [])

  const verificarRol = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', session.user.id).single()
    const rolesPermitidos = ['operativo_sli', 'admin_operativo', 'supervisor_sli', 'admin']
    if (!rolesPermitidos.includes(perfil?.rol)) { router.push('/login'); return }
    setRolUsuario(perfil?.rol)
    const { data: clientesData } = await supabase
      .from('clientes').select('id, razon_social, ruc').order('razon_social')
    setClientes(clientesData || [])
  }

  const puedeEditarEventos = ['admin_operativo', 'supervisor_sli', 'admin'].includes(rolUsuario)

  const generarNumero = () => {
    const fecha = ahoraLima()
    const anio = fecha.getFullYear()
    const rand = Math.floor(Math.random() * 9000) + 1000
    return `SOL-${anio}-${rand}`
  }

  const crearClienteNuevo = async (): Promise<string | null> => {
    if (!nuevoCliente.razon_social) {
      alert('Ingresa la razón social del cliente')
      return null
    }
    if (nuevoCliente.ruc && nuevoCliente.ruc.length !== 11) {
      alert('El RUC debe tener 11 dígitos')
      return null
    }
    const { data, error } = await supabase
      .from('clientes')
      .insert({ razon_social: nuevoCliente.razon_social, ruc: nuevoCliente.ruc || null })
      .select().single()
    if (error) { alert('Error al crear cliente: ' + error.message); return null }
    setClientes(prev => [...prev, data].sort((a, b) => a.razon_social.localeCompare(b.razon_social)))
    setForm({ ...form, cliente_id: data.id })
    setModoNuevoCliente(false)
    setNuevoCliente({ razon_social: '', ruc: '' })
    return data.id
  }

  const agregarDocumento = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files || [])
    setDocumentos(prev => [...prev, ...archivos.map(f => ({ nombre: f.name, archivo: f }))])
    e.target.value = ''
  }

  const eliminarDocumento = (i: number) => {
    setDocumentos(prev => prev.filter((_, idx) => idx !== i))
  }

  const guardar = async () => {
    if (!form.direccion_recojo || !form.direccion_entrega || !form.fecha_recojo) {
      alert('Completa los campos obligatorios: direccion de recojo, entrega y fecha')
      return
    }
    setGuardando(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    // Crear cliente nuevo si es necesario
    let clienteId = form.cliente_id
    if (modoNuevoCliente) {
      const nuevoId = await crearClienteNuevo()
      if (!nuevoId) { setGuardando(false); return }
      clienteId = nuevoId
    }

    const { data: sol, error } = await supabase
      .from('solicitudes_transporte')
      .insert({
        numero: generarNumero(),
        operativo_id: session.user.id,
        tipo_servicio: form.tipo_servicio,
        cliente_id: clienteId || null,
        shipment: form.shipment || null,
        bl_awb: form.bl_awb || null,
        num_unidades: form.num_unidades,
        tipo_carga: form.tipo_carga,
        es_contenedor: ['Contenedor 20 HQ', 'Contenedor 40 HQ'].includes(form.tipo_carga),
        direccion_recojo: form.direccion_recojo,
        direccion_entrega: form.direccion_entrega,
        fecha_recojo: form.fecha_recojo,
        zona: form.zona || null,
        almacen_devolucion: form.almacen_devolucion || null,
        peso: form.peso ? parseFloat(form.peso) : null,
        volumen: form.volumen ? parseFloat(form.volumen) : null,
        evento_critico_1: form.evento_critico_1,
        evento_critico_2: form.evento_critico_2,
        comentarios_operativo: form.comentarios_operativo || null,
        observaciones: form.observaciones || null,
        estado: 'pendiente',
        visto_por_transporte: false,
      })
      .select().single()

    if (error) { alert('Error: ' + error.message); setGuardando(false); return }

    // Notificar al area de transporte
    const { data: transportistas } = await supabase
      .from('perfiles').select('id').eq('rol', 'transporte')
    if (transportistas && transportistas.length > 0) {
      await supabase.from('notificaciones').insert(
        transportistas.map((t: any) => ({
          usuario_id: t.id,
          mensaje: `Nueva solicitud de transporte: ${sol.numero}`,
          link: `/transporte`,
        }))
      )
    }

    if (documentos.length > 0) {
      setSubiendo(true)
      for (const doc of documentos) {
        const ruta = `solicitudes/${sol.id}/${doc.nombre.replace(/\s/g, '_')}`
        const { error: uploadError } = await supabase.storage
          .from('documentos').upload(ruta, doc.archivo, { upsert: true })
        if (!uploadError) {
          await supabase.from('solicitud_documentos').insert({
            solicitud_id: sol.id, nombre: doc.nombre, url: ruta,
          })
        }
      }
      setSubiendo(false)
    }

    setGuardando(false)
    router.push(`/operativo/${sol.id}`)
  }

  const inputStyle = { width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }
  const selectStyle = { ...inputStyle, background: 'white' }
  const labelStyle = { display: 'block' as const, fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <button onClick={() => router.push('/operativo')}
            style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Solicitudes
          </button>
          <span style={{ color: '#DDD' }}>›</span>
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Nueva solicitud</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BotonAdmin />
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🚛</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Nueva solicitud de transporte</h2>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Completa los datos del embarque</p>
            </div>
          </div>

          {/* Seccion 1 — Datos del servicio */}
          <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#C41230', margin: '0 0 12px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Datos del servicio</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>Tipo <span style={{ color: '#C41230' }}>*</span></label>
                <select value={form.tipo_servicio} onChange={(e) => setForm({ ...form, tipo_servicio: e.target.value })} style={selectStyle}>
                  <option value="IMPO">IMPO</option>
                  <option value="EXPO">EXPO</option>
                </select>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Cliente</label>
                  <button type="button" onClick={() => { setModoNuevoCliente(!modoNuevoCliente); setForm({ ...form, cliente_id: '' }) }}
                    style={{ fontSize: '10px', color: modoNuevoCliente ? '#666' : '#C41230', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    {modoNuevoCliente ? '← Seleccionar existente' : '+ Crear nuevo cliente'}
                  </button>
                </div>
                {modoNuevoCliente ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '6px' }}>
                    <input type="text" value={nuevoCliente.razon_social}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, razon_social: e.target.value })}
                      placeholder="Razón social *"
                      style={{ ...inputStyle, border: '1.5px solid #C41230' }} />
                    <input type="text" value={nuevoCliente.ruc}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, ruc: e.target.value })}
                      placeholder="RUC"
                      style={inputStyle} />
                  </div>
                ) : (
                  <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} style={selectStyle}>
                    <option value="">Selecciona un cliente...</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.razon_social}{c.ruc ? ` — ${c.ruc}` : ''}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}># Shipment</label>
                <input type="text" value={form.shipment}
                  onChange={(e) => setForm({ ...form, shipment: e.target.value })}
                  placeholder="Ej: B00057672" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>BL / AWB</label>
                <input type="text" value={form.bl_awb}
                  onChange={(e) => setForm({ ...form, bl_awb: e.target.value })}
                  placeholder="Ej: COSCO2026041201" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Tipo de carga <span style={{ color: '#C41230' }}>*</span></label>
                <select value={form.tipo_carga} onChange={(e) => setForm({ ...form, tipo_carga: e.target.value })} style={selectStyle}>
                  {TIPOS_CARGA.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Unidades requeridas <span style={{ color: '#C41230' }}>*</span></label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button type="button" onClick={() => setForm({ ...form, num_unidades: Math.max(1, form.num_unidades - 1) })}
                    style={{ width: '32px', height: '38px', border: '1.5px solid #E8E8E8', borderRadius: '8px', background: 'white', fontSize: '16px', cursor: 'pointer', flexShrink: 0 }}>−</button>
                  <div style={{ flex: 1, padding: '9px 14px', border: '1.5px solid #C41230', borderRadius: '8px', fontSize: '14px', fontWeight: 700, color: '#C41230', textAlign: 'center' as const, background: '#FEF2F2' }}>
                    {form.num_unidades}
                  </div>
                  <button type="button" onClick={() => setForm({ ...form, num_unidades: form.num_unidades + 1 })}
                    style={{ width: '32px', height: '38px', border: '1.5px solid #E8E8E8', borderRadius: '8px', background: 'white', fontSize: '16px', cursor: 'pointer', flexShrink: 0 }}>+</button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Peso (TN)</label>
                <input type="number" min={0} value={form.peso}
                  onChange={(e) => setForm({ ...form, peso: e.target.value })}
                  placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Volumen (m3)</label>
                <input type="number" min={0} value={form.volumen}
                  onChange={(e) => setForm({ ...form, volumen: e.target.value })}
                  placeholder="0.00" style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Seccion 2 — Direcciones y fechas */}
          <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#C41230', margin: '0 0 12px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Direcciones y fechas</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>Direccion de recojo / Alm. retiro <span style={{ color: '#C41230' }}>*</span></label>
                <input type="text" value={form.direccion_recojo}
                  onChange={(e) => setForm({ ...form, direccion_recojo: e.target.value })}
                  placeholder="Terminal, muelle o direccion" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Direccion de entrega <span style={{ color: '#C41230' }}>*</span></label>
                <input type="text" value={form.direccion_entrega}
                  onChange={(e) => setForm({ ...form, direccion_entrega: e.target.value })}
                  placeholder="Almacen o direccion de destino" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Fecha de recojo <span style={{ color: '#C41230' }}>*</span></label>
                <input type="date" value={form.fecha_recojo}
                  onChange={(e) => setForm({ ...form, fecha_recojo: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Zona</label>
                <input type="text" value={form.zona}
                  onChange={(e) => setForm({ ...form, zona: e.target.value })}
                  placeholder="Ej: LURIN, UNICACHI" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Almacen de devolucion</label>
                <input type="text" value={form.almacen_devolucion}
                  onChange={(e) => setForm({ ...form, almacen_devolucion: e.target.value })}
                  placeholder="Nombre del almacen" style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Seccion 3 — Eventos criticos */}
          {puedeEditarEventos && (
            <div style={{ background: '#FFF7ED', borderRadius: '8px', padding: '14px', marginBottom: '14px', border: '1px solid #FED7AA' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#C2410C', margin: '0 0 12px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                Eventos criticos
                <span style={{ fontSize: '10px', fontWeight: 400, marginLeft: '8px', background: '#FED7AA', padding: '1px 6px', borderRadius: '4px' }}>Solo Admin Operativo y Supervisor</span>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Evento critico 1</label>
                  <select value={form.evento_critico_1}
                    onChange={(e) => setForm({ ...form, evento_critico_1: e.target.value })} style={selectStyle}>
                    {EVENTOS_CRITICOS.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Evento critico 2</label>
                  <select value={form.evento_critico_2}
                    onChange={(e) => setForm({ ...form, evento_critico_2: e.target.value })} style={selectStyle}>
                    {EVENTOS_CRITICOS.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Comentarios</label>
                <textarea value={form.comentarios_operativo}
                  onChange={(e) => setForm({ ...form, comentarios_operativo: e.target.value })}
                  placeholder="Observaciones internas..."
                  style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #FED7AA', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'none' as const, height: '70px', boxSizing: 'border-box' as const }} />
              </div>
            </div>
          )}

          {/* Seccion 4 — Documentos */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Documentos del embarque</label>
            <div style={{ border: '2px dashed #E8E8E8', borderRadius: '8px', padding: '14px', background: '#F9F9F9' }}>
              {documentos.length > 0 && (
                <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap' as const, gap: '6px' }}>
                  {documentos.map((doc, i) => (
                    <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#E6F1FB', border: '1px solid #B5D4F4', borderRadius: '6px', padding: '4px 10px' }}>
                      <span style={{ fontSize: '11px', color: '#185FA5' }}>📄 {doc.nombre}</span>
                      <button type="button" onClick={() => eliminarDocumento(i)}
                        style={{ background: 'none', border: 'none', color: '#C41230', cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'white', border: '1px solid #E8E8E8', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', color: '#666' }}>
                + Adjuntar documentos
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" style={{ display: 'none' }} onChange={agregarDocumento} />
              </label>
              <span style={{ fontSize: '10px', color: '#AAA', marginLeft: '8px' }}>PDF, JPG, PNG, DOCX, XLSX</span>
            </div>
          </div>

          {/* Instrucciones */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Instrucciones para el transportista</label>
            <textarea value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              placeholder="Instrucciones especiales, coordinar con almacen, hora de llegada, etc."
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'none' as const, height: '70px', boxSizing: 'border-box' as const }} />
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={() => router.push('/operativo')}
              style={{ padding: '10px 20px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={guardando || subiendo}
              style={{ padding: '10px 20px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: guardando || subiendo ? 0.7 : 1 }}>
              {guardando ? 'Guardando...' : subiendo ? 'Subiendo documentos...' : 'Enviar solicitud →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}