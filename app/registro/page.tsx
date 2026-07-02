'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PLANS, type PlanId } from '@/lib/planes'

export default function RegistroPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('starter')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/auth/completar-registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        company_name: companyName,
        email,
        password,
        plan: selectedPlan,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.ok) {
      setError(data.error || 'No se pudo completar el registro.')
      setLoading(false)
      return
    }

    router.push('/proyectos')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 py-12">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-900">Crear cuenta en Kerkus</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la empresa
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre de tu empresa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Elige tu plan
            </label>
            <div className="grid grid-cols-3 gap-3">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    selectedPlan === plan.id
                      ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{plan.name}</p>
                  <p className="text-sm font-semibold text-blue-600">
                    {plan.priceEur != null
                      ? <>{plan.priceEur}€<span className="text-xs font-normal text-gray-500">/mes</span></>
                      : 'A medida'}
                  </p>
                  <p className="text-xs text-gray-500">{plan.description}</p>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Creando cuenta...' : 'Registrarme'}
          </button>

          <p className="text-center text-sm text-gray-600">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:underline">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}
