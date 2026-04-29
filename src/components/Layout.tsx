import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar — logo only */}
        <header className="md:hidden flex items-center px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0 sticky top-0 z-30">
          <span className="text-white font-bold tracking-tight">Nexus</span>
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
