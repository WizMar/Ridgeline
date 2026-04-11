import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export type UserRole = 'Laborer' | 'Employee' | 'Lead' | 'Sales' | 'Sub-Admin' | 'Admin'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: UserRole
  org_id: string | null
}

export type Action =
  | 'view:dashboard'
  | 'view:timeclock'
  | 'view:jobs:assigned'
  | 'view:jobs:all'
  | 'create:jobs'
  | 'view:estimates'
  | 'create:estimates'
  | 'view:employees'
  | 'manage:employees'
  | 'view:settings'
  | 'manage:settings'
  | 'invite:members'
  | 'manage:timeclock'
  | 'approve:edits'

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Action[]> = {
  Laborer: [
    'view:timeclock',
  ],
  Employee: [
    'view:timeclock',
  ],
  Lead: [
    'view:dashboard',
    'view:timeclock',
    'manage:timeclock',
    'view:jobs:assigned',
    'view:jobs:all',
  ],
  Sales: [
    'view:dashboard',
    'view:timeclock',
    'view:jobs:all',
    'create:jobs',
    'view:estimates',
    'create:estimates',
  ],
  'Sub-Admin': [
    'view:dashboard',
    'view:timeclock',
    'manage:timeclock',
    'approve:edits',
    'view:jobs:assigned',
    'view:jobs:all',
    'create:jobs',
    'view:estimates',
    'view:employees',
    'invite:members',
  ],
  Admin: [
    'view:dashboard',
    'view:timeclock',
    'manage:timeclock',
    'approve:edits',
    'view:jobs:assigned',
    'view:jobs:all',
    'create:jobs',
    'view:estimates',
    'create:estimates',
    'view:employees',
    'manage:employees',
    'view:settings',
    'manage:settings',
    'invite:members',
  ],
}

type AuthContextType = {
  session: Session | null
  user: AuthUser | null
  loading: boolean
  can: (action: Action) => boolean
  refreshPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [customPermissions, setCustomPermissions] = useState<Partial<Record<UserRole, Action[]>>>({})
  const userRef = useRef<AuthUser | null>(null)

  // Keep ref in sync so refreshPermissions can access current user without stale closure
  useEffect(() => { userRef.current = user }, [user])

  async function loadPermissions(orgId: string) {
    const { data } = await supabase
      .from('settings')
      .select('role_permissions')
      .eq('org_id', orgId)
      .single()
    const rp = data?.role_permissions
    if (rp && typeof rp === 'object' && Object.keys(rp).length > 0) {
      setCustomPermissions(rp as Partial<Record<UserRole, Action[]>>)
    } else {
      setCustomPermissions({})
    }
  }

  async function refreshPermissions() {
    const orgId = userRef.current?.org_id
    if (orgId) await loadPermissions(orgId)
  }

  async function loadProfile(session: import('@supabase/supabase-js').Session) {
    const fallback = () => {
      const meta = session.user.user_metadata ?? {}
      const u = {
        id: session.user.id,
        email: session.user.email ?? '',
        name: (meta.name as string) ?? session.user.email ?? '',
        role: (meta.role as UserRole) ?? 'Laborer',
        org_id: (meta.org_id as string) ?? null,
      }
      setUser(u)
      userRef.current = u
    }

    try {
      const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 3000))
      const query = supabase
        .from('profiles')
        .select('name, role, org_id')
        .eq('id', session.user.id)
        .single()
        .then(r => r)

      const result = await Promise.race([query, timeout])

      if (!result) { fallback(); return }

      const { data: profile, error } = result
      if (error || !profile) { fallback(); return }

      const u = {
        id: session.user.id,
        email: session.user.email ?? '',
        name: profile.name ?? session.user.email ?? '',
        role: (profile.role as UserRole) ?? 'Admin',
        org_id: profile.org_id ?? null,
      }
      setUser(u)
      userRef.current = u

      if (profile.org_id) await loadPermissions(profile.org_id)
    } catch {
      fallback()
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout)
      setSession(session)
      if (session) await loadProfile(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        await loadProfile(session)
      } else {
        setUser(null)
        setCustomPermissions({})
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  function can(action: Action): boolean {
    if (!user) return false
    const perms = Object.keys(customPermissions).length > 0 ? customPermissions : DEFAULT_ROLE_PERMISSIONS
    return (perms[user.role] ?? DEFAULT_ROLE_PERMISSIONS[user.role] ?? []).includes(action)
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, can, refreshPermissions }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
