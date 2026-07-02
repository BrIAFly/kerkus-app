import { createClient } from '@supabase/supabase-js'

// Cliente con service role key — bypasa RLS.
// Solo usar desde Route Handlers / Server Actions, nunca en el cliente.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
