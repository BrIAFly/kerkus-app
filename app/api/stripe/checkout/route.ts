import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { getPriceId, type BillingCycle, type CheckoutPlanId } from '@/lib/planes'

const VALID_PLANS: CheckoutPlanId[] = ['starter', 'pro']
const VALID_CYCLES: BillingCycle[] = ['monthly', 'quarterly', 'annual']

export async function POST(request: Request) {
  const stripe = getStripe()
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const plan = body?.plan as CheckoutPlanId
  const billingCycle = body?.billingCycle as BillingCycle

  if (!VALID_PLANS.includes(plan) || !VALID_CYCLES.includes(billingCycle)) {
    return NextResponse.json({ error: 'plan o billingCycle inválido' }, { status: 400 })
  }

  let priceId: string
  try {
    priceId = getPriceId(plan, billingCycle)
  } catch (err) {
    console.error('[checkout] price id error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: `Price ID no configurado para ${plan}/${billingCycle}` },
      { status: 500 }
    )
  }

  const userId = userData.user.id
  const email = userData.user.email!

  const admin = createAdminClient()

  // El plan y el customer de Stripe viven en el tenant, no en el profile:
  // varios usuarios comparten el mismo tenant y la misma suscripción.
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.tenant_id) {
    console.error('[checkout] profile/tenant lookup error:', profileError?.message)
    return NextResponse.json({ error: 'No se pudo obtener el tenant del usuario' }, { status: 400 })
  }

  const tenantId: string = profile.tenant_id

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) {
    console.error('[checkout] tenant lookup error:', tenantError?.message)
    return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 })
  }

  let customerId = tenant.stripe_customer_id as string | null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { tenant_id: tenantId },
    })
    customerId = customer.id

    await admin.from('tenants').update({ stripe_customer_id: customerId }).eq('id', tenantId)
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    billing_address_collection: 'required',
    phone_number_collection: { enabled: true },
    tax_id_collection: { enabled: true },
    customer_update: { name: 'auto', address: 'auto' },
    metadata: {
      tenant_id: tenantId,
      plan_id: plan,
      billing_cycle: billingCycle,
    },
    subscription_data: {
      metadata: {
        tenant_id: tenantId,
        plan_id: plan,
        billing_cycle: billingCycle,
      },
    },
    success_url: `${siteUrl}/proyectos?checkout=success`,
    cancel_url: `${siteUrl}/registro?checkout=cancel`,
  })

  return NextResponse.json({ url: session.url })
}
