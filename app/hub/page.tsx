'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonAdmin from '../components/BotonAdmin'

const MODULOS = [
  {
    id: 'evaluador',
    titulo: 'Evaluador',
    desc: 'Homologación de proveedores',
    ruta: '/evaluador',
    accentColor: '#C41230',
    iconBg: '#FFEBEE',
    roles: ['evaluador', 'admin'],
  },
  {
    id: 'transporte',
    titulo: 'Transporte',
    desc: 'Gestión de solicitudes y flota',
    ruta: '/transporte',
    accentColor: '#1565C0',
    iconBg: '#E3F2FD',
    roles: ['transporte', 'admin'],
  },
  {
    id: 'operativo',
    titulo: 'Operativo',
    desc: 'Coordinación y seguimiento',
    ruta: '/operativo',
    accentColor: '#2E7D32',
    iconBg: '#E8F5E9',
    roles: ['operativo_sli', 'admin_operativo', 'supervisor_sli', 'admin'],
  },
  {
    id: 'comercial',
    titulo: 'Comercial',
    desc: 'Cotizaciones y clientes',
    ruta: '/comercial',
    accentColor: '#6A1B9A',
    iconBg: '#F3E5F5',
    roles: ['comercial', 'admin'],
  },
  {
    id: 'pricing',
    titulo: 'Pricing',
    desc: 'Tarifas y costos',
    ruta: '/pricing',
    accentColor: '#E65100',
    iconBg: '#FFF3E0',
    roles: ['pricing', 'admin'],
  },
  {
    id: 'supervisor',
    titulo: 'Supervisor SLI',
    desc: 'Indicadores y reportes',
    ruta: '/operativo',
    accentColor: '#1565C0',
    iconBg: '#E3F2FD',
    roles: ['supervisor_sli', 'admin'],
  },
  {
    id: 'admin_operativo',
    titulo: 'Admin operativo',
    desc: 'Configuración operativa',
    ruta: '/operativo',
    accentColor: '#0F1923',
    iconBg: '#F0F2F5',
    roles: ['admin_operativo', 'admin'],
  },
  {
    id: 'admin',
    titulo: 'Admin',
    desc: 'Usuarios y configuración',
    ruta: '/admin',
    accentColor: '#C41230',
    iconBg: '#FFEBEE',
    roles: ['admin'],
  },
]

const ICONOS: { [key: string]: string } = {
  evaluador: '📋',
  transporte: '🚛',
  operativo: '⚙️',
  comercial: '💼',
  pricing: '📊',
  supervisor: '📈',
  admin_operativo: '🔧',
  admin: '👑',
}

export default function HubPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState<any>(null)
  const [hora, setHora] = useState('')

  useEffect(() => {
    init()
    const ahora = new Date()
    const h = ahora.getHours()
    setHora(h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches')
  }, [])

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: p } = await supabase
      .from('perfiles').select('rol, nombre, email').eq('id', session.user.id).single()

    if (!p || p.rol === 'proveedor') { router.push('/dashboard'); return }
    setPerfil(p)
    setLoading(false)
  }

  const tieneAcceso = (modulo: any) => perfil && modulo.roles.includes(perfil.rol)

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

  const modulosAccesibles = MODULOS.filter(m => tieneAcceso(m))
  const modulosBloqueados = MODULOS.filter(m => !tieneAcceso(m))

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* NAV */}
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/hub">
            <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
          </a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Omni Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', margin: 0, lineHeight: 1.2 }}>
              {perfil?.nombre || perfil?.email}
            </p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', margin: 0, textTransform: 'capitalize' }}>
              {perfil?.rol?.replace('_', ' ')}
            </p>
          </div>
          <BotonAdmin />
          <button onClick={async () => { localStorage.removeItem('omni_rol'); await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '36px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '13px', color: '#8A9BB0', margin: '0 0 4px', textTransform: 'capitalize' }}>{fecha}</p>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>
            {hora}, {perfil?.nombre?.split(' ')[0] || 'bienvenido'}
          </h1>
          <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>
            Selecciona el módulo al que deseas acceder
          </p>
        </div>

        {/* Módulos accesibles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {modulosAccesibles.map((mod) => (
            <div key={mod.id}
              onClick={() => window.location.href = mod.ruta}
              style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = mod.accentColor; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
              onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = '#E8ECF0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: mod.accentColor }} />
              <div style={{ width: '44px', height: '44px', background: mod.iconBg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>
                {ICONOS[mod.id]}
              </div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>{mod.titulo}</p>
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 14px', lineHeight: 1.5 }}>{mod.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, background: mod.iconBg, color: mod.accentColor, padding: '3px 10px', borderRadius: '20px' }}>Acceder</span>
                <span style={{ fontSize: '12px', color: mod.accentColor, fontWeight: 700 }}>→</span>
              </div>
            </div>
          ))}
        </div>

        {/* Módulos bloqueados */}
        {modulosBloqueados.length > 0 && (
          <>
            <p style={{ fontSize: '12px', color: '#BCC6D0', margin: '0 0 12px', fontWeight: 500 }}>Sin acceso</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '32px' }}>
              {modulosBloqueados.map((mod) => (
                <div key={mod.id}
                  style={{ background: '#FAFBFC', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px', position: 'relative', overflow: 'hidden', opacity: 0.6 }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#E8ECF0' }} />
                  <div style={{ position: 'absolute', top: '14px', right: '14px', fontSize: '12px' }}>🔒</div>
                  <div style={{ width: '44px', height: '44px', background: '#F0F2F5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>
                    {ICONOS[mod.id]}
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#8A9BB0', margin: '0 0 4px' }}>{mod.titulo}</p>
                  <p style={{ fontSize: '11px', color: '#BCC6D0', margin: '0 0 14px', lineHeight: 1.5 }}>{mod.desc}</p>
                  <span style={{ fontSize: '10px', fontWeight: 700, background: '#F0F2F5', color: '#BCC6D0', padding: '3px 10px', borderRadius: '20px' }}>Sin acceso</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer KPIs — solo admin */}
        {perfil?.rol === 'admin' && (
          <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            {[
              { label: 'Módulos activos', valor: modulosAccesibles.length },
              { label: 'Roles en sistema', valor: 9 },
              { label: 'Portal v1.0', valor: '2026' },
            ].map((k: any) => (
              <div key={k.label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#0F1923', margin: '0 0 2px' }}>{k.valor}</p>
                <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>{k.label}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}