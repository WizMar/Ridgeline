import { useState, useEffect, useRef } from 'react'
import { ChevronRight, ArrowLeft, Building2, DollarSign, Calendar, Shield, Bell, CreditCard, AlertTriangle, Check, LayoutDashboard, BookOpen, Pencil, Trash2, Plus, Upload, Download, FileSignature } from 'lucide-react'
import ContractTemplateSection from '@/components/ContractTemplateSection'
import { read, utils, writeFile } from 'xlsx'
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
import { usePriceBook } from '@/context/PriceBookContext'
import { type PriceBookItem, UNIT_OPTIONS, CATEGORY_OPTIONS } from '@/types/pricebook'

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

const ROLE_NAMES: UserRole[] = ['Admin', 'Sub-Admin', 'Project Manager', 'Lead', 'Sales', 'Employee', 'Subcontractor']

const DASHBOARD_WIDGETS: { key: keyof DashboardVisibility; label: string; description: string }[] = [
  { key: 'summaryCards', label: 'Summary Cards',    description: 'Active jobs, clocked in, estimates, revenue' },
  { key: 'jobsChart',    label: 'Jobs by Status',   description: 'Pie chart showing job status distribution' },
  { key: 'hoursChart',   label: 'Hours This Period', description: 'Bar chart of hours logged per employee' },
  { key: 'quickActions', label: 'Quick Actions',    description: 'Shortcut buttons to create jobs, estimates, etc.' },
  { key: 'recentJobs',   label: 'Recent Jobs',      description: 'Table of the 5 most recently created jobs' },
]

type Section = 'company' | 'pricing' | 'pricebook' | 'contracts' | 'payperiod' | 'roles' | 'dashboard' | 'notifications' | 'subscription' | 'danger'

const SECTIONS: { id: Section; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'company',       label: 'Company',            description: 'Business info, branding & trade',       icon: Building2       },
  { id: 'pricing',       label: 'Pricing Defaults',   description: 'Markup, waste & labor rates',           icon: DollarSign      },
  { id: 'pricebook',     label: 'Price Book',         description: 'Saved items for estimates',             icon: BookOpen        },
  { id: 'contracts',     label: 'Contract Templates', description: 'Reusable templates for client contracts', icon: FileSignature  },
  { id: 'payperiod',     label: 'Pay Period',          description: 'Pay cycle & schedule',                  icon: Calendar        },
  { id: 'roles',         label: 'Roles & Access',     description: 'Edit permissions per role',             icon: Shield          },
  { id: 'dashboard',     label: 'Dashboard',          description: 'Control what each role sees',           icon: LayoutDashboard },
  { id: 'notifications', label: 'Notifications',      description: 'Email & push preferences',              icon: Bell            },
  { id: 'subscription',  label: 'Subscription',       description: 'Plan & billing',                        icon: CreditCard      },
  { id: 'danger',        label: 'Danger Zone',        description: 'Account & data management',             icon: AlertTriangle   },
]

export default function SettingsPage() {
  const { settings, setSettings, saveSettings } = useSettings()
  const { user, refreshPermissions } = useAuth()
  const [activeSection, setActiveSection] = useState<Section | null>(null)
  const [saved, setSaved] = useState(false)
  const [setupName, setSetupName] = useState('')
  const [setupUserName, setSetupUserName] = useState(user?.name || '')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')

  async function handleOrgSetup(e: React.FormEvent) {
    e.preventDefault()
    if (!setupName.trim() || !setupUserName.trim()) return
    setSetupLoading(true)
    setSetupError('')
    const { error } = await supabase.rpc('setup_organization', {
      p_org_name: setupName.trim(),
      p_user_name: setupUserName.trim(),
    })
    if (error) {
      setSetupError(error.message)
      setSetupLoading(false)
      return
    }
    localStorage.removeItem('nexus_onboarding_skipped')
    await refreshPermissions()
    setSetupLoading(false)
  }
  const [subAdminCanInvite, setSubAdminCanInvite] = useState(true)
  const [accessSaved, setAccessSaved] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  async function handleLogoUpload(file: File) {
    if (!user?.org_id) return
    setLogoUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.org_id}/logo.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (error) { setLogoUploading(false); return }
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    // Bust cache with timestamp so the new logo loads immediately
    const url = `${data.publicUrl}?t=${Date.now()}`
    setSettings(s => ({ ...s, company: { ...s.company, logoUrl: url } }))
    setLogoUploading(false)
  }

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

        {!user?.org_id && (
          <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-amber-900/50 text-amber-400 shrink-0">
              <Building2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-amber-300 font-medium text-sm">Company not set up</p>
              <p className="text-amber-700 text-xs mt-0.5">Finish setup to unlock all features.</p>
            </div>
            <Button size="sm" onClick={() => setActiveSection('company')} className="bg-stone-500 hover:bg-stone-400 text-white shrink-0">
              Finish Setup
            </Button>
          </div>
        )}

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
              <div className={`p-2 rounded-lg ${id === 'danger' ? 'bg-red-950 text-red-400' : 'bg-zinc-800 text-stone-300'}`}>
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
      <Button onClick={handleSave} className="bg-stone-500 hover:bg-stone-400 text-white mt-2">
        {saved ? <><Check size={14} className="mr-1.5" />Saved</> : 'Save Changes'}
      </Button>
    )
  }

  // ── Company ──────────────────────────────────────────────────────────────
  if (activeSection === 'company') {
    if (!user?.org_id) {
      return (
        <div className="max-w-2xl mx-auto">
          <SectionHeader />
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="text-white font-semibold">Set Up Your Company</h3>
              <p className="text-zinc-500 text-sm mt-1">This only takes a moment.</p>
            </div>
            <form onSubmit={handleOrgSetup} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Your Name *</Label>
                <Input
                  value={setupUserName}
                  onChange={e => setSetupUserName(e.target.value)}
                  placeholder="John Smith"
                  required
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Company Name *</Label>
                <Input
                  value={setupName}
                  onChange={e => setSetupName(e.target.value)}
                  placeholder="Acme Services LLC"
                  required
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>
              {setupError && <p className="text-red-400 text-sm">{setupError}</p>}
              <Button
                type="submit"
                disabled={!setupName.trim() || !setupUserName.trim() || setupLoading}
                className="w-full bg-stone-500 hover:bg-stone-400 text-white font-semibold h-11"
              >
                {setupLoading ? 'Setting up…' : 'Create Company →'}
              </Button>
            </form>
          </div>
        </div>
      )
    }

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
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
                />
                {company.logoUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                      <img src={company.logoUrl} alt="Company logo" className="w-full h-full object-contain p-2" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-white text-sm font-medium">Company Logo</p>
                      <p className="text-zinc-500 text-xs">PNG, JPG, or SVG recommended</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={logoUploading}
                      >
                        <Upload size={13} className="mr-1.5" />
                        {logoUploading ? 'Uploading…' : 'Replace Logo'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="w-full border-2 border-dashed border-zinc-700 hover:border-stone-500 rounded-xl p-8 flex flex-col items-center gap-3 transition-colors disabled:opacity-50"
                  >
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                      <Upload size={20} className="text-zinc-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-white text-sm font-medium">{logoUploading ? 'Uploading…' : 'Upload Company Logo'}</p>
                      <p className="text-zinc-500 text-xs mt-1">PNG, JPG, or SVG</p>
                    </div>
                  </button>
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

  // ── Price Book ───────────────────────────────────────────────────────────
  if (activeSection === 'pricebook') {
    return <PriceBookSection onBack={() => setActiveSection(null)} />
  }

  // ── Contract Templates ───────────────────────────────────────────────────
  if (activeSection === 'contracts') {
    return <ContractTemplateSection onBack={() => setActiveSection(null)} />
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
              <p className="text-stone-300 font-medium">
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
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-stone-500/30 text-stone-300 text-[10px]">✓</span>
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
                                  className="w-4 h-4 rounded accent-stone-400 cursor-pointer"
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
                description="When enabled, Sub-Admins can invite Project Manager, Lead, Sales, Employee, and Subcontractor roles."
                checked={subAdminCanInvite}
                onCheckedChange={setSubAdminCanInvite}
              />
              <Button onClick={saveAccessSettings} className="bg-stone-500 hover:bg-stone-400 text-white">
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
          <Accordion type="multiple" defaultValue={ROLE_NAMES.filter(r => r !== 'Employee' && r !== 'Subcontractor')} className="space-y-3">
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
                <div key={tier.name} className={`border rounded-xl p-4 space-y-3 hover:border-stone-500 transition-colors cursor-pointer ${tier.highlight ? 'border-stone-500 bg-zinc-800' : 'border-zinc-700'}`}>
                  <p className="text-white font-semibold text-lg">{tier.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-stone-300 tabular-nums text-4xl font-bold tracking-tight">{tier.price}</span>
                    <span className="text-zinc-400 text-sm mb-1">{tier.period}</span>
                  </div>
                  <ul className="space-y-1">
                    {tier.features.map(f => (
                      <li key={f} className="text-zinc-400 text-sm flex items-center gap-2">
                        <span className="text-stone-400">✓</span> {f}
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
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="data-[state=checked]:bg-stone-500 flex-shrink-0" />
    </div>
  )
}

const EMPTY_FORM = { name: '', description: '', category: 'Labor', unit: 'ea', unitPrice: '' }

// Normalize a spreadsheet header key for fuzzy matching
function normKey(k: string) {
  return k.toLowerCase().replace(/[\s_\-()$#%]/g, '')
}

// Map a raw spreadsheet row to a PriceBookItem payload
function parseSpreadsheetRow(row: Record<string, unknown>): Omit<PriceBookItem, 'id' | 'createdAt'> | null {
  const n = Object.fromEntries(Object.entries(row).map(([k, v]) => [normKey(k), v]))

  const name = String(
    n['name'] ?? n['item'] ?? n['itemname'] ?? n['product'] ?? n['productname'] ?? n['description'] ?? ''
  ).trim()
  if (!name) return null

  const description = String(n['description'] ?? n['desc'] ?? n['notes'] ?? n['details'] ?? '').trim()

  const rawCat = String(n['category'] ?? n['cat'] ?? n['type'] ?? n['group'] ?? '').trim()
  const category = CATEGORY_OPTIONS.find(c => c.toLowerCase() === rawCat.toLowerCase()) ?? 'Misc'

  const rawUnit = String(n['unit'] ?? n['uom'] ?? n['unitofmeasure'] ?? n['measure'] ?? 'ea').trim().toLowerCase()
  const unit = UNIT_OPTIONS.includes(rawUnit) ? rawUnit : 'ea'

  const rawPrice = n['unitprice'] ?? n['price'] ?? n['unitcost'] ?? n['cost'] ?? n['rate'] ?? n['amount'] ?? n['listprice'] ?? 0
  const unitPrice = parseFloat(String(rawPrice).replace(/[$,\s]/g, '')) || 0

  return { name, description, category, unit, unitPrice }
}

function downloadTemplate() {
  const ws = utils.aoa_to_sheet([
    ['Name', 'Description', 'Category', 'Unit', 'Unit Price'],
    ['30yr Architectural Shingle', 'Per square installed', 'Materials', 'sq', 89.00],
    ['Ice & Water Shield', 'Self-adhering underlayment', 'Materials', 'sqft', 0.45],
    ['Labor – Tear Off', 'Remove existing roofing', 'Labor', 'sq', 35.00],
    ['Labor – Install Shingle', 'Install new shingles', 'Labor', 'sq', 65.00],
    ['Ridge Cap', 'Hip & ridge cap shingles', 'Materials', 'lft', 1.20],
    ['Permit', 'Building permit fee', 'Permit', 'lot', 250.00],
  ])
  ws['!cols'] = [{ wch: 32 }, { wch: 30 }, { wch: 16 }, { wch: 8 }, { wch: 12 }]
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Price Book')
  writeFile(wb, 'nexus-pricebook-template.xlsx')
}

function PriceBookSection({ onBack }: { onBack: () => void }) {
  const { items, loading, addItem, updateItem, deleteItem } = usePriceBook()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add / edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PriceBookItem | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Import preview dialog
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<Omit<PriceBookItem, 'id' | 'createdAt'>[]>([])
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(item: PriceBookItem) {
    setEditing(item)
    setForm({ name: item.name, description: item.description, category: item.category, unit: item.unit, unitPrice: String(item.unitPrice) })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      unit: form.unit,
      unitPrice: parseFloat(form.unitPrice) || 0,
    }
    if (editing) {
      await updateItem({ ...editing, ...payload })
    } else {
      await addItem(payload)
    }
    setSaving(false)
    setDialogOpen(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError('')

    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = ev.target?.result
        const wb = read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        const parsed = raw.map(parseSpreadsheetRow).filter((r): r is Omit<PriceBookItem, 'id' | 'createdAt'> => r !== null)
        if (parsed.length === 0) {
          setImportError('No valid rows found. Make sure your file has a Name column.')
          return
        }
        setImportRows(parsed)
        setImportOpen(true)
      } catch {
        setImportError('Could not read the file. Make sure it is a valid .xlsx or .csv file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmImport() {
    setImporting(true)
    for (const row of importRows) {
      await addItem(row)
    }
    setImporting(false)
    setImportOpen(false)
    setImportRows([])
  }

  function handleExport() {
    const rows = items.map(i => ({
      Name: i.name,
      Description: i.description,
      Category: i.category,
      Unit: i.unit,
      'Unit Price': i.unitPrice,
    }))
    const ws = utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 32 }, { wch: 30 }, { wch: 16 }, { wch: 8 }, { wch: 12 }]
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Price Book')
    writeFile(wb, 'pricebook-export.xlsx')
  }

  const grouped = CATEGORY_OPTIONS.reduce<Record<string, PriceBookItem[]>>((acc, cat) => {
    acc[cat] = items.filter(i => i.category === cat)
    return acc
  }, {})

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">Price Book</h2>
          <p className="text-zinc-400 text-xs">Saved items for estimates</p>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button variant="outline" onClick={handleExport} className="border-zinc-700 text-zinc-300 hover:text-white gap-1.5 text-xs h-9">
              <Download size={13} /> Export
            </Button>
          )}
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="border-zinc-700 text-zinc-300 hover:text-white gap-1.5 text-xs h-9">
            <Upload size={13} /> Import
          </Button>
          <Button onClick={openAdd} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5 h-9">
            <Plus size={14} /> Add Item
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Import hint + template download */}
      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mb-4">
        <div>
          <p className="text-zinc-300 text-sm font-medium">Import from Excel or CSV</p>
          <p className="text-zinc-500 text-xs mt-0.5">Columns: Name, Description, Category, Unit, Unit Price</p>
        </div>
        <button onClick={downloadTemplate} className="text-stone-300 hover:text-stone-200 text-xs underline underline-offset-2 flex-shrink-0 ml-4">
          Download template
        </button>
      </div>

      {importError && (
        <p className="text-red-400 text-sm mb-4 bg-red-950/30 border border-red-900/40 rounded-lg px-4 py-3">{importError}</p>
      )}

      {/* Item list */}
      {loading ? (
        <p className="text-zinc-500 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen size={40} className="text-zinc-700 mb-3" />
          <p className="text-zinc-400 font-medium">No items yet</p>
          <p className="text-zinc-600 text-sm mt-1 mb-4">Add items manually or import your existing price list.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="border-zinc-700 text-zinc-300 gap-1.5">
              <Upload size={14} /> Import File
            </Button>
            <Button onClick={openAdd} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5">
              <Plus size={14} /> Add Item
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORY_OPTIONS.filter(cat => grouped[cat].length > 0).map(cat => (
            <div key={cat}>
              <p className="text-zinc-500 text-xs uppercase tracking-wider mb-2">{cat}</p>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Name</th>
                        <th className="text-left text-zinc-400 font-medium px-4 py-2.5 hidden sm:table-cell">Description</th>
                        <th className="text-left text-zinc-400 font-medium px-4 py-2.5">Unit</th>
                        <th className="text-right text-zinc-400 font-medium px-4 py-2.5">Price</th>
                        <th className="px-4 py-2.5 w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {grouped[cat].map(item => (
                        <tr key={item.id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                          <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell">{item.description || '—'}</td>
                          <td className="px-4 py-3 text-zinc-300">{item.unit}</td>
                          <td className="px-4 py-3 text-stone-300 text-right font-mono">${item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-950 text-zinc-400 hover:text-red-400 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Item' : 'Add Item'}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {editing ? 'Update this price book item.' : 'Add a new item to your price book.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-zinc-300 text-xs mb-1.5 block">Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. 30yr Shingle"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>
              <div>
                <Label className="text-zinc-300 text-xs mb-1.5 block">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-zinc-300 text-xs mb-1.5 block">Unit</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-zinc-300 text-xs mb-1.5 block">Unit Price ($)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.unitPrice}
                  onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}
                  placeholder="0.00"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>
              <div>
                <Label className="text-zinc-300 text-xs mb-1.5 block">Description</Label>
                <Input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-zinc-700 text-zinc-300 flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name.trim() || saving} className="bg-stone-500 hover:bg-stone-400 text-white flex-1 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Item'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import preview dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {importRows.length} item{importRows.length !== 1 ? 's' : ''} found. Review before importing.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800">
                <tr>
                  <th className="text-left text-zinc-400 font-medium px-3 py-2">Name</th>
                  <th className="text-left text-zinc-400 font-medium px-3 py-2">Category</th>
                  <th className="text-left text-zinc-400 font-medium px-3 py-2">Unit</th>
                  <th className="text-right text-zinc-400 font-medium px-3 py-2">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {importRows.map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-800/40">
                    <td className="px-3 py-2 text-white">{row.name}</td>
                    <td className="px-3 py-2 text-zinc-400">{row.category}</td>
                    <td className="px-3 py-2 text-zinc-400">{row.unit}</td>
                    <td className="px-3 py-2 text-stone-300 text-right font-mono">${row.unitPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportRows([]) }} className="border-zinc-700 text-zinc-300 flex-1">
              Cancel
            </Button>
            <Button onClick={confirmImport} disabled={importing} className="bg-stone-500 hover:bg-stone-400 text-white flex-1 disabled:opacity-50">
              {importing ? 'Importing...' : `Import ${importRows.length} Items`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

