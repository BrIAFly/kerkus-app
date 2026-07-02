'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createProject } from './actions'
import AppLayout from '@/components/AppLayout'
import type { User } from '@supabase/supabase-js'

type Project = {
  id: string
  name: string
  address: string
  created_at: string
  totalItems: number
  completedItems: number
  activeItemTitle: string | null
  activePhaseName: string | null
}

// Forma cruda que devuelve el select anidado de Supabase, antes de aplanar
// fases/ítems en los contadores de progreso que usa la tarjeta.
type RawProject = {
  id: string
  name: string
  address: string
  created_at: string
  project_phases: {
    status: string
    phase_templates: { name: string } | null
    checklist_items: {
      status: string
      item_templates: { title: string } | null
    }[]
  }[]
}

const EMPTY_FORM = { name: '', address: '' }

export default function ProyectosPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      setUser(session.user)

      // Obtener el tenant_id del perfil del usuario
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

      setTenantId(profile.tenant_id)
      await loadProjects(profile.tenant_id)
      setLoading(false)
    }

    init()
  }, [router])

  async function loadProjects(tid: string) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id, name, address, created_at,
        project_phases (
          status,
          phase_templates ( name ),
          checklist_items (
            status,
            item_templates ( title )
          )
        )
      `)
      .eq('tenant_id', tid)
      .order('created_at', { ascending: false })

    if (error) {
      setFetchError(error.message)
      return
    }

    const raw = (data ?? []) as unknown as RawProject[]

    const mapped: Project[] = raw.map((proj) => {
      const phases = proj.project_phases ?? []
      const allItems = phases.flatMap((phase) => phase.checklist_items ?? [])
      const activeItem = allItems.find((item) => item.status === 'en_progreso')
      const activePhase = phases.find((phase) => phase.status === 'en_progreso')

      return {
        id: proj.id,
        name: proj.name,
        address: proj.address,
        created_at: proj.created_at,
        totalItems: allItems.length,
        completedItems: allItems.filter((item) => item.status === 'completado').length,
        activeItemTitle: activeItem?.item_templates?.title ?? null,
        activePhaseName: activePhase?.phase_templates?.name ?? null,
      }
    })

    setProjects(mapped)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return
    setSaveError(null)
    setSaving(true)

    const { error } = await createProject(form.name, form.address)

    if (error) {
      setSaveError(error)
      setSaving(false)
      return
    }

    setForm(EMPTY_FORM)
    setShowModal(false)
    setSaving(false)
    await loadProjects(tenantId)
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
      <main className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Proyectos</h1>
          <button
            onClick={() => { setShowModal(true); setSaveError(null) }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo proyecto
          </button>
        </div>

        {/* Error de carga */}
        {fetchError && (
          <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg p-4 text-sm mb-6">
            <strong>Error:</strong> {fetchError}
          </div>
        )}

        {/* Lista de proyectos */}
        {!fetchError && projects.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">Todavía no tienes proyectos.</p>
            <p className="text-sm mt-1">Pulsa "Nuevo proyecto" para crear el primero.</p>
          </div>
        )}

        {!fetchError && projects.length > 0 && (
          <div className="flex flex-col gap-3">
            {projects.map((p) => {
              const pct = p.totalItems === 0 ? 0 : Math.round((p.completedItems / p.totalItems) * 100)

              return (
                <Link
                  key={p.id}
                  href={`/proyectos/${p.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all block"
                >
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-gray-900 text-base truncate">{p.name}</h2>
                    {p.address && (
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{p.address}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(p.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="w-full sm:w-80 flex-shrink-0">
                    {p.totalItems === 0 ? (
                      <p className="text-xs text-gray-400 italic">Sin tareas asignadas</p>
                    ) : (
                      <>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1.5">
                          {p.completedItems} de {p.totalItems} ítems completados
                        </p>

                        {p.activeItemTitle && (
                          <p className="text-xs text-gray-500 mt-2 truncate">
                            <span className="text-gray-400">En curso: </span>
                            <span className="font-semibold text-gray-900">{p.activeItemTitle}</span>
                          </p>
                        )}

                        {p.activePhaseName && (
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                            Fase: {p.activePhaseName}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Modal nuevo proyecto */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
              <h2 className="text-lg font-semibold mb-4">Nuevo proyecto</h2>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Edificio Torre Norte"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Calle Mayor 12, Madrid"
                  />
                </div>

                {saveError && (
                  <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm">
                    {saveError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AppLayout>
  )
}
