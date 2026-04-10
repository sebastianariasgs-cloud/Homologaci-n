'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NuevaSolicitudPage() {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [documentos, setDocumentos] = useState<{ nombre: string, archivo: File }[]>([])
  const [subiendo, setSubiendo] = useState(false)

  const [form, setForm] = useState({
    direccion_recojo: '',
    direccion_entrega: '',
    fecha_recojo: '',
    tipo_carga: 'General',
    peso: '',
    volumen: '',
    bl_awb: '',
    consignatario: '',
    observaciones: '',
    num_unidades: 1,
  })

  useEffect(() => { verificarRol() }, [])

  const verificarRol = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    if (!['operativo_sli', 'admin'].includes(perfil?.rol)) { router.push('/login'); return }
  }

  const generarNumero = () => {
    const fecha = new Date()
    const anio = fecha.getFullYear()
    const rand = Math.floor(Math.random() * 9000) + 1000
    return `SOL-${anio}-${rand}`
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
      alert('Completa los campos obligatorios')
      return
    }
    setGuardando(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { data: sol, error } = await supabase
      .from('solicitudes_transporte')
      .insert({
        numero: generarNumero(),
        operativo_id: user!.id,
        direccion_recojo: form.direccion_recojo,
        direccion_entrega: form.direccion_entrega,
        fecha_recojo: form.fecha_recojo,
        tipo_carga: form.tipo_carga,
        peso: form.peso ? parseFloat(form.peso) : null,
        volumen: form.volumen ? parseFloat(form.volumen) : null,
        bl_awb: form.bl_awb || null,
        consignatario: form.consignatario || null,
        observaciones: form.observaciones || null,
        num_unidades: form.num_unidades,
        estado: 'pendiente',
      })
      .select().single()

    if (error) { alert('Error: ' + error.message); setGuardando(false); return }

    if (documentos.length > 0) {
      setSubiendo(true)
      for (const doc of documentos) {
        const ruta = `solicitudes/${sol.id}/${doc.nombre.replace(/\s/g, '_')}`
        const { error: uploadError } = await supabase.storage
          .from('documentos').upload(ruta, doc.archivo, { upsert: true })
        if (!uploadError) {
          await supabase.from('solicitud_documentos').insert({
            solicitud_id: sol.id,
            nombre: doc.nombre,
            url: ruta,
          })
        }
      }
      setSubiendo(false)
    }

    setGuardando(false)
    router.push(`/operativo/${sol.id}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <a href="/operativo" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>Solicitudes</a>
          <span style={{ color: '#DDD' }}>›</span>
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Nueva solicitud</span>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
          Salir
        </button>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🚛</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Datos del embarque</h2>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Completa los datos y adjunta los documentos necesarios</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Direccion de recojo <span style={{ color: '#C41230' }}>*</span></label>
              <input type="text" value={form.direccion_recojo}
                onChange={(e) => setForm({ ...form, direccion_recojo: e.target.value })}
                placeholder="Terminal, muelle o direccion"
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Direccion de entrega <span style={{ color: '#C41230' }}>*</span></label>
              <input type="text" value={form.direccion_entrega}
                onChange={(e) => setForm({ ...form, direccion_entrega: e.target.value })}
                placeholder="Almacen o direccion de destino"
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Fecha de recojo <span style={{ color: '#C41230' }}>*</span></label>
              <input type="date" value={form.fecha_recojo}
                onChange={(e) => setForm({ ...form, fecha_recojo: e.target.value })}
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Tipo de carga</label>
              <select value={form.tipo_carga} onChange={(e) => setForm({ ...form, tipo_carga: e.target.value })}
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white' }}>
                <option>General</option>
                <option>Refrigerada</option>
                <option>Peligrosa</option>
                <option>Sobredimensionada</option>
                <option>Fragil</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Unidades requeridas <span style={{ color: '#C41230' }}>*</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setForm({ ...form, num_unidades: Math.max(1, form.num_unidades - 1) })}
                  style={{ width: '32px', height: '38px', border: '1.5px solid #E8E8E8', borderRadius: '8px', background: 'white', fontSize: '16px', cursor: 'pointer', flexShrink: 0 }}>−</button>
                <div style={{ flex: 1, padding: '9px 14px', border: '1.5px solid #C41230', borderRadius: '8px', fontSize: '14px', fontWeight: 700, color: '#C41230', textAlign: 'center', background: '#FEF2F2' }}>
                  {form.num_unidades}
                </div>
                <button onClick={() => setForm({ ...form, num_unidades: form.num_unidades + 1 })}
                  style={{ width: '32px', height: '38px', border: '1.5px solid #E8E8E8', borderRadius: '8px', background: 'white', fontSize: '16px', cursor: 'pointer', flexShrink: 0 }}>+</button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Peso (TN)</label>
              <input type="number" min={0} value={form.peso}
                onChange={(e) => setForm({ ...form, peso: e.target.value })}
                placeholder="0.00"
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Volumen (m3)</label>
              <input type="number" min={0} value={form.volumen}
                onChange={(e) => setForm({ ...form, volumen: e.target.value })}
                placeholder="0.00"
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Numero BL / AWB</label>
              <input type="text" value={form.bl_awb}
                onChange={(e) => setForm({ ...form, bl_awb: e.target.value })}
                placeholder="Ej: COSCO2026041201"
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Consignatario</label>
              <input type="text" value={form.consignatario}
                onChange={(e) => setForm({ ...form, consignatario: e.target.value })}
                placeholder="Nombre del cliente final"
                style={{ width: '100%', padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Documentos del embarque</label>
            <div style={{ border: '2px dashed #E8E8E8', borderRadius: '8px', padding: '14px', background: '#F9F9F9' }}>
              {documentos.length > 0 && (
                <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {documentos.map((doc, i) => (
                    <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#E6F1FB', border: '1px solid #B5D4F4', borderRadius: '6px', padding: '4px 10px' }}>
                      <span style={{ fontSize: '11px', color: '#185FA5' }}>📄 {doc.nombre}</span>
                      <button onClick={() => eliminarDocumento(i)}
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

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#444', marginBottom: '5px' }}>Instrucciones para el transportista</label>
            <textarea value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              placeholder="Instrucciones especiales, coordinar con almacen, hora de llegada, etc."
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', resize: 'none', height: '80px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => router.push('/operativo')}
              style={{ padding: '10px 20px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando || subiendo}
              style={{ padding: '10px 20px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: guardando || subiendo ? 0.7 : 1 }}>
              {guardando ? 'Guardando...' : subiendo ? 'Subiendo documentos...' : 'Enviar solicitud →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}