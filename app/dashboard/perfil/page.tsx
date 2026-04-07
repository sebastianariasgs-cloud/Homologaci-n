'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Notificaciones from '../../components/Notificaciones'

export default function PerfilPage() {
  const router = useRouter()
  const [proveedor, setProveedor] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [tipoId, setTipoId] = useState('')
  const [tiposProveedor, setTiposProveedor] = useState<any[]>([])
  const [almacenes, setAlmacenes] = useState<string[]>([''])

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prov } = await supabase
      .from('proveedores').select('*').eq('user_id', user.id).single()
    if (!prov) { router.push('/login'); return }
    setProveedor(prov)
    setTipoId(prov.tipo_id || '')

    const { data: tipos } = await supabase.from('tipos_proveedor').select('*').eq('activo', true)   
     setTiposProveedor(tipos || [])

    const { data: alms } = await supabase
      .from('almacenes_proveedor').select('nombre').eq('proveedor_id', prov.id)
    setAlmacenes(alms && alms.length > 0 ? alms.map((a: any) => a.nombre) : [''])

    setLoading(false)
  }

  const agregarAlmacen = () => setAlmacenes(prev => [...prev, ''])

  const actualizarAlmacen = (index: number, valor: string) => {
    setAlmacenes(prev => prev.map((a, i) => i === index ? valor : a))
  }

  const eliminarAlmacen = (index: number) => {
    if (almacenes.length === 1) {
      setAlmacenes([''])
      return
    }
    setAlmacenes(prev => prev.filter((_, i) => i !== index))
  }

  const guardarPerfil = async () => {
    if (!proveedor) return
    setGuardando(true)

    await supabase.from('proveedores').update({
      tipo_id: tipoId || null,
    }).eq('id', proveedor.id)

    await supabase.from('almacenes_proveedor').delete().eq('proveedor_id', proveedor.id)

    const almacenesValidos = almacenes.filter(a => a.trim() !== '')
    if (almacenesValidos.length > 0) {
      await supabase.from('almacenes_proveedor').insert(
        almacenesValidos.map(nombre => ({ proveedor_id: proveedor.id, nombre }))
      )
    }

    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 3000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7' }}>
      <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <a href="/dashboard" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>Dashboard</a>
          <span style={{ color: '#DDD' }}>›</span>
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Mi perfil</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Notificaciones proveedorId={proveedor?.id} />
          <span style={{ fontSize: '13px', color: '#888' }}>{proveedor?.razon_social}</span>
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Datos de la empresa */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏢</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Datos de la empresa</h2>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Información registrada en la plataforma</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#666', marginBottom: '6px' }}>Razón social</label>
              <div style={{ padding: '10px 14px', background: '#F9F9F9', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px', color: '#1a1a1a' }}>
                {proveedor?.razon_social}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#666', marginBottom: '6px' }}>RUC</label>
              <div style={{ padding: '10px 14px', background: '#F9F9F9', borderRadius: '8px', border: '1px solid #EEEEEE', fontSize: '13px', color: '#1a1a1a' }}>
                {proveedor?.ruc}
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#666', marginBottom: '6px' }}>
              Tipo de proveedor <span style={{ color: '#C41230' }}>*</span>
            </label>
            <select value={tipoId} onChange={(e) => setTipoId(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', border: '1.5px solid #E8E8E8',
                borderRadius: '8px', fontSize: '13px', color: '#1a1a1a',
                background: 'white', outline: 'none', cursor: 'pointer'
              }}>
              <option value="">Selecciona un tipo...</option>
              {tiposProveedor.map(tipo => (
                <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Almacenes */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏭</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Almacenes con acceso</h2>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Indica los almacenes a los que tu empresa tiene acceso</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {almacenes.map((almacen, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={almacen}
                  onChange={(e) => actualizarAlmacen(index, e.target.value)}
                  placeholder={`Almacén ${index + 1} (ej: Almacén Callao - Terminal Portuario)`}
                  style={{
                    flex: 1, padding: '9px 14px', border: '1.5px solid #E8E8E8',
                    borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#1a1a1a'
                  }}
                />
                <button onClick={() => eliminarAlmacen(index)}
                  style={{
                    width: '34px', height: '34px', background: '#FEF2F2', color: '#C41230',
                    border: '1px solid #FECACA', borderRadius: '8px', cursor: 'pointer',
                    fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                  ×
                </button>
              </div>
            ))}
          </div>

          <button onClick={agregarAlmacen}
            style={{
              padding: '8px 16px', background: 'white', color: '#C41230',
              border: '1.5px solid #FECACA', borderRadius: '8px',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}>
            + Agregar almacén
          </button>
        </div>

        {/* Botón guardar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          {guardado && (
            <span style={{ fontSize: '13px', color: '#15803D', fontWeight: 500 }}>
              ✓ Perfil guardado correctamente
            </span>
          )}
          <button onClick={guardarPerfil} disabled={guardando}
            style={{
              padding: '11px 28px', background: '#C41230', color: 'white',
              border: 'none', borderRadius: '8px', fontSize: '13px',
              fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer',
              opacity: guardando ? 0.8 : 1
            }}>
            {guardando ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </div>

      </div>
    </div>
  )
}