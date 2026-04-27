import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { ruc, razon_social, placa, conductor } = await req.json()

  const { data: prov, error: provError } = await supabaseAdmin
    .from('proveedores')
    .insert({ ruc, razon_social, estado: 'pendiente', urgente: true })
    .select().single()

  if (provError) return NextResponse.json({ error: provError.message }, { status: 400 })

  const { data: unidad } = await supabaseAdmin
    .from('unidades')
    .insert({ proveedor_id: prov.id, placa: placa.toUpperCase(), activo: true, pendiente_revision: true })
    .select().single()

  const { data: cond } = await supabaseAdmin
    .from('conductores')
    .insert({ proveedor_id: prov.id, nombre_completo: conductor, activo: true, pendiente_revision: true })
    .select().single()

  await supabaseAdmin.from('notificaciones').insert({
    titulo: '🚨 Proveedor urgente',
    mensaje: `${razon_social} fue registrado como proveedor urgente desde transporte`,
    tipo: 'urgente',
    leida: false,
  })

  return NextResponse.json({ ok: true, proveedor: prov, unidad, conductor: cond })
}