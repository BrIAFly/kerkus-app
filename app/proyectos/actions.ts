'use server'

import { createClient } from '@/lib/supabase/server'

export async function createProject(name: string, address: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No hay sesión activa.' }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', session.user.id)
    .single()

  if (profileError || !profile?.tenant_id) {
    return { error: 'No se pudo obtener el tenant del usuario.' }
  }

  const tenantId: string = profile.tenant_id

  // 1. Insertar proyecto
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({ name, address, tenant_id: tenantId })
    .select('id')
    .single()

  if (projectError) {
    return { error: `Error creando proyecto: ${projectError.message}` }
  }

  // 2. Cargar plantillas de fases: propias del tenant o globales (tenant_id IS NULL).
  //    .eq('tenant_id', tenantId) nunca matchea filas con tenant_id NULL en SQL,
  //    así que hace falta un OR explícito para incluir las plantillas globales.
  const { data: phaseTemplates, error: phaseTplError } = await supabase
    .from('phase_templates')
    .select('id, order_index')
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order('order_index', { ascending: true })

  if (phaseTplError) {
    return { error: `Error cargando plantillas de fases: ${phaseTplError.message}` }
  }

  if (!phaseTemplates || phaseTemplates.length === 0) return {}

  const minPhaseOrderIndex = phaseTemplates[0].order_index

  // 3. Crear fases e ítems
  for (const phaseTpl of phaseTemplates) {
    const phaseStatus = phaseTpl.order_index === minPhaseOrderIndex ? 'en_progreso' : 'bloqueada'

    const { data: phase, error: phaseError } = await supabase
      .from('project_phases')
      .insert({
        project_id: project.id,
        phase_template_id: phaseTpl.id,
        status: phaseStatus,
        order_index: phaseTpl.order_index,
      })
      .select('id')
      .single()

    if (phaseError) {
      return { error: `Error creando fase (template ${phaseTpl.id}): ${phaseError.message}` }
    }

    // 4. Cargar item_templates de esta fase ordenados
    const { data: itemTemplates, error: itemTplError } = await supabase
      .from('item_templates')
      .select('id')
      .eq('phase_template_id', phaseTpl.id)
      .order('order_index', { ascending: true })

    if (itemTplError) {
      return { error: `Error cargando ítems de plantilla (fase ${phaseTpl.id}): ${itemTplError.message}` }
    }

    if (!itemTemplates || itemTemplates.length === 0) continue

    // 5. Insertar checklist_items: primero 'en_progreso', resto 'bloqueado'
    //    El array ya viene ordenado por order_index asc, así que index 0 = primer ítem.
    //    Usamos .select() para recuperar los IDs generados.
    const { data: createdItems, error: itemsError } = await supabase
      .from('checklist_items')
      .insert(
        itemTemplates.map((tpl, index) => ({
          project_phase_id: phase.id,
          item_template_id: tpl.id,
          status: index === 0 ? 'en_progreso' : 'bloqueado',
        }))
      )
      .select('id, item_template_id')

    if (itemsError) {
      return { error: `Error creando ítems (fase ${phaseTpl.id}): ${itemsError.message}` }
    }

    if (!createdItems || createdItems.length === 0) continue

    // 6. Cargar sub_item_templates de todos los ítems de esta fase en una sola consulta
    const itemTemplateIds = createdItems.map((i) => i.item_template_id)

    const { data: subTemplates, error: subTplError } = await supabase
      .from('sub_item_templates')
      .select('id, item_template_id')
      .in('item_template_id', itemTemplateIds)
      .order('order_index', { ascending: true })

    if (subTplError) {
      return { error: `Error cargando sub-plantillas (fase ${phaseTpl.id}): ${subTplError.message}` }
    }

    if (!subTemplates || subTemplates.length === 0) continue

    // Mapa item_template_id → checklist_item.id para el join
    const itemMap = new Map(createdItems.map((i) => [i.item_template_id, i.id]))

    const subitems = subTemplates.map((sub) => ({
      checklist_item_id: itemMap.get(sub.item_template_id),
      sub_item_template_id: sub.id,
      status: 'pendiente',
    }))

    const { error: subitemsError } = await supabase
      .from('checklist_subitems')
      .insert(subitems)

    if (subitemsError) {
      return { error: `Error creando sub-ítems (fase ${phaseTpl.id}): ${subitemsError.message}` }
    }
  }

  return {}
}
