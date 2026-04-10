'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import BotonAdmin from '../components/BotonAdmin'


export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [tarifasImportacion, setTarifasImportacion] = useState<any[]>([])
  const [tarifasExportacion, setTarifasExportacion] = useState<any[]>([])
  const [pestana, setPestana] = useState<'importacion' | 'exportacion'>('importacion')
  const [filtro, setFiltro] = useState('')
  const [resultado, setResultado] = useState<any>(null)

  useEffect(() => { verificarRol() }, [])

  const verificarRol = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    if (!['pricing', 'admin'].includes(perfil?.rol)) { router.push('/login'); return }
    await cargarDatos()
  }

  const cargarDatos = async () => {
    const { data: imp } = await supabase
      .from('tarifario_importacion')
      .select('*')
      .eq('activo', true)
      .order('pais')
    setTarifasImportacion(imp || [])

    const { data: exp } = await supabase
      .from('tarifario_exportacion')
      .select('*')
      .eq('activo', true)
      .order('pais')
    setTarifasExportacion(exp || [])

    setLoading(false)
  }

  const evaluarFormula = (valor: any): number => {
    if (valor === null || valor === undefined) return 0
    if (typeof valor === 'number') return valor
    if (valor instanceof Date) return 0
    const str = String(valor).replace('=', '').trim()
    if (!str) return 0
    try {
      return Function('"use strict"; return (' + str + ')')()
    } catch {
      return parseFloat(str) || 0
    }
  }

  const parsearFecha = (valor: any): string | null => {
    if (!valor) return null
    if (valor instanceof Date) {
      if (isNaN(valor.getTime())) return null
      return valor.toISOString().split('T')[0]
    }
    if (typeof valor === 'string') {
      if (valor === 'SPOT' || valor === '') return null
      try {
        const d = new Date(valor)
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
      } catch { return null }
    }
    if (typeof valor === 'number') {
      const d = new Date((valor - 25569) * 86400 * 1000)
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    }
    return null
  }

  const procesarExcel = async (archivo: File) => {
    setProcesando(true)
    setResultado(null)

    try {
      const XLSX = await import('xlsx')
      const buffer = await archivo.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false, cellText: false })

      let totalImportacion = 0
      let totalExportacion = 0

      // Desactivar tarifas anteriores
      await supabase.from('tarifario_importacion').update({ activo: false }).eq('activo', true)
      await supabase.from('tarifario_exportacion').update({ activo: false }).eq('activo', true)

      // Procesar hoja IMPORTACION
      if (wb.SheetNames.includes('IMPORTACION')) {
        const ws = wb.Sheets['IMPORTACION']
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })

        let headerRow = -1
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] && String(rows[i][0]).trim() === 'PAIS') { headerRow = i; break }
        }

        if (headerRow >= 0) {
          const dataRows = rows.slice(headerRow + 1).filter(r => r[0] && r[2] && r[3])
          const inserts = dataRows.map(r => ({
            pais: String(r[0] || '').trim(),
            agente: r[1] ? String(r[1]).trim() : null,
            carrier: String(r[2] || '').trim(),
            pol: String(r[3] || '').trim(),
            pod: String(r[4] || '').trim(),
            tarifa_20gp: evaluarFormula(r[5]),
            tarifa_40hq: evaluarFormula(r[6]),
            tarifa_40nor: evaluarFormula(r[7]),
            thc: evaluarFormula(r[8]),
            bl: evaluarFormula(r[9]),
            total_20gp: evaluarFormula(r[10]),
            total_40hq: evaluarFormula(r[11]),
            total_40nor: evaluarFormula(r[12]),
            transit_time: r[13] ? String(r[13]).trim() : null,
            free_days: r[14] ? String(r[14]).trim() : null,
            validez: parsearFecha(r[15]),
            activo: true,
          }))

          if (inserts.length > 0) {
            const { error } = await supabase.from('tarifario_importacion').insert(inserts)
            if (error) console.error('Error importacion:', error)
            else totalImportacion = inserts.length
          }
        }
      }

      // Procesar hoja EXPORTACION
      if (wb.SheetNames.includes('EXPORTACION')) {
        const ws = wb.Sheets['EXPORTACION']
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' })

        let headerRow = -1
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] && String(rows[i][0]).trim() === 'CARRIER') { headerRow = i; break }
        }

        if (headerRow >= 0) {
          const dataRows = rows.slice(headerRow + 1).filter(r => r[0] && r[3])
          const inserts = dataRows.map(r => ({
            carrier: String(r[0] || '').trim(),
            continente: r[1] ? String(r[1]).trim() : null,
            pais: String(r[2] || '').trim(),
            pol: String(r[3] || '').trim(),
            pod: String(r[4] || '').trim(),
            tarifa_20gp: evaluarFormula(r[5]),
            tarifa_40hq: evaluarFormula(r[6]),
            thc: evaluarFormula(r[7]),
            bl: evaluarFormula(r[8]),
            total: evaluarFormula(r[9]),
            transit_time: r[10] ? String(r[10]).trim() : null,
            free_days_origen: r[11] ? parseInt(String(r[11])) || null : null,
            free_days_destino: r[12] ? parseInt(String(r[12])) || null : null,
            validez: parsearFecha(r[13]),
            activo: true,
          }))

          if (inserts.length > 0) {
            const { error } = await supabase.from('tarifario_exportacion').insert(inserts)
            if (error) console.error('Error exportacion:', error)
            else totalExportacion = inserts.length
          }
        }
      }

      setResultado({ totalImportacion, totalExportacion, archivo: archivo.name })
      await cargarDatos()

    } catch (err: any) {
      alert('Error al procesar el archivo: ' + err.message)
    }

    setProcesando(false)
  }

  const tarifasFiltradas = (pestana === 'importacion' ? tarifasImportacion : tarifasExportacion)
    .filter(t => filtro === '' ||
      t.pais?.toLowerCase().includes(filtro.toLowerCase()) ||
      t.carrier?.toLowerCase().includes(filtro.toLowerCase()) ||
      t.pol?.toLowerCase().includes(filtro.toLowerCase()) ||
      t.pod?.toLowerCase().includes(filtro.toLowerCase())
    )

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
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Modulo de pricing</span>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
          <BotonAdmin />
          Salir
        </button>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Tarifas activas', valor: tarifasImportacion.length + tarifasExportacion.length, bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
            { label: 'Rutas importacion', valor: tarifasImportacion.length, bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
            { label: 'Rutas exportacion', valor: tarifasExportacion.length, bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
            { label: 'Paises cubiertos', valor: new Set([...tarifasImportacion.map(t => t.pais), ...tarifasExportacion.map(t => t.pais)]).size, bg: '#F7F7F7', color: '#1a1a1a', border: '#EEEEEE' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '12px', padding: '16px', border: `1px solid ${kpi.border}` }}>
              <p style={{ fontSize: '11px', color: '#888', margin: '0 0 8px' }}>{kpi.label}</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: kpi.color, margin: 0, lineHeight: 1 }}>{kpi.valor}</p>
            </div>
          ))}
        </div>

        {/* Subir tarifario */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '20px 24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', background: '#FEF2F2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>📊</div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Subir nuevo tarifario</h2>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Al subir un nuevo archivo el tarifario anterior quedara inactivo automaticamente</p>
            </div>
          </div>

          {resultado && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 16px', marginBottom: '14px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#15803D', margin: '0 0 4px' }}>Tarifario importado correctamente</p>
              <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>
                {resultado.archivo} — {resultado.totalImportacion} tarifas de importacion · {resultado.totalExportacion} tarifas de exportacion
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'start' }}>
            <label style={{ display: 'block', border: '2px dashed #FECACA', borderRadius: '10px', padding: '20px', textAlign: 'center', background: '#FEF9F9', cursor: procesando ? 'not-allowed' : 'pointer' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#C41230', margin: '0 0 4px' }}>
                {procesando ? 'Procesando...' : '↑ Seleccionar archivo Excel'}
              </p>
              <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>Arrastra o haz clic · Solo archivos .xlsx</p>
              <input type="file" accept=".xlsx" style={{ display: 'none' }}
                disabled={procesando}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) procesarExcel(f) }} />
            </label>
            <div style={{ background: '#F9F9F9', borderRadius: '8px', padding: '12px', minWidth: '220px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 8px' }}>Requisitos del archivo</p>
              {[
                'Hojas: IMPORTACION y EXPORTACION',
                'Mantener el orden de columnas',
                'Las formulas se calculan automaticamente',
                'Fechas en formato DD/MM/AAAA',
              ].map(req => (
                <div key={req} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', marginBottom: '5px' }}>
                  <span style={{ width: '14px', height: '14px', background: '#F0FDF4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#15803D', flexShrink: 0, marginTop: '1px' }}>✓</span>
                  <span style={{ fontSize: '10px', color: '#666' }}>{req}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabla tarifas */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['importacion', 'exportacion'] as const).map(tab => (
                <button key={tab} onClick={() => setPestana(tab)}
                  style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: pestana === tab ? '#C41230' : '#F5F5F5', color: pestana === tab ? 'white' : '#666' }}>
                  {tab === 'importacion' ? `Importacion (${tarifasImportacion.length})` : `Exportacion (${tarifasExportacion.length})`}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Buscar por pais, carrier, puerto..."
              value={filtro} onChange={(e) => setFiltro(e.target.value)}
              style={{ padding: '7px 12px', border: '1.5px solid #E8E8E8', borderRadius: '7px', fontSize: '12px', outline: 'none', minWidth: '220px' }} />
          </div>

          <div style={{ overflowX: 'auto' }}>
            {tarifasFiltradas.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
                  {tarifasImportacion.length === 0 && tarifasExportacion.length === 0
                    ? 'No hay tarifas cargadas. Sube el primer tarifario.'
                    : 'No hay resultados para ese filtro.'}
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9F9F9', borderBottom: '1px solid #EEEEEE' }}>
                    {pestana === 'importacion'
                      ? ['Pais', 'Carrier', 'Agente', 'POL', 'POD', "20'GP", "40'HQ", "40'NOR", 'THC', 'BL', 'Total 20', 'Total 40', 'Total NOR', 'Transit', 'Free days', 'Validez'].map(col => (
                        <th key={col} style={{ padding: '9px 10px', fontSize: '10px', fontWeight: 600, color: '#666', textAlign: 'left', whiteSpace: 'nowrap' }}>{col}</th>
                      ))
                      : ['Carrier', 'Continente', 'Pais', 'POL', 'POD', "20'GP", "40'HQ", 'THC', 'BL', 'Total', 'Transit', 'Free Orig', 'Free Dest', 'Validez'].map(col => (
                        <th key={col} style={{ padding: '9px 10px', fontSize: '10px', fontWeight: 600, color: '#666', textAlign: 'left', whiteSpace: 'nowrap' }}>{col}</th>
                      ))
                    }
                  </tr>
                </thead>
                <tbody>
                  {tarifasFiltradas.map((t, i) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #F5F5F5', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                      {pestana === 'importacion' ? (
                        <>
                          <td style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap' }}>{t.pais}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>{t.carrier}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>{t.agente || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>{t.pol}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>{t.pod}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 600 }}>{t.tarifa_20gp?.toFixed(0)}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 600 }}>{t.tarifa_40hq?.toFixed(0)}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 600 }}>{t.tarifa_40nor?.toFixed(0)}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666' }}>{t.thc || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666' }}>{t.bl || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 600, color: '#C41230' }}>{t.total_20gp?.toFixed(0)}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 600, color: '#C41230' }}>{t.total_40hq?.toFixed(0)}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 600, color: '#C41230' }}>{t.total_40nor?.toFixed(0)}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>{t.transit_time || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>{t.free_days || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '20px', background: t.validez ? '#F0FDF4' : '#F5F5F5', color: t.validez ? '#15803D' : '#888' }}>
                              {t.validez ? new Date(t.validez).toLocaleDateString('es-PE') : 'SPOT'}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap' }}>{t.carrier}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>{t.continente || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>{t.pais}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>{t.pol}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>{t.pod}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 600 }}>{t.tarifa_20gp?.toFixed(0) || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 600 }}>{t.tarifa_40hq?.toFixed(0) || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666' }}>{t.thc || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666' }}>{t.bl || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', fontWeight: 600, color: '#C41230' }}>{t.total?.toFixed(0) || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666', whiteSpace: 'nowrap' }}>{t.transit_time || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666' }}>{t.free_days_origen || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', color: '#666' }}>{t.free_days_destino || '—'}</td>
                          <td style={{ padding: '7px 10px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '20px', background: t.validez ? '#F0FDF4' : '#F5F5F5', color: t.validez ? '#15803D' : '#888' }}>
                              {t.validez ? new Date(t.validez).toLocaleDateString('es-PE') : 'SPOT'}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}