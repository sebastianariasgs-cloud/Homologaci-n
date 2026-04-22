'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Notificaciones from '../../components/Notificaciones'

const TIPOS_SERVICIO = [
  'Carga general',
  'Carga IMO / Materiales peligrosos',
  'Carga refrigerada',
  'Carga sobredimensionada',
  'Carga a granel',
  'Carga de valor',
]

const ALCANCES = [
  'Local',
  'Nacional',
  'Internacional',
]

export default function PerfilPage() {
  const router = useRouter()
  const [proveedor, setProveedor] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [tiposProveedor, setTiposProveedor] = useState<any[]>([])
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>([])
  const [tiposServicio, setTiposServicio] = useState<string[]>([])
  const [alcances, setAlcances] = useState<string[]>([])
  const [almacenes, setAlmacenes] = useState<string[]>([''])
  const [debugInfo, setDebugInfo] = useState<string>('')

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      setDebugInfo(`USER: ${JSON.stringify(user?.id)} | ERROR: ${JSON.stringify(userError)}`)

      if (!user) {
        setDebugInfo(prev => prev + ' | SIN USUARIO → redirigiendo')
        router.push('/login')
        return
      }

      const { data: prov, error: provError } = await supabase
        .from('proveedores').select('*').eq('user_id', user.id).single()
      setDebugInfo(prev => prev + ` | PROV: ${JSON.stringify(prov?.id)} | PROV_ERR: ${JSON.stringify(provError)}`)

      if (!prov) {
        setDebugInfo(prev => prev + ' | SIN PROVEEDOR → redirigiendo')
        setLoading(false)
        return
      }

      setProveedor(prov)
      setTiposServicio(prov.tipo_servicio || [])
      setAlcances(prov.alcance || [])

      const { data: tipos } = await supabase
        .from('tipos_proveedor').select('*').eq('activo', true).order('nombre')
      setTiposProveedor(tipos || [])

      const { data: tiposActuales } = await supabase
        .from('proveedor_tipos').select('tipo_id').eq('proveedor_id', prov.id)
      setTiposSeleccionados(tiposActuales?.map((t: any) => t.tipo_id) || [])

      const { data: alms } = await supabase
        .from('almacenes_proveedor').select('nombre').eq('proveedor_id', prov.id)
      setAlmacenes(alms && alms.length > 0 ? alms.map((a: any) => a.nombre) : [''])

      setLoading(false)
    } catch (e) {
      setDebugInfo(prev => prev + ` | EXCEPCION: ${JSON.stringify(e)}`)
      setLoading(false)
    }
  }

  const toggleTipo = (tipoId: string) => {
    setTiposSeleccionados(prev =>
      prev.includes(tipoId) ? prev.filter(t => t !== tipoId) : [...prev, tipoId]
    )
  }

  const toggleTipoServicio = (tipo: string) => {
    setTiposServicio(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    )
  }

  const toggleAlcance = (alcance: string) => {
    setAlcances(prev =>
      prev.includes(alcance) ? prev.filter(a => a !== alcance) : [...prev, alcance]
    )
  }

  const agregarAlmacen = () => setAlmacenes(prev => [...prev, ''])

  const actualizarAlmacen = (index: number, valor: string) => {
    setAlmacenes(prev => prev.map((a, i) => i === index ? valor : a))
  }

  const eliminarAlmacen = (index: number) => {
    if (almacenes.length === 1) { setAlmacenes(['']); return }
    setAlmacenes(prev => prev.filter((_, i) => i !== index))
  }

  const guardarPerfil = async () => {
    if (!proveedor) return
    setGuardando(true)

    await supabase.from('proveedor_tipos').delete().eq('proveedor_id', proveedor.id)
    if (tiposSeleccionados.length > 0) {
      await supabase.from('proveedor_tipos').insert(
        tiposSeleccionados.map(tipo_id => ({ proveedor_id: proveedor.id, tipo_id }))
      )
    }

    await supabase.from('proveedores').update({
      tipo_id: tiposSeleccionados[0] || null,
      tipo_servicio: tiposServicio,
      alcance: alcances,
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

  const CheckBox = ({ label, seleccionado, onClick }: { label: string, seleccionado: boolean, onClick: () => void }) => (
    <div onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
        border: seleccionado ? '1.5px solid #C41230' : '1.5px solid #E8E8E8',
        background: seleccionado ? '#FEF2F2' : 'white',
      }}>
      <div style={{
        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
        background: seleccionado ? '#C41230' : 'white',
        border: seleccionado ? '1.5px solid #C41230' : '1.5px solid #CCC',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {seleccionado && <span style={{ color: 'white', fontSize: '10px', fontWeight: 700 }}>✓</span>}
      </div>
      <span style={{ fontSize: '12px', color: seleccionado ? '#C41230' : '#444', fontWeight: seleccionado ? 600 : 400 }}>
        {label}
      </span>
    </div>
  )

  // Pantalla de debug — muestra qué está pasando antes de redirigir
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7', gap: '16px' }}>
      <p style={{ color: '#888', fontSize: '14px' }}>Cargando...</p>
      {debugInfo && (
        <div style={{ maxWidth: '600px', padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid #E5E5E5', fontSize: '11px', color: '#444', wordBreak: 'break-all' }}>
          <strong>Debug:</strong> {debugInfo}
        </div>
      )}
    </div>
  )

  // Si no hay proveedor pero tampoco redirigió, mostrar debug
  if (!proveedor) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F7F7F7', gap: '16px' }}>
      <p style={{ color: '#C41230', fontSize: '14px', fontWeight: 600 }}>No se encontró el proveedor</p>
      <div style={{ maxWidth: '600px', padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid #E5E5E5', fontSize: '11px', color: '#444', wordBreak: 'break-all' }}>
        <strong>Debug:</strong> {debugInfo}
      </div>
      <a href="/dashboard" style={{ fontSize: '13px', color: '#C41230' }}>← Volver al inicio</a>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F7', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #EEEEEE', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/LogoOmni.png" alt="Omni Logistics" style={{ height: '32px' }} />
          <div style={{ width: '1px', height: '20px', background: '#E5E5E5' }} />
          <a href="/dashboard" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>Inicio</a>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
        </div>

        {/* Tipo de proveedor */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>📋</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Tipo de proveedor</h2>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Puedes seleccionar más de un tipo si aplica</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {tiposProveedor.map(tipo => (
              <CheckBox key={tipo.id} label={tipo.nombre}
                seleccionado={tiposSeleccionados.includes(tipo.id)}
                onClick={() => toggleTipo(tipo.id)} />
            ))}
          </div>
          {tiposSeleccionados.length > 0 && (
            <div style={{ marginTop: '12px', padding: '8px 12px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
              <p style={{ fontSize: '11px', color: '#C41230', margin: 0 }}>
                ✓ {tiposSeleccionados.length} tipo{tiposSeleccionados.length > 1 ? 's' : ''} seleccionado{tiposSeleccionados.length > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* Tipo de servicio */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🚛</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Tipo de servicio</h2>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Indica qué tipo de carga transporta tu empresa</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {TIPOS_SERVICIO.map(tipo => (
              <CheckBox key={tipo} label={tipo}
                seleccionado={tiposServicio.includes(tipo)}
                onClick={() => toggleTipoServicio(tipo)} />
            ))}
          </div>
          {tiposServicio.length > 0 && (
            <div style={{ marginTop: '12px', padding: '8px 12px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
              <p style={{ fontSize: '11px', color: '#C41230', margin: 0 }}>
                ✓ {tiposServicio.length} tipo{tiposServicio.length > 1 ? 's' : ''} seleccionado{tiposServicio.length > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* Alcance de operación */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🗺️</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Alcance de operación</h2>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Indica en qué ámbito opera tu empresa</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {ALCANCES.map(alcance => (
              <CheckBox key={alcance} label={alcance}
                seleccionado={alcances.includes(alcance)}
                onClick={() => toggleAlcance(alcance)} />
            ))}
          </div>
          {alcances.length > 0 && (
            <div style={{ marginTop: '12px', padding: '8px 12px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
              <p style={{ fontSize: '11px', color: '#C41230', margin: 0 }}>
                ✓ {alcances.join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Almacenes */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏭</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Almacenes con acceso</h2>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Indica los almacenes a los que tiene acceso tu empresa</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {almacenes.map((almacen, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="text" value={almacen}
                  onChange={(e) => actualizarAlmacen(index, e.target.value)}
                  placeholder={`Almacén ${index + 1}`}
                  style={{ flex: 1, padding: '9px 14px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '13px', outline: 'none', color: '#1a1a1a' }} />
                <button onClick={() => eliminarAlmacen(index)}
                  style={{ width: '34px', height: '34px', background: '#FEF2F2', color: '#C41230', border: '1px solid #FECACA', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <button onClick={agregarAlmacen}
            style={{ padding: '8px 16px', background: 'white', color: '#C41230', border: '1.5px solid #FECACA', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
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
            style={{ padding: '11px 28px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.8 : 1 }}>
            {guardando ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </div>
      </div>
    </div>
  )
}