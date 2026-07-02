import Sidebar from './Sidebar'
import type { User } from '@supabase/supabase-js'
import type { ReactNode } from 'react'

export default function AppLayout({ user, children }: { user: User | null; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <div className="md:pl-60">{children}</div>
    </div>
  )
}
