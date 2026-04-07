'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function ReportesPage() {
  const router = useRouter()
  const [proveedores, setProveedores] = useState<any[]>([])
  const [filtrados, setFiltrados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [tipos, setTipos] = useState<any[]>([])
  const [generando, setGenerando] = useState(false)

  useEffect(() => { verificarRol() }, [])

  useEffect(() => { aplicarFiltros() }, [filtroEstado, filtroTipo, proveedores])

  const verificarRol = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: perfil } = await supabase
      .from('perfiles').select('rol').eq('id', user.id).single()
    if (perfil?.rol !== 'evaluador') { router.push('/dashboard'); return }
    await cargarDatos()
  }

  const cargarDatos = async () => {
    const { data: provs } = await supabase
      .from('proveedores')
      .select('*, tipos_proveedor(nombre)')
      .order('created_at', { ascending: false })

    const { data: tiposData } = await supabase
      .from('tipos_proveedor').select('*').eq('activo', true)

    // Cargar stats de documentos y conductores/unidades para cada proveedor
    const provsConStats = await Promise.all((provs || []).map(async (prov) => {
      const { data: docs } = await supabase
        .from('documentos').select('estado').eq('proveedor_id', prov.id)
      const { data: conds } = await supabase
        .from('conductores').select('id').eq('proveedor_id', prov.id).eq('activo', true)
      const { data: units } = await supabase
        .from('unidades').select('id').eq('proveedor_id', prov.id).eq('activo', true)

      const aprobados = docs?.filter(d => d.estado === 'aprobado').length || 0
      const pendientes = docs?.filter(d => d.estado === 'pendiente').length || 0
      const rechazados = docs?.filter(d => d.estado === 'rechazado').length || 0

      return {
        ...prov,
        tipo_nombre: prov.tipos_proveedor?.nombre || 'No especificado',
        total_conductores: conds?.length || 0,
        total_unidades: units?.length || 0,
        docs_aprobados: aprobados,
        docs_pendientes: pendientes,
        docs_rechazados: rechazados,
      }
    }))

    setProveedores(provsConStats)
    setTipos(tiposData || [])
    setLoading(false)
  }

  const aplicarFiltros = () => {
    let resultado = [...proveedores]
    if (filtroEstado !== 'todos') {
      resultado = resultado.filter(p => p.estado === filtroEstado)
    }
    if (filtroTipo !== 'todos') {
      resultado = resultado.filter(p => p.tipo_id === filtroTipo)
    }
    setFiltrados(resultado)
  }

  const formatFecha = (fecha: string | null) => {
    if (!fecha) return '—'
    return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const exportarExcel = () => {
    setGenerando(true)
    const datos = filtrados.map(p => ({
      'Razón Social': p.razon_social,
      'RUC': p.ruc,
      'Tipo de Proveedor': p.tipo_nombre,
      'Estado': p.estado === 'homologado' ? 'Homologado' :
                p.estado === 'pendiente' ? 'Pendiente' :
                p.estado === 'rechazado' ? 'Rechazado' : 'En proceso',
      'Fecha de Registro': formatFecha(p.created_at),
      'Fecha de Homologación': formatFecha(p.fecha_homologacion),
      'N° Conductores': p.total_conductores,
      'N° Unidades': p.total_unidades,
      'Docs Aprobados': p.docs_aprobados,
      'Docs Pendientes': p.docs_pendientes,
      'Docs Rechazados': p.docs_rechazados,
    }))

    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()

    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 35 }, { wch: 14 }, { wch: 30 }, { wch: 14 },
      { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 12 },
      { wch: 14 }, { wch: 15 }, { wch: 15 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Proveedores')
    XLSX.writeFile(wb, `Reporte_Proveedores_${new Date().toLocaleDateString('es-PE').replace(/\//g, '-')}.xlsx`)
    setGenerando(false)
  }

  const exportarPDF = async () => {
    setGenerando(true)
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape' })

    // Header
    doc.setFillColor(196, 18, 48)
    doc.rect(0, 0, 297, 20, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('OMNI LOGISTICS - Reporte de Proveedores', 14, 13)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generado: ${new Date().toLocaleDateString('es-PE')} | Filtro: ${filtroEstado === 'todos' ? 'Todos' : filtroEstado} | Total: ${filtrados.length}`, 180, 13)

    autoTable(doc, {
      startY: 25,
      head: [[
        'Razón Social', 'RUC', 'Tipo', 'Estado',
        'F. Registro', 'F. Homologación',
        'Conductores', 'Unidades',
        'Docs ✓', 'Docs ⏳', 'Docs ✗'
      ]],
      body: filtrados.map(p => [
        p.razon_social,
        p.ruc,
        p.tipo_nombre,
        p.estado === 'homologado' ? 'Homologado' :
        p.estado === 'pendiente' ? 'Pendiente' :
        p.estado === 'rechazado' ? 'Rechazado' : 'En proceso',
        formatFecha(p.created_at),
        formatFecha(p.fecha_homologacion),
        p.total_conductores,
        p.total_unidades,
        p.docs_aprobados,
        p.docs_pendientes,
        p.docs_rechazados,
      ]),
      headStyles: { fillColor: [196, 18, 48], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 22 },
        2: { cellWidth: 35 },
        3: { cellWidth: 22 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 },
        6: { cellWidth: 18 },
        7: { cellWidth: 16 },
        8: { cellWidth: 14 },
        9: { cellWidth: 14 },
        10: { cellWidth: 14 },
      },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 3) {
          const estado = data.cell.raw as string
          if (estado === 'Homologado') doc.setTextColor(21, 128, 61)
          else if (estado === 'Pendiente') doc.setTextColor(194, 65, 12)
          else if (estado === 'Rechazado') doc.setTextColor(196, 18, 48)
          else doc.setTextColor(0, 0, 0)
        }
      },
    })

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text(`Página ${i} de ${pageCount} | Omni Logistics (Perú) S.R.L. | Confidencial`, 14, doc.internal.pageSize.height - 5)
    }

    doc.save(`Reporte_Proveedores_${new Date().toLocaleDateString('es-PE').replace(/\//g, '-')}.pdf`)
    setGenerando(false)
  }

  const estadoBadge = (estado: string) => {
    const estilos: { [key: string]: { bg: string, color: string, texto: string } } = {
      pendiente: { bg: '#FFF7ED', color: '#C2410C', texto: 'Pendiente' },
      homologado: { bg: '#F0FDF4', color: '#15803D', texto: 'Homologado' },
      rechazado: { bg: '#FEF2F2', color: '#C41230', texto: 'Rechazado' },
      aprobado: { bg: '#EFF6FF', color: '#1D4ED8', texto: 'Aprobado' },
    }
    const e = estilos[estado] || estilos.pendiente
    return (
      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: e.bg, color: e.color }}>
        {e.texto}
      </span>
    )
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
          <a href="/evaluador" style={{ fontSize: '13px', color: '#888', textDecoration: 'none' }}>Panel evaluador</a>
          <span style={{ color: '#DDD' }}>›</span>
          <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 500 }}>Reportes</span>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          style={{ fontSize: '13px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
          Salir
        </button>
      </nav>
      <div style={{ height: '3px', background: '#C41230' }} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total registrados', valor: proveedores.length, bg: '#F7F7F7', color: '#1a1a1a' },
            { label: 'Homologados', valor: proveedores.filter(p => p.estado === 'homologado').length, bg: '#F0FDF4', color: '#15803D' },
            { label: 'Pendientes', valor: proveedores.filter(p => p.estado === 'pendiente').length, bg: '#FFF7ED', color: '#C2410C' },
            { label: 'Rechazados', valor: proveedores.filter(p => p.estado === 'rechazado').length, bg: '#FEF2F2', color: '#C41230' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: kpi.bg, borderRadius: '12px', padding: '16px 20px', border: '1px solid #EEEEEE' }}>
              <p style={{ fontSize: '11px', color: '#888', margin: '0 0 6px' }}>{kpi.label}</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: kpi.color, margin: 0 }}>{kpi.valor}</p>
            </div>
          ))}
        </div>

        {/* Filtros y exportar */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>Estado:</span>
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
                style={{ padding: '7px 12px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '12px', outline: 'none', background: 'white' }}>
                <option value="todos">Todos</option>
                <option value="homologado">Homologados</option>
                <option value="pendiente">Pendientes</option>
                <option value="rechazado">Rechazados</option>
                <option value="aprobado">Aprobados</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>Tipo:</span>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}
                style={{ padding: '7px 12px', border: '1.5px solid #E8E8E8', borderRadius: '8px', fontSize: '12px', outline: 'none', background: 'white' }}>
                <option value="todos">Todos</option>
                {tipos.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: '12px', color: '#888' }}>{filtrados.length} resultados</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={exportarExcel} disabled={generando || filtrados.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: (generando || filtrados.length === 0) ? 0.5 : 1 }}>
              📊 Exportar Excel
            </button>
            <button onClick={exportarPDF} disabled={generando || filtrados.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#FEF2F2', color: '#C41230', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: (generando || filtrados.length === 0) ? 0.5 : 1 }}>
              📄 Exportar PDF
            </button>
          </div>
        </div>

        {/* Tabla */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9F9F9', borderBottom: '1px solid #EEEEEE' }}>
                  {['Razón social', 'RUC', 'Tipo', 'Estado', 'F. Registro', 'F. Homologación', 'Conductores', 'Unidades', 'Docs ✓', 'Docs ⏳', 'Docs ✗'].map(col => (
                    <th key={col} style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 600, color: '#666', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ padding: '32px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                      No hay proveedores con ese filtro
                    </td>
                  </tr>
                )}
                {filtrados.map((prov, i) => (
                  <tr key={prov.id} style={{ borderBottom: '1px solid #F5F5F5', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                    <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: '#1a1a1a' }}>{prov.razon_social}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#666' }}>{prov.ruc}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#666' }}>{prov.tipo_nombre}</td>
                    <td style={{ padding: '10px 14px' }}>{estadoBadge(prov.estado)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>{formatFecha(prov.created_at)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>{formatFecha(prov.fecha_homologacion)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#666', textAlign: 'center' }}>{prov.total_conductores}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#666', textAlign: 'center' }}>{prov.total_unidades}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#15803D', textAlign: 'center', fontWeight: 600 }}>{prov.docs_aprobados}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#C2410C', textAlign: 'center', fontWeight: 600 }}>{prov.docs_pendientes}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: '#C41230', textAlign: 'center', fontWeight: 600 }}>{prov.docs_rechazados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}