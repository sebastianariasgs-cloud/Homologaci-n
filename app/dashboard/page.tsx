'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Notificaciones from '../components/Notificaciones'

export default function DashboardPage() {
  const router = useRouter()
  const [proveedor, setProveedor] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [docsConductor, setDocsConductor] = useState<any[]>([])
  const [docsUnidad, setDocsUnidad] = useState<any[]>([])
  const [docsRequeridos, setDocsRequeridos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: prov } = await supabase
      .from('proveedores').select('*').eq('user_id', session.user.id).single()
    setProveedor(prov)

    if (prov) {
      const { data: docs } = await supabase.from('documentos').select('*').eq('proveedor_id', prov.id)
      setDocumentos(docs || [])

      const { data: tiposProv } = await supabase.from('proveedor_tipos').select('tipo_id').eq('proveedor_id', prov.id)
      if (tiposProv && tiposProv.length > 0) {
        const { data: req } = await supabase.from('documentos_requeridos').select('*').in('tipo_proveedor_id', tiposProv.map((t: any) => t.tipo_id)).eq('activo', true)
        const nombresVistos = new Set()
        setDocsRequeridos((req || []).filter((d: any) => { if (nombresVistos.has(d.nombre)) return false; nombresVistos.add(d.nombre); return true }))
      }

      const { data: conds } = await supabase.from('conductores').select('id').eq('proveedor_id', prov.id).eq('activo', true)
      if (conds && conds.length > 0) {
        const { data: dc } = await supabase.from('documentos_conductor').select('*').in('conductor_id', conds.map((c: any) => c.id))
        setDocsConductor(dc || [])
      }

      const { data: units } = await supabase.from('unidades').select('id').eq('proveedor_id', prov.id).eq('activo', true)
      if (units && units.length > 0) {
        const { data: du } = await supabase.from('documentos_unidad').select('*').in('unidad_id', units.map((u: any) => u.id))
        setDocsUnidad(du || [])
      }
    }

    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #EEEEEE', borderTopColor: '#C41230', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#999', fontSize: '13px', margin: 0 }}>Cargando...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const totalDocs = docsRequeridos.length
  const docsSubidos = documentos.length + docsConductor.length + docsUnidad.length
  const docsAprobados = [...documentos, ...docsConductor, ...docsUnidad].filter((d: any) => d.estado === 'aprobado').length
  const docsPendientes = [...documentos, ...docsConductor, ...docsUnidad].filter((d: any) => d.estado === 'pendiente').length
  const docsRechazados = [...documentos, ...docsConductor, ...docsUnidad].filter((d: any) => d.estado === 'rechazado').length
  const progreso = totalDocs > 0 ? Math.min(Math.round((docsSubidos / totalDocs) * 100), 100) : 0

  const pasos = ['Registro', 'Documentos', 'En revisión', 'Homologado']
  const pasoActual = proveedor?.estado === 'homologado' ? 3 :
    proveedor?.estado === 'aprobado' ? 3 :
    proveedor?.estado === 'en_revision' ? 2 :
    docsSubidos > 0 ? 1 : 0

  const estadoBadge: { [key: string]: { bg: string, color: string, texto: string } } = {
    pendiente:   { bg: '#FFF3E0', color: '#E65100', texto: 'Pendiente de revisión' },
    en_revision: { bg: '#E3F2FD', color: '#1565C0', texto: 'En revisión' },
    aprobado:    { bg: '#E8F5E9', color: '#2E7D32', texto: 'Aprobado' },
    homologado:  { bg: '#E8F5E9', color: '#2E7D32', texto: '✅ Homologado' },
    rechazado:   { bg: '#FFEBEE', color: '#B71C1C', texto: 'Rechazado' },
  }

  const badge = estadoBadge[proveedor?.estado] || estadoBadge.pendiente
  const perfilCompleto = !!(proveedor?.tipo_servicio?.length > 0 || proveedor?.tipo_id)

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* NAV */}
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/dashboard">
            <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
          </a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>Portal del proveedor</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Notificaciones proveedorId={proveedor?.id} />
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'white', margin: 0 }}>{proveedor?.razon_social}</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>RUC {proveedor?.ruc}</p>
          </div>
          <button onClick={handleLogout}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>Mi homologación</h1>
            <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>Sigue el progreso de tu proceso</p>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, padding: '6px 16px', borderRadius: '20px', background: badge.bg, color: badge.color }}>
            {badge.texto}
          </span>
        </div>

        {/* Progreso + pasos */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '24px', border: '1px solid #E8ECF0', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Progreso de documentación</p>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#C41230', margin: 0 }}>{progreso}%</p>
          </div>
          <div style={{ height: '8px', background: '#F0F2F5', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ height: '100%', background: progreso === 100 ? '#2E7D32' : '#C41230', borderRadius: '4px', width: `${progreso}%`, transition: 'width 0.5s' }} />
          </div>

          {/* Pasos */}
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {pasos.map((paso, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {i < pasos.length - 1 && (
                  <div style={{ position: 'absolute', top: '14px', left: '50%', width: '100%', height: '2px', background: i < pasoActual ? '#C41230' : '#E8ECF0', zIndex: 0 }} />
                )}
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, zIndex: 1, position: 'relative', background: i < pasoActual ? '#C41230' : i === pasoActual ? 'white' : '#F0F2F5', color: i < pasoActual ? 'white' : i === pasoActual ? '#C41230' : '#BCC6D0', border: i === pasoActual ? '2px solid #C41230' : 'none' }}>
                  {i < pasoActual ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: '11px', marginTop: '8px', textAlign: 'center', color: i <= pasoActual ? '#0F1923' : '#BCC6D0', fontWeight: i === pasoActual ? 700 : 400 }}>
                  {paso}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* KPIs documentos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total requeridos', valor: totalDocs, bg: 'white', color: '#0F1923', border: '#E8ECF0', icon: '📋' },
            { label: 'Aprobados', valor: docsAprobados, bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7', icon: '✅' },
            { label: 'En revisión', valor: docsPendientes, bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9', icon: '⏳' },
            { label: 'Rechazados', valor: docsRechazados, bg: '#FFEBEE', color: '#B71C1C', border: '#EF9A9A', icon: '❌' },
          ].map((kpi: any) => (
            <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${kpi.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <span style={{ fontSize: '18px' }}>{kpi.icon}</span>
              <p style={{ fontSize: '26px', fontWeight: 800, color: kpi.color, margin: '8px 0 4px', lineHeight: 1 }}>{kpi.valor}</p>
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Cards navegación */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
          {[
            {
              titulo: 'Mi perfil',
              desc: 'Completa los datos de tu empresa, tipo de servicios y alcance de operación.',
              link: '/dashboard/perfil',
              linkText: 'Ver perfil →',
              icon: '🏢',
              done: perfilCompleto,
            },
            {
              titulo: 'Mis documentos',
              desc: 'Carga y gestiona los documentos requeridos para completar tu homologación.',
              link: '/dashboard/documentos',
              linkText: 'Ir a documentos →',
              icon: '📄',
              done: docsSubidos > 0,
            },
            {
              titulo: 'Mi score',
              desc: 'Revisa tu puntaje de desempeño y estado de homologación.',
              link: null,
              linkText: 'Disponible tras la revisión',
              icon: '📊',
              done: false,
            },
          ].map((card: any) => (
            <div key={card.titulo} style={{ background: 'white', borderRadius: '14px', padding: '20px', border: '1px solid #E8ECF0', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'box-shadow 0.15s' }}
              onMouseEnter={(e: any) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
              onMouseLeave={(e: any) => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                  {card.icon}
                </div>
                {card.done && <span style={{ fontSize: '10px', fontWeight: 700, background: '#E8F5E9', color: '#2E7D32', padding: '3px 8px', borderRadius: '20px' }}>✓ Completado</span>}
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', marginBottom: '6px', margin: '0 0 6px' }}>{card.titulo}</h3>
              <p style={{ fontSize: '12px', color: '#8A9BB0', lineHeight: 1.6, flex: 1, margin: '0 0 14px' }}>{card.desc}</p>
              {card.link ? (
                <a href={card.link} style={{ fontSize: '12px', color: '#C41230', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {card.linkText}
                </a>
              ) : (
                <span style={{ fontSize: '12px', color: '#BCC6D0' }}>{card.linkText}</span>
              )}
            </div>
          ))}
        </div>

        {/* Próximos pasos */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '24px', border: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: '0 0 16px' }}>Próximos pasos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { num: 1, texto: 'Completa los datos de tu empresa en Mi perfil', done: perfilCompleto, link: '/dashboard/perfil' },
              { num: 2, texto: 'Carga todos los documentos requeridos', done: docsSubidos > 0, link: '/dashboard/documentos' },
              { num: 3, texto: 'Espera la revisión del equipo de Omni Logistics', done: proveedor?.estado === 'homologado' || proveedor?.estado === 'aprobado', link: null },
            ].map((paso: any) => (
              <div key={paso.num} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: paso.done ? '#E8F5E9' : '#F8F9FA', border: `1px solid ${paso.done ? '#A5D6A7' : '#E8ECF0'}` }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, background: paso.done ? '#2E7D32' : '#C41230', color: 'white' }}>
                  {paso.done ? '✓' : paso.num}
                </div>
                <span style={{ fontSize: '13px', color: paso.done ? '#2E7D32' : '#0F1923', fontWeight: paso.done ? 600 : 400, flex: 1 }}>
                  {paso.texto}
                </span>
                {paso.link && !paso.done && (
                  <a href={paso.link} style={{ fontSize: '12px', color: '#C41230', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' as const }}>
                    Ir →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}