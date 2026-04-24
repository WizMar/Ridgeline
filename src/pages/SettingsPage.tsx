import { useState, useEffect } from 'react'
import { ChevronRight, ArrowLeft, Building2, DollarSign, Calendar, Shield, Bell, CreditCard, AlertTriangle, Check, LayoutDashboard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useSettings, getPayPeriodRange, type PayPeriodType, type DashboardVisibility, DEFAULT_DASHBOARD_VISIBILITY, DAY_NAMES } from '@/context/SettingsContext'
import { useAuth, DEFAULT_ROLE_PERMISSIONS, type UserRole, type Action } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

const TRADES = [
  'Roofing', 'HVAC', 'Plumbing', 'Electrical', 'General Contractor',
  'Landscaping', 'Painting', 'Flooring', 'Concrete', 'Fencing', 'Other',
]

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
]

// Maps human label -> Action key. Admin column is locked (always full access).
const PERMISSION_ROWS: { label: string; action: Action; lockForAdmin?: boolean }[] = [
  { label: 'Dashboard',         action: 'view:dashboard' },
  { label: 'Time Clock',        action: 'view:timeclock' },
  { label: 'Manage Time',       action: 'manage:timeclock' },
  { label: 'Approve Edits',     action: 'approve:edits' },
  { label: 'View All Jobs',     action: 'view:jobs:all' },
  { label: 'Create Jobs',       action: 'create:jobs' },
  { label: 'View Estimates',    action: 'view:estimates' },
  { label: 'Create Estimates',  action: 'create:estimates' },
  { label: 'View Employees',    action: 'view:employees' },
  { label: 'Manage Employees',  action: 'manage:employees' },
  { label: 'Invite Members',    action: 'invite:members' },
  { label: 'Settings',          action: 'manage:settings' },
]

const ROLE_NAMES: UserRole[] = ['Admin', 'Sub-Admin', 'Lead', 'Sales', 'Employee', 'Laborer']

const DASHBOARD_WIDGETS: { key: keyof DashboardVisibility; label: string; description: string }[] = [
  { key: 'summaryCards', label: 'Summary Cards',    description: 'Active jobs, clocked in, estimates, revenue' },
  { key: 'jobsChart',    label: 'Jobs by Status',   description: 'Pie chart showing job status distribution' },
  { key: 'hoursChart',   label: 'Hours This Period', description: 'Bar chart of hours logged per employee' },
  { key: 'quickActions', label: 'Quick Actions',    description: 'Shortcut buttons to create jobs, estimates, etc.' },
  { key: 'recentJobs',   label: 'Recent Jobs',      description: 'Table of the 5 most recently created jobs' },
]

type Section = 'company' | 'pricing' | 'payperiod' | 'roles' | 'dashboard' | 'notifications' | 'subscription' | 'danger'

const SECTIONS: { id: Section; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'company',       label: 'Company',          description: 'Business info, branding & trade',       icon: Building2        },
  { id: 'pricing',       label: 'Pricing Defaults', description: 'Markup, waste & labor rates',           icon: DollarSign       },
  { id: 'payperiod',     label: 'Pay Period',        description: 'Pay cycle & schedule',                  icon: Calendar         },
  { id: 'roles',         label: 'Roles & Access',   description: 'Edit permissions per role',             icon: Shield           },
  { id: 'dashboard',     label: 'Dashboard',        description: 'Control what each role sees',           icon: LayoutDashboard  },
  { id: 'notifications', label: 'Notifications',    description: 'Email & push preferences',              icon: Bell             },
  { id: 'subscription',  label: 'Subscription',     description: 'Plan & billing',                        icon: CreditCard       },
  { id: 'danger',        label: 'Danger Zone',      description: 'Account & data management',             icon: AlertTriangle    },
]

export default function SettingsPage() {
  const { settings, setSettings, saveSettings } = useSettings()
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState<Section | null>(null)
  const [saved, setSaved] = useState(false)
  const [subAdminCanInvite, setSubAdminCanInvite] = useState(true)
  const [accessSaved, setAccessSaved] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

  useEffect(() => {
    if (user?.org_id) {
      supabase
        .from('organizations')
        .select('sub_admin_can_invite')
        .eq('id', user.org_id)
        .single()
        .then(({ data }) => {
          if (data) setSubAdminCanInvite(data.sub_admin_can_invite)
        })
    }
  }, [user?.org_id])

  async function handleSave() {
    await saveSettings()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveAccessSettings() {
    if (!user?.org_id) return
    await supabase
      .from('organizations')
      .update({ sub_admin_can_invite: subAdminCanInvite })
      .eq('id', user.org_id)
    setAccessSaved(true)
    setTimeout(() => setAccessSaved(false), 2000)
  }

  const { company, pricing, payPeriod, notifications } = settings

  function set<K extends keyof typeof settings>(section: K, key: string, value: string) {
    setSettings(s => ({ ...s, [section]: { ...(s[section] as object), [key]: value } }))
  }

  // ── Main section list ────────────────────────────────────────────────────
  if (!activeSection) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <p className="text-zinc-400 text-sm mt-1">Manage your company, team, and preferences.</p>
        </div>
        <div className="space-y-2">
          {SECTIONS.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left
                ${id === 'danger'
                  ? 'border-red-900/50 bg-zinc-900 hover:border-red-700 hover:bg-red-950/20'
                  : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800'}`}
            >
              <div className={`p-2 rounded-lg ${id === 'danger' ? 'bg-red-950 text-red-400' : 'bg-zinc-800 text-amber-400'}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${id === 'danger' ? 'text-red-400' : 'text-white'}`}>{label}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{description}</p>
              </div>
              <ChevronRight size={16} className="text-zinc-600 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Section header (back button) ─────────────────────────────────────────
  const currentSection = SECTIONS.find(s => s.id === activeSection)!

  function SectionHeader() {
    return (
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setActiveSection(null)}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white">{currentSection.label}</h2>
          <p className="text-zinc-400 text-xs">{currentSection.description}</p>
        </div>
      </div>
    )
  }

  function SaveButton() {
    return (
      <Button onClick={handleSave} className="bg-amber-600 hover:bg-amber-500 text-white mt-2">
        {saved ? <><Check size={14} className="mr-1.5" />Saved</> : 'Save Changes'}
      </Button>
    )
  }

  // ── Company ──────────────────────────────────────────────────────────────
  if (activeSection === 'company') {
    return (
      <div className="max-w-2xl mx-auto">
        <SectionHeader />
        <Accordion type="multiple" defaultValue={['info', 'branding', 'trade']} className="space-y-3">

          <AccordionItem value="info" className="bg-zinc-900 border border-zinc-800 rounded-xl px-4">
            <AccordionTrigger className="text-white font-medium hover:no-underline py-4">Business Info</AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Company Name">
                  <Input value={company.name} onChange={e => set('company', 'name', e.target.value)} placeholder="Acme Contractors" />
                </Field>
                <Field label="Phone">
                  <Input value={company.phone} onChange={e => set('company', 'phone', e.target.value)} placeholder="(555) 000-0000" />
                </Field>
                <Field label="Email">
                  <Input value={company.email} onChange={e => set('company', 'email', e.target.value)} placeholder="info@company.com" />
                </Field>
                <Field label="License #">
                  <Input value={company.license} onChange={e => set('company', 'license', e.target.value)} placeholder="LIC-000000" />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <Input value={company.address} onChange={e => set('company', 'address', e.target.value)} placeholder="123 Main St, City, CA 00000" />
                </Field>
                <Field label="Website" className="sm:col-span-2">
                  <Input value={company.website} onChange={e => set('company', 'website', e.target.value)} placeholder="https://yourcompany.com" />
                </Field>
              </div>
              <SaveButton />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="branding" className="bg-zinc-900 border border-zinc-800 rounded-xl px-4">
            <AccordionTrigger className="text-white font-medium hover:no-underline py-4">Branding</AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
                <Field label="Logo URL" hint="Paste a direct link to your company logo (PNG or SVG recommended).">
                  <Input value={company.logoUrl} onChange={e => set('company', 'logoUrl', e.target.value)} placeholder="https://yourcompany.com/logo.png" />
                </Field>
                {company.logoUrl && (
                  <div className="bg-zinc-800 rounded-lg p-3 flex items-center gap-3">
                    <img src={company.logoUrl} alt="Logo preview" className="h-10 w-auto object-contain rounded" onError={e => (e.currentTarget.style.display = 'none')} />
                    <p className="text-zinc-400 text-xs">Logo preview</p>
                  </div>
                )}
              </div>
              <SaveButton />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="trade" className="bg-zinc-900 border border-zinc-800 rounded-xl px-4">
            <AccordionTrigger className="text-white font-medium hover:no-underline py-4">Trade & Location</AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Trade">
                  <Select value={company.trade} onValueChange={v => set('company', 'trade', v)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue placeholder="Select trade..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                      {TRADES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Timezone">
                  <Select value={company.timezone} onValueChange={v => set('company', 'timezone', v)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                      {TIMEZONES.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <SaveButton />
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    )
  }

  // ── Pricing Defaults ─────────────────────────────────────────────────────
  if (activeSection === 'pricing') {
    return (
      <div className="max-w-2xl mx-auto">
        <SectionHeader />
        <Card className="bg-zinc-900 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle className="text-white">Pricing Defaults</CardTitle>
            <CardDescription className="text-zinc-400">Default values used when creating new estimates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Waste %" hint="Extra material to account for cuts and waste.">
                <Input type="number" value={pricing.wastePct} onChange={e => set('pricing', 'wastePct', e.target.value)} />
              </Field>
              <Field label="Markup %" hint="Profit margin applied on top of costs.">
                <Input type="number" value={pricing.markupPct} onChange={e => set('pricing', 'markupPct', e.target.value)} />
              </Field>
              <Field label="Unit Labor Rate ($)" hint="Labor cost per unit of work (e.g. per sq ft, per item).">
                <Input type="number" value={pricing.laborPerSq} onChange={e => set('pricing', 'laborPerSq', e.target.value)} />
              </Field>
              <Field label="Demo / Removal Rate ($)" hint="Cost to remove or demo existing work per unit.">
                <Input type="number" value={pricing.tearoffRate} onChange={e => set('pricing', 'tearoffRate', e.target.value)} />
              </Field>
              <Field label="Hourly Rate ($)" hint="Default billable hourly rate.">
                <Input type="number" value={pricing.hourlyRate} onChange={e => set('pricing', 'hourlyRate', e.target.value)} />
              </Field>
              <Field label="Labor Burden %" hint="Payroll taxes, workers' comp, and insurance on top of labor.">
                <Input type="number" value={pricing.burdenPct} onChange={e => set('pricing', 'burdenPct', e.target.value)} />
              </Field>
            </div>
            <SaveButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Pay Period ───────────────────────────────────────────────────────────
  if (activeSection === 'payperiod') {
    return (
      <div className="max-w-2xl mx-auto">
        <SectionHeader />
        <Card className="bg-zinc-900 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle className="text-white">Pay Period</CardTitle>
            <CardDescription className="text-zinc-400">Set how your employees are paid and when the period starts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Pay Period Type">
                <Select value={payPeriod.type} onValueChange={v => setSettings(s => ({ ...s, payPeriod: { ...s.payPeriod, type: v as PayPeriodType } }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly (every 2 weeks)</SelectItem>
                    <SelectItem value="semimonthly">Semimonthly (1st &amp; 15th)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {payPeriod.type === 'weekly' && (
                <Field label="Week Starts On">
                  <Select value={String(payPeriod.weeklyStartDay)} onValueChange={v => setSettings(s => ({ ...s, payPeriod: { ...s.payPeriod, weeklyStartDay: Number(v) } }))}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                      {DAY_NAMES.map((day, i) => <SelectItem key={i} value={String(i)}>{day}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {payPeriod.type === 'biweekly' && (
                <Field label="Reference Start Date" hint="The app auto-calculates every 2-week period from this date.">
                  <Input type="date" value={payPeriod.biweeklyAnchor}
                    onChange={e => setSettings(s => ({ ...s, payPeriod: { ...s.payPeriod, biweeklyAnchor: e.target.value } }))} />
                </Field>
              )}
            </div>
            <div className="bg-zinc-800 rounded-lg p-3 text-sm">
              <p className="text-zinc-400 text-xs mb-1">Current Pay Period</p>
              <p className="text-amber-400 font-medium">
                {getPayPeriodRange(settings).start} – {getPayPeriodRange(settings).end}
              </p>
              <p className="text-zinc-500 text-xs mt-1">Updates automatically — no manual changes needed.</p>
            </div>
            <SaveButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Roles & Access ───────────────────────────────────────────────────────
  if (activeSection === 'roles') {
    return (
      <div className="max-w-2xl mx-auto">
        <SectionHeader />
        <div className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800 text-white">
            <CardHeader>
              <CardTitle className="text-white">Role Permissions</CardTitle>
              <CardDescription className="text-zinc-400">
                Check or uncheck permissions per role. Admin always has full access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left text-zinc-400 font-medium pb-3 pr-4">Permission</th>
                      {ROLE_NAMES.map(role => (
                        <th key={role} className="text-center text-zinc-400 font-medium pb-3 px-2 whitespace-nowrap">{role}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {PERMISSION_ROWS.map(({ label, action }) => (
                      <tr key={action}>
                        <td className="text-zinc-300 py-2.5 pr-4 whitespace-nowrap">{label}</td>
                        {ROLE_NAMES.map(role => {
                          const isAdmin = role === 'Admin'
                          const effectivePerms = settings.rolePermissions[role] ?? DEFAULT_ROLE_PERMISSIONS[role] ?? []
                          const checked = effectivePerms.includes(action)
                          return (
                            <td key={role} className="text-center py-2.5 px-2">
                              {isAdmin ? (
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-600/30 text-amber-400 text-[10px]">✓</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const current = settings.rolePermissions[role] ?? DEFAULT_ROLE_PERMISSIONS[role] ?? []
                                    const updated = checked
                                      ? current.filter(a => a !== action)
                                      : [...current, action]
                                    setSettings(s => ({
                                      ...s,
                                      rolePermissions: { ...s.rolePermissions, [role]: updated as Action[] },
                                    }))
                                  }}
                                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                                />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-4 flex items-center gap-3">
                <SaveButton />
                <button
                  onClick={() => setSettings(s => ({ ...s, rolePermissions: {} }))}
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                >
                  Reset to defaults
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 text-white">
            <CardHeader>
              <CardTitle className="text-white">Team Access Controls</CardTitle>
              <CardDescription className="text-zinc-400">Fine-tune what your team can do.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow
                label="Allow Sub-Admins to invite members"
                description="When enabled, Sub-Admins can invite Sales, Lead, Employee, and Laborer roles."
                checked={subAdminCanInvite}
                onCheckedChange={setSubAdminCanInvite}
              />
              <Button onClick={saveAccessSettings} className="bg-amber-600 hover:bg-amber-500 text-white">
                {accessSaved ? <><Check size={14} className="mr-1.5" />Saved</> : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Dashboard Visibility ─────────────────────────────────────────────���───
  if (activeSection === 'dashboard') {
    return (
      <div className="max-w-2xl mx-auto">
        <SectionHeader />
        <div className="space-y-3">
          <p className="text-zinc-400 text-sm">Choose which dashboard widgets each role can see.</p>
          <Accordion type="multiple" defaultValue={ROLE_NAMES.filter(r => r !== 'Employee' && r !== 'Laborer')} className="space-y-3">
            {ROLE_NAMES.filter(r => DEFAULT_ROLE_PERMISSIONS[r]?.includes('view:dashboard')).map(role => {
              const vis: DashboardVisibility = { ...DEFAULT_DASHBOARD_VISIBILITY, ...(settings.dashboardVisibility[role] ?? {}) }
              return (
                <AccordionItem key={role} value={role} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4">
                  <AccordionTrigger className="text-white font-medium hover:no-underline py-4">{role}</AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-1">
                    {DASHBOARD_WIDGETS.map(({ key, label, description }) => (
                      <ToggleRow
                        key={key}
                        label={label}
                        description={description}
                        checked={vis[key]}
                        onCheckedChange={v => setSettings(s => ({
                          ...s,
                          dashboardVisibility: {
                            ...s.dashboardVisibility,
                            [role]: { ...DEFAULT_DASHBOARD_VISIBILITY, ...(s.dashboardVisibility[role] ?? {}), [key]: v },
                          },
                        }))}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
          <SaveButton />
        </div>
      </div>
    )
  }

  // ── Notifications ────────────────────────────────────────────────────────
  if (activeSection === 'notifications') {
    return (
      <div className="max-w-2xl mx-auto">
        <SectionHeader />
        <Card className="bg-zinc-900 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle className="text-white">Notifications</CardTitle>
            <CardDescription className="text-zinc-400">Choose what you get notified about.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-zinc-500 text-xs uppercase tracking-wider pb-2">Email</p>
            <ToggleRow
              label="New job created"
              description="Get an email when a new job is added to your organization."
              checked={notifications.emailNewJob}
              onCheckedChange={v => setSettings(s => ({ ...s, notifications: { ...s.notifications, emailNewJob: v } }))}
            />
            <ToggleRow
              label="Employee clocks in"
              description="Get an email when an employee clocks in for the day."
              checked={notifications.emailClockIn}
              onCheckedChange={v => setSettings(s => ({ ...s, notifications: { ...s.notifications, emailClockIn: v } }))}
            />
            <ToggleRow
              label="Time edit request"
              description="Get notified when an employee submits a time edit request."
              checked={notifications.emailEditRequest}
              onCheckedChange={v => setSettings(s => ({ ...s, notifications: { ...s.notifications, emailEditRequest: v } }))}
            />
            <ToggleRow
              label="Invite accepted"
              description="Get an email when someone joins your organization via invite."
              checked={notifications.emailInviteAccepted}
              onCheckedChange={v => setSettings(s => ({ ...s, notifications: { ...s.notifications, emailInviteAccepted: v } }))}
            />
            <div className="pt-4">
              <SaveButton />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Subscription ─────────────────────────────────────────────────────────
  if (activeSection === 'subscription') {
    return (
      <div className="max-w-2xl mx-auto">
        <SectionHeader />
        <Card className="bg-zinc-900 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle className="text-white">Subscription</CardTitle>
            <CardDescription className="text-zinc-400">Your current plan and billing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { name: 'Solo',    price: '$29', period: '/mo', features: ['1 admin/sales user', 'Up to 10 active jobs', 'Estimates & calculator', 'Time clock'] },
                { name: 'Crew',    price: '$59', period: '/mo', features: ['Up to 5 admin/sales users', 'Unlimited jobs', 'Estimates & calculator', 'Time clock'], highlight: true },
                { name: 'Company', price: '$99', period: '/mo', features: ['Unlimited admin/sales users', 'Unlimited jobs', 'Estimates & calculator', 'Time clock', 'White-label PDF'] },
              ].map(tier => (
                <div key={tier.name} className={`border rounded-xl p-4 space-y-3 hover:border-amber-600 transition-colors cursor-pointer ${tier.highlight ? 'border-amber-600 bg-zinc-800' : 'border-zinc-700'}`}>
                  <p className="text-white font-semibold text-lg">{tier.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-amber-400 tabular-nums text-4xl font-bold tracking-tight">{tier.price}</span>
                    <span className="text-zinc-400 text-sm mb-1">{tier.period}</span>
                  </div>
                  <ul className="space-y-1">
                    {tier.features.map(f => (
                      <li key={f} className="text-zinc-400 text-sm flex items-center gap-2">
                        <span className="text-amber-500">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-zinc-500 text-sm">Payment integration coming soon.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Danger Zone ──────────────────────────────────────────────────────────
  if (activeSection === 'danger') {
    return (
      <div className="max-w-2xl mx-auto">
        <SectionHeader />
        <div className="space-y-4">
          <Card className="bg-zinc-900 border-red-900/40 text-white">
            <CardHeader>
              <CardTitle className="text-white">Transfer Ownership</CardTitle>
              <CardDescription className="text-zinc-400">Transfer admin ownership to another member of your organization.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-400 text-sm mb-4">The current owner will be downgraded to Sub-Admin. This action cannot be undone without the new owner's cooperation.</p>
              <Button variant="outline" disabled className="border-zinc-700 text-zinc-400 cursor-not-allowed">
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-red-900/40 text-white">
            <CardHeader>
              <CardTitle className="text-red-400">Delete Organization</CardTitle>
              <CardDescription className="text-zinc-400">Permanently delete your organization and all associated data.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-400 text-sm mb-4">
                This will permanently delete all jobs, employees, time entries, and settings. <span className="text-red-400 font-medium">This cannot be undone.</span>
              </p>
              <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)} className="bg-red-700 hover:bg-red-600">
                Delete Organization
              </Button>
            </CardContent>
          </Card>
        </div>

        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-red-400">Delete Organization</DialogTitle>
              <DialogDescription className="text-zinc-400">
                This action is permanent and cannot be undone. Type <span className="text-white font-mono font-semibold">DELETE</span> to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setDeleteConfirmOpen(false); setDeleteInput('') }} className="border-zinc-700 text-zinc-300 flex-1">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteInput !== 'DELETE'}
                  className="bg-red-700 hover:bg-red-600 flex-1 disabled:opacity-40"
                  onClick={() => {
                    // TODO: implement org deletion
                    setDeleteConfirmOpen(false)
                    setDeleteInput('')
                  }}
                >
                  Delete Forever
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label className="text-zinc-300">{label}</Label>
      {hint && <p className="text-zinc-500 text-xs">{hint}</p>}
      <div className="[&_input]:bg-zinc-800 [&_input]:border-zinc-700 [&_input]:text-white [&_input]:placeholder:text-zinc-500">
        {children}
      </div>
    </div>
  )
}

function ToggleRow({ label, description, checked, onCheckedChange }: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <div className="pr-4">
        <p className="text-white text-sm font-medium">{label}</p>
        <p className="text-zinc-500 text-xs mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="data-[state=checked]:bg-amber-600 flex-shrink-0" />
    </div>
  )
}

