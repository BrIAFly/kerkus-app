import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'

export async function POST() {
  const stripe = getStripe()
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const admin = createAdminClient()

  // El customer de Stripe vive en el tenant, no en el profile.
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('tenant_id')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile?.tenant_id) {
    console.error('[portal] profile/tenant lookup error:', profileError?.message)
    return NextResponse.json({ error: 'No se pudo obtener el tenant del usuario' }, { status: 400 })
  }

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', profile.tenant_id)
    .single()

  const stripeCustomerId = tenant?.stripe_customer_id as string | null

  if (tenantError || !stripeCustomerId) {
    return NextResponse.json(
      { error: 'Este tenant no tiene una suscripción de Stripe activa' },
      { status: 400 }
    )
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${siteUrl}/proyectos`,
  })

  return NextResponse.json({ url: session.url })
}
