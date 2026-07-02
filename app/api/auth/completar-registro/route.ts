import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanId } from '@/lib/planes'

const VALID_PLANS: PlanId[] = ['starter', 'pro', 'enterprise']

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { full_name, company_name, email, password, plan } = body

  if (!company_name || typeof company_name !== 'string') {
    return NextResponse.json({ error: 'company_name requerido' }, { status: 400 })
  }
  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return NextResponse.json({ error: 'email y password requeridos' }, { status: 400 })
  }
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'plan inválido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Se crea con la API admin (email_confirm: true) en vez de signUp() normal
  // para que la cuenta quede utilizable de inmediato en esta demo, sin
  // depender de si el proyecto de Supabase exige confirmación de email.
  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createUserError || !createdUser.user) {
    return NextResponse.json({ error: createUserError?.message || 'No se pudo crear el usuario' }, { status: 400 })
  }

  const userId = createdUser.user.id

  // Cliente ligado a las cookies de la request: signInWithPassword() aquí
  // deja la sesión activa en el navegador, así /proyectos puede leerla justo
  // después de este POST.
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError) {
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: signInError.message }, { status: 400 })
  }

  // Cada registro crea una empresa (tenant) nueva. El usuario que la crea
  // queda como admin_tenant de ese tenant. Sin stripe_customer_id: en esta
  // demo el plan se activa directamente, sin pasar por Stripe.
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({ name: company_name, plan })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    console.error('[completar-registro] tenant insert error:', tenantError?.message)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'No se pudo crear la empresa' }, { status: 500 })
  }

  // upsert porque un trigger de Supabase puede haber creado ya una fila
  // stub en profiles al hacer createUser() — así cubrimos ambos casos.
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: userId,
      tenant_id: tenant.id,
      full_name: full_name || null,
      role: 'admin_tenant',
    })

  if (profileError) {
    console.error('[completar-registro] profile upsert error:', profileError.message)
    // Sin profile no queremos un tenant huérfano ni un usuario a medio crear.
    await admin.from('tenants').delete().eq('id', tenant.id)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'No se pudo crear el perfil del usuario' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
