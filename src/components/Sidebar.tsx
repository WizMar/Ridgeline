import { NavLink } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth, type Action } from '@/context/AuthContext'
import { LayoutDashboard, Briefcase, Users, Clock, SlidersHorizontal, User, LogOut, Folder, FileText } from 'lucide-react'

type NavItem = {
  label: string
  path: string
  action: Action
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: 'Dashboard',  path: '/dashboard', action: 'view:dashboard',      icon: <LayoutDashboard size={18} strokeWidth={1.5} /> },
  { label: 'Clients',   path: '/clients',   action: 'view:clients',        icon: <Folder          size={18} strokeWidth={1.5} /> },
  { label: 'Jobs',       path: '/jobs',       action: 'view:jobs:assigned',  icon: <Briefcase       size={18} strokeWidth={1.5} /> },
  { label: 'Estimates',  path: '/estimates',  action: 'manage:estimates',    icon: <FileText        size={18} strokeWidth={1.5} /> },
  { label: 'Employees',  path: '/employees',  action: 'view:employees',      icon: <Users           size={18} strokeWidth={1.5} /> },
  { label: 'Time Clock', path: '/timeclock',  action: 'view:timeclock',      icon: <Clock           size={18} strokeWidth={1.5} /> },
  { label: 'Settings',   path: '/settings',   action: 'manage:settings',     icon: <SlidersHorizontal size={18} strokeWidth={1.5} /> },
]

export default function Sidebar() {
  const { can, user } = useAuth()

  const visibleItems = navItems.filter(item => can(item.action))

  return (
    <aside className="w-60 min-h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 flex items-center border-b border-zinc-800">
        <span className="text-lg font-bold text-white tracking-tight">Nexus</span>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-stone-500 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User info + Sign Out */}
      <div className="px-3 py-4 border-t border-zinc-800 space-y-1">
        {user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-sm font-medium">{user.name}</p>
            <p className="text-zinc-500 text-xs">{user.role}</p>
          </div>
        )}
        <NavLink
          to="/account"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-stone-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`
          }
        >
          <User size={18} strokeWidth={1.5} />
          My Account
        </NavLink>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors w-full"
        >
          <LogOut size={18} strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
