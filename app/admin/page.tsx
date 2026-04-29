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
    proveedores_urgentes: 0,
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
  const [hora, setHora] = useState('')
  const [nombreAdmin, setNombreAdmin] = useState('')

  useEffect(() => {
    const h = new Date().getHours()
    setHora(h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches')
    init()
  }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol, nombre, email').eq('id', session.user.id).single()
    if (perfil?.rol !== 'admin') { router.push('/login'); return }
    setNombreAdmin(perfil?.nombre || perfil?.email || 'Admin')
    await cargarDatos()
  }

  const cargarDatos = async () => {
    const ahora = new Date()
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
    const en30dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [
      { data: provs },
      { data: cots },
      { data: sols },
      { data: docsVencer },
      { data: perfiles },
    ] = await Promise.all([
      supabase.from('proveedores').select('id, estado, urgente'),
      supabase.from('cotizaciones').select('estado, total_final').gte('created_at', inicioMes),
      supabase.from('solicitudes_transporte').select('estado'),
      supabase.from('documentos').select('id').lte('fecha_vencimiento', en30dias).eq('estado', 'aprobado'),
      supabase.from('perfiles').select('id'),
    ])

    setStats({
      proveedores_total: provs?.length || 0,
      proveedores_homologados: provs?.filter((p: any) => p.estado === 'homologado').length || 0,
      proveedores_pendientes: provs?.filter((p: any) => p.estado === 'pendiente').length || 0,
      proveedores_urgentes: provs?.filter((p: any) => p.urgente).length || 0,
      cotizaciones_mes: cots?.length || 0,
      cotizaciones_aceptadas: cots?.filter((c: any) => c.estado === 'aceptada').length || 0,
      cotizaciones_valor: cots?.reduce((acc: number, c: any) => acc + (c.total_final || 0), 0) || 0,
      solicitudes_total: sols?.length || 0,
      solicitudes_pendientes: sols?.filter((s: any) => s.estado === 'pendiente').length || 0,
      solicitudes_en_transito: sols?.filter((s: any) => s.estado === 'asignada').length || 0,
      solicitudes_entregadas: sols?.filter((s: any) => s.estado === 'entregada').length || 0,
      documentos_por_vencer: docsVencer?.length || 0,
      usuarios_activos: perfiles?.length || 0,
    })

    setLoading(false)
  }

  const fecha = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #EEEEEE', borderTopColor: '#C41230', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#999', fontSize: '13px', margin: 0 }}>Cargando...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const MODULOS = [
    {
      id: 'evaluador',
      titulo: 'Homologación',
      desc: 'Evaluación y gestión de proveedores',
      ruta: '/evaluador',
      accentColor: '#C41230',
      iconBg: '#FFEBEE',
      icon: '🏢',
      badge: stats.proveedores_pendientes > 0 ? { texto: `${stats.proveedores_pendientes} pendientes`, bg: '#FFEBEE', color: '#791F1F' } : null,
      kpis: [
        { label: 'Total', valor: stats.proveedores_total },
        { label: 'Homologados', valor: stats.proveedores_homologados },
        { label: 'Pendientes', valor: stats.proveedores_pendientes },
      ],
    },
    {
      id: 'transporte',
      titulo: 'Transporte',
      desc: 'Solicitudes, asignación y seguimiento',
      ruta: '/transporte',
      accentColor: '#1565C0',
      iconBg: '#E3F2FD',
      icon: '🚛',
      badge: stats.solicitudes_pendientes > 0 ? { texto: `${stats.solicitudes_pendientes} sin atender`, bg: '#E3F2FD', color: '#0C447C' } : null,
      kpis: [
        { label: 'Total', valor: stats.solicitudes_total },
        { label: 'Activas', valor: stats.solicitudes_en_transito },
        { label: 'Entregadas', valor: stats.solicitudes_entregadas },
      ],
    },
    {
      id: 'comercial',
      titulo: 'Comercial',
      desc: 'Cotizaciones y gestión de clientes',
      ruta: '/comercial',
      accentColor: '#6A1B9A',
      iconBg: '#F3E5F5',
      icon: '💼',
      badge: null,
      kpis: [
        { label: 'Este mes', valor: stats.cotizaciones_mes },
        { label: 'Aceptadas', valor: stats.cotizaciones_aceptadas },
        { label: 'Valor USD', valor: stats.cotizaciones_valor.toLocaleString('es-PE', { maximumFractionDigits: 0 }) },
      ],
    },
    {
      id: 'operativo',
      titulo: 'Operativo',
      desc: 'Coordinación y seguimiento operativo',
      ruta: '/operativo',
      accentColor: '#2E7D32',
      iconBg: '#E8F5E9',
      icon: '⚙️',
      badge: null,
      kpis: [],
    },
    {
      id: 'pricing',
      titulo: 'Pricing',
      desc: 'Gestión de tarifas y costos',
      ruta: '/pricing',
      accentColor: '#E65100',
      iconBg: '#FFF3E0',
      icon: '📊',
      badge: null,
      kpis: [],
    },
    {
      id: 'usuarios',
      titulo: 'Usuarios',
      desc: 'Gestión de accesos y roles',
      ruta: '/admin/usuarios',
      accentColor: '#0F1923',
      iconBg: '#E8EAF0',
      icon: '👥',
      badge: null,
      kpis: [
        { label: 'En plataforma', valor: stats.usuarios_activos },
      ],
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* NAV */}
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/admin">
            <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
          </a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Panel de administración</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', margin: 0, lineHeight: 1.2 }}>{nombreAdmin}</p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>Administrador</p>
          </div>
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      {/* HERO */}
      <div style={{ background: '#0F1923', padding: '32px 32px 0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap' as const, gap: '16px' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'capitalize' as const }}>{fecha}</p>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'white', margin: '0 0 6px' }}>
                {hora}, {nombreAdmin.split(' ')[0]}
              </h1>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                Aquí tienes un resumen del estado del portal
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
              {stats.proveedores_pendientes > 0 && (
                <a href="/evaluador" style={{ fontSize: '11px', fontWeight: 700, background: '#C41230', color: 'white', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ {stats.proveedores_pendientes} por homologar
                </a>
              )}
              {stats.documentos_por_vencer > 0 && (
                <div style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(255,255,255,0.1)', color: 'white', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)' }}>
                  📄 {stats.documentos_por_vencer} docs por vencer
                </div>
              )}
            </div>
          </div>

          {/* KPIs globales en hero */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'rgba(255,255,255,0.08)', borderRadius: '14px 14px 0 0', overflow: 'hidden' }}>
            {[
              { label: 'Proveedores', valor: stats.proveedores_total, sub: `${stats.proveedores_homologados} homologados`, accent: true },
              { label: 'Pendientes homologar', valor: stats.proveedores_pendientes, sub: `${stats.proveedores_urgentes} urgentes` },
              { label: 'Solicitudes transporte', valor: stats.solicitudes_total, sub: `${stats.solicitudes_pendientes} sin atender` },
              { label: 'Cotizaciones mes', valor: stats.cotizaciones_mes, sub: `${stats.cotizaciones_aceptadas} aceptadas` },
              { label: 'Usuarios', valor: stats.usuarios_activos, sub: 'en plataforma' },
            ].map((kpi, i) => (
              <div key={kpi.label} style={{ background: '#0F1923', padding: '16px 20px', borderTop: `2px solid ${i === 0 ? '#C41230' : 'rgba(255,255,255,0.08)'}` }}>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{kpi.label}</p>
                <p style={{ fontSize: '24px', fontWeight: 700, color: 'white', margin: 0, lineHeight: 1 }}>{kpi.valor}</p>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>{kpi.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 32px' }}>

        {/* Sección módulos operativos */}
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#8A9BB0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 12px' }}>Módulos operativos</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {MODULOS.filter(m => ['evaluador', 'transporte', 'comercial'].includes(m.id)).map((mod) => (
            <div key={mod.id}
              onClick={() => window.location.href = mod.ruta}
              style={{ background: 'white', borderRadius: '16px', border: '0.5px solid #E8ECF0', padding: '20px', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = mod.accentColor; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)' }}
              onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = '#E8ECF0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: mod.accentColor }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ width: '44px', height: '44px', background: mod.iconBg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  {mod.icon}
                </div>
                {mod.badge && (
                  <span style={{ fontSize: '10px', fontWeight: 700, background: mod.badge.bg, color: mod.badge.color, padding: '3px 8px', borderRadius: '20px' }}>
                    {mod.badge.texto}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>{mod.titulo}</p>
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 16px', lineHeight: 1.5 }}>{mod.desc}</p>
              {mod.kpis.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', paddingTop: '14px', borderTop: '1px solid #F0F2F5', marginBottom: '14px' }}>
                  {mod.kpis.map((k: any) => (
                    <div key={k.label}>
                      <p style={{ fontSize: '16px', fontWeight: 700, color: '#0F1923', margin: 0, lineHeight: 1 }}>{k.valor}</p>
                      <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '2px 0 0' }}>{k.label}</p>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '12px', color: mod.accentColor, fontWeight: 700 }}>Acceder →</span>
              </div>
            </div>
          ))}
        </div>

        {/* Sección módulos de soporte */}
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#8A9BB0', textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 12px' }}>Otros módulos</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {MODULOS.filter(m => ['operativo', 'pricing', 'usuarios'].includes(m.id)).map((mod) => (
            <div key={mod.id}
              onClick={() => window.location.href = mod.ruta}
              style={{ background: 'white', borderRadius: '16px', border: '0.5px solid #E8ECF0', padding: '20px', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = mod.accentColor; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)' }}
              onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = '#E8ECF0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: mod.accentColor }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ width: '44px', height: '44px', background: mod.iconBg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  {mod.icon}
                </div>
              </div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>{mod.titulo}</p>
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 16px', lineHeight: 1.5 }}>{mod.desc}</p>
              {mod.kpis.length > 0 && (
                <div style={{ display: 'flex', gap: '12px', paddingTop: '14px', borderTop: '1px solid #F0F2F5', marginBottom: '14px' }}>
                  {mod.kpis.map((k: any) => (
                    <div key={k.label}>
                      <p style={{ fontSize: '16px', fontWeight: 700, color: '#0F1923', margin: 0, lineHeight: 1 }}>{k.valor}</p>
                      <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '2px 0 0' }}>{k.label}</p>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '12px', color: mod.accentColor, fontWeight: 700 }}>Acceder →</span>
              </div>
            </div>
          ))}
        </div>

        {/* Banner valor cotizaciones */}
        <div style={{ background: '#0F1923', borderRadius: '16px', padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' as const }}>
          <div>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Valor cotizaciones este mes</p>
            <p style={{ fontSize: '28px', fontWeight: 700, color: 'white', margin: 0, lineHeight: 1 }}>
              USD {stats.cotizaciones_valor.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            {[
              { label: 'Docs por vencer', valor: stats.documentos_por_vencer, color: stats.documentos_por_vencer > 0 ? '#EF9A9A' : 'rgba(255,255,255,0.6)' },
              { label: 'Urgentes', valor: stats.proveedores_urgentes, color: stats.proveedores_urgentes > 0 ? '#EF9A9A' : 'rgba(255,255,255,0.6)' },
            ].map((item: any) => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '22px', fontWeight: 700, color: item.color, margin: 0, lineHeight: 1 }}>{item.valor}</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}