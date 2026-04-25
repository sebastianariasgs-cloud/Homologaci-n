import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const ruc = req.nextUrl.searchParams.get('ruc')

  if (!ruc || !/^\d{11}$/.test(ruc)) {
    return NextResponse.json({ error: 'RUC inválido' }, { status: 400 })
  }

  const res = await fetch(`https://api.apis.net.pe/v1/ruc?numero=${ruc}`, {
    headers: { Authorization: `Bearer ${process.env.APIS_PERU_TOKEN}` }
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'No se encontró el RUC' }, { status: 404 })
  }

  const data = await res.json()
  return NextResponse.json(data)
}