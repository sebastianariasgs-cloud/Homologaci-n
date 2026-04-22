'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Notificaciones from '../components/Notificaciones'

export default function DashboardPage() {
  const router = useRouter()
  const [proveedor, setProveedor] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data } = await supabase
      .from('proveedores').select('*').eq('user_id', session.user.id).single()
    setProveedor(data)

    const { data: docs } = await supabase
      .from('documentos').select('*').eq('proveedor_id', data?.id)
    setDocumentos(docs || [])

    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
    </div>
  )

  const pasos = ['Registro', 'Documentos', 'En revisión', 'Aprobación', 'Homologado']
  const pasoActual = proveedor?.estado === 'homologado' ? 4 :
    proveedor?.estado === 'aprobado' ? 3 :
    proveedor?.estado === 'en_revision' ? 2 :
    documentos.length > 0 ? 1 : 0

  const estadoColor: { [key: string]: { bg: string, text: string } } = {
    pendiente: { bg: '#FFF7ED', text: '#C2410C' },
    en_revision: { bg: '#EFF6FF', text: '#1D4ED8' },
    aprobado: { bg: '#F0FDF4', text: '#15803D' },
    homologado: { bg: '#F0FDF4', text: '#15803D' },
    rechazado: { bg: '#FEF2F2', text: '#C41230' },
  }

  const estadoActual = estadoColor[proveedor?.estado] || estadoColor.pendiente

  const perfilCompleto = !!(proveedor?.tipo_servicio?.length > 0 || proveedor?.tipo_id)
  const docsSubidos = documentos.length > 0

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* Navbar */}
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <span style={{ fontSize: '13px', color: '#888' }}>Portal del proveedor</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Notificaciones proveedorId={proveedor?.id} />
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{proveedor?.razon_social}</p>
            <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>RUC {proveedor?.ruc}</p>
          </div>
          <button onClick={handleLogout}
            style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px' }}>
            Salir
          </button>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            Mi homologación
          </h1>
          <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
            Sigue el progreso de tu proceso de homologación
          </p>
        </div>

        {/* Estado actual */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #EEEEEE', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>
              Estado del proceso
            </h2>
            <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px', background: estadoActual.bg, color: estadoActual.text }}>
              {proveedor?.estado === 'pendiente' ? 'Pendiente de revisión' :
               proveedor?.estado === 'homologado' ? 'Homologado' :
               proveedor?.estado === 'rechazado' ? 'Rechazado' :
               proveedor?.estado === 'aprobado' ? 'Aprobado' : 'En proceso'}
            </span>
          </div>

          {/* Barra de pasos */}
          <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
            {pasos.map((paso, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                {i < pasos.length - 1 && (
                  <div style={{ position: 'absolute', top: '14px', left: '50%', width: '100%', height: '2px', background: i < pasoActual ? '#C41230' : '#E5E5E5', zIndex: 0 }} />
                )}
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 600, zIndex: 1, position: 'relative',
                  background: i < pasoActual ? '#C41230' : 'white',
                  color: i < pasoActual ? 'white' : i === pasoActual ? '#C41230' : '#CCC',
                  border: i === pasoActual ? '2px solid #C41230' : i < pasoActual ? 'none' : '2px solid #E5E5E5',
                }}>
                  {i < pasoActual ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: '11px', marginTop: '8px', textAlign: 'center', color: i <= pasoActual ? '#1a1a1a' : '#AAA', fontWeight: i === pasoActual ? 600 : 400 }}>
                  {paso}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cards — orden: Mi perfil, Mis documentos, Mi score */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
          {[
            {
              titulo: 'Mi perfil',
              desc: 'Completa y actualiza los datos de tu empresa, tipo de servicios y alcance de operación.',
              link: '/dashboard/perfil',
              linkText: 'Ver perfil →',
              icon: '🏢',
            },
            {
              titulo: 'Mis documentos',
              desc: 'Carga y gestiona los documentos requeridos para completar tu homologación.',
              link: '/dashboard/documentos',
              linkText: 'Ir a documentos →',
              icon: '📄',
            },
            {
              titulo: 'Mi score',
              desc: 'Revisa tu puntaje de desempeño y estado de homologación.',
              link: null,
              linkText: 'Disponible tras la revisión',
              icon: '📊',
            },
          ].map((card) => (
            <div key={card.titulo} style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #EEEEEE', display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>
                {card.icon}
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', marginBottom: '6px' }}>
                {card.titulo}
              </h3>
              <p style={{ fontSize: '12px', color: '#888', lineHeight: 1.6, flex: 1, marginBottom: '12px' }}>
                {card.desc}
              </p>
              {card.link ? (
                <a href={card.link} style={{ fontSize: '12px', color: '#C41230', fontWeight: 600, textDecoration: 'none' }}>
                  {card.linkText}
                </a>
              ) : (
                <span style={{ fontSize: '12px', color: '#CCC' }}>{card.linkText}</span>
              )}
            </div>
          ))}
        </div>

        {/* Próximos pasos — sin tachado, solo checks */}
        <div style={{ background: '#FEF2F2', borderRadius: '12px', padding: '20px', border: '1px solid #FECACA' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#C41230', marginBottom: '14px' }}>
            Próximos pasos
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { num: 1, texto: 'Completa los datos de tu empresa en Mi perfil', done: perfilCompleto },
              { num: 2, texto: 'Carga todos los documentos requeridos', done: docsSubidos },
              { num: 3, texto: 'Espera la revisión y aprobación del evaluador', done: proveedor?.estado === 'homologado' || proveedor?.estado === 'aprobado' },
            ].map((paso) => (
              <div key={paso.num} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 600,
                  background: paso.done ? '#C41230' : 'white',
                  color: paso.done ? 'white' : '#C41230',
                  border: paso.done ? 'none' : '2px solid #C41230',
                }}>
                  {paso.done ? '✓' : paso.num}
                </div>
                <span style={{ fontSize: '13px', color: '#1a1a1a' }}>
                  {paso.texto}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}