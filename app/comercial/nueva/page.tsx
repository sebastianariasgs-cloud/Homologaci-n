'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const SERVICIOS_ADICIONALES = [
  { nombre: 'Agenciamiento de aduana', monto: 0 },
  { nombre: 'Transporte local', monto: 0 },
  { nombre: 'Almacenaje', monto: 0 },
  { nombre: 'Seguro de carga', monto: 0 },
  { nombre: 'Handling en destino', monto: 0 },
]

export default function NuevaCotizacionPage() {
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [loading, setLoading] = useState(false)
  const [tarifas, setTarifas] = useState<any[]>([])
  const [tarifaSeleccionada, setTarifaSeleccionada] = useState<any>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [servicios, setServicios] = useState(
    SERVICIOS_ADICIONALES.map(s => ({ ...s, activo: false }))
  )
  const [otroServicio, setOtroServicio] = useState({ activo: false, nombre: '', monto: 0 })
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [form, setForm] = useState({
    cliente_id: '',
    razon_social: '',
    ruc: '',
    email_cliente: '',
    tipo_servicio: 'FCL Maritimo',
    moneda: 'USD',
    incoterm: 'FOB',
    origen: '',
    destino: '',
    tipo_contenedor: "40' HQ",
    cantidad: 1,
    tipo_carga: 'General',
  })

  useEffect(() => { verificarRol() }, [])

  const verificarRol = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    if (!['comercial', 'admin'].includes(perfil?.rol)) { router.push('/login'); return }

    const { data: clientesData } = await supabase
      .from('clientes').select('*').order('razon_social')
    setClientes(clientesData || [])
  }

  const buscarTarifas = async () => {
    setLoading(true)
    setTarifas([])
    setTarifaSeleccionada(null)

    const tabla = form.tipo_servicio.includes('Importacion') || form.tipo_servicio.includes('FCL') || form.tipo_servicio.includes('LCL')
      ? 'tarifario_importacion'
      : 'tarifario_exportacion'

    const { data } = await supabase
      .from('tarifario_importacion')
      .select('*')
      .eq('activo', true)
      .ilike('pais', `%${form.origen.split(' ')[0]}%`)
      .order('total_40hq', { ascending: true })

    setTarifas(data || [])
    setLoading(false)
    if (data && data.length > 0) setPaso(2)
    else alert('No se encontraron tarifas para esa ruta. Verifica el origen.')
  }

  const seleccionarTarifa = (tarifa: any) => {
    setTarifaSeleccionada(tarifa)
    setPaso(3)
  }

  const getTotalFlete = () => {
    if (!tarifaSeleccionada) return 0
    const campo = form.tipo_contenedor === "20' GP" ? 'total_20gp'
      : form.tipo_contenedor === "40' NOR" ? 'total_40nor'
      : 'total_40hq'
    return (tarifaSeleccionada[campo] || 0) * form.cantidad
  }

  const getTotalServicios = () => {
    let total = servicios.filter(s => s.activo).reduce((acc, s) => acc + (Number(s.monto) || 0), 0)
    if (otroServicio.activo) total += Number(otroServicio.monto) || 0
    return total
  }

  const getTotalFinal = () => getTotalFlete() + getTotalServicios()

  const generarNumero = () => {
    const fecha = new Date()
    const anio = fecha.getFullYear()
    const rand = Math.floor(Math.random() * 900) + 100
    return `COT-${anio}-${rand}`
  }

  const guardarCotizacion = async (estado: string) => {
    if (!tarifaSeleccionada) return
    setGuardando(true)

    const { data: { user } } = await supabase.auth.getUser()

    let clienteId = form.cliente_id
    if (nuevoCliente) {
      const { data: nuevoClienteData } = await supabase
        .from('clientes')
        .insert({ razon_social: form.razon_social, ruc: form.ruc, email: form.email_cliente })
        .select().single()
      clienteId = nuevoClienteData?.id
    }

    const campo = form.tipo_contenedor === "20' GP" ? 'tarifa_20gp'
      : form.tipo_contenedor === "40' NOR" ? 'tarifa_40nor'
      : 'tarifa_40hq'

    const { data: cotData, error } = await supabase.from('cotizaciones').insert({
      numero: generarNumero(),
      cliente_id: clienteId,
      usuario_id: user?.id,
      tipo_servicio: form.tipo_servicio,
      moneda: form.moneda,
      incoterm: form.incoterm,
      origen: tarifaSeleccionada.pol,
      destino: tarifaSeleccionada.pod,
      tipo_contenedor: form.tipo_contenedor,
      cantidad: form.cantidad,
      tipo_carga: form.tipo_carga,
      carrier: tarifaSeleccionada.carrier,
      transit_time: tarifaSeleccionada.transit_time,
      free_days: tarifaSeleccionada.free_days,
      validez_tarifa: tarifaSeleccionada.validez,
      tarifa_flete: tarifaSeleccionada[campo],
      tarifa_thc: tarifaSeleccionada.thc,
      tarifa_bl: tarifaSeleccionada.bl,
      total_flete: getTotalFlete(),
      total_servicios: getTotalServicios(),
      total_final: getTotalFinal(),
      estado,
      observaciones,
      email_cliente: form.email_cliente,
    }).select().single()

    if (error) { alert('Error: ' + error.message); setGuardando(false); return }

    const serviciosActivos = servicios.filter(s => s.activo)
    if (otroServicio.activo && otroServicio.nombre) {
      serviciosActivos.push({ nombre: otroServicio.nombre, monto: otroServicio.monto, activo: true })
    }

    if (serviciosActivos.length > 0) {
      await supabase.from('cotizacion_servicios').insert(
        serviciosActivos.map(s => ({ cotizacion_id: cotData.id, nombre: s.nombre, monto: s.monto }))
      )
    }

    setGuardando(false)
    router.push(`/comercial/${cotData.id}`)
  }

  const StepBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
      {['Datos del envio', 'Seleccionar tarifa', 'Servicios adicionales', 'Generar cotizacion'].map((label, i) => {
        const num = i + 1
        const done = paso > num
        const active = paso === num
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, background: done ? '#15803D' : active ? '#C41230' : '#F0F0F0', color: done || active ? 'white' : '#AAA' }}>
                {done ? '✓' : num}
              </div>
              <span style={{ fontSize: '10px', color: active ? '#C41230' : done ? '#15803D' : '#AAA', fontWeight: active || done ? 600 : 400, whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < 3 && <div style={{ flex: 1, height: '2px', background: done ? '#C41230' : '#EEE', margin: '0 8px', marginBottom: '16px' }} />}
          </div>
        )
      })}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <a href="/comercial" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>Cotizaciones</a>
          <span style={{ color: '#DDD' }}>›</span>
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Nueva cotizacion</span>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
          Salir
        </button>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 24px' }}>
        <StepBar />

        {/* PASO 1 — Datos del envio */}
        {paso === 1 && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>📋</div>
              <div>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Datos del cliente y envio</h2>
                <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Completa la informacion para buscar las mejores tarifas</p>
              </div>
            </div>

            {/* Cliente */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>
                Cliente <span style={{ color: '#C41230' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button onClick={() => setNuevoCliente(false)}
                  style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer', background: !nuevoCliente ? '#C41230' : '#F5F5F5', color: !nuevoCliente ? 'white' : '#666' }}>
                  Cliente existente
                </button>
                <button onClick={() => setNuevoCliente(true)}
                  style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer', background: nuevoCliente ? '#C41230' : '#F5F5F5', color: nuevoCliente ? 'white' : '#666' }}>
                  Nuevo cliente
                </button>
              </div>
              {!nuevoCliente ? (
                <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                  style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white' }}>
                  <option value="">Selecciona un cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.razon_social} — RUC {c.ruc}</option>
                  ))}
                </select>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#666', marginBottom: '4px' }}>Razon social</label>
                    <input type="text" value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                      placeholder="Empresa S.A.C."
                      style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#666', marginBottom: '4px' }}>RUC</label>
                    <input type="text" value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })}
                      placeholder="20XXXXXXXXX"
                      style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Email del cliente</label>
              <input type="email" value={form.email_cliente} onChange={(e) => setForm({ ...form, email_cliente: e.target.value })}
                placeholder="contacto@empresa.com"
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Tipo de servicio</label>
                <select value={form.tipo_servicio} onChange={(e) => setForm({ ...form, tipo_servicio: e.target.value })}
                  style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white' }}>
                  <option>FCL Maritimo</option>
                  <option>LCL Maritimo</option>
                  <option>FCL Aereo</option>
                  <option>LCL Aereo</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Moneda</label>
                <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                  style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white' }}>
                  <option value="USD">USD — Dolares</option>
                  <option value="EUR">EUR — Euros</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Incoterm</label>
                <select value={form.incoterm} onChange={(e) => setForm({ ...form, incoterm: e.target.value })}
                  style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white' }}>
                  <option>FOB</option>
                  <option>CIF</option>
                  <option>EXW</option>
                  <option>DAP</option>
                  <option>DDP</option>
                  <option>FCA</option>
                  <option>CPT</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Pais de origen <span style={{ color: '#C41230' }}>*</span></label>
                <input type="text" value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}
                  placeholder="Ej: China, USA, Europa"
                  style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Pais de destino <span style={{ color: '#C41230' }}>*</span></label>
                <input type="text" value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })}
                  placeholder="Ej: Peru, Chile, Colombia"
                  style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Tipo de contenedor</label>
                <select value={form.tipo_contenedor} onChange={(e) => setForm({ ...form, tipo_contenedor: e.target.value })}
                  style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white' }}>
                  <option>20' GP</option>
                  <option>40' HQ</option>
                  <option>40' NOR</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Cantidad</label>
                <input type="number" min={1} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: parseInt(e.target.value) || 1 })}
                  style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Tipo de carga</label>
                <select value={form.tipo_carga} onChange={(e) => setForm({ ...form, tipo_carga: e.target.value })}
                  style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white' }}>
                  <option>General</option>
                  <option>Refrigerada</option>
                  <option>Peligrosa</option>
                  <option>Sobredimensionada</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => router.push('/comercial')}
                style={{ padding: '10px 20px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={buscarTarifas} disabled={loading || !form.origen}
                style={{ padding: '10px 20px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: loading || !form.origen ? 0.7 : 1 }}>
                {loading ? 'Buscando...' : 'Buscar tarifas →'}
              </button>
            </div>
          </div>
        )}

        {/* PASO 2 — Seleccionar tarifa */}
        {paso === 2 && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Tarifas disponibles</h2>
                <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{tarifas.length} opciones encontradas · ordenadas por precio</p>
              </div>
              <button onClick={() => setPaso(1)}
                style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Volver
              </button>
            </div>

            {tarifas.map((tarifa, i) => {
              const campo = form.tipo_contenedor === "20' GP" ? 'total_20gp'
                : form.tipo_contenedor === "40' NOR" ? 'total_40nor'
                : 'total_40hq'
              const total = (tarifa[campo] || 0) * form.cantidad
              const esMejor = i === 0

              return (
                <div key={tarifa.id} style={{
                  border: esMejor ? '2px solid #C41230' : '1px solid #F0F0F0',
                  borderRadius: '10px', padding: '14px', marginBottom: '10px',
                  background: esMejor ? '#FEF2F2' : '#FAFAFA'
                }}>
                  {esMejor && (
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#C41230', background: 'white', border: '1px solid #FECACA', padding: '2px 8px', borderRadius: '20px' }}>
                        Mejor precio
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' }}>{tarifa.carrier} — {tarifa.agente}</p>
                      <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{tarifa.pol} → {tarifa.pod}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '20px', fontWeight: 700, color: esMejor ? '#C41230' : '#1a1a1a', margin: '0 0 2px' }}>
                        {form.moneda} {total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </p>
                      <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>x {form.cantidad} {form.tipo_contenedor}</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                    {[
                      { label: 'Flete', valor: tarifa[form.tipo_contenedor === "20' GP" ? 'tarifa_20gp' : form.tipo_contenedor === "40' NOR" ? 'tarifa_40nor' : 'tarifa_40hq'] },
                      { label: 'THC', valor: tarifa.thc },
                      { label: 'Transit time', valor: tarifa.transit_time },
                      { label: 'Free days', valor: tarifa.free_days },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'white', borderRadius: '6px', padding: '7px', textAlign: 'center' }}>
                        <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>{item.label}</p>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>
                          {typeof item.valor === 'number' ? `${form.moneda} ${item.valor}` : item.valor || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#888' }}>
                      Valido hasta: {tarifa.validez ? new Date(tarifa.validez).toLocaleDateString('es-PE') : '—'}
                    </span>
                    <button onClick={() => seleccionarTarifa(tarifa)}
                      style={{ padding: '7px 16px', background: esMejor ? '#C41230' : 'white', color: esMejor ? 'white' : '#C41230', border: '1px solid #FECACA', borderRadius: '7px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                      Seleccionar →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* PASO 3 — Servicios adicionales */}
        {paso === 3 && tarifaSeleccionada && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '14px' }}>
            <div>
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Servicios adicionales</h2>
                  <button onClick={() => setPaso(2)}
                    style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
                    ← Cambiar tarifa
                  </button>
                </div>

                {servicios.map((servicio, i) => (
                  <div key={servicio.nombre} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: servicio.activo ? '#F9F9F9' : 'white', border: '1px solid #F0F0F0', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="checkbox" checked={servicio.activo}
                        onChange={(e) => {
                          const nuevos = [...servicios]
                          nuevos[i].activo = e.target.checked
                          setServicios(nuevos)
                        }}
                        style={{ accentColor: '#C41230', width: '15px', height: '15px' }} />
                      <span style={{ fontSize: '13px', color: servicio.activo ? '#1a1a1a' : '#888' }}>{servicio.nombre}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#888' }}>{form.moneda}</span>
                      <input type="number" min={0} value={servicio.monto}
                        disabled={!servicio.activo}
                        onChange={(e) => {
                          const nuevos = [...servicios]
                          nuevos[i].monto = parseFloat(e.target.value) || 0
                          setServicios(nuevos)
                        }}
                        style={{ width: '80px', padding: '5px 8px', border: '1px solid #E8E8E8', borderRadius: '6px', fontSize: '12px', textAlign: 'right', outline: 'none', opacity: servicio.activo ? 1 : 0.4 }} />
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: otroServicio.activo ? '#F9F9F9' : 'white', border: '1.5px dashed #E8E8E8', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <input type="checkbox" checked={otroServicio.activo}
                      onChange={(e) => setOtroServicio({ ...otroServicio, activo: e.target.checked })}
                      style={{ accentColor: '#C41230', width: '15px', height: '15px' }} />
                    <input type="text" placeholder="Otro cargo (descripcion libre)"
                      value={otroServicio.nombre}
                      disabled={!otroServicio.activo}
                      onChange={(e) => setOtroServicio({ ...otroServicio, nombre: e.target.value })}
                      style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', color: otroServicio.activo ? '#1a1a1a' : '#888' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#888' }}>{form.moneda}</span>
                    <input type="number" min={0} value={otroServicio.monto}
                      disabled={!otroServicio.activo}
                      onChange={(e) => setOtroServicio({ ...otroServicio, monto: parseFloat(e.target.value) || 0 })}
                      style={{ width: '80px', padding: '5px 8px', border: '1px solid #E8E8E8', borderRadius: '6px', fontSize: '12px', textAlign: 'right', outline: 'none', opacity: otroServicio.activo ? 1 : 0.4 }} />
                  </div>
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '6px' }}>Observaciones para el cliente</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Tarifa sujeta a disponibilidad de espacio..."
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'none', height: '80px', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Resumen */}
            <div>
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>Resumen de cotizacion</p>
                <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '10px', color: '#888', margin: '0 0 4px' }}>Servicio</p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 4px' }}>{form.tipo_servicio} · {form.tipo_contenedor}</p>
                  <p style={{ fontSize: '10px', color: '#888', margin: '0 0 2px' }}>Carrier: {tarifaSeleccionada.carrier}</p>
                  <p style={{ fontSize: '10px', color: '#888', margin: '0 0 2px' }}>{tarifaSeleccionada.pol} → {tarifaSeleccionada.pod}</p>
                  <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>Transit: {tarifaSeleccionada.transit_time}</p>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F5F5F5', fontSize: '12px' }}>
                    <span style={{ color: '#666' }}>Flete ({form.tipo_contenedor} x{form.cantidad})</span>
                    <span style={{ fontWeight: 600 }}>{form.moneda} {getTotalFlete().toFixed(2)}</span>
                  </div>
                  {servicios.filter(s => s.activo).map(s => (
                    <div key={s.nombre} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F5F5F5', fontSize: '12px' }}>
                      <span style={{ color: '#666' }}>{s.nombre}</span>
                      <span style={{ fontWeight: 600 }}>{form.moneda} {Number(s.monto).toFixed(2)}</span>
                    </div>
                  ))}
                  {otroServicio.activo && otroServicio.nombre && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F5F5F5', fontSize: '12px' }}>
                      <span style={{ color: '#666' }}>{otroServicio.nombre}</span>
                      <span style={{ fontWeight: 600 }}>{form.moneda} {Number(otroServicio.monto).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '2px solid #C41230', paddingTop: '10px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700 }}>
                    <span>Total</span>
                    <span style={{ color: '#C41230' }}>{form.moneda} {getTotalFinal().toFixed(2)}</span>
                  </div>
                </div>

                <button onClick={() => guardarCotizacion('pendiente')} disabled={guardando}
                  style={{ width: '100%', padding: '11px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '8px', opacity: guardando ? 0.7 : 1 }}>
                  {guardando ? 'Generando...' : 'Generar cotizacion →'}
                </button>
                <button onClick={() => guardarCotizacion('borrador')} disabled={guardando}
                  style={{ width: '100%', padding: '11px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', opacity: guardando ? 0.7 : 1 }}>
                  Guardar borrador
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}