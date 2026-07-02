'use server'

import { createClient } from '@/lib/supabase/server'

export async function toggleChecklistItem(
  itemId: string,
  newStatus: 'pendiente' | 'completado',
  phaseId: string,
  projectId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No hay sesión activa.' }

  // 1. Actualizar el status del ítem
  const { error: itemError } = await supabase
    .from('checklist_items')
    .update({ status: newStatus })
    .eq('id', itemId)

  if (itemError) return { error: `Error actualizando ítem: ${itemError.message}` }

  // 2. Comprobar si todos los ítems de la fase están completados
  const { data: allItems, error: fetchError } = await supabase
    .from('checklist_items')
    .select('status')
    .eq('project_phase_id', phaseId)

  if (fetchError) return { error: `Error verificando progreso: ${fetchError.message}` }

  const allCompleted = allItems?.every((i) => i.status === 'completado') ?? false

  if (allCompleted) {
    // Marcar la fase actual como completada
    const { error: completeError } = await supabase
      .from('project_phases')
      .update({ status: 'completada' })
      .eq('id', phaseId)

    if (completeError) return { error: `Error completando fase: ${completeError.message}` }

    // Obtener el order_index de la fase actual para encontrar la siguiente
    const { data: currentPhase } = await supabase
      .from('project_phases')
      .select('order_index')
      .eq('id', phaseId)
      .single()

    if (currentPhase) {
      // Desbloquear la siguiente fase (la de order_index más bajo que sea mayor al actual)
      const { data: nextPhase } = await supabase
        .from('project_phases')
        .select('id, status')
        .eq('project_id', projectId)
        .gt('order_index', currentPhase.order_index)
        .order('order_index', { ascending: true })
        .limit(1)
        .single()

      if (nextPhase && nextPhase.status === 'bloqueada') {
        const { error: unlockError } = await supabase
          .from('project_phases')
          .update({ status: 'en_progreso' })
          .eq('id', nextPhase.id)

        if (unlockError) return { error: `Error desbloqueando siguiente fase: ${unlockError.message}` }
      }
    }
  } else if (newStatus === 'pendiente') {
    // Si se desmarca un ítem y la fase estaba completada, volver a en_progreso
    // (no se vuelve a bloquear la fase siguiente si ya avanzó)
    const { error: revertError } = await supabase
      .from('project_phases')
      .update({ status: 'en_progreso' })
      .eq('id', phaseId)
      .eq('status', 'completada')

    if (revertError) return { error: `Error revirtiendo fase: ${revertError.message}` }
  }

  return {}
}
