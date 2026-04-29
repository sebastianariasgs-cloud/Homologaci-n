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
  const [hora, setHora] = useState('')

  useEffect(() => {
    cargarDatos()
    const h = new Date().getHours()
    setHora(h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches')
  }, [])

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
        const { data: req } = await supabase.from('documentos_requeridos').select('*')
          .in('tipo_proveedor_id', tiposProv.map((t: any) => t.tipo_id)).eq('activo', true)
        const nombresVistos = new Set()
        setDocsRequeridos((req || []).filter((d: any) => {
          if (nombresVistos.has(d.nombre)) return false
          nombresVistos.add(d.nombre); return true
        }))
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

  const todosLosDocs = [...documentos, ...docsConductor, ...docsUnidad]
  const totalDocs = docsRequeridos.length
  const docsSubidos = todosLosDocs.length
  const docsAprobados = todosLosDocs.filter((d: any) => d.estado === 'aprobado').length
  const docsPendientes = todosLosDocs.filter((d: any) => d.estado === 'pendiente').length
  const docsRechazados = todosLosDocs.filter((d: any) => d.estado === 'rechazado').length
  const pendientesPorSubir = Math.max(totalDocs - docsSubidos, 0)
  const progreso = totalDocs > 0 ? Math.min(Math.round((docsSubidos / totalDocs) * 100), 100) : 0

  const pasos = ['Registro', 'Documentos', 'En revisión', 'Homologado']
  const pasoActual = proveedor?.estado === 'homologado' ? 3 :
    proveedor?.estado === 'en_revision' ? 2 :
    docsSubidos > 0 ? 1 : 0

  const estadoBadgeColor: { [key: string]: string } = {
    pendiente: '#E65100', en_revision: '#1565C0',
    aprobado: '#C41230', homologado: '#C41230', rechazado: '#B71C1C',
  }
  const estadoTexto: { [key: string]: string } = {
    pendiente: 'Pendiente', en_revision: 'En revisión',
    aprobado: 'Aprobado', homologado: 'Homologado', rechazado: 'Rechazado',
  }

  const badgeColor = estadoBadgeColor[proveedor?.estado] || '#E65100'
  const badgeTexto = estadoTexto[proveedor?.estado] || 'Pendiente'
  const perfilCompleto = !!(proveedor?.tipo_servicio?.length > 0 || proveedor?.tipo_id)
  const initiales = proveedor?.razon_social
    ? proveedor.razon_social.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : 'PR'

  const fecha = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Notificaciones proveedorId={proveedor?.id} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 12px' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#C41230', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '10px', fontWeight: 700 }}>
              {initiales}
            </div>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', margin: 0, lineHeight: 1.2 }}>{proveedor?.razon_social}</p>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>RUC {proveedor?.ruc}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      {/* HERO */}
      <div style={{ background: '#0F1923', padding: '32px 32px 0' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap' as const, gap: '16px' }}>
            <div>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'capitalize' as const }}>{fecha}</p>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'white', margin: '0 0 8px', lineHeight: 1.2 }}>
                {hora}, {proveedor?.razon_social?.split(' ')[0]}
              </h1>
              <span style={{ fontSize: '11px', fontWeight: 700, background: badgeColor, color: 'white', padding: '4px 12px', borderRadius: '20px' }}>
                {badgeTexto}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <a href="/dashboard/documentos" style={{ fontSize: '12px', fontWeight: 700, background: '#C41230', color: 'white', padding: '10px 18px', borderRadius: '10px', textDecoration: 'none' }}>
                📄 Mis documentos
              </a>
              <a href="/dashboard/perfil" style={{ fontSize: '12px', fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: 'white', padding: '10px 18px', borderRadius: '10px', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.15)' }}>
                Mi perfil
              </a>
            </div>
          </div>

          {/* KPIs en hero */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'rgba(255,255,255,0.08)', borderRadius: '14px 14px 0 0', overflow: 'hidden' }}>
            {[
              { label: 'Progreso', valor: `${progreso}%`, sub: 'de documentación', accent: true },
              { label: 'Aprobados', valor: docsAprobados, sub: 'documentos' },
              { label: 'En revisión', valor: docsPendientes, sub: 'documentos' },
              { label: 'Por cargar', valor: pendientesPorSubir, sub: 'documentos' },
            ].map((kpi, i) => (
              <div key={kpi.label} style={{ background: '#0F1923', padding: '16px 20px', borderTop: `2px solid ${i === 0 ? '#C41230' : 'rgba(255,255,255,0.08)'}` }}>
                <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{kpi.label}</p>
                <p style={{ fontSize: '26px', fontWeight: 700, color: 'white', margin: 0, lineHeight: 1 }}>{kpi.valor}</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>{kpi.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 32px' }}>

        {/* Barra de progreso + pasos */}
        <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Estado de homologación</p>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#C41230' }}>{progreso}% completado</span>
          </div>
          <div style={{ height: '8px', background: '#F0F2F5', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ height: '100%', width: `${progreso}%`, background: '#C41230', borderRadius: '4px', transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {pasos.map((paso, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {i < pasos.length - 1 && (
                  <div style={{ position: 'absolute', top: '14px', left: '50%', width: '100%', height: '2px', background: i < pasoActual ? '#C41230' : '#E8ECF0', zIndex: 0 }} />
                )}
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, zIndex: 1, position: 'relative', background: i < pasoActual ? '#C41230' : i === pasoActual ? 'white' : '#F0F2F5', color: i < pasoActual ? 'white' : i === pasoActual ? '#C41230' : '#BCC6D0', border: i === pasoActual ? '2px solid #C41230' : 'none' }}>
                  {i < pasoActual ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: '11px', marginTop: '8px', textAlign: 'center', color: i <= pasoActual ? '#0F1923' : '#BCC6D0', fontWeight: i === pasoActual ? 700 : 400 }}>{paso}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cards acceso rápido */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '16px' }}>
          {[
            {
              titulo: 'Mis documentos',
              desc: pendientesPorSubir > 0 ? `${pendientesPorSubir} documentos por cargar` : 'Documentación al día',
              link: '/dashboard/documentos',
              accentColor: '#C41230',
              iconBg: '#FFEBEE',
              icon: '📄',
              tagBg: pendientesPorSubir > 0 ? '#FFEBEE' : '#F0F2F5',
              tagColor: pendientesPorSubir > 0 ? '#791F1F' : '#8A9BB0',
              tagTexto: pendientesPorSubir > 0 ? `${pendientesPorSubir} pendientes` : 'Al día',
            },
            {
              titulo: 'Mi perfil',
              desc: 'Datos y tipo de servicios de tu empresa',
              link: '/dashboard/perfil',
              accentColor: '#0F1923',
              iconBg: '#E8EAF0',
              icon: '🏢',
              tagBg: perfilCompleto ? '#E3F2FD' : '#FFEBEE',
              tagColor: perfilCompleto ? '#0C447C' : '#791F1F',
              tagTexto: perfilCompleto ? 'Completo' : 'Incompleto',
            },
            {
              titulo: 'Mi score',
              desc: 'Estado de desempeño y homologación',
              link: null,
              accentColor: '#C41230',
              iconBg: '#FFEBEE',
              icon: '📊',
              tagBg: '#F0F2F5',
              tagColor: '#8A9BB0',
              tagTexto: 'Disponible pronto',
            },
          ].map((card: any) => (
            <div key={card.titulo}
              style={{ background: 'white', borderRadius: '16px', border: '0.5px solid #E8ECF0', padding: '20px', cursor: card.link ? 'pointer' : 'default', position: 'relative', overflow: 'hidden', transition: 'border-color 0.15s, transform 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              onMouseEnter={(e: any) => { if (card.link) { e.currentTarget.style.borderColor = card.accentColor; e.currentTarget.style.transform = 'translateY(-2px)' } }}
              onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = '#E8ECF0'; e.currentTarget.style.transform = 'translateY(0)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: card.accentColor }} />
              <div style={{ width: '44px', height: '44px', background: card.iconBg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', fontSize: '20px' }}>
                {card.icon}
              </div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>{card.titulo}</p>
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 14px', lineHeight: 1.5 }}>{card.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, background: card.tagBg, color: card.tagColor, padding: '3px 10px', borderRadius: '20px' }}>{card.tagTexto}</span>
                {card.link && <a href={card.link} style={{ fontSize: '12px', color: card.accentColor, fontWeight: 700, textDecoration: 'none' }}>Ir →</a>}
              </div>
            </div>
          ))}
        </div>

        {/* Próximos pasos */}
        <div style={{ background: 'white', borderRadius: '16px', border: '0.5px solid #E8ECF0', padding: '24px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: '0 0 16px' }}>Próximos pasos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { num: 1, texto: 'Completa los datos de tu empresa', sub: perfilCompleto ? 'Perfil completado' : 'Pendiente de completar', done: perfilCompleto, link: '/dashboard/perfil' },
              { num: 2, texto: 'Carga todos los documentos requeridos', sub: pendientesPorSubir > 0 ? `Faltan ${pendientesPorSubir} documentos` : 'Documentación al día', done: pendientesPorSubir <= 0 && docsSubidos > 0, link: '/dashboard/documentos' },
              { num: 3, texto: 'Espera la aprobación del evaluador', sub: 'Disponible al completar los documentos', done: proveedor?.estado === 'homologado', link: null },
            ].map((paso: any) => {
              const activo = !paso.done && (paso.num === 1 || (paso.num === 2 && perfilCompleto) || (paso.num === 3 && pendientesPorSubir <= 0))
              return (
                <div key={paso.num} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', borderRadius: '12px', background: paso.done ? '#F0F2F5' : activo ? '#FFEBEE' : '#FAFBFC', border: `0.5px solid ${paso.done ? '#BCC6D0' : activo ? '#EF9A9A' : '#E8ECF0'}` }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: paso.done ? '#0F1923' : activo ? '#C41230' : '#E8ECF0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {paso.done
                      ? <span style={{ color: 'white', fontSize: '14px' }}>✓</span>
                      : <span style={{ fontSize: '13px', fontWeight: 700, color: activo ? 'white' : '#8A9BB0' }}>{paso.num}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: paso.done ? '#0F1923' : activo ? '#0F1923' : '#8A9BB0', margin: 0 }}>{paso.texto}</p>
                    <p style={{ fontSize: '11px', color: paso.done ? '#8A9BB0' : activo ? '#791F1F' : '#BCC6D0', margin: '2px 0 0' }}>{paso.sub}</p>
                  </div>
                  {paso.link && !paso.done && activo && (
                    <a href={paso.link} style={{ fontSize: '11px', color: '#791F1F', background: 'white', border: '0.5px solid #EF9A9A', borderRadius: '8px', padding: '5px 12px', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' as const }}>
                      Completar →
                    </a>
                  )}
                  {paso.done && <span style={{ fontSize: '10px', fontWeight: 700, background: '#0F1923', color: 'white', padding: '3px 10px', borderRadius: '20px' }}>Listo</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Banner contacto */}
        <div style={{ background: '#0F1923', borderRadius: '16px', padding: '22px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' as const }}>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: 'white', margin: '0 0 4px' }}>¿Tienes alguna consulta?</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>Nuestro equipo de homologación está disponible para ayudarte.</p>
          </div>
          <a href="mailto:homologacion@omnilogistics.com.pe" style={{ fontSize: '12px', fontWeight: 700, background: '#C41230', color: 'white', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
            Contactar equipo
          </a>
        </div>

      </div>
    </div>
  )
}