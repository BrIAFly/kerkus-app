'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toggleChecklistItem } from './actions'
import AppLayout from '@/components/AppLayout'
import type { User } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

type ItemTemplate = {
  title: string
  description: string
  area: string
  risk_level: string
  order_index: number
}

type ChecklistItem = {
  id: string
  status: 'pendiente' | 'completado'
  item_templates: ItemTemplate | null
}

type Phase = {
  id: string
  status: 'en_progreso' | 'bloqueada' | 'completada'
  order_index: number
  phase_templates: { name: string } | null
  checklist_items: ChecklistItem[]
}

type Project = {
  id: string
  name: string
  address: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RISK_BADGE: Record<string, string> = {
  critico:       'bg-red-100 text-red-700 border-red-200',
  importante:    'bg-orange-100 text-orange-700 border-orange-200',
  control_basico:'bg-green-100 text-green-700 border-green-200',
}

const RISK_LABEL: Record<string, string> = {
  critico:       'Crítico',
  importante:    'Importante',
  control_basico:'Control básico',
}

function RiskBadge({ level }: { level: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${RISK_BADGE[level] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {RISK_LABEL[level] ?? level}
    </span>
  )
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">{done} de {total}</span>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null) // itemId en proceso

  const loadData = useCallback(async () => {
    const supabase = createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/login'); return }
    setUser(session.user)

    // Proyecto
    const { data: proj, error: projError } = await supabase
      .from('projects')
      .select('id, name, address')
      .eq('id', id)
      .single()

    if (projError || !proj) { setError('Proyecto no encontrado.'); setLoading(false); return }
    setProject(proj)

    // Fases + ítems (nested select)
    const { data: rawPhases, error: phasesError } = await supabase
      .from('project_phases')
      .select(`
        id, status, order_index,
        phase_templates ( name ),
        checklist_items (
          id, status,
          item_templates ( title, description, area, risk_level, order_index )
        )
      `)
      .eq('project_id', id)
      .order('order_index', { ascending: true })

    if (phasesError) { setError(phasesError.message); setLoading(false); return }

    // El cliente Supabase no está tipado con un esquema generado (sin
    // Database genérico), así que para un select anidado como este infiere
    // las relaciones como arrays en vez de objetos únicos — no coincide con
    // la forma real que devuelve la API en runtime (confirmado por el uso de
    // phase.phase_templates?.name / item.item_templates?.title más abajo).
    // Puenteamos por unknown hacia el tipo Phase[], que sí refleja la forma real.
    const typedPhases = (rawPhases ?? []) as unknown as Phase[]

    // Ordenar ítems por order_index del template (Supabase no ordena nested)
    const sorted: Phase[] = typedPhases.map((phase) => ({
      ...phase,
      checklist_items: [...phase.checklist_items].sort(
        (a, b) =>
          (a.item_templates?.order_index ?? 0) - (b.item_templates?.order_index ?? 0)
      ),
    }))

    setPhases(sorted)
    setLoading(false)
  }, [id, router])

  useEffect(() => { loadData() }, [loadData])

  async function handleToggle(
    item: ChecklistItem,
    phaseId: string,
  ) {
    setToggling(item.id)
    const newStatus = item.status === 'completado' ? 'pendiente' : 'completado'
    const { error } = await toggleChecklistItem(item.id, newStatus, phaseId, id)
    if (error) alert(error)
    await loadData()
    setToggling(null)
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout user={user}>
        <main className="p-8"><p className="text-gray-500">Cargando...</p></main>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout user={user}>
        <main className="p-8">
          <p className="text-red-600">{error}</p>
        </main>
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user}>
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
        {project?.address && (
          <p className="text-sm text-gray-500 mt-0.5">{project.address}</p>
        )}
      </div>

      {/* Fases */}
      {phases.map((phase) => {
        const items = phase.checklist_items
        const done = items.filter((i) => i.status === 'completado').length
        const total = items.length
        const bloqueada = phase.status === 'bloqueada'

        return (
          <section
            key={phase.id}
            className={`rounded-xl border p-5 ${bloqueada ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 shadow-sm'}`}
          >
            {/* Cabecera de fase */}
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <h2 className={`font-semibold text-base ${bloqueada ? 'text-gray-400' : 'text-gray-800'}`}>
                  {phase.phase_templates?.name ?? `Fase ${phase.order_index}`}
                </h2>
                {phase.status === 'completada' && (
                  <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                    Completada
                  </span>
                )}
              </div>
              {!bloqueada && <ProgressBar done={done} total={total} />}
            </div>

            {/* Bloqueada */}
            {bloqueada && (
              <p className="text-sm text-gray-400 italic">
                Bloqueada hasta completar la fase anterior.
              </p>
            )}

            {/* Lista de ítems */}
            {!bloqueada && (
              <ul className="space-y-3 mt-4">
                {items.map((item) => {
                  const tpl = item.item_templates
                  const isToggling = toggling === item.id
                  const done = item.status === 'completado'

                  return (
                    <li
                      key={item.id}
                      className={`flex gap-3 p-3 rounded-lg border transition-colors ${
                        done ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggle(item, phase.id)}
                        disabled={isToggling}
                        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          done
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-gray-300 hover:border-blue-400'
                        } ${isToggling ? 'opacity-50' : ''}`}
                        aria-label={done ? 'Marcar como pendiente' : 'Marcar como completado'}
                      >
                        {done && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-sm font-medium ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {tpl?.title ?? '—'}
                          </span>
                          {tpl?.risk_level && <RiskBadge level={tpl.risk_level} />}
                        </div>
                        {tpl?.area && (
                          <p className="text-xs text-gray-400 mb-1">{tpl.area}</p>
                        )}
                        {tpl?.description && (
                          <p className="text-xs text-gray-500 leading-relaxed">{tpl.description}</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </main>
    </AppLayout>
  )
}
