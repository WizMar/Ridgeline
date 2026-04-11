import { createContext, useContext, useState, useEffect } from 'react'
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

type AuthContextType = {
  session: Session | null
  user: AuthUser | null
  loading: boolean
  can: (action: Action) => boolean
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

const ROLE_PERMISSIONS: Record<UserRole, Action[]> = {
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

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(session: import('@supabase/supabase-js').Session) {
    const fallback = () => {
      const meta = session.user.user_metadata ?? {}
      setUser({
        id: session.user.id,
        email: session.user.email ?? '',
        name: (meta.name as string) ?? session.user.email ?? '',
        role: (meta.role as UserRole) ?? 'Laborer',
        org_id: (meta.org_id as string) ?? null,
      })
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

      if (!result) {
        fallback()
        return
      }

      const { data: profile, error } = result

      if (error || !profile) {
        fallback()
        return
      }

      setUser({
        id: session.user.id,
        email: session.user.email ?? '',
        name: profile.name ?? session.user.email ?? '',
        role: (profile.role as UserRole) ?? 'Admin',
        org_id: profile.org_id ?? null,
      })
    } catch {
      fallback()
    }
  }

  useEffect(() => {
    // Get initial session on mount
    const timeout = setTimeout(() => setLoading(false), 5000)

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout)
      setSession(session)
      if (session) {
        await loadProfile(session)
      }
      setLoading(false)
    })

    // Listen for auth changes after that
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        await loadProfile(session)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  function can(action: Action): boolean {
    if (!user) return false
    return ROLE_PERMISSIONS[user.role]?.includes(action) ?? false
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
