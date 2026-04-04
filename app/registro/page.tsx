'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegistroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    razon_social: '',
    ruc: '',
    email: '',
    password: '',
    confirmar_password: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmar_password) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (form.ruc.length !== 11) {
      setError('El RUC debe tener 11 dígitos')
      return
    }

    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (authError) {
      setError('Error al crear la cuenta: ' + authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: dbError } = await supabase
        .from('proveedores')
        .insert({
          user_id: data.user.id,
          razon_social: form.razon_social,
          ruc: form.ruc,
          tipo_id: null,
          estado: 'pendiente',
        })

      if (dbError) {
        setError('Error al guardar los datos: ' + dbError.message)
        setLoading(false)
        return
      }

      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-10">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 w-full max-w-md">

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Registro de proveedor</h1>
          <p className="text-gray-500 text-sm mt-1">Completa tus datos para iniciar el proceso de homologación</p>
        </div>

        <form onSubmit={handleRegistro} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Razón social
            </label>
            <input
              type="text"
              name="razon_social"
              value={form.razon_social}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Empresa SAC"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RUC
            </label>
            <input
              type="text"
              name="ruc"
              value={form.ruc}
              onChange={handleChange}
              maxLength={11}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="20XXXXXXXXX"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="contacto@empresa.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar contraseña
            </label>
            <input
              type="password"
              name="confirmar_password"
              value={form.confirmar_password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Repite tu contraseña"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Registrando...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <a href="/login" className="text-blue-600 hover:underline font-medium">
              Inicia sesión
            </a>
          </p>
        </div>

      </div>
    </div>
  )
}