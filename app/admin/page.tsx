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
    setProveedoresRecientes((provs || []).slice(0, 5))

    const { data: cots } = await supabase
      .from('cotizaciones').select('*, clientes(razon_social)').gte('created_at', inicioMes).order('created_at', { ascending: false })
    setCotizacionesRecientes((cots || []).slice(0, 5))

    const { data: sols } = await supabase
      .from('solicitudes_transporte').select('*').order('created_at', { ascending: false })
    setSolicitudesRecientes((sols || []).slice(0, 5))

    const { data: docsVencer } = await supabase
      .from('documentos').select('id').lte('fecha_vencimiento', en30dias).eq('estado', 'aprobado')

    const { data: perfiles } = await supabase.from('perfiles').select('id')

    setStats({
      proveedores_total: provs?.length || 0,
      proveedores_homologados: provs?.filter((p: any) => p.estado === 'homologado').length || 0,
      proveedores_pendientes: provs?.filter((p: any) => p.estado === 'pendiente').length || 0,
      cotizaciones_mes: cots?.length || 0,
      cotizaciones_aceptadas: cots?.filter((c: any) => c.estado === 'aceptada').length || 0,
      cotizaciones_valor: cots?.reduce((acc: number, c: any) => acc + (c.total_final || 0), 0) || 0,
      solicitudes_total: sols?.length || 0,
      solicitudes_pendientes: sols?.filter((s: any) => s.estado === 'pendiente').length || 0,
      solicitudes_en_transito: sols?.filter((s: any) => s.estado === 'en_transito').length || 0,
      solicitudes_entregadas: sols?.filter((s: any) => s.estado === 'entregada').length || 0,
      documentos_por_vencer: docsVencer?.length || 0,
      usuarios_activos: perfiles?.length || 0,
    })

    setLoading(false)
  }

  const badge = (estado: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      pendiente:   { bg: '#FFF3E0', color: '#E65100', label: 'Pendiente' },
      homologado:  { bg: '#E8F5E9', color: '#2E7D32', label: 'Homologado' },
      rechazado:   { bg: '#FFEBEE', color: '#B71C1C', label: 'Rechazado' },
      borrador:    { bg: '#F5F5F5', color: '#616161', label: 'Borrador' },
      enviada:     { bg: '#E3F2FD', color: '#1565C0', label: 'Enviada' },
      aceptada:    { bg: '#E8F5E9', color: '#2E7D32', label: 'Aceptada' },
      en_transito: { bg: '#E3F2FD', color: '#1565C0', label: 'En tránsito' },
      entregada:   { bg: '#E8F5E9', color: '#2E7D32', label: 'Entregada' },
    }
    return map[estado] || map.pendiente
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FA', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #EEEEEE', borderTopColor: '#C41230', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#999', fontSize: '13px', margin: 0 }}>Cargando panel...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* SIDEBAR */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '220px', height: '100vh', background: '#0F1923', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <img src="/LogoOmni.png" alt="Omni" style={{ height: '30px', filter: 'brightness(0) invert(1)' }} />
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', margin: '8px 0 0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Panel de administración</p>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px' }}>
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 8px 10px', fontWeight: 600 }}>Módulos</p>
          {[
            { href: '/evaluador', icon: '🏢', label: 'Homologación' },
            { href: '/comercial', icon: '📋', label: 'Cotizaciones' },
            { href: '/transporte', icon: '🚛', label: 'Transporte' },
          ].map((item: any) => (
            <a key={item.href} href={item.href}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', marginBottom: '2px', textDecoration: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}
              onMouseEnter={(e: any) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={(e: any) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}>
              <span style={{ fontSize: '15px' }}>{item.icon}</span>
              {item.label}
            </a>
          ))}

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '16px 0' }} />
          <p style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 8px 10px', fontWeight: 600 }}>Configuración</p>
          <a href="/admin/usuarios"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', textDecoration: 'none', background: 'rgba(196,18,48,0.15)', color: '#FF6B6B', fontSize: '13px', border: '1px solid rgba(196,18,48,0.2)' }}>
            <span style={{ fontSize: '15px' }}>👤</span>
            Gestionar usuarios
          </a>
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ width: '100%', padding: '9px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', cursor: 'pointer' }}>
            ↗ Cerrar sesión
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ marginLeft: '220px', padding: '28px 32px', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>Vista general</h1>
            <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>
              {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {stats.proveedores_pendientes > 0 && (
              <a href="/evaluador" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', color: '#E65100', fontWeight: 600 }}>
                ⚠ {stats.proveedores_pendientes} pendiente{stats.proveedores_pendientes > 1 ? 's' : ''} de homologar
              </a>
            )}
            {stats.documentos_por_vencer > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: '8px', fontSize: '12px', color: '#B71C1C', fontWeight: 600 }}>
                📄 {stats.documentos_por_vencer} doc{stats.documentos_por_vencer > 1 ? 's' : ''} por vencer
              </div>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
          {[
            { label: 'Proveedores', valor: stats.proveedores_total, sub: `${stats.proveedores_homologados} homologados`, icon: '🏢', accent: '#1565C0', pct: stats.proveedores_total > 0 ? Math.round((stats.proveedores_homologados / stats.proveedores_total) * 100) : 0 },
            { label: 'Cotizaciones', valor: stats.cotizaciones_mes, sub: `${stats.cotizaciones_aceptadas} aceptadas`, icon: '📋', accent: '#2E7D32', pct: stats.cotizaciones_mes > 0 ? Math.round((stats.cotizaciones_aceptadas / stats.cotizaciones_mes) * 100) : 0 },
            { label: 'Transporte', valor: stats.solicitudes_total, sub: `${stats.solicitudes_en_transito} en tránsito`, icon: '🚛', accent: '#E65100', pct: stats.solicitudes_total > 0 ? Math.round((stats.solicitudes_entregadas / stats.solicitudes_total) * 100) : 0 },
            { label: 'Usuarios', valor: stats.usuarios_activos, sub: 'en plataforma', icon: '👥', accent: '#6A1B9A', pct: null },
          ].map((kpi: any) => (
            <div key={kpi.label} style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${kpi.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                  {kpi.icon}
                </div>
                {kpi.pct !== null && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: kpi.accent, background: `${kpi.accent}12`, padding: '3px 8px', borderRadius: '20px' }}>
                    {kpi.pct}%
                  </span>
                )}
              </div>
              <p style={{ fontSize: '30px', fontWeight: 800, color: '#0F1923', margin: '0 0 4px', lineHeight: 1 }}>{kpi.valor}</p>
              <p style={{ fontSize: '12px', color: '#8A9BB0', margin: '0 0 2px' }}>{kpi.label}</p>
              <p style={{ fontSize: '11px', color: kpi.accent, margin: 0, fontWeight: 600 }}>{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Fila secundaria */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#0F1923', borderRadius: '14px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Valor cotizaciones este mes</p>
              <p style={{ fontSize: '32px', fontWeight: 800, color: 'white', margin: 0, lineHeight: 1 }}>
                USD {stats.cotizaciones_valor.toLocaleString('es-PE', { minimumFractionDigits: 0 })}
              </p>
            </div>
            <div style={{ fontSize: '40px', opacity: 0.15 }}>💰</div>
          </div>
          <div style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pendientes homologar</p>
            <p style={{ fontSize: '34px', fontWeight: 800, color: stats.proveedores_pendientes > 0 ? '#E65100' : '#0F1923', margin: 0 }}>{stats.proveedores_pendientes}</p>
          </div>
          <div style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Docs por vencer</p>
            <p style={{ fontSize: '34px', fontWeight: 800, color: stats.documentos_por_vencer > 0 ? '#C41230' : '#0F1923', margin: 0 }}>{stats.documentos_por_vencer}</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'white', padding: '4px', borderRadius: '10px', border: '1px solid #E8ECF0', width: 'fit-content' }}>
          {[
            { id: 'overview', label: 'Vista general' },
            { id: 'proveedores', label: 'Proveedores' },
            { id: 'cotizaciones', label: 'Cotizaciones' },
            { id: 'transporte', label: 'Transporte' },
          ].map((tab: any) => (
            <button key={tab.id} onClick={() => setPestana(tab.id as any)}
              style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', background: pestana === tab.id ? '#0F1923' : 'transparent', color: pestana === tab.id ? 'white' : '#8A9BB0' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {pestana === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            {[
              { title: 'Proveedores recientes', link: '/evaluador', items: proveedoresRecientes, empty: 'Sin proveedores aún',
                render: (p: any) => ({ main: p.razon_social, sub: `RUC ${p.ruc}`, estado: p.estado }) },
              { title: 'Cotizaciones del mes', link: '/comercial', items: cotizacionesRecientes, empty: 'Sin cotizaciones este mes',
                render: (c: any) => ({ main: c.numero, sub: c.clientes?.razon_social || '—', estado: c.estado, extra: `${c.moneda} ${c.total_final?.toFixed(0)}` }) },
              { title: 'Solicitudes de transporte', link: '/transporte', items: solicitudesRecientes, empty: 'Sin solicitudes aún',
                render: (s: any) => ({ main: s.numero, sub: new Date(s.fecha_recojo).toLocaleDateString('es-PE'), estado: s.estado }) },
            ].map((col: any) => (
              <div key={col.title} style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>{col.title}</p>
                  <a href={col.link} style={{ fontSize: '11px', color: '#C41230', textDecoration: 'none', fontWeight: 600 }}>Ver todos →</a>
                </div>
                {col.items.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#BCC6D0', textAlign: 'center', padding: '28px', margin: 0 }}>{col.empty}</p>
                ) : col.items.map((item: any, i: any) => {
                  const r = col.render(item)
                  const b = badge(r.estado)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < col.items.length - 1 ? '1px solid #F5F7FA' : 'none' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F1923', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{r.main}</p>
                        <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>{r.sub}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', background: b.bg, color: b.color, display: 'inline-block' }}>{b.label}</span>
                        {r.extra && <p style={{ fontSize: '11px', fontWeight: 700, color: '#0F1923', margin: '3px 0 0' }}>{r.extra}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* PROVEEDORES */}
        {pestana === 'proveedores' && (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Todos los proveedores</p>
              <a href="/evaluador" style={{ fontSize: '12px', color: 'white', textDecoration: 'none', fontWeight: 600, background: '#C41230', padding: '7px 16px', borderRadius: '8px' }}>Ir al panel de evaluación →</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid #F0F2F5' }}>
              {[
                { label: 'Total', valor: stats.proveedores_total, color: '#0F1923', bg: '#F8F9FA' },
                { label: 'Homologados', valor: stats.proveedores_homologados, color: '#2E7D32', bg: '#E8F5E9' },
                { label: 'Pendientes', valor: stats.proveedores_pendientes, color: '#E65100', bg: '#FFF3E0' },
              ].map((item: any) => (
                <div key={item.label} style={{ background: item.bg, padding: '18px 24px', textAlign: 'center', borderRight: '1px solid #F0F2F5' }}>
                  <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                  <p style={{ fontSize: '32px', fontWeight: 800, color: item.color, margin: 0 }}>{item.valor}</p>
                </div>
              ))}
            </div>
            {proveedoresRecientes.map((p: any, i: any) => {
              const b = badge(p.estado)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #F5F7FA', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: '0 0 3px' }}>{p.razon_social}</p>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>RUC {p.ruc} · {new Date(p.created_at).toLocaleDateString('es-PE')}</p>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: b.bg, color: b.color }}>{b.label}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* COTIZACIONES */}
        {pestana === 'cotizaciones' && (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Cotizaciones del mes</p>
              <a href="/comercial" style={{ fontSize: '12px', color: 'white', textDecoration: 'none', fontWeight: 600, background: '#C41230', padding: '7px 16px', borderRadius: '8px' }}>Ir al módulo comercial →</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid #F0F2F5' }}>
              {[
                { label: 'Total mes', valor: stats.cotizaciones_mes, color: '#0F1923', bg: '#F8F9FA' },
                { label: 'Aceptadas', valor: stats.cotizaciones_aceptadas, color: '#2E7D32', bg: '#E8F5E9' },
                { label: 'Valor total', valor: `USD ${stats.cotizaciones_valor.toLocaleString('es-PE', { minimumFractionDigits: 0 })}`, color: '#C41230', bg: '#FFEBEE' },
              ].map((item: any) => (
                <div key={item.label} style={{ background: item.bg, padding: '18px 24px', textAlign: 'center', borderRight: '1px solid #F0F2F5' }}>
                  <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                  <p style={{ fontSize: '28px', fontWeight: 800, color: item.color, margin: 0 }}>{item.valor}</p>
                </div>
              ))}
            </div>
            {cotizacionesRecientes.map((c: any, i: any) => {
              const b = badge(c.estado)
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #F5F7FA', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: '0 0 3px' }}>{c.numero} · {c.clientes?.razon_social}</p>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>{c.tipo_servicio} · {c.origen} → {c.destino}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: b.bg, color: b.color, display: 'block', marginBottom: '4px' }}>{b.label}</span>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F1923', margin: 0 }}>{c.moneda} {c.total_final?.toFixed(2)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* TRANSPORTE */}
        {pestana === 'transporte' && (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F2F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Solicitudes de transporte</p>
              <a href="/transporte" style={{ fontSize: '12px', color: 'white', textDecoration: 'none', fontWeight: 600, background: '#C41230', padding: '7px 16px', borderRadius: '8px' }}>Ir al panel de transporte →</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: '1px solid #F0F2F5' }}>
              {[
                { label: 'Total', valor: stats.solicitudes_total, color: '#0F1923', bg: '#F8F9FA' },
                { label: 'Pendientes', valor: stats.solicitudes_pendientes, color: '#E65100', bg: '#FFF3E0' },
                { label: 'En tránsito', valor: stats.solicitudes_en_transito, color: '#1565C0', bg: '#E3F2FD' },
                { label: 'Entregadas', valor: stats.solicitudes_entregadas, color: '#2E7D32', bg: '#E8F5E9' },
              ].map((item: any) => (
                <div key={item.label} style={{ background: item.bg, padding: '18px 24px', textAlign: 'center', borderRight: '1px solid #F0F2F5' }}>
                  <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                  <p style={{ fontSize: '32px', fontWeight: 800, color: item.color, margin: 0 }}>{item.valor}</p>
                </div>
              ))}
            </div>
            {solicitudesRecientes.map((s: any, i: any) => {
              const b = badge(s.estado)
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #F5F7FA', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: '0 0 3px' }}>{s.numero}</p>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>{s.direccion_recojo} → {s.direccion_entrega} · Recojo: {new Date(s.fecha_recojo).toLocaleDateString('es-PE')}</p>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: b.bg, color: b.color }}>{b.label}</span>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}