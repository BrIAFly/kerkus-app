'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PLANS, type PlanId } from '@/lib/planes'
import AppLayout from '@/components/AppLayout'
import type { User } from '@supabase/supabase-js'

const PLAN_BADGE_CLASSES: Record<PlanId, string> = {
  starter: 'bg-gray-100 text-gray-700',
  pro: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
}

export default function CuentaPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [tenantName, setTenantName] = useState('')
  const [plan, setPlan] = useState<PlanId | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [updatingPlan, setUpdatingPlan] = useState<PlanId | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      setUser(session.user)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', session.user.id)
        .single()

      if (profileError || !profile?.tenant_id) {
        setFetchError('No se pudo obtener el tenant del usuario.')
        setLoading(false)
        return
      }

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('name, plan')
        .eq('id', profile.tenant_id)
        .single()

      if (tenantError || !tenant) {
        setFetchError('No se pudo obtener la información de la empresa.')
        setLoading(false)
        return
      }

      setTenantName(tenant.name)
      setPlan(tenant.plan as PlanId)
      setLoading(false)
    }

    init()
  }, [router])

  async function handleActivar(newPlan: PlanId) {
    setActionError(null)
    setUpdatingPlan(newPlan)

    const res = await fetch('/api/suscripcion/simular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: newPlan }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || !data.ok) {
      setActionError(data.error || 'No se pudo activar el plan.')
      setUpdatingPlan(null)
      return
    }

    window.location.reload()
  }

  if (loading) {
    return (
      <AppLayout user={user}>
        <main className="p-8">
          <p className="text-gray-500">Cargando...</p>
        </main>
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user}>
      <main className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Mi cuenta</h1>

        {fetchError && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg p-4 text-sm mb-6">
            {fetchError}
          </div>
        )}

        {!fetchError && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-6">
            <div>
              <p className="text-sm text-gray-500">Empresa</p>
              <p className="text-lg font-semibold text-gray-900">{tenantName}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">Plan activo</p>
              {plan && (
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${PLAN_BADGE_CLASSES[plan]}`}>
                  {PLANS.find((p) => p.id === plan)?.name ?? plan}
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-3">Simular cambio de plan (demo, sin Stripe)</p>

              {actionError && (
                <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm mb-3">
                  {actionError}
                </div>
              )}

              <div className="flex gap-3 flex-wrap">
                {PLANS.map((p) => {
                  const isCurrent = plan === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleActivar(p.id)}
                      disabled={updatingPlan !== null || isCurrent}
                      className={`text-sm font-medium px-4 py-2 rounded-lg border transition-colors disabled:cursor-default ${
                        isCurrent
                          ? 'bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-500/50'
                          : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700 disabled:opacity-50'
                      }`}
                    >
                      {updatingPlan === p.id
                        ? 'Activando...'
                        : isCurrent
                          ? `${p.name} (activo)`
                          : `Activar ${p.name}`}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </AppLayout>
  )
}
