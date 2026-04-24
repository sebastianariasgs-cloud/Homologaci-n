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

  return NextResponse.json({ ok: true, usuario: authData.user })
}