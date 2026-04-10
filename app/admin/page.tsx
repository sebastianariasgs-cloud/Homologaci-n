'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    proveedores_total: 0,
    proveedores_homologados: 0,
    proveedores_pendientes: 0,
    cotizaciones_mes: 0,
    cotizaciones_aceptadas: 0,
    cotizaciones_valor: 0,
    solicitudes_total: 0,
    solicitudes_pendientes: 0,
    solicitudes_en_transito: 0,
    solicitudes_entregadas: 0,
    documentos_por_vencer: 0,
    usuarios_activos: 0,
  })
  const [proveedoresRecientes, setProveedoresRecientes] = useState<any[]>([])
  const [cotizacionesRecientes, setCotizacionesRecientes] = useState<any[]>([])
  const [solicitudesRecientes, setSolicitudesRecientes] = useState<any[]>([])
  const [pestana, setPestana] = useState<'overview' | 'proveedores' | 'cotizaciones' | 'transporte'>('overview')

  useEffect(() => {
    const init = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return }
        const { data: perfil } = await supabase
         .from('perfiles').select('rol').eq('id', session.user.id).single()
        if (perfil?.rol !== 'admin') { router.push('/login'); return }
        await cargarDatos()
    }
     init()
    }, [])

  const cargarDatos = async () => {
    const ahora = new Date()
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
    const en30dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data: provs } = await supabase
      .from('proveedores').select('id, razon_social, ruc, estado, created_at').order('created_at', { ascending: false })
    const totalProvs = provs?.length || 0
    const homologados = provs?.filter(p => p.estado === 'homologado').length || 0
    const pendientes = provs?.filter(p => p.estado === 'pendiente').length || 0
    setProveedoresRecientes((provs || []).slice(0, 5))

    const { data: cots } = await supabase
      .from('cotizaciones')
      .select('*, clientes(razon_social)')
      .gte('created_at', inicioMes)
      .order('created_at', { ascending: false })
    const totalCots = cots?.length || 0
    const aceptadas = cots?.filter(c => c.estado === 'aceptada').length || 0
    const valorTotal = cots?.reduce((acc, c) => acc + (c.total_final || 0), 0) || 0
    setCotizacionesRecientes((cots || []).slice(0, 5))

    const { data: sols } = await supabase
      .from('solicitudes_transporte')
      .select('*')
      .order('created_at', { ascending: false })
    const totalSols = sols?.length || 0
    const solsPendientes = sols?.filter(s => s.estado === 'pendiente').length || 0
    const solsTransito = sols?.filter(s => s.estado === 'en_transito').length || 0
    const solsEntregadas = sols?.filter(s => s.estado === 'entregada').length || 0
    setSolicitudesRecientes((sols || []).slice(0, 5))

    const { data: docsVencer } = await supabase
      .from('documentos')
      .select('id')
      .lte('fecha_vencimiento', en30dias)
      .eq('estado', 'aprobado')
    const totalVencer = docsVencer?.length || 0

    const { data: perfiles } = await supabase.from('perfiles').select('id')
    const totalUsuarios = perfiles?.length || 0

    setStats({
      proveedores_total: totalProvs,
      proveedores_homologados: homologados,
      proveedores_pendientes: pendientes,
      cotizaciones_mes: totalCots,
      cotizaciones_aceptadas: aceptadas,
      cotizaciones_valor: valorTotal,
      solicitudes_total: totalSols,
      solicitudes_pendientes: solsPendientes,
      solicitudes_en_transito: solsTransito,
      solicitudes_entregadas: solsEntregadas,
      documentos_por_vencer: totalVencer,
      usuarios_activos: totalUsuarios,
    })

    setLoading(false)
  }

  const estadoBadge: { [key: string]: { bg: string, color: string, texto: string } } = {
    pendiente: { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente' },
    homologado: { bg: '#F0FDF4', color: '#15803D', texto: 'Homologado' },
    rechazado: { bg: '#FEF2F2', color: '#C41230', texto: 'Rechazado' },
    borrador: { bg: '#F5F5F5', color: '#666', texto: 'Borrador' },
    enviada: { bg: '#EFF6FF', color: '#1D4ED8', texto: 'Enviada' },
    aceptada: { bg: '#F0FDF4', color: '#15803D', texto: 'Aceptada' },
    asignada: { bg: '#EEEDFE', color: '#3C3489', texto: 'Asignada' },
    en_transito: { bg: '#EFF6FF', color: '#1D4ED8', texto: 'En transito' },
    entregada: { bg: '#F0FDF4', color: '#15803D', texto: 'Entregada' },
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Panel de administracion</span>
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <a href="/evaluador" style={{ fontSize: '11px', color: '#666', textDecoration: 'none', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E8E8E8', background: '#F9F9F9' }}>🏢 Homologacion</a>
            <a href="/comercial" style={{ fontSize: '11px', color: '#666', textDecoration: 'none', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E8E8E8', background: '#F9F9F9' }}>📋 Cotizaciones</a>
            <a href="/transporte" style={{ fontSize: '11px', color: '#666', textDecoration: 'none', padding: '5px 10px', borderRadius: '6px', border: '1px solid #E8E8E8', background: '#F9F9F9' }}>🚛 Transporte</a>
          </div>
        </div>
        <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
          style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
          Salir
        </button>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Proveedores homologados', valor: stats.proveedores_homologados, total: stats.proveedores_total, bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
            { label: 'Cotizaciones este mes', valor: stats.cotizaciones_mes, sub: `${stats.cotizaciones_aceptadas} aceptadas`, bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
            { label: 'Solicitudes de transporte', valor: stats.solicitudes_total, sub: `${stats.solicitudes_en_transito} en transito`, bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
            { label: 'Docs por vencer', valor: stats.documentos_por_vencer, sub: 'proximos 30 dias', bg: stats.documentos_por_vencer > 0 ? '#FEF2F2' : '#F7F7F7', color: stats.documentos_por_vencer > 0 ? '#C41230' : '#1a1a1a', border: stats.documentos_por_vencer > 0 ? '#FECACA' : '#EEEEEE' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${kpi.border}` }}>
              <p style={{ fontSize: '11px', color: '#888', margin: '0 0 8px' }}>{kpi.label}</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: kpi.color, margin: 0, lineHeight: 1 }}>{kpi.valor}</p>
              {(kpi as any).total && <p style={{ fontSize: '10px', color: '#888', margin: '4px 0 0' }}>de {(kpi as any).total} total</p>}
              {(kpi as any).sub && <p style={{ fontSize: '10px', color: '#888', margin: '4px 0 0' }}>{(kpi as any).sub}</p>}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Valor cotizaciones mes', valor: `USD ${stats.cotizaciones_valor.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`, bg: '#F7F7F7', color: '#1a1a1a', border: '#EEEEEE' },
            { label: 'Pendientes de homologar', valor: stats.proveedores_pendientes, bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
            { label: 'Solicitudes pendientes', valor: stats.solicitudes_pendientes, bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
            { label: 'Usuarios en plataforma', valor: stats.usuarios_activos, bg: '#F7F7F7', color: '#1a1a1a', border: '#EEEEEE' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${kpi.border}` }}>
              <p style={{ fontSize: '11px', color: '#888', margin: '0 0 8px' }}>{kpi.label}</p>
              <p style={{ fontSize: '24px', fontWeight: 700, color: kpi.color, margin: 0, lineHeight: 1 }}>{kpi.valor}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[
            { id: 'overview', label: 'Vista general' },
            { id: 'proveedores', label: 'Proveedores' },
            { id: 'cotizaciones', label: 'Cotizaciones' },
            { id: 'transporte', label: 'Transporte' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setPestana(tab.id as any)}
              style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: pestana === tab.id ? '#C41230' : 'white', color: pestana === tab.id ? 'white' : '#666', border: pestana === tab.id ? '1px solid #C41230' : '1px solid #EEEEEE' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {pestana === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Proveedores recientes</p>
                <a href="/evaluador" style={{ fontSize: '10px', color: '#C41230', textDecoration: 'none', fontWeight: 600 }}>Ver todos →</a>
              </div>
              {proveedoresRecientes.map((p, i) => {
                const badge = estadoBadge[p.estado] || estadoBadge.pendiente
                return (
                  <div key={p.id} style={{ padding: '10px 16px', borderBottom: i < proveedoresRecientes.length - 1 ? '1px solid #F5F5F5' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px' }}>{p.razon_social}</p>
                        <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>RUC {p.ruc}</p>
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                    </div>
                  </div>
                )
              })}
              {proveedoresRecientes.length === 0 && (
                <p style={{ fontSize: '12px', color: '#AAA', textAlign: 'center', padding: '20px', margin: 0 }}>Sin proveedores aun</p>
              )}
            </div>

            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Cotizaciones del mes</p>
                <a href="/comercial" style={{ fontSize: '10px', color: '#C41230', textDecoration: 'none', fontWeight: 600 }}>Ver todas →</a>
              </div>
              {cotizacionesRecientes.map((c, i) => {
                const badge = estadoBadge[c.estado] || estadoBadge.borrador
                return (
                  <div key={c.id} style={{ padding: '10px 16px', borderBottom: i < cotizacionesRecientes.length - 1 ? '1px solid #F5F5F5' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px' }}>{c.numero}</p>
                        <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>{c.clientes?.razon_social || '—'}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '20px', background: badge.bg, color: badge.color, display: 'block', marginBottom: '2px' }}>{badge.texto}</span>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{c.moneda} {c.total_final?.toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
              {cotizacionesRecientes.length === 0 && (
                <p style={{ fontSize: '12px', color: '#AAA', textAlign: 'center', padding: '20px', margin: 0 }}>Sin cotizaciones este mes</p>
              )}
            </div>

            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Solicitudes de transporte</p>
                <a href="/transporte" style={{ fontSize: '10px', color: '#C41230', textDecoration: 'none', fontWeight: 600 }}>Ver todas →</a>
              </div>
              {solicitudesRecientes.map((s, i) => {
                const badge = estadoBadge[s.estado] || estadoBadge.pendiente
                return (
                  <div key={s.id} style={{ padding: '10px 16px', borderBottom: i < solicitudesRecientes.length - 1 ? '1px solid #F5F5F5' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px' }}>{s.numero}</p>
                        <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>{new Date(s.fecha_recojo).toLocaleDateString('es-PE')}</p>
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                    </div>
                  </div>
                )
              })}
              {solicitudesRecientes.length === 0 && (
                <p style={{ fontSize: '12px', color: '#AAA', textAlign: 'center', padding: '20px', margin: 0 }}>Sin solicitudes aun</p>
              )}
            </div>
          </div>
        )}

        {pestana === 'proveedores' && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Todos los proveedores ({stats.proveedores_total})</p>
              <a href="/evaluador" style={{ fontSize: '12px', color: '#C41230', textDecoration: 'none', fontWeight: 600, background: '#FEF2F2', padding: '6px 14px', borderRadius: '7px', border: '1px solid #FECACA' }}>
                Ir al panel de evaluacion →
              </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#F0F0F0' }}>
              {[
                { label: 'Total', valor: stats.proveedores_total, color: '#1a1a1a', bg: 'white' },
                { label: 'Homologados', valor: stats.proveedores_homologados, color: '#15803D', bg: '#F0FDF4' },
                { label: 'Pendientes', valor: stats.proveedores_pendientes, color: '#C2410C', bg: '#FFF7ED' },
              ].map(item => (
                <div key={item.label} style={{ background: item.bg, padding: '16px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0 0 6px' }}>{item.label}</p>
                  <p style={{ fontSize: '28px', fontWeight: 700, color: item.color, margin: 0 }}>{item.valor}</p>
                </div>
              ))}
            </div>
            {proveedoresRecientes.map((p, i) => {
              const badge = estadoBadge[p.estado] || estadoBadge.pendiente
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #F5F5F5', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px' }}>{p.razon_social}</p>
                    <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>RUC {p.ruc} · Registrado {new Date(p.created_at).toLocaleDateString('es-PE')}</p>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                </div>
              )
            })}
          </div>
        )}

        {pestana === 'cotizaciones' && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Cotizaciones del mes ({stats.cotizaciones_mes})</p>
              <a href="/comercial" style={{ fontSize: '12px', color: '#C41230', textDecoration: 'none', fontWeight: 600, background: '#FEF2F2', padding: '6px 14px', borderRadius: '7px', border: '1px solid #FECACA' }}>
                Ir al modulo comercial →
              </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#F0F0F0' }}>
              {[
                { label: 'Total mes', valor: stats.cotizaciones_mes, color: '#1a1a1a', bg: 'white' },
                { label: 'Aceptadas', valor: stats.cotizaciones_aceptadas, color: '#15803D', bg: '#F0FDF4' },
                { label: 'Valor total', valor: `USD ${stats.cotizaciones_valor.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`, color: '#C41230', bg: '#FEF2F2' },
              ].map(item => (
                <div key={item.label} style={{ background: item.bg, padding: '16px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0 0 6px' }}>{item.label}</p>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: item.color, margin: 0 }}>{item.valor}</p>
                </div>
              ))}
            </div>
            {cotizacionesRecientes.map((c, i) => {
              const badge = estadoBadge[c.estado] || estadoBadge.borrador
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #F5F5F5', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px' }}>{c.numero} · {c.clientes?.razon_social}</p>
                    <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>{c.tipo_servicio} · {c.origen} → {c.destino}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: badge.bg, color: badge.color, display: 'block', marginBottom: '4px' }}>{badge.texto}</span>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{c.moneda} {c.total_final?.toFixed(2)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {pestana === 'transporte' && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Solicitudes de transporte ({stats.solicitudes_total})</p>
              <a href="/transporte" style={{ fontSize: '12px', color: '#C41230', textDecoration: 'none', fontWeight: 600, background: '#FEF2F2', padding: '6px 14px', borderRadius: '7px', border: '1px solid #FECACA' }}>
                Ir al panel de transporte →
              </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#F0F0F0' }}>
              {[
                { label: 'Total', valor: stats.solicitudes_total, color: '#1a1a1a', bg: 'white' },
                { label: 'Pendientes', valor: stats.solicitudes_pendientes, color: '#C2410C', bg: '#FFF7ED' },
                { label: 'En transito', valor: stats.solicitudes_en_transito, color: '#1D4ED8', bg: '#EFF6FF' },
                { label: 'Entregadas', valor: stats.solicitudes_entregadas, color: '#15803D', bg: '#F0FDF4' },
              ].map(item => (
                <div key={item.label} style={{ background: item.bg, padding: '16px 20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0 0 6px' }}>{item.label}</p>
                  <p style={{ fontSize: '28px', fontWeight: 700, color: item.color, margin: 0 }}>{item.valor}</p>
                </div>
              ))}
            </div>
            {solicitudesRecientes.map((s, i) => {
              const badge = estadoBadge[s.estado] || estadoBadge.pendiente
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #F5F5F5', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px' }}>{s.numero}</p>
                    <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                      {s.direccion_recojo} → {s.direccion_entrega} · Recojo: {new Date(s.fecha_recojo).toLocaleDateString('es-PE')}
                    </p>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: badge.bg, color: badge.color }}>{badge.texto}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}