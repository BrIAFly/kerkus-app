import Stripe from 'stripe'

let _stripe: Stripe | null = null

// Cliente perezoso: si se instanciara al cargar el módulo, `next build`
// revienta al recolectar page data de las rutas /api/stripe/* en cuanto
// STRIPE_SECRET_KEY no está definida (p. ej. en un build sin esa env var).
export function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY no definida')
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-06-24.dahlia',
    })
  }
  return _stripe
}
