'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function DetalleCotizacionPage() {
  const router = useRouter()
  const params = useParams()
  const [cotizacion, setCotizacion] = useState<any>(null)
  const [servicios, setServicios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [emailDestino, setEmailDestino] = useState('')

  useEffect(() => { cargarCotizacion() }, [])

  const cargarCotizacion = async () => {
    const { data: cot } = await supabase
      .from('cotizaciones')
      .select('*, clientes(razon_social, ruc, email)')
      .eq('id', params.id)
      .single()

    if (!cot) { router.push('/comercial'); return }
    setCotizacion(cot)
    setEmailDestino(cot.email_cliente || cot.clientes?.email || '')

    const { data: servs } = await supabase
      .from('cotizacion_servicios')
      .select('*')
      .eq('cotizacion_id', params.id)

    setServicios(servs || [])
    setLoading(false)
  }

  const actualizarEstado = async (estado: string) => {
    await supabase.from('cotizaciones').update({ estado }).eq('id', params.id)
    setCotizacion({ ...cotizacion, estado })
  }

  const exportarPDF = async () => {
    setGenerando(true)
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF()

    // Header rojo
    doc.setFillColor(196, 18, 48)
    doc.rect(0, 0, 210, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('OMNI LOGISTICS (PERU) S.R.L.', 14, 12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('www.omnilogistics.com  |  +51 983 287 925', 14, 19)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('COTIZACION', 160, 12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(cotizacion.numero, 160, 19)
    doc.text(new Date(cotizacion.created_at).toLocaleDateString('es-PE'), 160, 24)

    // Datos cliente y comercial
    doc.setTextColor(0)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('CLIENTE', 14, 38)
    doc.setFont('helvetica', 'normal')
    doc.text(cotizacion.clientes?.razon_social || '', 14, 44)
    doc.text(`RUC: ${cotizacion.clientes?.ruc || ''}`, 14, 49)

    doc.setFont('helvetica', 'bold')
    doc.text('INCOTERM', 120, 38)
    doc.setFont('helvetica', 'normal')
    doc.text(cotizacion.incoterm || '', 120, 44)

    doc.setFont('helvetica', 'bold')
    doc.text('MONEDA', 160, 38)
    doc.setFont('helvetica', 'normal')
    doc.text(cotizacion.moneda || 'USD', 160, 44)

    // Detalle del servicio
    autoTable(doc, {
      startY: 58,
      head: [['Servicio', 'Contenedor', 'Origen', 'Destino', 'Carrier', 'Transit', 'Free Days']],
      body: [[
        cotizacion.tipo_servicio,
        `${cotizacion.cantidad}x ${cotizacion.tipo_contenedor}`,
        cotizacion.origen,
        cotizacion.destino,
        cotizacion.carrier,
        cotizacion.transit_time || '—',
        cotizacion.free_days || '—',
      ]],
      headStyles: { fillColor: [196, 18, 48], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
    })

    // Detalle de costos
    const startY = (doc as any).lastAutoTable.finalY + 8
    const filas = [
      [`Flete maritimo (${cotizacion.tipo_contenedor} x${cotizacion.cantidad})`, `${cotizacion.moneda} ${cotizacion.total_flete?.toFixed(2)}`],
      ...servicios.map(s => [s.nombre, `${cotizacion.moneda} ${Number(s.monto).toFixed(2)}`]),
    ]

    autoTable(doc, {
      startY,
      head: [['Concepto', 'Monto']],
      body: filas,
      foot: [['TOTAL', `${cotizacion.moneda} ${cotizacion.total_final?.toFixed(2)}`]],
      headStyles: { fillColor: [196, 18, 48], fontSize: 9 },
      footStyles: { fillColor: [196, 18, 48], textColor: 255, fontStyle: 'bold', fontSize: 11 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
    })

    // Observaciones
    if (cotizacion.observaciones) {
      const y = (doc as any).lastAutoTable.finalY + 8
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text('Observaciones: ' + cotizacion.observaciones, 14, y)
    }

    // Footer
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text('Omni Logistics (Peru) S.R.L. | Documento confidencial', 14, 285)

    doc.save(`${cotizacion.numero}.pdf`)
    setGenerando(false)
  }

  const estadoBadge: { [key: string]: { bg: string, color: string, texto: string } } = {
    borrador: { bg: '#F5F5F5', color: '#666', texto: 'Borrador' },
    pendiente: { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente de envio' },
    enviada: { bg: '#EFF6FF', color: '#1D4ED8', texto: 'Enviada' },
    aceptada: { bg: '#F0FDF4', color: '#15803D', texto: 'Aceptada' },
    rechazada: { bg: '#FEF2F2', color: '#C41230', texto: 'Rechazada' },
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
    </div>
  )

  const badge = estadoBadge[cotizacion.estado] || estadoBadge.borrador

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <a href="/comercial" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>Cotizaciones</a>
          <span style={{ color: '#DDD' }}>›</span>
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>{cotizacion.numero}</span>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
          Salir
        </button>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '28px 24px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>

        {/* Vista previa cotizacion */}
        <div>
          <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #EEEEEE' }}>
            {/* Header PDF */}
            <div style={{ background: '#C41230', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ color: 'white', fontSize: '15px', fontWeight: 700, margin: '0 0 2px' }}>OMNI LOGISTICS (PERU) S.R.L.</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', margin: 0 }}>www.omnilogistics.com · +51 983 287 925</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: 'white', fontSize: '13px', fontWeight: 700, margin: '0 0 2px' }}>COTIZACION</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', margin: 0 }}>{cotizacion.numero}</p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', margin: 0 }}>{new Date(cotizacion.created_at).toLocaleDateString('es-PE')}</p>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              {/* Cliente */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #F0F0F0' }}>
                <div>
                  <p style={{ fontSize: '9px', color: '#888', margin: '0 0 3px', fontWeight: 600 }}>CLIENTE</p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px' }}>{cotizacion.clientes?.razon_social}</p>
                  <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>RUC: {cotizacion.clientes?.ruc}</p>
                </div>
                <div>
                  <p style={{ fontSize: '9px', color: '#888', margin: '0 0 3px', fontWeight: 600 }}>INCOTERM</p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{cotizacion.incoterm}</p>
                </div>
                <div>
                  <p style={{ fontSize: '9px', color: '#888', margin: '0 0 3px', fontWeight: 600 }}>MONEDA</p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{cotizacion.moneda}</p>
                </div>
              </div>

              {/* Detalle servicio */}
              <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                <p style={{ fontSize: '10px', color: '#888', margin: '0 0 8px', fontWeight: 600 }}>DETALLE DEL SERVICIO</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { label: 'Servicio', valor: cotizacion.tipo_servicio },
                    { label: 'Contenedor', valor: `${cotizacion.cantidad}x ${cotizacion.tipo_contenedor}` },
                    { label: 'Tipo de carga', valor: cotizacion.tipo_carga },
                    { label: 'Origen', valor: cotizacion.origen },
                    { label: 'Destino', valor: cotizacion.destino },
                    { label: 'Carrier', valor: cotizacion.carrier },
                    { label: 'Transit time', valor: cotizacion.transit_time || '—' },
                    { label: 'Free days', valor: cotizacion.free_days || '—' },
                    { label: 'Validez tarifa', valor: cotizacion.validez_tarifa ? new Date(cotizacion.validez_tarifa).toLocaleDateString('es-PE') : '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>{item.label}</p>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{item.valor}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Costos */}
              <p style={{ fontSize: '10px', color: '#888', margin: '0 0 8px', fontWeight: 600 }}>DETALLE DE COSTOS</p>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F5F5F5', fontSize: '12px' }}>
                  <span style={{ color: '#666' }}>Flete ({cotizacion.tipo_contenedor} x{cotizacion.cantidad})</span>
                  <span style={{ fontWeight: 600 }}>{cotizacion.moneda} {cotizacion.total_flete?.toFixed(2)}</span>
                </div>
                {servicios.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F5F5F5', fontSize: '12px' }}>
                    <span style={{ color: '#666' }}>{s.nombre}</span>
                    <span style={{ fontWeight: 600 }}>{cotizacion.moneda} {Number(s.monto).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '2px solid #C41230', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>
                <span>TOTAL</span>
                <span style={{ color: '#C41230' }}>{cotizacion.moneda} {cotizacion.total_final?.toFixed(2)}</span>
              </div>

              {cotizacion.observaciones && (
                <div style={{ background: '#FEF2F2', borderRadius: '6px', padding: '10px 12px' }}>
                  <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>{cotizacion.observaciones}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel acciones */}
        <div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>Acciones</p>
            <button onClick={exportarPDF} disabled={generando}
              style={{ width: '100%', padding: '10px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginBottom: '8px', opacity: generando ? 0.7 : 1 }}>
              {generando ? 'Generando...' : '↓ Descargar PDF'}
            </button>
            <button onClick={() => router.push('/comercial')}
              style={{ width: '100%', padding: '10px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              ← Volver a cotizaciones
            </button>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', marginBottom: '10px' }}>Estado</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
            </div>
            <select value={cotizacion.estado} onChange={(e) => actualizarEstado(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '12px', outline: 'none', background: 'white', marginBottom: '8px' }}>
              <option value="borrador">Borrador</option>
              <option value="pendiente">Pendiente de envio</option>
              <option value="enviada">Enviada</option>
              <option value="aceptada">Aceptada</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', marginBottom: '10px' }}>Enviar por email</p>
            <input type="email" value={emailDestino} onChange={(e) => setEmailDestino(e.target.value)}
              placeholder="correo@cliente.com"
              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '12px', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }} />
            <button disabled={enviando || !emailDestino}
              onClick={async () => {
                setEnviando(true)
                await actualizarEstado('enviada')
                alert(`Cotizacion marcada como enviada a ${emailDestino}`)
                setEnviando(false)
              }}
              style={{ width: '100%', padding: '10px', background: '#FEF2F2', color: '#C41230', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: (enviando || !emailDestino) ? 0.5 : 1 }}>
              {enviando ? 'Enviando...' : 'Marcar como enviada'}
            </button>
            <p style={{ fontSize: '10px', color: '#AAA', marginTop: '6px', textAlign: 'center' }}>
              El envio de email se configurara proximamente
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}