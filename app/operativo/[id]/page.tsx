'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

export default function DetalleSolicitudOperativoPage() {
  const router = useRouter()
  const params = useParams()
  const [solicitud, setSolicitud] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarSolicitud() }, [])

  const cargarSolicitud = async () => {
    const { data: sol } = await supabase
      .from('solicitudes_transporte')
      .select('*, proveedores(razon_social, ruc), unidades(placa), conductores(nombre_completo)')
      .eq('id', params.id)
      .single()

    if (!sol) { router.push('/operativo'); return }
    setSolicitud(sol)

    const { data: docs } = await supabase
      .from('solicitud_documentos')
      .select('*')
      .eq('solicitud_id', params.id)
    setDocumentos(docs || [])
    setLoading(false)
  }

  const verDocumento = async (url: string) => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(url, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const estadoBadge: { [key: string]: { bg: string, color: string, texto: string } } = {
    pendiente: { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente' },
    asignada: { bg: '#EEEDFE', color: '#3C3489', texto: 'Asignada' },
    en_transito: { bg: '#EFF6FF', color: '#1D4ED8', texto: 'En transito' },
    entregada: { bg: '#F0FDF4', color: '#15803D', texto: 'Entregada' },
  }

  const timeline = [
    { estado: 'pendiente', label: 'Solicitud creada', done: true },
    { estado: 'asignada', label: 'Empresa asignada', done: ['asignada', 'en_transito', 'entregada'].includes(solicitud?.estado) },
    { estado: 'en_transito', label: 'En transito', done: ['en_transito', 'entregada'].includes(solicitud?.estado) },
    { estado: 'entregada', label: 'Entrega confirmada', done: solicitud?.estado === 'entregada' },
  ]

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
    </div>
  )

  const badge = estadoBadge[solicitud.estado] || estadoBadge.pendiente

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <a href="/operativo" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>Solicitudes</a>
          <span style={{ color: '#DDD' }}>›</span>
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>{solicitud.numero}</span>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
          Salir
        </button>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '28px 24px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>

        <div>
          {/* Cabecera */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{solicitud.numero}</h2>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                </div>
                <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                  Creada el {new Date(solicitud.created_at).toLocaleDateString('es-PE')}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#F9F9F9', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              {[
                { label: 'Recojo', valor: solicitud.direccion_recojo },
                { label: 'Entrega', valor: solicitud.direccion_entrega },
                { label: 'Fecha recojo', valor: new Date(solicitud.fecha_recojo).toLocaleDateString('es-PE') },
                { label: 'Tipo de carga', valor: solicitud.tipo_carga },
                { label: 'Peso', valor: solicitud.peso ? `${solicitud.peso} TN` : '—' },
                { label: 'Volumen', valor: solicitud.volumen ? `${solicitud.volumen} m3` : '—' },
                { label: 'BL / AWB', valor: solicitud.bl_awb || '—' },
                { label: 'Consignatario', valor: solicitud.consignatario || '—' },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>{item.label}</p>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{item.valor}</p>
                </div>
              ))}
            </div>

            {solicitud.observaciones && (
              <div style={{ background: '#FFF7ED', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                <p style={{ fontSize: '10px', color: '#888', margin: '0 0 3px', fontWeight: 600 }}>OBSERVACIONES</p>
                <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{solicitud.observaciones}</p>
              </div>
            )}
          </div>

          {/* Empresa asignada */}
          {solicitud.estado !== 'pendiente' && solicitud.proveedores && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '12px' }}>Empresa asignada</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#F0FDF4', borderRadius: '8px', padding: '12px' }}>
                <div>
                  <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Empresa</p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#15803D', margin: 0 }}>{solicitud.proveedores.razon_social}</p>
                </div>
                <div>
                  <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Placa</p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{solicitud.unidades?.placa || '—'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '9px', color: '#888', margin: '0 0 2px' }}>Conductor</p>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{solicitud.conductores?.nombre_completo || '—'}</p>
                </div>
              </div>
              {solicitud.observaciones_transporte && (
                <div style={{ marginTop: '10px', background: '#F9F9F9', borderRadius: '8px', padding: '10px 12px' }}>
                  <p style={{ fontSize: '10px', color: '#888', margin: '0 0 3px', fontWeight: 600 }}>OBSERVACIONES DE TRANSPORTE</p>
                  <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{solicitud.observaciones_transporte}</p>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', marginBottom: '16px' }}>Seguimiento</p>
            {timeline.map((item, i) => (
              <div key={item.estado} style={{ display: 'flex', gap: '12px', paddingBottom: i < timeline.length - 1 ? '16px' : '0', position: 'relative' }}>
                {i < timeline.length - 1 && (
                  <div style={{ position: 'absolute', left: '10px', top: '20px', width: '2px', height: 'calc(100% - 4px)', background: item.done ? '#C41230' : '#F0F0F0' }} />
                )}
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, background: item.done ? (solicitud.estado === item.estado ? '#C41230' : '#15803D') : '#F0F0F0', color: item.done ? 'white' : '#AAA', zIndex: 1 }}>
                  {item.done && solicitud.estado !== item.estado ? '✓' : i + 1}
                </div>
                <div style={{ paddingTop: '2px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: item.done ? '#1a1a1a' : '#AAA', margin: '0 0 2px' }}>{item.label}</p>
                  {item.estado === 'entregada' && solicitud.fecha_entrega && (
                    <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>{new Date(solicitud.fecha_entrega).toLocaleDateString('es-PE')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel lateral */}
        <div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', marginBottom: '10px' }}>Documentos adjuntos</p>
            {documentos.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#AAA', margin: 0 }}>Sin documentos adjuntos</p>
            ) : (
              documentos.map(doc => (
                <div key={doc.id} onClick={() => verDocumento(doc.url)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#E6F1FB', border: '1px solid #B5D4F4', borderRadius: '6px', padding: '6px 10px', marginBottom: '6px', cursor: 'pointer' }}>
                  <span style={{ fontSize: '11px', color: '#185FA5', fontWeight: 600 }}>📄 {doc.nombre}</span>
                </div>
              ))
            )}
          </div>

          {/* Evidencia si fue entregada */}
          {solicitud.estado === 'entregada' && solicitud.evidencia_url && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', marginBottom: '10px' }}>Evidencia de entrega</p>
              <button onClick={() => verDocumento(solicitud.evidencia_url)}
                style={{ width: '100%', padding: '10px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Ver evidencia
              </button>
            </div>
          )}

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px' }}>
            <button onClick={() => router.push('/operativo')}
              style={{ width: '100%', padding: '10px', background: '#F5F5F5', color: '#666', border: '1px solid #E8E8E8', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
              ← Volver a solicitudes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}