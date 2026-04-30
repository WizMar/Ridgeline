import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { useSettings } from '@/context/SettingsContext'

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { settings } = useSettings()
  const logoUrl = settings.company.logoUrl
  const companyName = settings.company.name || 'Nexus'

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded object-contain bg-white/5 p-0.5 shrink-0" />
            ) : (
              <div className="h-7 w-7 rounded bg-stone-600 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">{companyName.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <span className="text-white font-bold text-sm tracking-tight truncate">{companyName}</span>
          </div>
          <span className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-600">Nexus</span>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}
