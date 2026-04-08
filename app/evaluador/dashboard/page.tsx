'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function EvaluadorDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0, homologados: 0, pendientes: 0, rechazados: 0, enRiesgo: 0
  })
  const [proveedoresRiesgo, setProveedoresRiesgo] = useState<any[]>([])
  const [actividadReciente, setActividadReciente] = useState<any[]>([])
  const [vencimientosProximos, setVencimientosProximos] = useState<any[]>([])
  const [completitud, setCompletitud] = useState<any[]>([])

  useEffect(() => { verificarRol() }, [])

  const verificarRol = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    if (perfil?.rol !== 'evaluador') { router.push('/dashboard'); return }
    await cargarDatos()
  }

  const cargarDatos = async () => {
    // Stats generales
    const { data: provs } = await supabase
      .from('proveedores').select('*, tipos_proveedor(nombre)')

    const total = provs?.length || 0
    const homologados = provs?.filter(p => p.estado === 'homologado').length || 0
    const pendientes = provs?.filter(p => p.estado === 'pendiente').length || 0
    const rechazados = provs?.filter(p => p.estado === 'rechazado').length || 0

    // Documentos por vencer en 7 días
    const hoy = new Date()
    const en7dias = new Date()
    en7dias.setDate(en7dias.getDate() + 7)

    const { data: docsVenciendo } = await supabase
      .from('documentos')
      .select('*, proveedores(razon_social)')
      .lte('fecha_vencimiento', en7dias.toISOString().split('T')[0])
      .gte('fecha_vencimiento', hoy.toISOString().split('T')[0])

    const { data: docsVenciendoCond } = await supabase
      .from('documentos_conductor')
      .select('*, conductores(nombre_completo, proveedores(razon_social))')
      .lte('fecha_vencimiento', en7dias.toISOString().split('T')[0])
      .gte('fecha_vencimiento', hoy.toISOString().split('T')[0])

    const { data: docsVenciendoUnit } = await supabase
      .from('documentos_unidad')
      .select('*, unidades(placa, proveedores(razon_social))')
      .lte('fecha_vencimiento', en7dias.toISOString().split('T')[0])
      .gte('fecha_vencimiento', hoy.toISOString().split('T')[0])

    // Documentos vencidos
    const { data: docsVencidos } = await supabase
      .from('documentos')
      .select('*, proveedores(razon_social)')
      .lt('fecha_vencimiento', hoy.toISOString().split('T')[0])
      .eq('estado', 'aprobado')

    const vencimientos: any[] = [
      ...(docsVencidos || []).map(d => ({
        proveedor: d.proveedores?.razon_social,
        documento: d.nombre,
        vencimiento: d.fecha_vencimiento,
        tipo: 'vencido'
      })),
      ...(docsVenciendo || []).map(d => ({
        proveedor: d.proveedores?.razon_social,
        documento: d.nombre,
        vencimiento: d.fecha_vencimiento,
        tipo: 'proximo'
      })),
      ...(docsVenciendoCond || []).map(d => ({
        proveedor: d.conductores?.proveedores?.razon_social,
        documento: `${d.nombre} — ${d.conductores?.nombre_completo}`,
        vencimiento: d.fecha_vencimiento,
        tipo: 'proximo'
      })),
      ...(docsVenciendoUnit || []).map(d => ({
        proveedor: d.unidades?.proveedores?.razon_social,
        documento: `${d.nombre} — ${d.unidades?.placa}`,
        vencimiento: d.fecha_vencimiento,
        tipo: 'proximo'
      })),
    ].sort((a, b) => new Date(a.vencimiento).getTime() - new Date(b.vencimiento).getTime())

    setVencimientosProximos(vencimientos.slice(0, 8))

    // Proveedores en riesgo (docs vencidos)
    const provsEnRiesgo = [...new Set(docsVencidos?.map(d => d.proveedores?.razon_social))]
    setProveedoresRiesgo(provsEnRiesgo.slice(0, 5) as any[])

    setStats({ total, homologados, pendientes, rechazados, enRiesgo: provsEnRiesgo.length })

    // Actividad reciente — notificaciones
    const { data: notifs } = await supabase
      .from('notificaciones')
      .select('*, proveedores(razon_social)')
      .order('created_at', { ascending: false })
      .limit(8)
    setActividadReciente(notifs || [])

    // Completitud de proveedores pendientes
    const provsPendientes = provs?.filter(p => p.estado === 'pendiente') || []
    const completitudData = await Promise.all(provsPendientes.slice(0, 5).map(async (prov) => {
      const { data: docs } = await supabase
        .from('documentos').select('estado').eq('proveedor_id', prov.id)
      const total = docs?.length || 0
      const aprobados = docs?.filter(d => d.estado === 'aprobado').length || 0
      return {
        nombre: prov.razon_social,
        id: prov.id,
        total,
        aprobados,
        pct: total > 0 ? Math.round((aprobados / total) * 100) : 0,
        diasEspera: Math.floor((new Date().getTime() - new Date(prov.created_at).getTime()) / (1000 * 60 * 60 * 24))
      }
    }))
    setCompletitud(completitudData)

    setLoading(false)
  }

  const formatFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
  }

  const diasParaVencer = (fecha: string) => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const vence = new Date(fecha)
    return Math.ceil((vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <p style={{ color: '#888', fontSize: '14px' }}>Cargando dashboard...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Dashboard del evaluador</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <a href="/evaluador" style={{ fontSize: '12px', color: '#C41230', fontWeight: 600, textDecoration: 'none', background: '#FEF2F2', padding: '6px 14px', borderRadius: '7px', border: '1px solid #FECACA' }}>
            Revisar proveedores
          </a>
          <a href="/evaluador/reportes" style={{ fontSize: '12px', color: '#666', fontWeight: 600, textDecoration: 'none', background: '#F5F5F5', padding: '6px 14px', borderRadius: '7px', border: '1px solid #E8E8E8' }}>
            Reportes
          </a>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            Buenos días, evaluador
          </h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total proveedores', valor: stats.total, bg: '#F7F7F7', color: '#1a1a1a', border: '#EEEEEE' },
            { label: 'Homologados', valor: stats.homologados, bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
            { label: 'Pendientes', valor: stats.pendientes, bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
            { label: 'Rechazados', valor: stats.rechazados, bg: '#FEF2F2', color: '#C41230', border: '#FECACA' },
            { label: 'En riesgo', valor: stats.enRiesgo, bg: '#FEF2F2', color: '#C41230', border: '#FECACA' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${kpi.border}` }}>
              <p style={{ fontSize: '11px', color: '#888', margin: '0 0 8px' }}>{kpi.label}</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: kpi.color, margin: 0, lineHeight: 1 }}>{kpi.valor}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

          {/* Vencimientos proximos */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>Vencimientos proximos</span>
              <span style={{ fontSize: '11px', color: '#888' }}>proximos 7 dias</span>
            </div>
            {vencimientosProximos.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>Sin vencimientos proximos</p>
              </div>
            ) : (
              vencimientosProximos.map((v, i) => {
                const dias = diasParaVencer(v.vencimiento)
                const esVencido = v.tipo === 'vencido'
                return (
                  <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid #F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.proveedor}</p>
                      <p style={{ fontSize: '11px', color: '#888', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.documento}</p>
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', flexShrink: 0,
                      background: esVencido ? '#FEF2F2' : dias <= 3 ? '#FEF2F2' : '#FFF7ED',
                      color: esVencido ? '#C41230' : dias <= 3 ? '#C41230' : '#C2410C'
                    }}>
                      {esVencido ? 'Vencido' : `${dias}d`}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Completitud proveedores pendientes */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>Proveedores en revision</span>
              <a href="/evaluador" style={{ fontSize: '11px', color: '#C41230', textDecoration: 'none', fontWeight: 600 }}>Ver todos →</a>
            </div>
            {completitud.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>No hay proveedores pendientes</p>
              </div>
            ) : (
              completitud.map((prov, i) => (
                <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{prov.nombre}</p>
                      <p style={{ fontSize: '10px', color: '#888', margin: 0 }}>{prov.diasEspera} dias en revision · {prov.aprobados}/{prov.total} docs aprobados</p>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: prov.pct === 100 ? '#15803D' : prov.pct >= 50 ? '#C2410C' : '#C41230' }}>
                      {prov.pct}%
                    </span>
                  </div>
                  <div style={{ height: '5px', background: '#F0F0F0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '3px', width: `${prov.pct}%`, background: prov.pct === 100 ? '#15803D' : prov.pct >= 50 ? '#EF9F27' : '#C41230', transition: 'width 0.5s' }} />
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* Actividad reciente */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>Actividad reciente</span>
          </div>
          {actividadReciente.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>Sin actividad reciente</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
              {actividadReciente.map((notif, i) => {
                const esAprobado = notif.tipo === 'info'
                const esRechazado = notif.tipo === 'peligro'
                return (
                  <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid #F5F5F5', borderRight: i % 2 === 0 ? '1px solid #F5F5F5' : 'none', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', background: esAprobado ? '#F0FDF4' : esRechazado ? '#FEF2F2' : '#FFF7ED' }}>
                      {esAprobado ? '✓' : esRechazado ? '✗' : '⚠'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{notif.titulo}</p>
                      <p style={{ fontSize: '11px', color: '#888', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.mensaje}</p>
                      <p style={{ fontSize: '10px', color: '#AAA', margin: '2px 0 0' }}>
                        {notif.proveedores?.razon_social} · {formatFecha(notif.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}