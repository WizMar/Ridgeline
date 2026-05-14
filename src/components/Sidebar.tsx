import { NavLink } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth, type Action } from '@/context/AuthContext'
import { useSettings } from '@/context/SettingsContext'
import { LayoutDashboard, Briefcase, Users, Clock, SlidersHorizontal, User, LogOut, Folder, FileText, MessageSquare, TrendingUp, CalendarDays, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

type NavItem = {
  label: string
  path: string
  action: Action
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: 'Dashboard',  path: '/dashboard', action: 'view:dashboard',      icon: <LayoutDashboard   size={17} strokeWidth={1.5} /> },
  { label: 'Clients',    path: '/clients',   action: 'view:clients',        icon: <Folder            size={17} strokeWidth={1.5} /> },
  { label: 'Jobs',       path: '/jobs',       action: 'view:jobs:assigned',  icon: <Briefcase         size={17} strokeWidth={1.5} /> },
  { label: 'Estimates',  path: '/estimates',  action: 'view:estimates',      icon: <FileText          size={17} strokeWidth={1.5} /> },
  { label: 'Calendar',   path: '/calendar',   action: 'view:calendar',       icon: <CalendarDays      size={17} strokeWidth={1.5} /> },
  { label: 'Revenue',    path: '/revenue',    action: 'view:revenue',        icon: <TrendingUp        size={17} strokeWidth={1.5} /> },
  { label: 'Messages',   path: '/messages',   action: 'view:messages',       icon: <MessageSquare     size={17} strokeWidth={1.5} /> },
  { label: 'Employees',  path: '/employees',  action: 'view:employees',      icon: <Users             size={17} strokeWidth={1.5} /> },
  { label: 'Time Clock', path: '/timeclock',  action: 'view:timeclock',      icon: <Clock             size={17} strokeWidth={1.5} /> },
  { label: 'Settings',   path: '/settings',   action: 'manage:settings',     icon: <SlidersHorizontal size={17} strokeWidth={1.5} /> },
]

type Props = {
  collapsed?: boolean
  onToggle?: () => void
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ collapsed = false, onToggle, isOpen = true, onClose = () => {} }: Props) {
  const { can, user } = useAuth()
  const { settings } = useSettings()
  const visibleItems = navItems.filter(item => can(item.action))
  const logoUrl = settings.company.logoUrl
  const companyName = settings.company.name || 'Nexus'

  return (
    <aside className={`
      fixed md:static inset-y-0 left-0 z-50
      min-h-screen bg-zinc-950 border-r border-zinc-800/60 flex flex-col
      transition-all duration-200 ease-in-out
      ${collapsed ? 'w-[60px]' : 'w-[220px]'}
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      {/* Logo + toggle */}
      <div className={`h-14 flex items-center border-b border-zinc-800/60 shrink-0 ${collapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded object-contain shrink-0 bg-white/5 p-0.5" />
            ) : (
              <div className="h-7 w-7 rounded bg-stone-600 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">{companyName.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <span className="text-sm font-bold text-white truncate">{companyName}</span>
          </div>
        )}
        {collapsed && logoUrl && (
          <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded object-contain bg-white/5 p-0.5" />
        )}
        {collapsed && !logoUrl && (
          <div className="h-7 w-7 rounded bg-stone-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{companyName.charAt(0).toUpperCase()}</span>
          </div>
        )}
        {onToggle && !collapsed && (
          <button
            onClick={onToggle}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors shrink-0"
            title="Collapse"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
        {onToggle && collapsed && (
          <button
            onClick={onToggle}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Expand"
          >
            <PanelLeftOpen size={15} />
          </button>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !collapsed && (
                  <span className="absolute left-0 inset-y-[7px] w-[3px] bg-stone-400 rounded-r-full" />
                )}
                <span className={`transition-colors duration-150 ${isActive ? 'text-stone-300' : ''}`}>
                  {item.icon}
                </span>
                {!collapsed && item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Nexus brand */}
      {!collapsed && (
        <div className="px-4 py-2.5 border-t border-zinc-800/60">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-700">Powered by</p>
          <p className="text-sm font-black tracking-widest text-zinc-500 uppercase leading-tight">Nexus</p>
        </div>
      )}

      {/* User + Sign Out */}
      <div className="px-2 py-3 border-t border-zinc-800/60 space-y-0.5">
        {user && !collapsed && (
          <div className="px-2.5 py-2 mb-1">
            <p className="text-white text-xs font-semibold truncate">{user.name}</p>
            <p className="text-zinc-600 text-xs">{user.role}</p>
          </div>
        )}
        <NavLink
          to="/account"
          onClick={onClose}
          title={collapsed ? 'My Account' : undefined}
          className={({ isActive }) =>
            `relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              collapsed ? 'justify-center' : ''
            } ${
              isActive ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && !collapsed && (
                <span className="absolute left-0 inset-y-[7px] w-[3px] bg-stone-400 rounded-r-full" />
              )}
              <span className={`transition-colors duration-150 ${isActive ? 'text-stone-300' : ''}`}>
                <User size={17} strokeWidth={1.5} />
              </span>
              {!collapsed && 'My Account'}
            </>
          )}
        </NavLink>
        <button
          onClick={() => supabase.auth.signOut()}
          title={collapsed ? 'Sign Out' : undefined}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-all duration-150 w-full ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={17} strokeWidth={1.5} />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </aside>
  )
}
