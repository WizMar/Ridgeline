import { useState } from 'react'
import { useEstimates } from '@/context/EstimatesContext'
import { useJobs } from '@/context/JobsContext'
import { useSettings } from '@/context/SettingsContext'
import { useEmployees } from '@/context/EmployeeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  type Estimate, type EstimateStatus, type TradeCalc, type RoofCalc,
  ESTIMATE_STATUSES, STATUS_BADGE, PITCH_OPTIONS, calcEstimateTotal,
} from '@/types/estimate'
import { type Job, JOB_TYPES } from '@/types/job'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtOrDash(n: number) {
  return n > 0 ? fmt(n) : '--'
}

type PricingDefaults = { wastePct: string; markupPct: string; laborPerSq: string; tearoffRate: string; hourlyRate: string; burdenPct: string }

function defaultRoofCalc(defaults: PricingDefaults): RoofCalc {
  return {
    squares: '',
    pitch: '4/12',
    tearOffLayers: '0',
    materialType: 'Shingle',
    materialPerSq: '',
    wastePct: defaults.wastePct,
    markupPct: defaults.markupPct,
    laborPerSq: defaults.laborPerSq,
    tearoffRate: defaults.tearoffRate,
    burdenPct: defaults.burdenPct,
    laborMethod: 'perSq',
    numWorkers: '',
    laborHours: '',
    numDays: '',
    dayRate: '',
    hourlyRate: defaults.hourlyRate,
    permitFee: '',
    dumpster: '',
    deckingSheets: '',
    deckingCostPerSheet: '',
    dripEdgeLF: '',
    dripEdgeCostPerLF: '',
    pricingMethod: 'markup',
    sellPricePerSq: '',
  }
}

function defaultTradeCalc(defaults: PricingDefaults): TradeCalc {
  return {
    markupPct: defaults.markupPct,
    burdenPct: defaults.burdenPct,
    pricingMethod: 'markup',
    sellPrice: '',
    laborHours: '',
    hourlyRate: defaults.hourlyRate,
    materialCost: '',
    equipmentCost: '',
    ductworkLF: '',
    ductworkRate: '18',
    serviceCallFee: '',
    numFixtures: '',
    hoursPerFixture: '2',
    electricalMethod: 'sqft',
    sqFt: '',
    sqFtRate: '5.75',
    areaSqFt: '',
    ratePerSqFt: '8',
    cubicYards: '',
    cubicYardRate: '65',
    paintType: 'Interior',
    paintableSqFt: '',
    numCoats: '2',
    prepWork: false,
    prepSurcharge: '',
    subcontractorCost: '',
  }
}

function newEstimate(num: string, defaults: PricingDefaults): Estimate {
  return {
    id: crypto.randomUUID(),
    estimateNumber: num,
    status: 'Draft',
    client: { name: '', phone: '', email: '' },
    address: '',
    jobType: 'Roofing',
    roofCalc: defaultRoofCalc(defaults),
    tradeCalc: defaultTradeCalc(defaults),
    lineItems: [],
    notes: '',
    scope: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    convertedJobId: null,
  }
}


const STATUS_BORDER: Record<EstimateStatus, string> = {
  Draft: 'border-l-zinc-500',
  Submitted: 'border-l-yellow-500',
  Sent: 'border-l-blue-500',
  Approved: 'border-l-amber-500',
  Declined: 'border-l-red-500',
}

const inputCls = 'bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500'
const readOnlyCls = 'bg-zinc-900/50 border border-zinc-700 rounded-md px-3 py-2 text-zinc-300 text-sm min-h-[38px] flex items-center'
const sectionCls = 'bg-zinc-800 rounded-lg p-4 space-y-3'
const sectionLabelCls = 'text-zinc-400 text-xs font-medium uppercase tracking-widest'

function BtnGroup<T extends string>({
  options, value, onChange, className,
}: { options: T[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`flex gap-1 flex-wrap ${className ?? ''}`}>
      {options.map(o => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            value === o
              ? 'bg-amber-600 border-amber-600 text-white'
              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 bg-zinc-900/30'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export default function EstimatesPage() {
  const { estimates, addEstimate, updateEstimate, deleteEstimate, nextNumber } = useEstimates()
  const { addJob } = useJobs()
  const { settings } = useSettings()
  const { employees } = useEmployees()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<EstimateStatus | 'All'>('All')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmConvert, setConfirmConvert] = useState<Estimate | null>(null)
  const [draft, setDraft] = useState<Estimate | null>(null)
  const [selected, setSelected] = useState<Estimate | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const pricingDefaults: PricingDefaults = {
    ...settings.pricing,
    hourlyRate: settings.pricing.hourlyRate ?? '85',
    burdenPct: settings.pricing.burdenPct ?? '35',
  }

  const canConvert = (e: Estimate) => e.status === 'Approved' && !e.convertedJobId

  const filtered = estimates.filter(e => {
    const matchSearch = !search ||
      e.estimateNumber.toLowerCase().includes(search.toLowerCase()) ||
      e.client.name.toLowerCase().includes(search.toLowerCase()) ||
      e.address.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'All' || e.status === filterStatus
    return matchSearch && matchStatus
  })

  const statusCounts = ESTIMATE_STATUSES.reduce((acc, s) => {
    acc[s] = estimates.filter(e => e.status === s).length
    return acc
  }, {} as Record<EstimateStatus, number>)

  async function openCreate() {
    const num = await nextNumber()
    setDraft(newEstimate(num, pricingDefaults))
    setIsEditing(false)
    setDialogOpen(true)
  }

  function openEdit(e: Estimate) {
    const backfilledRoof: RoofCalc = {
      ...defaultRoofCalc(pricingDefaults),
      ...e.roofCalc,
    }
    const backfilled: Estimate = {
      ...e,
      lineItems: e.lineItems.map(li => ({ ...li })),
      roofCalc: backfilledRoof,
      tradeCalc: { ...defaultTradeCalc(pricingDefaults), ...e.tradeCalc },
    }
    setDraft(backfilled)
    setIsEditing(true)
    setDetailOpen(false)
    setDialogOpen(true)
  }

  function openDetail(e: Estimate) {
    setSelected(e)
    setDetailOpen(true)
  }

  function handleSave() {
    if (!draft || !draft.client.name.trim()) return
    const updated = { ...draft, updatedAt: new Date().toISOString() }
    if (isEditing) {
      updateEstimate(updated)
      setSelected(updated)
    } else {
      addEstimate(updated)
    }
    setDialogOpen(false)
  }

  function handleDelete(id: string) {
    deleteEstimate(id)
    setConfirmDelete(null)
    setDetailOpen(false)
  }

  function handleConvert(estimate: Estimate) {
    const leads = employees.filter(e =>
      e.status === 'Active' &&
      (e.role === 'Admin' || e.role === 'Sub-Admin' || e.role === 'Sales')
    )
    const job: Job = {
      id: crypto.randomUUID(),
      title: estimate.client.name
        ? `${estimate.client.name} - ${estimate.jobType}`
        : estimate.jobType,
      client: { ...estimate.client },
      address: estimate.address,
      type: estimate.jobType as Job['type'],
      status: 'Scheduled',
      leadId: leads[0]?.id ?? null,
      crewIds: [],
      notes: estimate.notes,
      scope: estimate.scope,
      scheduledDate: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    addJob(job)
    const updated = { ...estimate, convertedJobId: job.id, updatedAt: new Date().toISOString() }
    updateEstimate(updated)
    setSelected(updated)
    setConfirmConvert(null)
  }

  function setRC(patch: Partial<RoofCalc>) {
    setDraft(d => d ? { ...d, roofCalc: { ...d.roofCalc, ...patch } } : d)
  }

  function setTC(patch: Partial<TradeCalc>) {
    setDraft(d => d ? { ...d, tradeCalc: { ...d.tradeCalc, ...patch } } : d)
  }

  // ── (line items removed) ───────────────────────────────────────────────────



  // ── Pricing dual-card picker ───────────────────────────────────────────────
  function PricingCards({
    method, markup, onMethod, onMarkup,
    sellLabel, sellValue, onSell,
    subtotal,
  }: {
    method: 'markup' | 'sellPrice'
    markup: string
    onMethod: (m: 'markup' | 'sellPrice') => void
    onMarkup: (v: string) => void
    sellLabel: string
    sellValue: string
    onSell: (v: string) => void
    subtotal: number
  }) {
    const mPct = parseFloat(markup) || 0
    const grossMargin = subtotal > 0 && mPct > 0
      ? ((subtotal * mPct / 100) / (subtotal * (1 + mPct / 100))) * 100
      : 0

    return (
      <div className={sectionCls}>
        <p className={sectionLabelCls}>Pricing — Pick Your Method</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Sell Price card */}
          <div
            onClick={() => onMethod('sellPrice')}
            className={`rounded-lg p-3 cursor-pointer transition-all ${
              method === 'sellPrice'
                ? 'border-2 border-orange-500 bg-orange-900/20'
                : 'border border-zinc-700 bg-zinc-900/30 opacity-60'
            }`}
          >
            <p className="text-zinc-300 text-xs font-medium uppercase tracking-wide mb-2">{sellLabel}</p>
            <Input
              type="number"
              value={sellValue}
              onChange={e => { onMethod('sellPrice'); onSell(e.target.value) }}
              placeholder="0"
              className={`${inputCls} h-8 text-sm`}
              onClick={e => e.stopPropagation()}
            />
          </div>
          {/* Markup card */}
          <div
            onClick={() => onMethod('markup')}
            className={`rounded-lg p-3 cursor-pointer transition-all ${
              method === 'markup'
                ? 'border-2 border-amber-500 bg-amber-900/20'
                : 'border border-zinc-700 bg-zinc-900/30 opacity-60'
            }`}
          >
            <p className="text-zinc-300 text-xs font-medium uppercase tracking-wide mb-2">Markup on Cost</p>
            <Input
              type="number"
              value={markup}
              onChange={e => { onMethod('markup'); onMarkup(e.target.value) }}
              placeholder="30"
              className={`${inputCls} h-8 text-sm`}
              onClick={e => e.stopPropagation()}
            />
            {method === 'markup' && mPct > 0 && subtotal > 0 && (
              <p className="text-zinc-500 text-xs mt-1">— {grossMargin.toFixed(1)}% gross margin</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Estimates</h2>
          <p className="text-zinc-400 text-sm mt-1">Create and manage customer estimates.</p>
        </div>
        <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-500 text-white">
          + New Estimate
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        {(['All', ...ESTIMATE_STATUSES] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              filterStatus === s
                ? 'bg-amber-600 border-amber-600 text-white'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
            }`}
          >
            {s} {s !== 'All' && statusCounts[s] > 0 && `(${statusCounts[s]})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <Input
        placeholder="Search by estimate #, client, or address..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className={`${inputCls} max-w-md`}
      />

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-16 text-center text-zinc-500">
            {estimates.length === 0
              ? 'No estimates yet. Create your first estimate to get started.'
              : 'No estimates match your search.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(est => {
            const { total } = calcEstimateTotal(est)
            return (
              <div
                key={est.id}
                onClick={() => openDetail(est)}
                className={`bg-zinc-900 border border-zinc-800 border-l-4 ${STATUS_BORDER[est.status]} rounded-lg p-4 cursor-pointer hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-white leading-tight">{est.estimateNumber}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[est.status]}`}>
                    {est.status}
                  </span>
                </div>
                <p className="text-zinc-300 text-sm">{est.client.name || '—'}</p>
                <p className="text-zinc-500 text-xs mt-1 line-clamp-1">{est.address || 'No address'}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
                  <span className="text-zinc-500 text-xs">{est.jobType}</span>
                  <span className="text-amber-400 text-sm font-semibold">{fmt(total)}</span>
                </div>
                {est.convertedJobId && (
                  <p className="text-teal-400 text-xs mt-2">Converted to Job</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (() => {
            const { breakdown, subtotal, markup, markupPct, total } = calcEstimateTotal(selected)
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between pr-4">
                    <div>
                      <DialogTitle className="text-white text-xl">{selected.estimateNumber}</DialogTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[selected.status]}`}>
                          {selected.status}
                        </span>
                        <span className="text-zinc-500 text-xs">{selected.jobType}</span>
                      </div>
                    </div>
                    <span className="text-amber-400 text-2xl font-bold">{fmt(total)}</span>
                  </div>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                  {/* Client */}
                  <div className="bg-zinc-800 rounded-lg p-3 space-y-1">
                    <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Client</p>
                    <p className="text-white font-medium">{selected.client.name}</p>
                    {selected.client.phone && <p className="text-zinc-300 text-sm">{selected.client.phone}</p>}
                    {selected.client.email && <p className="text-zinc-400 text-sm">{selected.client.email}</p>}
                    {selected.address && <p className="text-zinc-400 text-sm mt-1">{selected.address}</p>}
                  </div>

                  {/* Cost Breakdown */}
                  {breakdown.length > 0 && (
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-3">Cost Breakdown</p>
                      <div className="space-y-1.5 text-sm">
                        {breakdown.map((item, i) => (
                          <div key={i} className="flex justify-between">
                            <span className="text-zinc-400">{item.label}</span>
                            <span className="text-white">{fmt(item.amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between pt-2 border-t border-zinc-700">
                          <span className="text-zinc-400">Subtotal</span>
                          <span className="text-white">{fmt(subtotal)}</span>
                        </div>
                        {markup > 0 && (
                          <div className="flex justify-between">
                            <span className="text-zinc-400">Markup ({markupPct}%)</span>
                            <span className="text-white">{fmt(markup)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-zinc-700 font-semibold">
                          <span className="text-white">Total</span>
                          <span className="text-amber-400">{fmt(total)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {selected.scope && (
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-zinc-400 text-xs mb-1">Scope of Work</p>
                      <p className="text-zinc-200 text-sm whitespace-pre-wrap">{selected.scope}</p>
                    </div>
                  )}
                  {selected.notes && (
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-zinc-400 text-xs mb-1">Notes</p>
                      <p className="text-zinc-200 text-sm whitespace-pre-wrap">{selected.notes}</p>
                    </div>
                  )}
                  {selected.convertedJobId && (
                    <div className="bg-teal-900/30 border border-teal-700 rounded-lg p-3">
                      <p className="text-teal-300 text-sm font-medium">This estimate has been converted to a job.</p>
                    </div>
                  )}
                </div>

                <DialogFooter className="flex gap-2 mt-4 flex-wrap">
                  <Button
                    variant="outline"
                    className="border-red-700 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                    onClick={() => setConfirmDelete(selected.id)}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                    onClick={() => openEdit(selected)}
                  >
                    Edit
                  </Button>
                  <Select
                    value={selected.status}
                    onValueChange={v => {
                      const updated = { ...selected, status: v as EstimateStatus, updatedAt: new Date().toISOString() }
                      updateEstimate(updated)
                      setSelected(updated)
                    }}
                  >
                    <SelectTrigger className="border-zinc-600 text-zinc-300 bg-transparent w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                      {ESTIMATE_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {canConvert(selected) && (
                    <Button
                      className="bg-amber-600 hover:bg-amber-500 text-white"
                      onClick={() => setConfirmConvert(selected)}
                    >
                      Convert to Job
                    </Button>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {isEditing ? `Edit ${draft?.estimateNumber}` : 'New Estimate'}
            </DialogTitle>
          </DialogHeader>

          {draft && (
            <div className="space-y-4 mt-2">
              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={v => setDraft(d => d ? { ...d, status: v as EstimateStatus } : d)}
                >
                  <SelectTrigger className={inputCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {ESTIMATE_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Client Info */}
              <div className={sectionCls}>
                <p className={sectionLabelCls}>Client Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-zinc-300">Client Name *</Label>
                    <Input
                      value={draft.client.name}
                      onChange={e => setDraft(d => d ? { ...d, client: { ...d.client, name: e.target.value } } : d)}
                      placeholder="John Smith"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Phone</Label>
                    <Input
                      value={draft.client.phone}
                      onChange={e => setDraft(d => d ? { ...d, client: { ...d.client, phone: e.target.value } } : d)}
                      placeholder="(555) 000-0000"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Email</Label>
                    <Input
                      value={draft.client.email}
                      onChange={e => setDraft(d => d ? { ...d, client: { ...d.client, email: e.target.value } } : d)}
                      placeholder="client@email.com"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Address + Trade */}
              <div className={sectionCls}>
                <p className={sectionLabelCls}>Job Details</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Property Address</Label>
                    <Input
                      value={draft.address}
                      onChange={e => setDraft(d => d ? { ...d, address: e.target.value } : d)}
                      placeholder="123 Main St, City, CA 00000"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Trade</Label>
                    <Select
                      value={draft.jobType}
                      onValueChange={v => setDraft(d => d ? { ...d, jobType: v as typeof d.jobType } : d)}
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                        {JOB_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* ══ ROOFING CALCULATOR ══════════════════════════════════════════ */}
              {draft.jobType === 'Roofing' && (() => {
                const rc = draft.roofCalc
                const sq = parseFloat(rc.squares) || 0
                const waste = parseFloat(rc.wastePct) / 100 || 0
                const adjustedSq = sq * (1 + waste)
                const matTotal = adjustedSq * (parseFloat(rc.materialPerSq) || 0)

                // Labor
                let laborTotal = 0
                if (rc.laborMethod === 'perSq') {
                  const { PITCH_MULTIPLIER } = (() => {
                    const pm: Record<string, number> = {
                      '4/12': 1.0, '5/12': 1.06, '6/12': 1.12, '7/12': 1.18,
                      '8/12': 1.25, '9/12': 1.31, '10/12': 1.37, '11/12': 1.43,
                      '12/12': 1.5, 'Steep (>12/12)': 1.65,
                    }
                    return { PITCH_MULTIPLIER: pm }
                  })()
                  laborTotal = sq * (parseFloat(rc.laborPerSq) || 0) * (PITCH_MULTIPLIER[rc.pitch] ?? 1)
                } else if (rc.laborMethod === 'dayRate') {
                  laborTotal = (parseFloat(rc.numDays) || 0) * (parseFloat(rc.dayRate) || 0)
                } else {
                  laborTotal = (parseFloat(rc.numWorkers) || 0) * (parseFloat(rc.laborHours) || 0) * (parseFloat(rc.hourlyRate) || 0)
                }
                const burdenTotal = laborTotal * ((parseFloat(rc.burdenPct) || 0) / 100)

                const { subtotal } = calcEstimateTotal(draft)

                return (
                  <div className="space-y-3">
                    {/* Material Type */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Material Type</p>
                      <BtnGroup
                        options={['Shingle', 'Flat/TPO', 'Metal', 'Tile'] as const}
                        value={rc.materialType}
                        onChange={v => setRC({ materialType: v })}
                      />
                    </div>

                    {/* Job Parameters */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Job Parameters</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Roof Area (sq ft)</Label>
                          <Input type="number" value={rc.squares}
                            onChange={e => setRC({ squares: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Pitch</Label>
                          <Select value={rc.pitch}
                            onValueChange={v => setRC({ pitch: v as typeof rc.pitch })}>
                            <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                              {PITCH_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {/* Waste slider */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-zinc-300 text-xs">Waste %</Label>
                          <span className="text-amber-400 text-xs font-medium">{rc.wastePct || '10'}%</span>
                        </div>
                        <input
                          type="range" min="5" max="30" step="1"
                          value={rc.wastePct || '10'}
                          onChange={e => setRC({ wastePct: e.target.value })}
                          className="w-full accent-amber-500"
                        />
                        <div className="flex justify-between text-zinc-600 text-xs">
                          <span>5%</span><span>30%</span>
                        </div>
                      </div>
                      {/* Tear-off layers */}
                      <div className="space-y-1.5">
                        <Label className="text-zinc-300 text-xs">Tear-Off Layers</Label>
                        <div className="flex gap-2 items-center">
                          <BtnGroup
                            options={['0', '1', '2', '3'] as const}
                            value={rc.tearOffLayers as '0' | '1' | '2' | '3'}
                            onChange={v => setRC({ tearOffLayers: v })}
                          />
                          {rc.tearOffLayers !== '0' && (
                            <div className="flex items-center gap-2 ml-2">
                              <Label className="text-zinc-400 text-xs shrink-0">Rate / Sq</Label>
                              <Input type="number" value={rc.tearoffRate}
                                onChange={e => setRC({ tearoffRate: e.target.value })}
                                placeholder="35" className={`${inputCls} w-20 h-8 text-sm`} />
                            </div>
                          )}
                        </div>
                        {rc.tearOffLayers === '0' && (
                          <p className="text-zinc-600 text-xs">0 = no tear-off</p>
                        )}
                      </div>
                    </div>

                    {/* Materials */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Materials</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Material Cost / Square</Label>
                          <Input type="number" value={rc.materialPerSq}
                            onChange={e => setRC({ materialPerSq: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Material Total</Label>
                          <div className={readOnlyCls}>{fmtOrDash(matTotal)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Labor */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Labor</p>
                      {/* Method tabs */}
                      <div className="flex gap-1">
                        {([['perSq', 'Per Square ($/sq)'], ['dayRate', 'Day Rate'], ['hourly', 'Hourly']] as const).map(([val, label]) => (
                          <button key={val} type="button"
                            onClick={() => setRC({ laborMethod: val })}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                              rc.laborMethod === val
                                ? 'bg-amber-600 border-amber-600 text-white'
                                : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 bg-zinc-900/30'
                            }`}
                          >{label}</button>
                        ))}
                      </div>

                      {rc.laborMethod === 'perSq' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-zinc-300 text-xs">Labor / Square</Label>
                            <Input type="number" value={rc.laborPerSq}
                              onChange={e => setRC({ laborPerSq: e.target.value })}
                              placeholder="0" className={inputCls} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-xs">Est. Labor Total</Label>
                            <div className={readOnlyCls}>{fmtOrDash(laborTotal)}</div>
                          </div>
                        </div>
                      )}

                      {rc.laborMethod === 'dayRate' && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-zinc-300 text-xs"># Days</Label>
                            <Input type="number" value={rc.numDays}
                              onChange={e => setRC({ numDays: e.target.value })}
                              placeholder="0" className={inputCls} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-300 text-xs">Day Rate $</Label>
                            <Input type="number" value={rc.dayRate}
                              onChange={e => setRC({ dayRate: e.target.value })}
                              placeholder="0" className={inputCls} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-xs">Est. Labor Total</Label>
                            <div className={readOnlyCls}>{fmtOrDash(laborTotal)}</div>
                          </div>
                        </div>
                      )}

                      {rc.laborMethod === 'hourly' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-zinc-300 text-xs"># Workers</Label>
                            <Input type="number" value={rc.numWorkers}
                              onChange={e => setRC({ numWorkers: e.target.value })}
                              placeholder="0" className={inputCls} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-300 text-xs">Hours</Label>
                            <Input type="number" value={rc.laborHours}
                              onChange={e => setRC({ laborHours: e.target.value })}
                              placeholder="0" className={inputCls} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-300 text-xs">Rate / hr</Label>
                            <Input type="number" value={rc.hourlyRate}
                              onChange={e => setRC({ hourlyRate: e.target.value })}
                              placeholder="0" className={inputCls} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-xs">Est. Labor Total</Label>
                            <div className={readOnlyCls}>{fmtOrDash(laborTotal)}</div>
                          </div>
                        </div>
                      )}

                      {/* Burden */}
                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-700">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">
                            Labor Burden %
                            <span className="text-zinc-500 ml-1">(Taxes, insurance, benefits)</span>
                          </Label>
                          <Input type="number" value={rc.burdenPct}
                            onChange={e => setRC({ burdenPct: e.target.value })}
                            placeholder="35" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Burden Total</Label>
                          <div className={readOnlyCls}>{fmtOrDash(burdenTotal)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Line Items (roofing-specific fixed fields) */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Additional Line Items</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Permit Fee $</Label>
                          <Input type="number" value={rc.permitFee}
                            onChange={e => setRC({ permitFee: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Dumpster / Haul Away $</Label>
                          <Input type="number" value={rc.dumpster}
                            onChange={e => setRC({ dumpster: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Decking — # Sheets</Label>
                          <Input type="number" value={rc.deckingSheets}
                            onChange={e => setRC({ deckingSheets: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Cost / Sheet $</Label>
                          <Input type="number" value={rc.deckingCostPerSheet}
                            onChange={e => setRC({ deckingCostPerSheet: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Drip Edge / Flashing (LF)</Label>
                          <Input type="number" value={rc.dripEdgeLF}
                            onChange={e => setRC({ dripEdgeLF: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Cost / LF $</Label>
                          <Input type="number" value={rc.dripEdgeCostPerLF}
                            onChange={e => setRC({ dripEdgeCostPerLF: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                      </div>
                    </div>

                    {/* Accessories table */}

                    {/* Pricing */}
                    <PricingCards
                      method={rc.pricingMethod}
                      markup={rc.markupPct}
                      onMethod={m => setRC({ pricingMethod: m })}
                      onMarkup={v => setRC({ markupPct: v })}
                      sellLabel="Sell Price / Square"
                      sellValue={rc.sellPricePerSq}
                      onSell={v => setRC({ sellPricePerSq: v })}
                      subtotal={subtotal}
                    />
                  </div>
                )
              })()}

              {/* ══ HVAC CALCULATOR ═════════════════════════════════════════════ */}
              {draft.jobType === 'HVAC' && (() => {
                const tc = draft.tradeCalc
                const equipCost = parseFloat(tc.equipmentCost) || 0
                const ductworkCost = (parseFloat(tc.ductworkLF) || 0) * (parseFloat(tc.ductworkRate) || 0)
                const laborCost = (parseFloat(tc.laborHours) || 0) * (parseFloat(tc.hourlyRate) || 0)
                const burdenTotal = laborCost * ((parseFloat(tc.burdenPct) || 0) / 100)
                const { subtotal } = calcEstimateTotal(draft)
                return (
                  <div className="space-y-3">
                    {/* Equipment */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Equipment</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Equipment Cost</Label>
                          <Input type="number" value={tc.equipmentCost}
                            onChange={e => setTC({ equipmentCost: e.target.value })}
                            placeholder="Units, coils, systems..." className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Equipment Cost</Label>
                          <div className={readOnlyCls}>{fmtOrDash(equipCost)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Ductwork */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Ductwork</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">LF</Label>
                          <Input type="number" value={tc.ductworkLF}
                            onChange={e => setTC({ ductworkLF: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Rate / LF</Label>
                          <Input type="number" value={tc.ductworkRate}
                            onChange={e => setTC({ ductworkRate: e.target.value })}
                            placeholder="18" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Ductwork Cost</Label>
                          <div className={readOnlyCls}>{fmtOrDash(ductworkCost)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Labor */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Labor</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Hours</Label>
                          <Input type="number" value={tc.laborHours}
                            onChange={e => setTC({ laborHours: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Rate</Label>
                          <Input type="number" value={tc.hourlyRate}
                            onChange={e => setTC({ hourlyRate: e.target.value })}
                            placeholder="85" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Labor Cost</Label>
                          <div className={readOnlyCls}>{fmtOrDash(laborCost)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-700">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">
                            Burden %
                            <span className="text-zinc-500 ml-1">(Taxes, insurance, benefits)</span>
                          </Label>
                          <Input type="number" value={tc.burdenPct}
                            onChange={e => setTC({ burdenPct: e.target.value })}
                            placeholder="35" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Burden Total</Label>
                          <div className={readOnlyCls}>{fmtOrDash(burdenTotal)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Materials */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Materials</p>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-300 text-xs">Material Cost</Label>
                        <Input type="number" value={tc.materialCost}
                          onChange={e => setTC({ materialCost: e.target.value })}
                          placeholder="0" className={inputCls} />
                      </div>
                    </div>

                    <PricingCards
                      method={tc.pricingMethod}
                      markup={tc.markupPct}
                      onMethod={m => setTC({ pricingMethod: m })}
                      onMarkup={v => setTC({ markupPct: v })}
                      sellLabel="Flat Sell Price"
                      sellValue={tc.sellPrice}
                      onSell={v => setTC({ sellPrice: v })}
                      subtotal={subtotal}
                    />
                  </div>
                )
              })()}

              {/* ══ PLUMBING CALCULATOR ═════════════════════════════════════════ */}
              {draft.jobType === 'Plumbing' && (() => {
                const tc = draft.tradeCalc
                const fixtureHours = (parseFloat(tc.numFixtures) || 0) * (parseFloat(tc.hoursPerFixture) || 0)
                const fixtureLaborCost = fixtureHours * (parseFloat(tc.hourlyRate) || 0)
                const extraLaborCost = (parseFloat(tc.laborHours) || 0) * (parseFloat(tc.hourlyRate) || 0)
                const totalLaborCost = fixtureLaborCost + extraLaborCost
                const burdenTotal = totalLaborCost * ((parseFloat(tc.burdenPct) || 0) / 100)
                const { subtotal } = calcEstimateTotal(draft)
                return (
                  <div className="space-y-3">
                    {/* Service */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Service</p>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-300 text-xs">Service Call Fee (optional)</Label>
                        <Input type="number" value={tc.serviceCallFee}
                          onChange={e => setTC({ serviceCallFee: e.target.value })}
                          placeholder="0" className={inputCls} />
                      </div>
                    </div>

                    {/* Fixtures */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Fixtures</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs"># Fixtures</Label>
                          <Input type="number" value={tc.numFixtures}
                            onChange={e => setTC({ numFixtures: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Hours / Fixture</Label>
                          <Input type="number" value={tc.hoursPerFixture}
                            onChange={e => setTC({ hoursPerFixture: e.target.value })}
                            placeholder="2" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Fixture Labor</Label>
                          <div className={readOnlyCls}>{fmtOrDash(fixtureLaborCost)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Labor */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Labor</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Extra Hours</Label>
                          <Input type="number" value={tc.laborHours}
                            onChange={e => setTC({ laborHours: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Rate</Label>
                          <Input type="number" value={tc.hourlyRate}
                            onChange={e => setTC({ hourlyRate: e.target.value })}
                            placeholder="85" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Labor Total</Label>
                          <div className={readOnlyCls}>{fmtOrDash(totalLaborCost)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-700">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">
                            Burden %
                            <span className="text-zinc-500 ml-1">(Taxes, insurance, benefits)</span>
                          </Label>
                          <Input type="number" value={tc.burdenPct}
                            onChange={e => setTC({ burdenPct: e.target.value })}
                            placeholder="35" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Burden Total</Label>
                          <div className={readOnlyCls}>{fmtOrDash(burdenTotal)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Materials */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Materials</p>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-300 text-xs">Material Cost</Label>
                        <Input type="number" value={tc.materialCost}
                          onChange={e => setTC({ materialCost: e.target.value })}
                          placeholder="0" className={inputCls} />
                      </div>
                    </div>

                    <PricingCards
                      method={tc.pricingMethod}
                      markup={tc.markupPct}
                      onMethod={m => setTC({ pricingMethod: m })}
                      onMarkup={v => setTC({ markupPct: v })}
                      sellLabel="Flat Sell Price"
                      sellValue={tc.sellPrice}
                      onSell={v => setTC({ sellPrice: v })}
                      subtotal={subtotal}
                    />
                  </div>
                )
              })()}

              {/* ══ ELECTRICAL CALCULATOR ═══════════════════════════════════════ */}
              {draft.jobType === 'Electrical' && (() => {
                const tc = draft.tradeCalc
                const sqFtCost = tc.electricalMethod === 'sqft'
                  ? (parseFloat(tc.sqFt) || 0) * (parseFloat(tc.sqFtRate) || 0)
                  : 0
                const hoursCost = tc.electricalMethod === 'hours'
                  ? (parseFloat(tc.laborHours) || 0) * (parseFloat(tc.hourlyRate) || 0)
                  : 0
                const laborCost = sqFtCost > 0 ? sqFtCost : hoursCost
                const burdenTotal = laborCost * ((parseFloat(tc.burdenPct) || 0) / 100)
                const { subtotal } = calcEstimateTotal(draft)
                return (
                  <div className="space-y-3">
                    {/* Estimation Method */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Estimation Method</p>
                      <BtnGroup
                        options={['sqft', 'hours'] as const}
                        value={tc.electricalMethod}
                        onChange={v => setTC({ electricalMethod: v })}
                      />
                      {tc.electricalMethod === 'sqft' && (
                        <div className="grid grid-cols-3 gap-3 mt-2">
                          <div className="space-y-1.5">
                            <Label className="text-zinc-300 text-xs">Sq Ft</Label>
                            <Input type="number" value={tc.sqFt}
                              onChange={e => setTC({ sqFt: e.target.value })}
                              placeholder="0" className={inputCls} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-300 text-xs">Rate / Sq Ft</Label>
                            <Input type="number" value={tc.sqFtRate}
                              onChange={e => setTC({ sqFtRate: e.target.value })}
                              placeholder="5.75" className={inputCls} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-xs">Est. Labor</Label>
                            <div className={readOnlyCls}>{fmtOrDash(sqFtCost)}</div>
                          </div>
                        </div>
                      )}
                      {tc.electricalMethod === 'hours' && (
                        <div className="grid grid-cols-3 gap-3 mt-2">
                          <div className="space-y-1.5">
                            <Label className="text-zinc-300 text-xs">Hours</Label>
                            <Input type="number" value={tc.laborHours}
                              onChange={e => setTC({ laborHours: e.target.value })}
                              placeholder="0" className={inputCls} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-300 text-xs">Rate</Label>
                            <Input type="number" value={tc.hourlyRate}
                              onChange={e => setTC({ hourlyRate: e.target.value })}
                              placeholder="110" className={inputCls} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-xs">Est. Labor</Label>
                            <div className={readOnlyCls}>{fmtOrDash(hoursCost)}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Labor Burden */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Labor Burden</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">
                            Burden %
                            <span className="text-zinc-500 ml-1">(Taxes, insurance, benefits)</span>
                          </Label>
                          <Input type="number" value={tc.burdenPct}
                            onChange={e => setTC({ burdenPct: e.target.value })}
                            placeholder="35" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Burden Total</Label>
                          <div className={readOnlyCls}>{fmtOrDash(burdenTotal)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Materials */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Materials</p>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-300 text-xs">Material Cost</Label>
                        <Input type="number" value={tc.materialCost}
                          onChange={e => setTC({ materialCost: e.target.value })}
                          placeholder="0" className={inputCls} />
                      </div>
                    </div>

                    <PricingCards
                      method={tc.pricingMethod}
                      markup={tc.markupPct}
                      onMethod={m => setTC({ pricingMethod: m })}
                      onMarkup={v => setTC({ markupPct: v })}
                      sellLabel="Flat Sell Price"
                      sellValue={tc.sellPrice}
                      onSell={v => setTC({ sellPrice: v })}
                      subtotal={subtotal}
                    />
                  </div>
                )
              })()}

              {/* ══ LANDSCAPING CALCULATOR ══════════════════════════════════════ */}
              {draft.jobType === 'Landscaping' && (() => {
                const tc = draft.tradeCalc
                const areaCost = (parseFloat(tc.areaSqFt) || 0) * (parseFloat(tc.ratePerSqFt) || 0)
                const laborCost = (parseFloat(tc.laborHours) || 0) * (parseFloat(tc.hourlyRate) || 0)
                const burdenTotal = laborCost * ((parseFloat(tc.burdenPct) || 0) / 100)
                const bulkCost = (parseFloat(tc.cubicYards) || 0) * (parseFloat(tc.cubicYardRate) || 0)
                const { subtotal } = calcEstimateTotal(draft)
                return (
                  <div className="space-y-3">
                    {/* Area Work */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Area Work</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Sq Ft</Label>
                          <Input type="number" value={tc.areaSqFt}
                            onChange={e => setTC({ areaSqFt: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Rate / Sq Ft</Label>
                          <Input type="number" value={tc.ratePerSqFt}
                            onChange={e => setTC({ ratePerSqFt: e.target.value })}
                            placeholder="8" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Area Cost</Label>
                          <div className={readOnlyCls}>{fmtOrDash(areaCost)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Labor */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Labor</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Hours</Label>
                          <Input type="number" value={tc.laborHours}
                            onChange={e => setTC({ laborHours: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Rate</Label>
                          <Input type="number" value={tc.hourlyRate}
                            onChange={e => setTC({ hourlyRate: e.target.value })}
                            placeholder="50" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Labor</Label>
                          <div className={readOnlyCls}>{fmtOrDash(laborCost)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-700">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">
                            Burden %
                            <span className="text-zinc-500 ml-1">(Taxes, insurance, benefits)</span>
                          </Label>
                          <Input type="number" value={tc.burdenPct}
                            onChange={e => setTC({ burdenPct: e.target.value })}
                            placeholder="35" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Burden Total</Label>
                          <div className={readOnlyCls}>{fmtOrDash(burdenTotal)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Bulk Materials */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Bulk Materials</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Cubic Yards</Label>
                          <Input type="number" value={tc.cubicYards}
                            onChange={e => setTC({ cubicYards: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Rate / CY</Label>
                          <Input type="number" value={tc.cubicYardRate}
                            onChange={e => setTC({ cubicYardRate: e.target.value })}
                            placeholder="65" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Bulk Cost</Label>
                          <div className={readOnlyCls}>{fmtOrDash(bulkCost)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Plants & Materials */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Plants & Materials</p>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-300 text-xs">Material Cost</Label>
                        <Input type="number" value={tc.materialCost}
                          onChange={e => setTC({ materialCost: e.target.value })}
                          placeholder="0" className={inputCls} />
                      </div>
                    </div>

                    <PricingCards
                      method={tc.pricingMethod}
                      markup={tc.markupPct}
                      onMethod={m => setTC({ pricingMethod: m })}
                      onMarkup={v => setTC({ markupPct: v })}
                      sellLabel="Flat Sell Price"
                      sellValue={tc.sellPrice}
                      onSell={v => setTC({ sellPrice: v })}
                      subtotal={subtotal}
                    />
                  </div>
                )
              })()}

              {/* ══ PAINTING CALCULATOR ═════════════════════════════════════════ */}
              {draft.jobType === 'Painting' && (() => {
                const tc = draft.tradeCalc
                const paintSqFt = parseFloat(tc.paintableSqFt) || 0
                const numCoats = parseFloat(tc.numCoats) || 1
                const estHours = paintSqFt > 0 ? (paintSqFt * numCoats) / 200 : 0
                const exteriorMult = tc.paintType === 'Exterior' ? 1.3 : 1.0
                const laborCost = estHours * (parseFloat(tc.hourlyRate) || 0) * exteriorMult
                const burdenTotal = laborCost * ((parseFloat(tc.burdenPct) || 0) / 100)
                const { subtotal } = calcEstimateTotal(draft)
                return (
                  <div className="space-y-3">
                    {/* Type */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Type</p>
                      <div className="flex gap-2 items-center">
                        <BtnGroup
                          options={['Interior', 'Exterior'] as const}
                          value={tc.paintType}
                          onChange={v => setTC({ paintType: v })}
                        />
                        {tc.paintType === 'Exterior' && (
                          <span className="text-zinc-500 text-xs">+30% exterior premium</span>
                        )}
                      </div>
                    </div>

                    {/* Area */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Area</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Paintable Sq Ft</Label>
                          <Input type="number" value={tc.paintableSqFt}
                            onChange={e => setTC({ paintableSqFt: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Coats</Label>
                          <Select value={tc.numCoats} onValueChange={v => setTC({ numCoats: v })}>
                            <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                              <SelectItem value="1">1 coat</SelectItem>
                              <SelectItem value="2">2 coats</SelectItem>
                              <SelectItem value="3">3 coats</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Labor Hours</Label>
                          <div className={readOnlyCls}>{estHours > 0 ? `${estHours.toFixed(1)} hrs` : '--'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Labor */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Labor</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Hourly Rate</Label>
                          <Input type="number" value={tc.hourlyRate}
                            onChange={e => setTC({ hourlyRate: e.target.value })}
                            placeholder="60" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Labor Cost</Label>
                          <div className={readOnlyCls}>{fmtOrDash(laborCost)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-700">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">
                            Burden %
                            <span className="text-zinc-500 ml-1">(Taxes, insurance, benefits)</span>
                          </Label>
                          <Input type="number" value={tc.burdenPct}
                            onChange={e => setTC({ burdenPct: e.target.value })}
                            placeholder="35" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Burden Total</Label>
                          <div className={readOnlyCls}>{fmtOrDash(burdenTotal)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Prep Work */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Prep Work</p>
                      <div className="flex items-center gap-3">
                        <button type="button"
                          onClick={() => setTC({ prepWork: !tc.prepWork })}
                          className={`w-10 h-5 rounded-full transition-colors ${tc.prepWork ? 'bg-amber-600' : 'bg-zinc-700'}`}>
                          <span className={`block w-4 h-4 mx-0.5 rounded-full bg-white transition-transform ${tc.prepWork ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                        <Label className="text-zinc-300 text-xs">Prep work included</Label>
                      </div>
                      {tc.prepWork && (
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Prep Cost</Label>
                          <Input type="number" value={tc.prepSurcharge}
                            onChange={e => setTC({ prepSurcharge: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                      )}
                    </div>

                    {/* Paint & Materials */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Paint & Materials</p>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-300 text-xs">Material Cost</Label>
                        <Input type="number" value={tc.materialCost}
                          onChange={e => setTC({ materialCost: e.target.value })}
                          placeholder="0" className={inputCls} />
                      </div>
                    </div>

                    <PricingCards
                      method={tc.pricingMethod}
                      markup={tc.markupPct}
                      onMethod={m => setTC({ pricingMethod: m })}
                      onMarkup={v => setTC({ markupPct: v })}
                      sellLabel="Flat Sell Price"
                      sellValue={tc.sellPrice}
                      onSell={v => setTC({ sellPrice: v })}
                      subtotal={subtotal}
                    />
                  </div>
                )
              })()}

              {/* ══ GENERAL / OTHER CALCULATOR ══════════════════════════════════ */}
              {(draft.jobType === 'General' || draft.jobType === 'Other') && (() => {
                const tc = draft.tradeCalc
                const laborCost = (parseFloat(tc.laborHours) || 0) * (parseFloat(tc.hourlyRate) || 0)
                const burdenTotal = laborCost * ((parseFloat(tc.burdenPct) || 0) / 100)
                const { subtotal } = calcEstimateTotal(draft)
                return (
                  <div className="space-y-3">
                    {/* Labor */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Labor</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Hours</Label>
                          <Input type="number" value={tc.laborHours}
                            onChange={e => setTC({ laborHours: e.target.value })}
                            placeholder="0" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">Rate</Label>
                          <Input type="number" value={tc.hourlyRate}
                            onChange={e => setTC({ hourlyRate: e.target.value })}
                            placeholder="85" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Est. Labor</Label>
                          <div className={readOnlyCls}>{fmtOrDash(laborCost)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-700">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-300 text-xs">
                            Burden %
                            <span className="text-zinc-500 ml-1">(Taxes, insurance, benefits)</span>
                          </Label>
                          <Input type="number" value={tc.burdenPct}
                            onChange={e => setTC({ burdenPct: e.target.value })}
                            placeholder="35" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Burden Total</Label>
                          <div className={readOnlyCls}>{fmtOrDash(burdenTotal)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Materials */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Materials</p>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-300 text-xs">Material Cost</Label>
                        <Input type="number" value={tc.materialCost}
                          onChange={e => setTC({ materialCost: e.target.value })}
                          placeholder="0" className={inputCls} />
                      </div>
                    </div>

                    {/* Subcontractors */}
                    <div className={sectionCls}>
                      <p className={sectionLabelCls}>Subcontractors</p>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-300 text-xs">Subcontractor Cost</Label>
                        <Input type="number" value={tc.subcontractorCost}
                          onChange={e => setTC({ subcontractorCost: e.target.value })}
                          placeholder="0" className={inputCls} />
                      </div>
                    </div>

                    <PricingCards
                      method={tc.pricingMethod}
                      markup={tc.markupPct}
                      onMethod={m => setTC({ pricingMethod: m })}
                      onMarkup={v => setTC({ markupPct: v })}
                      sellLabel="Flat Sell Price"
                      sellValue={tc.sellPrice}
                      onSell={v => setTC({ sellPrice: v })}
                      subtotal={subtotal}
                    />
                  </div>
                )
              })()}

              {/* Live Total Preview */}
              {(() => {
                const { total } = calcEstimateTotal(draft)
                return total > 0 ? (
                  <div className="bg-zinc-800 rounded-lg px-3 py-2 flex justify-between items-center">
                    <span className="text-zinc-400 text-sm">Estimated Total</span>
                    <span className="text-amber-400 font-semibold">{fmt(total)}</span>
                  </div>
                ) : null
              })()}

              {/* Scope */}
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Scope of Work</Label>
                <textarea value={draft.scope}
                  onChange={e => setDraft(d => d ? { ...d, scope: e.target.value } : d)}
                  rows={3} placeholder="Describe the work to be performed..."
                  className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-600" />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Internal Notes</Label>
                <textarea value={draft.notes}
                  onChange={e => setDraft(d => d ? { ...d, notes: e.target.value } : d)}
                  rows={2} placeholder="Internal notes (not visible to client)..."
                  className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-600" />
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-500 text-white"
              onClick={handleSave}
              disabled={!draft?.client.name.trim()}
            >
              {isEditing ? 'Save Changes' : 'Create Estimate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Confirm */}
      <Dialog open={!!confirmConvert} onOpenChange={() => setConfirmConvert(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Convert to Job?</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400 text-sm">
            This will create a new job from <span className="text-white font-medium">{confirmConvert?.estimateNumber}</span> and mark the estimate as converted.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setConfirmConvert(null)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-500 text-white"
              onClick={() => confirmConvert && handleConvert(confirmConvert)}>
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Estimate?</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400 text-sm">This action cannot be undone.</p>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button className="bg-red-700 hover:bg-red-600 text-white" onClick={() => handleDelete(confirmDelete!)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
