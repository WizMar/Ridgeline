import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth, type UserRole, type Action } from '@/context/AuthContext'

export type PayPeriodType = 'weekly' | 'biweekly' | 'semimonthly'

export type DashboardVisibility = {
  summaryCards: boolean
  jobsChart: boolean
  hoursChart: boolean
  quickActions: boolean
  recentJobs: boolean
}

const DEFAULT_DASHBOARD_VISIBILITY: DashboardVisibility = {
  summaryCards: true,
  jobsChart: true,
  hoursChart: true,
  quickActions: true,
  recentJobs: true,
}

export { DEFAULT_DASHBOARD_VISIBILITY }

export type AppSettings = {
  company: {
    name: string
    phone: string
    email: string
    address: string
    license: string
    website: string
    logoUrl: string
    trade: string
    timezone: string
  }
  pricing: {
    wastePct: string
    markupPct: string
    laborPerSq: string
    tearoffRate: string
    hourlyRate: string
    burdenPct: string
  }
  payPeriod: {
    type: PayPeriodType
    weeklyStartDay: number
    biweeklyAnchor: string
  }
  notifications: {
    emailNewJob: boolean
    emailClockIn: boolean
    emailEditRequest: boolean
    emailInviteAccepted: boolean
  }
  rolePermissions: Partial<Record<UserRole, Action[]>>
  dashboardVisibility: Partial<Record<UserRole, DashboardVisibility>>
}

const defaultSettings: AppSettings = {
  company: { name: '', phone: '', email: '', address: '', license: '', website: '', logoUrl: '', trade: '', timezone: 'America/Los_Angeles' },
  pricing: { wastePct: '10', markupPct: '30', laborPerSq: '85', tearoffRate: '35', hourlyRate: '45', burdenPct: '35' },
  payPeriod: { type: 'biweekly', weeklyStartDay: 1, biweeklyAnchor: new Date().toISOString().split('T')[0] },
  notifications: { emailNewJob: true, emailClockIn: false, emailEditRequest: true, emailInviteAccepted: true },
  rolePermissions: {},
  dashboardVisibility: {},
}

function loadFromStorage(key: string, fallback: AppSettings): AppSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '')
    const merged: AppSettings = {
      company: { ...fallback.company, ...stored.company },
      pricing: { ...fallback.pricing, ...stored.pricing },
      payPeriod: { ...fallback.payPeriod, ...stored.payPeriod },
      notifications: { ...fallback.notifications, ...stored.notifications },
      rolePermissions: stored.rolePermissions ?? {},
      dashboardVisibility: stored.dashboardVisibility ?? {},
    }
    delete (merged.payPeriod as Record<string, unknown>).startDate
    delete (merged.payPeriod as Record<string, unknown>).endDate
    return merged
  } catch { return fallback }
}

function mergeFromDB(row: Record<string, unknown>, fallback: AppSettings): AppSettings {
  return {
    company: { ...fallback.company, ...(row.company as object ?? {}) },
    pricing: { ...fallback.pricing, ...(row.pricing as object ?? {}) },
    payPeriod: { ...fallback.payPeriod, ...(row.pay_period as object ?? {}) },
    notifications: { ...fallback.notifications, ...(row.notifications as object ?? {}) },
    rolePermissions: (row.role_permissions as Partial<Record<UserRole, Action[]>>) ?? {},
    dashboardVisibility: (row.dashboard_visibility as Partial<Record<UserRole, DashboardVisibility>>) ?? {},
  }
}

type SettingsContextType = {
  settings: AppSettings
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>
  saveSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshPermissions } = useAuth()
  const [settings, setSettings] = useState<AppSettings>(() => loadFromStorage('rl_settings', defaultSettings))

  useEffect(() => {
    if (!user?.org_id) return
    supabase
      .from('settings')
      .select('company, pricing, pay_period, notifications, role_permissions, dashboard_visibility')
      .eq('org_id', user.org_id)
      .single()
      .then(({ data }) => {
        if (data) {
          const merged = mergeFromDB(data as Record<string, unknown>, defaultSettings)
          setSettings(merged)
          localStorage.setItem('rl_settings', JSON.stringify(merged))
        }
      })
  }, [user?.org_id])

  const saveSettings = useCallback(async () => {
    if (!user?.org_id) return
    const payload = {
      org_id: user.org_id,
      company: settings.company,
      pricing: settings.pricing,
      pay_period: settings.payPeriod,
      notifications: settings.notifications,
      role_permissions: settings.rolePermissions,
      dashboard_visibility: settings.dashboardVisibility,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'org_id' })
    if (!error) {
      localStorage.setItem('rl_settings', JSON.stringify(settings))
      await refreshPermissions()
    }
  }, [user?.org_id, settings, refreshPermissions])

  return (
    <SettingsContext.Provider value={{ settings, setSettings, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function getPayPeriodRange(settings: AppSettings): { start: string; end: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { type, weeklyStartDay, biweeklyAnchor } = settings.payPeriod

  if (type === 'weekly') {
    const day = today.getDay()
    const diff = (day - weeklyStartDay + 7) % 7
    const start = new Date(today)
    start.setDate(today.getDate() - diff)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: toISO(start), end: toISO(end) }
  }

  if (type === 'semimonthly') {
    const d = today.getDate()
    const ym = toISO(today).slice(0, 7)
    if (d <= 15) {
      return { start: `${ym}-01`, end: `${ym}-15` }
    } else {
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
      return { start: `${ym}-16`, end: `${ym}-${String(lastDay).padStart(2, '0')}` }
    }
  }

  const anchor = new Date(biweeklyAnchor)
  anchor.setHours(0, 0, 0, 0)
  const msPerDay = 86400000
  const daysSinceAnchor = Math.floor((today.getTime() - anchor.getTime()) / msPerDay)
  const daysIntoPeriod = ((daysSinceAnchor % 14) + 14) % 14
  const start = new Date(today.getTime() - daysIntoPeriod * msPerDay)
  const end = new Date(start.getTime() + 13 * msPerDay)
  return { start: toISO(start), end: toISO(end) }
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
