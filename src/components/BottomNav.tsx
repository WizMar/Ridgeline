import { NavLink } from 'react-router-dom'
import { useAuth, type Action } from '@/context/AuthContext'
import { LayoutDashboard, Briefcase, Users, Clock, SlidersHorizontal, Folder, FileText, MessageSquare } from 'lucide-react'

type NavItem = {
  label: string
  path: string
  action: Action
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: 'Home',      path: '/dashboard', action: 'view:dashboard',     icon: <LayoutDashboard size={20} strokeWidth={1.5} /> },
  { label: 'Clients',   path: '/clients',   action: 'view:clients',       icon: <Folder          size={20} strokeWidth={1.5} /> },
  { label: 'Jobs',      path: '/jobs',       action: 'view:jobs:assigned', icon: <Briefcase       size={20} strokeWidth={1.5} /> },
  { label: 'Estimates', path: '/estimates',  action: 'manage:estimates',   icon: <FileText        size={20} strokeWidth={1.5} /> },
  { label: 'Messages',  path: '/messages',   action: 'view:messages',      icon: <MessageSquare   size={20} strokeWidth={1.5} /> },
  { label: 'Employees', path: '/employees',  action: 'view:employees',     icon: <Users           size={20} strokeWidth={1.5} /> },
  { label: 'Clock',     path: '/timeclock',  action: 'view:timeclock',     icon: <Clock           size={20} strokeWidth={1.5} /> },
  { label: 'Settings',  path: '/settings',   action: 'manage:settings',    icon: <SlidersHorizontal size={20} strokeWidth={1.5} /> },
]

export default function BottomNav() {
  const { can } = useAuth()
  const visibleItems = navItems.filter(item => can(item.action))

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-zinc-900/95 backdrop-blur border-t border-zinc-800">
      <div className="flex overflow-x-auto scrollbar-none pb-safe">
        {visibleItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 px-2 flex-1 min-w-[56px] transition-colors ${
                isActive ? 'text-stone-300' : 'text-zinc-600 active:text-zinc-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-stone-500/20' : ''}`}>
                  {item.icon}
                </div>
                <span className={`text-[9px] font-semibold leading-none tracking-wide ${isActive ? 'text-stone-400' : ''}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
