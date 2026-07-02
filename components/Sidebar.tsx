'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0" />
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

const NAV_ITEMS = [
  { href: '/proyectos', label: 'Proyectos', icon: FolderIcon },
  { href: '/cuenta', label: 'Mi cuenta', icon: UserIcon },
]

export default function Sidebar({ user }: { user: User | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col bg-gray-900 text-gray-100">
        <div className="px-5 py-5 border-b border-gray-800">
          <span className="text-lg font-bold tracking-tight text-white">Kerkus</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium border-l-2 transition-colors ${
                  active
                    ? 'bg-gray-800 text-white border-blue-500'
                    : 'border-transparent text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-gray-800 px-4 py-4">
          <p className="mb-2 truncate text-xs text-gray-400">{user?.email}</p>
          <button
            onClick={handleSignOut}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Sidebar fijo en escritorio */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:block md:w-60">
        <SidebarContent />
      </aside>

      {/* Botón hamburguesa en móvil */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg bg-gray-900 p-2 text-white shadow-lg md:hidden"
        aria-label="Abrir menú"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="relative w-60 flex-shrink-0">
            <SidebarContent />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-gray-300 hover:bg-gray-800 hover:text-white"
              aria-label="Cerrar menú"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}
