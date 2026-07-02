export type PlanId = 'starter' | 'pro' | 'enterprise'
export type BillingCycle = 'monthly' | 'quarterly' | 'annual'

// Planes con precio fijo y checkout de autoservicio en Stripe.
// 'enterprise' es a medida (contacto comercial), no tiene priceId de Stripe.
export type CheckoutPlanId = Extract<PlanId, 'starter' | 'pro'>

// `level` ordena los planes de menor a mayor para detectar subidas/bajadas
// de plan sin depender del ciclo de facturación elegido.
export const PLANS: {
  id: PlanId
  name: string
  description: string
  priceEur: number | null
  maxProjects: number | null
  maxUsers: number | null
  level: number
}[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: '1-3 proyectos activos',
    priceEur: 29,
    maxProjects: 3,
    maxUsers: 1,
    level: 1,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Proyectos ilimitados, varios usuarios',
    priceEur: 79,
    maxProjects: null,
    maxUsers: null,
    level: 2,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'A medida',
    priceEur: null,
    maxProjects: null,
    maxUsers: null,
    level: 3,
  },
]

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

// Mismo descuento por ciclo que en BrIAfly: -5% trimestral, -15% anual
// (cobrado en una sola cuota, no es un precio mensual con descuento).
export function calcularPrecioCiclo(monthlyPrice: number, cycle: BillingCycle) {
  if (cycle === 'monthly') {
    return { total: monthlyPrice, monthlyEquivalent: monthlyPrice }
  }
  if (cycle === 'quarterly') {
    const total = round2(monthlyPrice * 3 * 0.95)
    return { total, monthlyEquivalent: round2(total / 3) }
  }
  const total = round2(monthlyPrice * 12 * 0.85)
  return { total, monthlyEquivalent: round2(total / 12) }
}

// Misma convención de nombres de variable de entorno que stripePlans.ts en BrIAfly:
// STRIPE_PRICE_<PLAN>_<CYCLE>, p.ej. STRIPE_PRICE_STARTER_MONTHLY.
export function getPriceId(plan: CheckoutPlanId, cycle: BillingCycle): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`
  const priceId = process.env[key]
  if (!priceId) throw new Error(`Falta la variable de entorno: ${key}`)
  return priceId
}

// Deduce el PlanId de Kerkus a partir de un priceId de Stripe, comparando
// contra las variables STRIPE_PRICE_* configuradas. Se usa en el webhook
// para saber a qué plan pasar el tenant cuando llega un evento de Stripe.
export function planIdFromPriceId(priceId: string): PlanId | null {
  const cycles: BillingCycle[] = ['monthly', 'quarterly', 'annual']
  const checkoutPlans: CheckoutPlanId[] = ['starter', 'pro']
  for (const plan of checkoutPlans) {
    for (const cycle of cycles) {
      const key = `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`
      if (process.env[key] === priceId) return plan
    }
  }
  return null
}
