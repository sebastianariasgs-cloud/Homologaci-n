import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { email, password, razon_social, ruc, rol } = await req.json()

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const { error: perfilError } = await supabaseAdmin
    .from('perfiles')
    .insert({
      id: authData.user.id,
      email,
      nombre: razon_social,
      ruc,
      rol
    })

  if (perfilError) {
    return NextResponse.json({ error: perfilError.message }, { status: 400 })
  }

  // Si es proveedor, buscar si ya existe uno con ese RUC (creado como urgente desde transporte)
  if (rol === 'proveedor' && ruc) {
    const { data: provExistente } = await supabaseAdmin
      .from('proveedores')
      .select('id')
      .eq('ruc', ruc)
      .single()

    if (provExistente) {
      // Enlazar el proveedor urgente existente con el nuevo usuario
      await supabaseAdmin
        .from('proveedores')
        .update({ user_id: authData.user.id })
        .eq('id', provExistente.id)
    } else {
      // Crear el proveedor nuevo normalmente
      await supabaseAdmin
        .from('proveedores')
        .insert({
          user_id: authData.user.id,
          ruc,
          razon_social,
          estado: 'pendiente',
        })
    }
  }

  return NextResponse.json({ ok: true, usuario: authData.user })
}