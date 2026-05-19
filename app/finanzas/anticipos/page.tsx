'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BotonHub from '../../components/BotonHub'

const ESTADOS: Record<string, { bg: string; color: string; label: string }> = {
  pendiente_firma: { bg: '#FFF3E0', color: '#E65100', label: 'Pendiente de firma'       },
  firmado:         { bg: '#E3F2FD', color: '#1565C0', label: 'Firmado'                  },
  pagado:          { bg: '#FFF8E1', color: '#F57F17', label: 'Pagado / Pdte. rendición' },
  rendido:         { bg: '#E8F5E9', color: '#2E7D32', label: 'Rendido'                  },
  observado:       { bg: '#FFEBEE', color: '#B71C1C', label: 'Observado'                },
}

function BadgeEstado({ estado }: { estado: string }) {
  const e = ESTADOS[estado] || { bg: '#F0F2F5', color: '#8A9BB0', label: estado }
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, background: e.bg, color: e.color, padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' as const }}>
      {e.label}
    </span>
  )
}

export default function AnticiposPage() {
  const router = useRouter()
  const [perfil,       setPerfil]       = useState<any>(null)
  const [anticipos,    setAnticipos]    = useState<any[]>([])
  const [seleccionado, setSeleccionado] = useState<any>(null)
  const [cargando,     setCargando]     = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda,     setBusqueda]     = useState('')
  const [fechaDesde,   setFechaDesde]   = useState('')
  const [fechaHasta,   setFechaHasta]   = useState('')

  const [nuevoEstado,   setNuevoEstado]   = useState('')
  const [obsFinanzas,   setObsFinanzas]   = useState('')
  const [movBancario,   setMovBancario]   = useState('')
  const [guardando,     setGuardando]     = useState(false)
  const [subiendoComp,  setSubiendoComp]  = useState(false)
  const [subiendoXML,   setSubiendoXML]   = useState(false)
  const [subiendoPDF,   setSubiendoPDF]   = useState(false)
  const compRef = useRef<HTMLInputElement>(null)
  const xmlRef  = useRef<HTMLInputElement>(null)
  const pdfRef  = useRef<HTMLInputElement>(null)

  const [datosXML,   setDatosXML]   = useState<any>(null)
  const [mostrarXML, setMostrarXML] = useState(false)
  const [archivoXML, setArchivoXML] = useState<File | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: p } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (!p || !['operativo_sli', 'admin_operativo', 'supervisor_sli', 'finanzas', 'admin'].includes(p.rol)) {
        router.push('/hub'); return
      }
      setPerfil(p)
      await cargar(p)
    }
    init()
  }, [])

  const cargar = async (p?: any) => {
    const perfActual = p || perfil
    setCargando(true)
    let query = supabase.from('anticipos').select('*').order('created_at', { ascending: false })
    if (['operativo_sli', 'admin_operativo', 'supervisor_sli'].includes(perfActual?.rol)) {
      const { data: { session } } = await supabase.auth.getSession()
      query = query.eq('solicitante_id', session?.user.id)
    }
    const { data, error } = await query
    if (error) { console.error(error); setCargando(false); return }

    const ids = [...new Set((data || []).map((a: any) => a.solicitante_id).filter(Boolean))]
    let perfilesMap: Record<string, any> = {}
    if (ids.length > 0) {
      const { data: perfs } = await supabase.from('perfiles').select('id, nombre, email').in('id', ids)
      ;(perfs || []).forEach((p: any) => { perfilesMap[p.id] = p })
    }
    setAnticipos((data || []).map((a: any) => ({ ...a, solicitante: perfilesMap[a.solicitante_id] || null })))
    setCargando(false)
  }

  const seleccionar = (ant: any) => {
    setSeleccionado(ant)
    setNuevoEstado(ant.estado)
    setObsFinanzas(ant.observacion_finanzas || '')
    setMovBancario(ant.mov_bancario || '')
    setDatosXML(null)
    setMostrarXML(false)
  }

  const esFinanzas  = perfil && ['finanzas', 'admin'].includes(perfil.rol)
  const esOperativo = perfil && ['operativo_sli', 'admin_operativo', 'supervisor_sli', 'admin'].includes(perfil.rol)

  const guardarCambios = async () => {
    if (!seleccionado) return
    setGuardando(true)
    const upd = { estado: nuevoEstado, observacion_finanzas: obsFinanzas || null, mov_bancario: movBancario || null }
    await supabase.from('anticipos').update(upd).eq('id', seleccionado.id)
    const updated = { ...seleccionado, ...upd }
    setSeleccionado(updated)
    setAnticipos(prev => prev.map(a => a.id === seleccionado.id ? updated : a))
    setGuardando(false)
  }

  const subirComprobante = async (file: File) => {
    if (!seleccionado || !file) return
    setSubiendoComp(true)
    const ext  = file.name.split('.').pop()
    const path = `anticipos/${seleccionado.id}/comprobante_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (error) { alert('Error al subir comprobante'); setSubiendoComp(false); return }
    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
    const upd = { comprobante_url: publicUrl, comprobante_nombre: file.name }
    await supabase.from('anticipos').update(upd).eq('id', seleccionado.id)
    const updated = { ...seleccionado, ...upd }
    setSeleccionado(updated)
    setAnticipos(prev => prev.map(a => a.id === seleccionado.id ? updated : a))
    setSubiendoComp(false)
  }

  const subirFacturaPDF = async (file: File) => {
    if (!seleccionado || !file) return
    setSubiendoPDF(true)
    const ext  = file.name.split('.').pop()
    const path = `anticipos/${seleccionado.id}/factura_pdf_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (error) { alert('Error al subir PDF'); setSubiendoPDF(false); return }
    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
    // Si ya hay XML confirmado → solo agregar PDF, estado ya es rendido
    // Si no hay XML → cambiar estado a rendido al subir PDF
    const yaRendido = seleccionado.estado === 'rendido'
    const upd: any = {
      factura_pdf_url:    publicUrl,
      factura_pdf_nombre: file.name,
      fecha_regularizacion: seleccionado.fecha_regularizacion || new Date().toISOString().split('T')[0],
    }
    if (!yaRendido) upd.estado = 'rendido'
    await supabase.from('anticipos').update(upd).eq('id', seleccionado.id)
    const updated = { ...seleccionado, ...upd }
    setSeleccionado(updated)
    setNuevoEstado(updated.estado)
    setAnticipos(prev => prev.map(a => a.id === seleccionado.id ? updated : a))
    setSubiendoPDF(false)
  }

  // ── XML Parser SUNAT ───────────────────────────────────────────────────────
const parsearXMLFactura = (xmlText: string) => {
  try {
    const parser = new DOMParser()
    const doc    = parser.parseFromString(xmlText, 'text/xml')

    if (doc.querySelector('parsererror')) return null

    // Primer cbc:ID del documento = número de factura
    const numero = doc.getElementsByTagName('cbc:ID')[0]?.textContent?.trim() || ''
    const fecha  = doc.getElementsByTagName('cbc:IssueDate')[0]?.textContent?.trim() || ''
    const moneda = doc.getElementsByTagName('cbc:DocumentCurrencyCode')[0]?.textContent?.trim() || ''

    // Montos desde LegalMonetaryTotal
    const lmt      = doc.getElementsByTagName('cac:LegalMonetaryTotal')[0]
    const total    = lmt?.getElementsByTagName('cbc:PayableAmount')[0]?.textContent?.trim() || ''
    const subtotal = lmt?.getElementsByTagName('cbc:LineExtensionAmount')[0]?.textContent?.trim() || ''

    // IGV desde primer TaxTotal
    const taxTotal = doc.getElementsByTagName('cac:TaxTotal')[0]
    const igv      = taxTotal?.getElementsByTagName('cbc:TaxAmount')[0]?.textContent?.trim() || ''

    // Emisor — RUC en PartyIdentification/cbc:ID, nombre en PartyLegalEntity/RegistrationName
    const supplierNode = doc.getElementsByTagName('cac:AccountingSupplierParty')[0]
    let rucEmisor = '', nombreEmisor = ''
    if (supplierNode) {
      rucEmisor    = supplierNode.getElementsByTagName('cac:PartyIdentification')[0]
                       ?.getElementsByTagName('cbc:ID')[0]?.textContent?.trim() || ''
      nombreEmisor = supplierNode.getElementsByTagName('cac:PartyLegalEntity')[0]
                       ?.getElementsByTagName('cbc:RegistrationName')[0]?.textContent?.trim() || ''
    }

    // Receptor — misma estructura
    const customerNode = doc.getElementsByTagName('cac:AccountingCustomerParty')[0]
    let rucReceptor = '', nombreReceptor = ''
    if (customerNode) {
      rucReceptor    = customerNode.getElementsByTagName('cac:PartyIdentification')[0]
                         ?.getElementsByTagName('cbc:ID')[0]?.textContent?.trim() || ''
      nombreReceptor = customerNode.getElementsByTagName('cac:PartyLegalEntity')[0]
                         ?.getElementsByTagName('cbc:RegistrationName')[0]?.textContent?.trim() || ''
    }

    return { numero, fecha, moneda, total, igv, subtotal, rucEmisor, nombreEmisor, rucReceptor, nombreReceptor, valido: !!numero }
  } catch { return null }
}

 const manejarArchivoXML = async (file: File) => {
  if (!file) return
  // Leer como ArrayBuffer para manejar el encoding correctamente
  const buffer  = await file.arrayBuffer()
  const uint8   = new Uint8Array(buffer)
  // Detectar encoding del XML declaration
  const preview = new TextDecoder('utf-8', { fatal: false }).decode(uint8.slice(0, 200))
  const match   = preview.match(/encoding=['"]([\w-]+)['"]/i)
  const encoding = match ? match[1] : 'UTF-8'
  const texto   = new TextDecoder(encoding).decode(buffer)
  const datos   = parsearXMLFactura(texto)
  if (datos?.valido) {
    setDatosXML(datos)
    setArchivoXML(file)
    setMostrarXML(true)
  } else {
    alert('No se pudo leer el XML. Verifica que sea una factura electrónica SUNAT válida.')
  }
}

  const confirmarXML = async () => {
    if (!archivoXML || !datosXML || !seleccionado) return
    setSubiendoXML(true)
    setMostrarXML(false)
    const path = `anticipos/${seleccionado.id}/factura_xml_${Date.now()}.xml`
    const { error } = await supabase.storage.from('documentos').upload(path, archivoXML, { upsert: true })
    if (error) { alert('Error al subir XML'); setSubiendoXML(false); return }
    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
    const upd: any = {
      factura_xml_url:      publicUrl,
      factura_xml_nombre:   archivoXML.name,
      factura_numero:       datosXML.numero || seleccionado.factura_numero,
      fecha_regularizacion: datosXML.fecha  || new Date().toISOString().split('T')[0],
      estado:               'rendido',
    }
    await supabase.from('anticipos').update(upd).eq('id', seleccionado.id)
    const updated = { ...seleccionado, ...upd }
    setSeleccionado(updated)
    setNuevoEstado('rendido')
    setAnticipos(prev => prev.map(a => a.id === seleccionado.id ? updated : a))
    setDatosXML(null)
    setArchivoXML(null)
    setSubiendoXML(false)
  }

  // ── Excel export ───────────────────────────────────────────────────────────
  const exportarExcel = async () => {
    const XLSX = await import('xlsx')
    const datos = listaFiltrada.map(a => ({
      'N° Solicitud':         a.numero,
      'Fecha':                new Date(a.fecha).toLocaleDateString('es-PE'),
      'Solicitante':          a.solicitante?.email || a.solicitante?.nombre || '—',
      'Proveedor':            a.proveedor,
      'Moneda':               a.moneda,
      'Monto':                parseFloat(a.monto),
      'Descripción':          a.descripcion || '—',
      'Shipment':             a.shipment || '—',
      'BK/BL':                a.bk_bl || '—',
      'Facturado a':          a.facturado_a || '—',
      'N° Factura':           a.factura_numero || '—',
      'Banco':                a.banco || '—',
      'Cuenta bancaria':      a.cuenta_bancaria || '—',
      'Código de pago':       a.codigo_pago || '—',
      'MOV Bancario':         a.mov_bancario || '—',
      'Estado':               ESTADOS[a.estado]?.label || a.estado,
      'XML subido':           a.factura_xml_url ? 'Sí' : 'No',
      'PDF subido':           a.factura_pdf_url ? 'Sí' : 'No',
      'Comprobante':          a.comprobante_url ? 'Sí' : 'No',
      'Fecha rendición':      a.fecha_regularizacion ? new Date(a.fecha_regularizacion).toLocaleDateString('es-PE') : '—',
      'Observación finanzas': a.observacion_finanzas || '—',
      'Comentarios':          a.comentarios || '—',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(datos)
    ws['!cols'] = Array(22).fill({ wch: 18 })
    const totalUSD = listaFiltrada.filter(a => a.moneda === 'USD').reduce((s, a) => s + parseFloat(a.monto || 0), 0)
    const totalPEN = listaFiltrada.filter(a => a.moneda === 'PEN').reduce((s, a) => s + parseFloat(a.monto || 0), 0)
    XLSX.utils.sheet_add_aoa(ws, [[], ['', '', '', 'TOTAL USD', 'USD', totalUSD], ['', '', '', 'TOTAL PEN', 'PEN', totalPEN]], { origin: -1 })
    XLSX.utils.book_append_sheet(wb, ws, 'Anticipos')
    const filtroLabel = filtroEstado === 'todos' ? 'todos' : ESTADOS[filtroEstado]?.label || filtroEstado
    XLSX.writeFile(wb, `Anticipos_${filtroLabel}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const listaFiltrada = anticipos.filter(a => {
    const matchEstado   = filtroEstado === 'todos' || a.estado === filtroEstado
    const matchBusqueda = !busqueda ||
      a.numero?.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.proveedor?.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.descripcion?.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.solicitante?.email?.toLowerCase().includes(busqueda.toLowerCase())
    const matchDesde = !fechaDesde || a.fecha >= fechaDesde
    const matchHasta = !fechaHasta || a.fecha <= fechaHasta
    return matchEstado && matchBusqueda && matchDesde && matchHasta
  })

  const inp: any = { width: '100%', padding: '9px 12px', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: 'white', color: '#0F1923', outline: 'none', boxSizing: 'border-box' }
  const lbl: any = { fontSize: '11px', fontWeight: 700, color: '#8A9BB0', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }

  if (!perfil) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid #EEE', borderTopColor: '#C41230', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'Segoe UI', Roboto, sans-serif" }}>

      {/* ── MODAL XML ── */}
      {mostrarXML && datosXML && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,25,35,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#0F1923', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'white', margin: '0 0 2px' }}>📄 Factura electrónica detectada</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Datos extraídos del XML SUNAT — verifica antes de confirmar</p>
              </div>
              <button onClick={() => { setMostrarXML(false); setDatosXML(null); setArchivoXML(null) }}
                style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ height: '3px', background: '#C41230' }} />
            <div style={{ padding: '24px' }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div style={{ background: '#F8F9FA', borderRadius: '10px', padding: '12px 14px' }}>
                  <p style={{ fontSize: '9px', fontWeight: 700, color: '#8A9BB0', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>N° Factura</p>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#0F1923', margin: 0 }}>{datosXML.numero || '—'}</p>
                </div>
                <div style={{ background: '#F8F9FA', borderRadius: '10px', padding: '12px 14px' }}>
                  <p style={{ fontSize: '9px', fontWeight: 700, color: '#8A9BB0', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>Fecha emisión</p>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#0F1923', margin: 0 }}>
                    {datosXML.fecha ? datosXML.fecha.split('-').reverse().join('/') : '—'}

                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                {[
                  { label: 'Subtotal',                       valor: datosXML.subtotal, color: '#0F1923' },
                  { label: 'IGV',                            valor: datosXML.igv,      color: '#E65100' },
                  { label: `Total ${datosXML.moneda || ''}`, valor: datosXML.total,    color: '#6A1B9A' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#F8F9FA', borderRadius: '10px', padding: '12px 14px', textAlign: 'center' as const }}>
                    <p style={{ fontSize: '9px', fontWeight: 700, color: '#8A9BB0', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>{item.label}</p>
                    <p style={{ fontSize: '15px', fontWeight: 800, color: item.color, margin: 0 }}>
                      {item.valor ? parseFloat(item.valor).toLocaleString('es-PE', { minimumFractionDigits: 2 }) : '—'}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ background: '#EEF2FF', borderRadius: '10px', padding: '12px 14px', marginBottom: '10px', border: '1px solid #C7D2FE' }}>
                <p style={{ fontSize: '9px', fontWeight: 700, color: '#3730A3', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>Emisor (proveedor)</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: '0 0 2px' }}>{datosXML.nombreEmisor || '—'}</p>
                {datosXML.rucEmisor && <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>RUC: {datosXML.rucEmisor}</p>}
              </div>

              <div style={{ background: '#F0FDF4', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', border: '1px solid #A5D6A7' }}>
                <p style={{ fontSize: '9px', fontWeight: 700, color: '#2E7D32', textTransform: 'uppercase' as const, margin: '0 0 4px' }}>Receptor</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F1923', margin: '0 0 2px' }}>{datosXML.nombreReceptor || '—'}</p>
                {datosXML.rucReceptor && <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>RUC: {datosXML.rucReceptor}</p>}
              </div>

              {seleccionado && datosXML.total && (
                <div style={{
                  background: Math.abs(parseFloat(datosXML.total) - parseFloat(seleccionado.monto)) < 0.01 ? '#E8F5E9' : '#FFF8E1',
                  borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
                  border: `1px solid ${Math.abs(parseFloat(datosXML.total) - parseFloat(seleccionado.monto)) < 0.01 ? '#A5D6A7' : '#FDE68A'}`,
                }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, margin: 0, color: Math.abs(parseFloat(datosXML.total) - parseFloat(seleccionado.monto)) < 0.01 ? '#2E7D32' : '#92400E' }}>
                    {Math.abs(parseFloat(datosXML.total) - parseFloat(seleccionado.monto)) < 0.01
                      ? '✓ El monto coincide con el anticipo solicitado'
                      : `⚠️ Difiere del anticipo (${seleccionado.moneda} ${parseFloat(seleccionado.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })})`}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={confirmarXML} disabled={subiendoXML}
                  style={{ flex: 1, padding: '11px', background: '#C41230', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: subiendoXML ? 0.6 : 1 }}>
                  {subiendoXML ? 'Guardando...' : '✓ Confirmar y guardar'}
                </button>
                <button onClick={() => { setMostrarXML(false); setDatosXML(null); setArchivoXML(null) }}
                  style={{ padding: '11px 20px', background: '#F0F2F5', color: '#8A9BB0', border: '1px solid #E8ECF0', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{ background: '#0F1923', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href="/hub"><img src="/LogoOmni.png" alt="Omni" style={{ height: '28px', filter: 'brightness(0) invert(1)', cursor: 'pointer' }} /></a>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)' }} />
          <button onClick={() => router.push('/finanzas')} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Finanzas</button>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>Anticipos</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {esFinanzas && (
            <button onClick={exportarExcel}
              style={{ padding: '7px 16px', background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              ↓ Exportar Excel
            </button>
          )}
          {esOperativo && (
            <button onClick={() => router.push('/finanzas/anticipos/nueva')}
              style={{ padding: '7px 16px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              + Nueva solicitud
            </button>
          )}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', margin: 0 }}>{perfil.nombre || perfil.email}</p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', margin: 0, textTransform: 'capitalize' }}>{perfil.rol?.replace('_', ' ')}</p>
          </div>
          <BotonHub />
        </div>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ display: 'flex', height: 'calc(100vh - 59px)' }}>

        {/* ── Panel izquierdo ── */}
        <div style={{ width: '320px', minWidth: '320px', background: 'white', borderRight: '1px solid #E8ECF0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #E8ECF0' }}>
            <input placeholder="Buscar proveedor, número, email..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)} style={{ ...inp, marginBottom: '10px' }} />
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' as const, marginBottom: '10px' }}>
              {(['todos', ...Object.keys(ESTADOS)] as const).map(f => (
                <button key={f} onClick={() => setFiltroEstado(f)}
                  style={{ padding: '4px 10px', border: `1px solid ${filtroEstado === f ? '#0F1923' : '#E8ECF0'}`, borderRadius: '20px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', background: filtroEstado === f ? '#0F1923' : 'white', color: filtroEstado === f ? 'white' : '#8A9BB0' }}>
                  {f === 'todos' ? 'Todos' : ESTADOS[f].label}
                </button>
              ))}
            </div>
            {esFinanzas && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ fontSize: '9px', fontWeight: 700, color: '#8A9BB0', display: 'block', marginBottom: '3px', textTransform: 'uppercase' as const }}>Desde</label>
                  <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #E8ECF0', borderRadius: '6px', fontSize: '11px', outline: 'none', color: '#0F1923', boxSizing: 'border-box' as const }} />
                </div>
                <div>
                  <label style={{ fontSize: '9px', fontWeight: 700, color: '#8A9BB0', display: 'block', marginBottom: '3px', textTransform: 'uppercase' as const }}>Hasta</label>
                  <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #E8ECF0', borderRadius: '6px', fontSize: '11px', outline: 'none', color: '#0F1923', boxSizing: 'border-box' as const }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: '8px 16px', borderBottom: '1px solid #E8ECF0', background: '#FAFBFC' }}>
            <span style={{ fontSize: '11px', color: '#8A9BB0' }}>
              {listaFiltrada.length} solicitud{listaFiltrada.length !== 1 ? 'es' : ''}
              {listaFiltrada.length !== anticipos.length && ` de ${anticipos.length}`}
            </span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {cargando ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#8A9BB0', fontSize: '13px' }}>Cargando...</div>
            ) : listaFiltrada.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#8A9BB0' }}>
                <p style={{ fontSize: '28px', margin: '0 0 8px' }}>💸</p>
                <p style={{ fontSize: '13px', margin: 0 }}>Sin solicitudes</p>
              </div>
            ) : listaFiltrada.map(ant => (
              <div key={ant.id} onClick={() => seleccionar(ant)}
                style={{ padding: '14px 16px', borderBottom: '1px solid #E8ECF0', cursor: 'pointer', background: seleccionado?.id === ant.id ? '#F8F9FA' : 'white', borderLeft: seleccionado?.id === ant.id ? '3px solid #C41230' : '3px solid transparent', transition: 'all 0.1s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F1923' }}>{ant.numero}</span>
                  <BadgeEstado estado={ant.estado} />
                </div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F1923', margin: '0 0 3px' }}>{ant.proveedor}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#8A9BB0' }}>{ant.moneda} {parseFloat(ant.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
                  <span style={{ fontSize: '10px', color: '#8A9BB0' }}>{new Date(ant.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</span>
                </div>
                {/* Indicadores de documentos */}
                <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
                  {ant.comprobante_url    && <span style={{ fontSize: '9px', background: '#E8F5E9', color: '#2E7D32', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>Comprobante</span>}
                  {ant.factura_xml_url    && <span style={{ fontSize: '9px', background: '#EEF2FF', color: '#3730A3', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>XML</span>}
                  {ant.factura_pdf_url    && <span style={{ fontSize: '9px', background: '#F3E5F5', color: '#6A1B9A', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>PDF</span>}
                </div>
                {esFinanzas && ant.solicitante && (
                  <p style={{ fontSize: '10px', color: '#BCC6D0', margin: '3px 0 0' }}>{ant.solicitante.email || ant.solicitante.nombre}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Panel derecho ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#F0F2F5' }}>
          {!seleccionado ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8A9BB0' }}>
              <p style={{ fontSize: '48px', margin: '0 0 12px' }}>💸</p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#0F1923', margin: '0 0 4px' }}>Selecciona una solicitud</p>
              <p style={{ fontSize: '13px', margin: 0 }}>Elige un anticipo de la lista para ver el detalle</p>
            </div>
          ) : (
            <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Header */}
              <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px', fontWeight: 600 }}>{seleccionado.numero}</p>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F1923', margin: '0 0 8px' }}>{seleccionado.proveedor}</h2>
                    <BadgeEstado estado={seleccionado.estado} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '24px', fontWeight: 800, color: '#6A1B9A', margin: 0 }}>
                      {seleccionado.moneda} {parseFloat(seleccionado.monto).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </p>
                    <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '4px 0 0' }}>
                      {new Date(seleccionado.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E8ECF0' }}>
                  {[
                    { label: 'Solicitante', value: seleccionado.solicitante?.email || seleccionado.solicitante?.nombre },
                    { label: 'Facturado a', value: seleccionado.facturado_a },
                    { label: 'Descripción', value: seleccionado.descripcion },
                    { label: 'Shipment',    value: seleccionado.shipment    || '—' },
                    { label: 'BK/BL',       value: seleccionado.bk_bl       || '—' },
                    { label: 'N° Factura',  value: seleccionado.factura_numero || 'Sin factura aún' },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#8A9BB0', margin: '0 0 3px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{item.label}</p>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: 0 }}>{item.value || '—'}</p>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #E8ECF0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {[
                    { label: 'Banco',           value: seleccionado.banco },
                    { label: 'Cuenta bancaria', value: seleccionado.cuenta_bancaria },
                    { label: 'Código de pago',  value: seleccionado.codigo_pago },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#8A9BB0', margin: '0 0 3px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{item.label}</p>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: 0 }}>{item.value || '—'}</p>
                    </div>
                  ))}
                </div>

                {seleccionado.comentarios && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', background: '#F8F9FA', borderRadius: '8px', fontSize: '12px', color: '#0F1923' }}>
                    <strong>Comentarios:</strong> {seleccionado.comentarios}
                  </div>
                )}
              </div>

              {/* Gestión finanzas */}
              {esFinanzas && (
                <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 16px' }}>Gestión de pago</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ ...lbl }}>Estado</label>
                      <select value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)} style={{ ...inp }}>
                        {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lbl }}>MOV Bancario</label>
                      <input value={movBancario} onChange={e => setMovBancario(e.target.value)}
                        placeholder="Número de movimiento" style={{ ...inp }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ ...lbl }}>Observación</label>
                    <textarea value={obsFinanzas} onChange={e => setObsFinanzas(e.target.value)}
                      rows={2} placeholder="Observaciones de finanzas..."
                      style={{ ...inp, resize: 'none' as const, fontFamily: 'inherit', lineHeight: '1.5' }} />
                  </div>
                  <button onClick={guardarCambios} disabled={guardando}
                    style={{ padding: '10px 20px', background: '#C41230', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  {seleccionado.mov_bancario && (
                    <div style={{ marginTop: '12px', padding: '8px 14px', background: '#E8F5E9', borderRadius: '8px', fontSize: '12px', color: '#2E7D32', fontWeight: 600 }}>
                      ✓ MOV: {seleccionado.mov_bancario}
                    </div>
                  )}
                </div>
              )}

              {/* Comprobante de pago */}
              <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: '0 0 16px' }}>Comprobante de pago</h3>
                {seleccionado.comprobante_url ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#E8F5E9', borderRadius: '10px', border: '1px solid #A5D6A7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>📎</span>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#2E7D32', margin: 0 }}>Comprobante cargado</p>
                        <p style={{ fontSize: '11px', color: '#8A9BB0', margin: '2px 0 0' }}>{seleccionado.comprobante_nombre}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={seleccionado.comprobante_url} target="_blank" rel="noopener noreferrer"
                        style={{ padding: '6px 14px', background: '#2E7D32', color: 'white', borderRadius: '8px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>Ver</a>
                      {esFinanzas && (
                        <button onClick={() => compRef.current?.click()}
                          style={{ padding: '6px 14px', background: '#F0F2F5', color: '#0F1923', border: '1px solid #E8ECF0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                          Reemplazar
                        </button>
                      )}
                    </div>
                  </div>
                ) : esFinanzas ? (
                  <div onClick={() => compRef.current?.click()}
                    style={{ border: '2px dashed #E8ECF0', borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer', background: '#FAFBFC' }}>
                    {subiendoComp ? <p style={{ color: '#8A9BB0', margin: 0 }}>Subiendo...</p> : (
                      <>
                        <p style={{ fontSize: '28px', margin: '0 0 6px' }}>📤</p>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F1923', margin: '0 0 4px' }}>Subir comprobante de pago</p>
                        <p style={{ fontSize: '11px', color: '#8A9BB0', margin: 0 }}>PDF, JPG o PNG</p>
                      </>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: '#8A9BB0', margin: 0 }}>Pendiente de carga por finanzas.</p>
                )}
                <input ref={compRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && subirComprobante(e.target.files[0])} />
              </div>

              {/* Regularización — XML + PDF independientes */}
              <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #E8ECF0', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F1923', margin: 0 }}>Regularización con factura</h3>
                  {seleccionado.fecha_regularizacion && (
                    <span style={{ fontSize: '10px', color: '#8A9BB0' }}>
                      {new Date(seleccionado.fecha_regularizacion).toLocaleDateString('es-PE')}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: '#8A9BB0', margin: '0 0 16px' }}>
                  Puedes subir el XML para lectura automática y/o el PDF como representación impresa. Al subir cualquiera el estado cambia a <strong>Rendido</strong>.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                  {/* XML */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#3730A3', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                      📄 XML electrónico
                    </p>
                    {seleccionado.factura_xml_url ? (
                      <div style={{ padding: '10px 12px', background: '#EEF2FF', borderRadius: '10px', border: '1px solid #C7D2FE' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#3730A3', margin: '0 0 2px' }}>✓ XML cargado</p>
                        <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '0 0 8px' }}>{seleccionado.factura_xml_nombre}</p>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <a href={seleccionado.factura_xml_url} target="_blank" rel="noopener noreferrer"
                            style={{ flex: 1, padding: '5px', background: '#3730A3', color: 'white', borderRadius: '6px', fontSize: '11px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' as const }}>
                            Descargar
                          </a>
                          <button onClick={() => xmlRef.current?.click()}
                            style={{ padding: '5px 10px', background: '#F0F2F5', color: '#0F1923', border: '1px solid #E8ECF0', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                            Reemplazar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => xmlRef.current?.click()}
                        style={{ border: '2px dashed #C7D2FE', borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#FAFBFF' }}>
                        {subiendoXML ? <p style={{ color: '#8A9BB0', margin: 0, fontSize: '12px' }}>Subiendo...</p> : (
                          <>
                            <p style={{ fontSize: '22px', margin: '0 0 4px' }}>📄</p>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#3730A3', margin: '0 0 2px' }}>Subir XML</p>
                            <p style={{ fontSize: '10px', color: '#8A9BB0', margin: 0 }}>Lectura automática SUNAT</p>
                          </>
                        )}
                      </div>
                    )}
                    <input ref={xmlRef} type="file" accept=".xml,text/xml,application/xml" style={{ display: 'none' }}
                      onChange={e => e.target.files?.[0] && manejarArchivoXML(e.target.files[0])} />
                  </div>

                  {/* PDF */}
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#6A1B9A', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                      🧾 PDF / Imagen
                    </p>
                    {seleccionado.factura_pdf_url ? (
                      <div style={{ padding: '10px 12px', background: '#F3E5F5', borderRadius: '10px', border: '1px solid #CE93D8' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#6A1B9A', margin: '0 0 2px' }}>✓ PDF cargado</p>
                        <p style={{ fontSize: '10px', color: '#8A9BB0', margin: '0 0 8px' }}>{seleccionado.factura_pdf_nombre}</p>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <a href={seleccionado.factura_pdf_url} target="_blank" rel="noopener noreferrer"
                            style={{ flex: 1, padding: '5px', background: '#6A1B9A', color: 'white', borderRadius: '6px', fontSize: '11px', fontWeight: 700, textDecoration: 'none', textAlign: 'center' as const }}>
                            Ver
                          </a>
                          <button onClick={() => pdfRef.current?.click()}
                            style={{ padding: '5px 10px', background: '#F0F2F5', color: '#0F1923', border: '1px solid #E8ECF0', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
                            Reemplazar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => pdfRef.current?.click()}
                        style={{ border: '2px dashed #CE93D8', borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: '#FDF8FF' }}>
                        {subiendoPDF ? <p style={{ color: '#8A9BB0', margin: 0, fontSize: '12px' }}>Subiendo...</p> : (
                          <>
                            <p style={{ fontSize: '22px', margin: '0 0 4px' }}>🧾</p>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#6A1B9A', margin: '0 0 2px' }}>Subir PDF</p>
                            <p style={{ fontSize: '10px', color: '#8A9BB0', margin: 0 }}>PDF, JPG o PNG</p>
                          </>
                        )}
                      </div>
                    )}
                    <input ref={pdfRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
                      onChange={e => e.target.files?.[0] && subirFacturaPDF(e.target.files[0])} />
                  </div>

                </div>

                {/* Estado de regularización */}
                {(seleccionado.factura_xml_url || seleccionado.factura_pdf_url) && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', background: '#E8F5E9', borderRadius: '8px', fontSize: '12px', color: '#2E7D32', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ✅ Factura regularizada
                    {seleccionado.factura_xml_url && seleccionado.factura_pdf_url && (
                      <span style={{ fontSize: '10px', background: '#A5D6A7', color: 'white', padding: '2px 8px', borderRadius: '10px' }}>XML + PDF</span>
                    )}
                    {seleccionado.factura_xml_url && !seleccionado.factura_pdf_url && (
                      <span style={{ fontSize: '10px', background: '#A5D6A7', color: 'white', padding: '2px 8px', borderRadius: '10px' }}>Solo XML</span>
                    )}
                    {!seleccionado.factura_xml_url && seleccionado.factura_pdf_url && (
                      <span style={{ fontSize: '10px', background: '#A5D6A7', color: 'white', padding: '2px 8px', borderRadius: '10px' }}>Solo PDF</span>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}