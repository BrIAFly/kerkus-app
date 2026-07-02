import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanId } from '@/lib/planes'

const VALID_PLANS: PlanId[] = ['starter', 'pro', 'enterprise']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const plan = body?.plan as PlanId

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'plan inválido' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('tenant_id')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile?.tenant_id) {
    console.error('[suscripcion/simular] profile lookup error:', profileError?.message)
    return NextResponse.json({ error: 'No se pudo obtener el tenant del usuario' }, { status: 400 })
  }

  const { error: updateError } = await admin
    .from('tenants')
    .update({ plan })
    .eq('id', profile.tenant_id)

  if (updateError) {
    console.error('[suscripcion/simular] tenant update error:', updateError.message)
    return NextResponse.json({ error: 'No se pudo actualizar el plan' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
