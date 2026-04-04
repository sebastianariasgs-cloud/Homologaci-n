'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [proveedor, setProveedor] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('proveedores')
        .select('*')
        .eq('user_id', user.id)
        .single()

      setProveedor(data)
      setLoading(false)
    }

    cargarDatos()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Portal de proveedor</h1>
          <p className="text-xs text-gray-400">Plataforma de homologación</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{proveedor?.razon_social}</p>
            <p className="text-xs text-gray-400">RUC {proveedor?.ruc}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-500 transition"
          >
            Salir
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Estado de homologación */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Estado de homologación</h2>
            <span className="bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1 rounded-full">
              {proveedor?.estado === 'pendiente' ? 'Pendiente de revisión' : proveedor?.estado}
            </span>
          </div>

          {/* Pasos */}
          <div className="flex items-center gap-0">
            {['Registro', 'Documentos', 'En revisión', 'Aprobación', 'Homologado'].map((paso, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium
                    ${i === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {i === 0 ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs mt-1 ${i === 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                    {paso}
                  </span>
                </div>
                {i < 4 && <div className="h-px bg-gray-200 flex-1 mb-4"></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Cards de acción */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Mis documentos</h3>
            <p className="text-xs text-gray-400 mb-3">Carga y gestiona tus documentos requeridos</p>
            <a href="/dashboard/documentos" className="text-xs text-blue-600 font-medium hover:underline">
              Ir a documentos →
            </a>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Mi perfil</h3>
            <p className="text-xs text-gray-400 mb-3">Completa los datos de tu empresa</p>
            <a href="/dashboard/perfil" className="text-xs text-blue-600 font-medium hover:underline">
              Ver perfil →
            </a>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Mi score</h3>
            <p className="text-xs text-gray-400 mb-3">Revisa tu puntaje de homologación</p>
            <span className="text-xs text-gray-400">Disponible tras revisión</span>
          </div>
        </div>

        {/* Próximos pasos */}
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Próximos pasos</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-blue-800">
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
              Selecciona el tipo de proveedor en tu perfil
            </li>
            <li className="flex items-center gap-2 text-sm text-blue-800">
              <span className="w-5 h-5 bg-blue-200 text-blue-600 rounded-full flex items-center justify-center text-xs">2</span>
              Carga los documentos requeridos
            </li>
            <li className="flex items-center gap-2 text-sm text-blue-800">
              <span className="w-5 h-5 bg-blue-200 text-blue-600 rounded-full flex items-center justify-center text-xs">3</span>
              Espera la revisión del evaluador
            </li>
          </ul>
        </div>

      </div>
    </div>
  )
}