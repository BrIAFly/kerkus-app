import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { planIdFromPriceId, type PlanId } from '@/lib/planes'

export async function POST(request: Request) {
  const stripe = getStripe()
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET no configurado')
    return NextResponse.json({ error: 'Webhook secret no configurado' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature!, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Firma inválida'
    console.error('[webhook] constructEvent error:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      // El tenant ya existe (se crea en /api/auth/completar-registro antes del
      // checkout) — aquí solo confirmamos el customer y activamos el plan.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription' || !session.subscription) break

        const tenantId = session.metadata?.tenant_id
        if (!tenantId) {
          console.error('[webhook] checkout.session.completed: tenant_id ausente en metadata')
          break
        }

        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = sub.items.data[0]?.price?.id

        const planId: PlanId | undefined =
          (sub.metadata?.plan_id as PlanId | undefined) ??
          (session.metadata?.plan_id as PlanId | undefined) ??
          (priceId ? planIdFromPriceId(priceId) ?? undefined : undefined)

        if (!planId) {
          console.error('[webhook] checkout.session.completed: no se pudo resolver el plan — tenant=%s priceId=%s', tenantId, priceId)
          break
        }

        const { error } = await admin
          .from('tenants')
          .update({ stripe_customer_id: sub.customer as string, plan: planId })
          .eq('id', tenantId)

        if (error) console.error('[webhook] checkout.session.completed update error:', error.message)
        else console.log(`[webhook] checkout.session.completed: tenant ${tenantId} → plan=${planId}`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const priceId = sub.items.data[0]?.price?.id

        // Resolver el plan: primero desde metadata (suscripciones creadas por
        // nosotros), después cruzando el price_id contra las variables
        // STRIPE_PRICE_* (cambios de plan hechos desde el portal de Stripe).
        const planId: PlanId | undefined =
          (sub.metadata?.plan_id as PlanId | undefined) ??
          (priceId ? planIdFromPriceId(priceId) ?? undefined : undefined)

        if (!planId) {
          console.error('[webhook] subscription.updated: no se pudo resolver el plan — customer=%s priceId=%s', customerId, priceId)
          break
        }

        const { error } = await admin
          .from('tenants')
          .update({ plan: planId })
          .eq('stripe_customer_id', customerId)

        if (error) console.error('[webhook] subscription.updated error:', error.message)
        else console.log(`[webhook] subscription.updated: customer=${customerId} plan=${planId} status=${sub.status}`)
        break
      }

      // No borramos datos del tenant: solo degradamos el plan a starter.
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        const { error } = await admin
          .from('tenants')
          .update({ plan: 'starter' satisfies PlanId })
          .eq('stripe_customer_id', customerId)

        if (error) console.error('[webhook] subscription.deleted error:', error.message)
        else console.log(`[webhook] subscription.deleted: customer=${customerId} → plan=starter`)
        break
      }

      default:
        // Evento no manejado — ignorar silenciosamente
        break
    }
  } catch (err) {
    console.error(`[webhook] error procesando ${event.type}:`, err instanceof Error ? err.message : err)
    // Responder 200 para que Stripe no reintente: el error está logueado.
  }

  return NextResponse.json({ received: true })
}
