'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type Row = Record<string, unknown>

export default function TestPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [tenants, setTenants] = useState<Row[]>([])
  const [profiles, setProfiles] = useState<Row[]>([])
  const [errors, setErrors] = useState<{ tenants?: string; profiles?: string }>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const supabase = createClient()

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      setUser(session.user)

      const [tenantsResult, profilesResult] = await Promise.all([
        supabase.from('tenants').select('*'),
        supabase.from('profiles').select('*').eq('id', session.user.id),
      ])

      if (tenantsResult.error) {
        setErrors((e) => ({ ...e, tenants: tenantsResult.error!.message }))
      } else {
        setTenants(tenantsResult.data ?? [])
      }

      if (profilesResult.error) {
        setErrors((e) => ({ ...e, profiles: profilesResult.error!.message }))
      } else {
        setProfiles(profilesResult.data ?? [])
      }

      setLoading(false)
    }

    init()
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <main className="p-8">
        <p className="text-gray-500">Cargando...</p>
      </main>
    )
  }

  return (
    <main className="p-8 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de prueba</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sesión activa: <span className="font-medium text-gray-700">{user?.email}</span>
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Cerrar sesión
        </button>
      </div>

      {/* Tenants */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Tabla: tenants</h2>
        {errors.tenants && <ErrorBox message={errors.tenants} />}
        {!errors.tenants && tenants.length === 0 && <Empty />}
        {!errors.tenants && tenants.length > 0 && <RowList rows={tenants} />}
      </section>

      {/* Profiles */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Tabla: profiles (tu registro)</h2>
        {errors.profiles && <ErrorBox message={errors.profiles} />}
        {!errors.profiles && profiles.length === 0 && <Empty />}
        {!errors.profiles && profiles.length > 0 && <RowList rows={profiles} />}
      </section>
    </main>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm">
      <strong>Error:</strong> {message}
    </div>
  )
}

function Empty() {
  return <p className="text-gray-400 text-sm">Sin registros.</p>
}

function RowList({ rows }: { rows: Row[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((row, i) => (
        <li key={i} className="bg-white border rounded-lg p-4 shadow-sm">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(row, null, 2)}
          </pre>
        </li>
      ))}
    </ul>
  )
}
