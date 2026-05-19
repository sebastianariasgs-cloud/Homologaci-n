'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BotonHub from '../components/BotonHub'

export default function TransporteHubPage() {
  const router  = useRouter()
  const [perfil, setPerfil] = useState<any>(null)
  const [stats,  setStats]  = useState({ pendientes: 0, en_curso: 0, entregados_hoy: 0 })

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (!p || !['transporte', 'operativo_transporte', 'monitor', 'admin'].includes(p.rol)) {
        router.push('/hub'); return
      }
      setPerfil(p)
      const [{ count: pend }, { count: curso }, { count: entregados }] = await Promise.all([
        supabase.from('solicitudes_transporte').select('*', { count: 'exact', head: true }).eq('estado', 'asignado'),
        supabase.from('solicitudes_transporte').select('*', { count: 'exact', head: true }).in('estado', ['en_ruta', 'en_destino']),
        supabase.from('solicitudes_transporte').select('*', { count: 'exact', head: true }).eq('estado', 'entregado').gte('fecha_entrega_real', new Date().toISOString().split('T')[0]),
      ])
      setStats({ pendientes: pend || 0, en_curso: curso || 0, entregados_hoy: entregados || 0 })
    }
    init()
  }, [])

  if (!perfil) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #EEE', borderTopColor: '#C41230', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  const esCoord   = ['operativo_transporte', 'transporte', 'admin'].includes(perfil.rol)
  const esMonitor = ['monitor', 'transporte', 'admin'].includes(perfil.rol)

  const MODULOS = [
    esCoord && {
      titulo: 'Coordinación',
      desc: 'Asigna empresas, conductores y unidades. Gestiona precios y operativos.',
      ruta: '/transporte/coordinacion',
      accentColor: '#1565C0',
      iconBg: '#E3F2FD',
      icono: '📋',
      badge: stats.pendientes > 0 ? `${stats.pendientes} por atender` : 'Al día',
    },
    esMonitor && {
      titulo: 'Monitoreo',
      desc: 'Seguimiento en tiempo real, estados, incidencias y evidencia de entrega.',
      ruta: '/transporte/monitoreo',
      accentColor: '#2E7D32',
      iconBg: '#E8F5E9',
      icono: '📡',
      badge: stats.en_curso > 0 ? `${stats.en_curso} en curso` : 'Sin activos',
    },
  ].filter(Boolean) as any[]

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* NAV */}
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/hub">
            <img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} />
          </a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Transporte</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', margin: 0, lineHeight: 1.2 }}>{perfil.nombre || perfil.email}</p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', margin: 0, textTransform: 'capitalize' }}>{perfil.rol?.replace('_', ' ')}</p>
          </div>
          <BotonHub />
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '36px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '13px', color: '#8A9BB0', margin: '0 0 4px' }}>Módulo de transporte</p>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>
            Selecciona un submódulo
          </h1>
          <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>
            {perfil.rol === 'transporte' ? 'Supervisor · acceso completo' :
             perfil.rol === 'operativo_transporte' ? 'Operativo de transporte' :
             perfil.rol === 'monitor' ? 'Monitor de servicios' : 'Administrador'}
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
          {[
            { label: 'Por iniciar',    value: stats.pendientes,     accent: '#1565C0', bg: '#E3F2FD' },
            { label: 'En curso',       value: stats.en_curso,       accent: '#2E7D32', bg: '#E8F5E9' },
            { label: 'Entregados hoy', value: stats.entregados_hoy, accent: '#6A1B9A', bg: '#F3E5F5' },
          ].map(k => (
            <div key={k.label} style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: '28px', fontWeight: 700, color: k.accent, margin: '0 0 4px' }}>{k.value}</p>
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0, fontWeight: 500 }}>{k.label}</p>
            </div>
          ))}
        </div>

        {/* Cards de submódulos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
          {MODULOS.map((mod: any) => (
            <div key={mod.titulo}
              onClick={() => router.push(mod.ruta)}
              style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = mod.accentColor; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
              onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = '#E8ECF0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: mod.accentColor }} />
              <div style={{ width: '44px', height: '44px', background: mod.iconBg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>
                {mod.icono}
              </div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>{mod.titulo}</p>
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 14px', lineHeight: 1.5 }}>{mod.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, background: mod.iconBg, color: mod.accentColor, padding: '3px 10px', borderRadius: '20px' }}>{mod.badge}</span>
                <span style={{ fontSize: '12px', color: mod.accentColor, fontWeight: 700 }}>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}