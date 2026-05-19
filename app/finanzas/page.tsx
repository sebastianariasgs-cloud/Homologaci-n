'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BotonHub from '../components/BotonHub'

export default function FinanzasHubPage() {
  const router = useRouter()
  const [perfil, setPerfil] = useState<any>(null)
  const [stats,  setStats]  = useState({ pendientes: 0, pagados: 0, por_regularizar: 0, total_mes: 0 })

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (!p || !['operativo_sli', 'admin_operativo', 'supervisor_sli', 'finanzas', 'admin'].includes(p.rol)) {
        router.push('/hub'); return
      }
      setPerfil(p)

      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      const [{ data: ants }] = await Promise.all([
        supabase.from('anticipos').select('estado, monto, moneda').gte('fecha', inicioMes),
      ])
      const todos = ants || []
      setStats({
        pendientes:      todos.filter(a => ['pendiente_firma', 'firmado'].includes(a.estado)).length,
        pagados:         todos.filter(a => a.estado === 'pagado').length,
        por_regularizar: todos.filter(a => a.estado === 'pagado').length,
        total_mes:       todos.filter(a => a.moneda === 'USD').reduce((s, a) => s + (a.monto || 0), 0),
      })
    }
    init()
  }, [])

  if (!perfil) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #EEE', borderTopColor: '#C41230', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const esFinanzas  = ['finanzas', 'admin'].includes(perfil.rol)
  const esOperativo = ['operativo_sli', 'admin_operativo', 'supervisor_sli', 'admin'].includes(perfil.rol)

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/hub"><img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} /></a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Finanzas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', margin: 0 }}>{perfil.nombre || perfil.email}</p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', margin: 0, textTransform: 'capitalize' }}>{perfil.rol?.replace('_', ' ')}</p>
          </div>
          <BotonHub />
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '36px 24px' }}>

        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '13px', color: '#8A9BB0', margin: '0 0 4px' }}>Módulo de finanzas</p>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>Selecciona un submódulo</h1>
          <p style={{ fontSize: '13px', color: '#8A9BB0', margin: 0 }}>
            {esFinanzas ? 'Control y gestión de pagos' : 'Solicitudes de pago adelantado'}
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
          {[
            { label: 'Pendientes',       value: stats.pendientes,      accent: '#E65100', bg: '#FFF3E0' },
            { label: 'Pagados',          value: stats.pagados,         accent: '#1565C0', bg: '#E3F2FD' },
            { label: 'Por regularizar',  value: stats.por_regularizar, accent: '#6A1B9A', bg: '#F3E5F5' },
            { label: 'USD este mes',     value: `$ ${stats.total_mes.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`, accent: '#2E7D32', bg: '#E8F5E9' },
          ].map(k => (
            <div key={k.label} style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: '22px', fontWeight: 700, color: k.accent, margin: '0 0 4px' }}>{k.value}</p>
              <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0, fontWeight: 500 }}>{k.label}</p>
            </div>
          ))}
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>

          {/* Anticipos */}
          <div onClick={() => router.push('/finanzas/anticipos')}
            style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = '#6A1B9A'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
            onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = '#E8ECF0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#6A1B9A' }} />
            <div style={{ width: '44px', height: '44px', background: '#F3E5F5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>💸</div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 4px' }}>Anticipos</p>
            <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 14px', lineHeight: 1.5 }}>
              {esOperativo ? 'Solicita pagos adelantados a proveedores y regulariza con facturas.' : 'Gestiona y controla todas las solicitudes de anticipo.'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, background: '#F3E5F5', color: '#6A1B9A', padding: '3px 10px', borderRadius: '20px' }}>
                {stats.pendientes > 0 ? `${stats.pendientes} pendientes` : 'Al día'}
              </span>
              <span style={{ fontSize: '12px', color: '#6A1B9A', fontWeight: 700 }}>→</span>
            </div>
          </div>

          {/* Detracciones — próximamente */}
          <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px', position: 'relative', overflow: 'hidden', opacity: 0.5 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: '#E8ECF0' }} />
            <div style={{ position: 'absolute', top: '14px', right: '14px', fontSize: '11px', background: '#F0F2F5', color: '#8A9BB0', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>Próximamente</div>
            <div style={{ width: '44px', height: '44px', background: '#F0F2F5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>🏦</div>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#8A9BB0', margin: '0 0 4px' }}>Detracciones</p>
            <p style={{ fontSize: '11px', color: '#BCC6D0', margin: '0 0 14px', lineHeight: 1.5 }}>Control y seguimiento de detracciones SUNAT.</p>
            <span style={{ fontSize: '10px', fontWeight: 700, background: '#F0F2F5', color: '#BCC6D0', padding: '3px 10px', borderRadius: '20px' }}>Sin acceso</span>
          </div>

        </div>
      </div>
    </div>
  )
}