import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth, type Action } from '@/context/AuthContext'
import { LayoutDashboard, Briefcase, Users, Clock, SlidersHorizontal, Folder, FileText, MessageSquare, MoreHorizontal, X } from 'lucide-react'

type NavItem = {
  label: string
  path: string
  action: Action
  icon: React.ReactNode
  iconFilled: React.ReactNode
}

const navItems: NavItem[] = [
  { label: 'Home',      path: '/dashboard', action: 'view:dashboard',     icon: <LayoutDashboard   size={28} strokeWidth={1.5} />, iconFilled: <LayoutDashboard   size={28} strokeWidth={2.5} /> },
  { label: 'Jobs',      path: '/jobs',       action: 'view:jobs:assigned', icon: <Briefcase         size={28} strokeWidth={1.5} />, iconFilled: <Briefcase         size={28} strokeWidth={2.5} /> },
  { label: 'Clock',     path: '/timeclock',  action: 'view:timeclock',     icon: <Clock             size={28} strokeWidth={1.5} />, iconFilled: <Clock             size={28} strokeWidth={2.5} /> },
  { label: 'Estimates', path: '/estimates',  action: 'view:estimates',     icon: <FileText          size={28} strokeWidth={1.5} />, iconFilled: <FileText          size={28} strokeWidth={2.5} /> },
  { label: 'Clients',   path: '/clients',   action: 'view:clients',       icon: <Folder            size={28} strokeWidth={1.5} />, iconFilled: <Folder            size={28} strokeWidth={2.5} /> },
  { label: 'Messages',  path: '/messages',   action: 'view:messages',      icon: <MessageSquare     size={28} strokeWidth={1.5} />, iconFilled: <MessageSquare     size={28} strokeWidth={2.5} /> },
  { label: 'Employees', path: '/employees',  action: 'view:employees',     icon: <Users             size={28} strokeWidth={1.5} />, iconFilled: <Users             size={28} strokeWidth={2.5} /> },
  { label: 'Settings',  path: '/settings',   action: 'manage:settings',    icon: <SlidersHorizontal size={28} strokeWidth={1.5} />, iconFilled: <SlidersHorizontal size={28} strokeWidth={2.5} /> },
]

const MAX_VISIBLE = 4

export default function BottomNav() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const visibleItems = navItems.filter(item => can(item.action))
  const primary = visibleItems.slice(0, MAX_VISIBLE)
  const overflow = visibleItems.slice(MAX_VISIBLE)
  const hasMore = overflow.length > 0
  const overflowActive = overflow.some(item => location.pathname.startsWith(item.path))

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/60">
        <div className="flex items-center" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
          {primary.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex-1 flex items-center justify-center py-4"
            >
              {({ isActive }) => (
                <span className={`transition-colors duration-150 ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                  {isActive ? item.iconFilled : item.icon}
                </span>
              )}
            </NavLink>
          ))}

          {hasMore && (
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex-1 flex items-center justify-center py-4 transition-colors duration-150 ${
                overflowActive ? 'text-white' : 'text-zinc-500'
              }`}
            >
              <MoreHorizontal size={28} strokeWidth={overflowActive ? 2.5 : 1.5} />
            </button>
          )}
        </div>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-0 inset-x-0 z-50 bg-zinc-950 border-t border-zinc-800/60 rounded-t-2xl pb-safe">
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mt-3 mb-1" />
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-sm font-semibold text-white">More</span>
              <button onClick={() => setMoreOpen(false)} className="text-zinc-500 hover:text-zinc-300 p-1">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 px-4 pb-4">
              {overflow.map(item => {
                const isActive = location.pathname.startsWith(item.path)
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMoreOpen(false) }}
                    className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-zinc-900 active:bg-zinc-800 transition-colors"
                  >
                    <span className={isActive ? 'text-white' : 'text-zinc-400'}>
                      {isActive ? item.iconFilled : item.icon}
                    </span>
                    <span className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-zinc-500'}`}>
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
