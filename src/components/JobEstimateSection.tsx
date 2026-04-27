import { useState } from 'react'
import { useSettings } from '@/context/SettingsContext'
import { useAuth } from '@/context/AuthContext'
import { usePriceBook } from '@/context/PriceBookContext'
import { useJobEstimate } from '@/hooks/useJobEstimate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PDFDownloadButton } from '@/components/PDFDownloadButton'
import { BookOpen, Plus, Trash2, FileText, Save, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import {
  type Estimate, type EstimateStatus, type LineItem, type PitchOption,
  PITCH_OPTIONS, ESTIMATE_STATUSES, STATUS_BADGE, calcEstimateTotal,
} from '@/types/estimate'
import type { Job } from '@/types/job'
import type { PDFCompanyInfo } from '@/components/EstimatePDF'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function BtnGroup<T extends string>({ options, value, onChange, small, labels }: { options: T[]; value: T; onChange: (v: T) => void; small?: boolean; labels?: Partial<Record<string, string>> }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-zinc-700">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 ${small ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs'} font-medium transition-colors ${
            value === opt ? 'bg-stone-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {labels?.[opt] ?? opt}
        </button>
      ))}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 items-center">
      <Label className="text-zinc-400 text-xs">{label}</Label>
      <div>{children}</div>
    </div>
  )
}

function FieldInput({ value, onChange, prefix, placeholder }: { value: string; onChange: (v: string) => void; prefix?: string; placeholder?: string }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">{prefix}</span>}
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '0'}
        className={`bg-zinc-900 border-zinc-700 text-white text-sm h-8 ${prefix ? 'pl-6' : ''}`}
      />
    </div>
  )
}

export default function JobEstimateSection({ job }: { job: Job }) {
  const { user } = useAuth()
  const { settings } = useSettings()
  const { items: pbItems } = usePriceBook()
  const isAdmin = user?.role === 'Admin' || user?.role === 'Sub-Admin'
  const pricing = settings.pricing ?? {}
  const defaults = {
    wastePct: pricing.wastePct ?? '10',
    markupPct: pricing.markupPct ?? '30',
    laborPerSq: pricing.laborPerSq ?? '85',
    tearoffRate: pricing.tearoffRate ?? '35',
    hourlyRate: pricing.hourlyRate ?? '45',
    burdenPct: pricing.burdenPct ?? '35',
  }

  const { estimate, setEstimate, loading, saving, createEstimate, saveEstimate, removeEstimate } = useJobEstimate(job)

  const mode = job.type === 'Repair' ? 'repair' : 'full'
  const [pbOpen, setPbOpen] = useState(false)
  const [pbSearch, setPbSearch] = useState('')
  const [liForm, setLiForm] = useState<{ desc: string; qty: string; unit: string; price: string } | null>(null)
  const [aiDesc, setAiDesc] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [declineReason, setDeclineReason] = useState<string | null>(null)

  const companyInfo: PDFCompanyInfo = {
    name: settings.company?.name ?? '',
    phone: settings.company?.phone ?? '',
    email: settings.company?.email ?? '',
    address: settings.company?.address ?? '',
    license: settings.company?.license ?? '',
    website: settings.company?.website ?? '',
    logoUrl: settings.company?.logoUrl ?? '',
  }

  async function generateWithAI() {
    if (!aiDesc.trim() || !estimate) return
    setAiLoading(true)
    try {
      const priceBookItems = pbItems.map(i => ({
        name: i.name,
        category: i.category,
        unit: i.unit,
        unitPrice: i.unitPrice,
      }))
      const { data, error } = await supabase.functions.invoke('ai_estimate', {
        body: { description: aiDesc, pricingDefaults: defaults, priceBookItems },
      })
      if (error || !data?.success) {
        toast.error(`AI failed: ${error?.message ?? data?.error ?? 'Unknown error'}`)
        return
      }
      const est = data.estimate
      setEstimate(prev => {
        if (!prev) return prev
        return {
          ...prev,
          jobType: est.jobType ?? prev.jobType,
          scope: est.scope ?? prev.scope,
          roofCalc: est.roofCalc ? { ...prev.roofCalc, ...est.roofCalc } : prev.roofCalc,
          tradeCalc: est.tradeCalc ? { ...prev.tradeCalc, ...est.tradeCalc } : prev.tradeCalc,
          lineItems: est.lineItems?.length
            ? [...prev.lineItems, ...est.lineItems.map((li: { description: string; qty: number; unit: string; unitPrice: number }) => ({ ...li, id: crypto.randomUUID() }))]
            : prev.lineItems,
        }
      })
      toast.success('Estimate filled in — review and adjust as needed')
      setAiDesc('')
    } catch {
      toast.error('Failed to reach AI — try again')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleCreate() {
    const est = await createEstimate(defaults)
    if (!est) toast.error('Failed to create estimate')
  }

  async function handleSave() {
    if (!estimate) return
    const ok = await saveEstimate(estimate)
    if (ok) toast.success('Estimate saved')
    else toast.error('Failed to save')
  }

  async function handleSubmitForApproval() {
    if (!estimate) return
    const ok = await saveEstimate({ ...estimate, status: 'Submitted' })
    if (ok) toast.success('Submitted for admin approval')
    else toast.error('Failed to submit')
  }

  async function handleApprove() {
    if (!estimate) return
    const ok = await saveEstimate({ ...estimate, status: 'Approved' })
    if (ok) toast.success('Estimate approved')
    else toast.error('Failed to approve')
  }

  async function handleDecline(reason: string) {
    if (!estimate) return
    const ok = await saveEstimate({ ...estimate, status: 'Declined', declineReason: reason })
    if (ok) { toast.success('Estimate declined'); setDeclineReason(null) }
    else toast.error('Failed to decline')
  }

  async function handleRevise() {
    if (!estimate) return
    const ok = await saveEstimate({ ...estimate, status: 'Draft', declineReason: '' })
    if (ok) toast.success('Reset to draft — make changes and resubmit')
    else toast.error('Failed to revise')
  }

  function update(patch: Partial<Estimate>) {
    if (!estimate) return
    setEstimate({ ...estimate, ...patch })
  }

  function updateRoof(patch: Partial<Estimate['roofCalc']>) {
    if (!estimate) return
    setEstimate({ ...estimate, roofCalc: { ...estimate.roofCalc, ...patch } })
  }

  function updateTrade(patch: Partial<Estimate['tradeCalc']>) {
    if (!estimate) return
    setEstimate({ ...estimate, tradeCalc: { ...estimate.tradeCalc, ...patch } })
  }

  function addLineItem(li: Omit<LineItem, 'id'>) {
    if (!estimate) return
    setEstimate({ ...estimate, lineItems: [...estimate.lineItems, { ...li, id: crypto.randomUUID() }] })
  }

  function removeLineItem(id: string) {
    if (!estimate) return
    setEstimate({ ...estimate, lineItems: estimate.lineItems.filter(l => l.id !== id) })
  }

  if (loading) return <p className="text-zinc-500 text-sm py-8 text-center">Loading estimate…</p>

  if (!estimate) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <FileText className="w-10 h-10 text-zinc-600" strokeWidth={1.5} />
        <p className="text-zinc-500 text-sm">No estimate for this job yet.</p>
        <Button onClick={handleCreate} className="bg-stone-500 hover:bg-stone-400 text-white">
          + Create Estimate
        </Button>
      </div>
    )
  }

  const totals = calcEstimateTotal(estimate)
  const isRoofing = job.type === 'Roofing'

  const filteredPb = pbItems.filter(i =>
    !pbSearch || i.name.toLowerCase().includes(pbSearch.toLowerCase()) ||
    i.category.toLowerCase().includes(pbSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <p className="text-white font-semibold">{estimate.estimateNumber}</p>
          <Select value={estimate.status} onValueChange={v => update({ status: v as EstimateStatus })}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white h-8 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
              {ESTIMATE_STATUSES.map(s => (
                <SelectItem key={s} value={s}>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_BADGE[s]}`}>{s}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Draft — non-admin sees Submit, admin sees grayed PDF */}
          {estimate.status === 'Draft' && !isAdmin && (
            <Button onClick={handleSubmitForApproval} disabled={saving} size="sm"
              className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5">
              Submit for Approval
            </Button>
          )}
          {estimate.status === 'Draft' && (
            <span title="Submit for approval before downloading" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-700 text-zinc-600 text-xs cursor-not-allowed select-none">
              <FileText size={13} /> PDF — Draft only
            </span>
          )}

          {/* Submitted — admin sees Approve / Decline */}
          {estimate.status === 'Submitted' && isAdmin && (
            <>
              <Button onClick={handleApprove} disabled={saving} size="sm"
                className="bg-green-700 hover:bg-green-600 text-white gap-1.5">
                Approve
              </Button>
              <Button onClick={() => setDeclineReason('')} disabled={saving} size="sm" variant="outline"
                className="border-red-800 text-red-400 hover:bg-red-900/30 gap-1.5">
                Decline
              </Button>
            </>
          )}
          {estimate.status === 'Submitted' && !isAdmin && (
            <span className="text-xs text-zinc-500 italic">Pending admin approval…</span>
          )}

          {/* Approved / Sent — PDF unlocked */}
          {(estimate.status === 'Approved' || estimate.status === 'Sent') && (
            <PDFDownloadButton estimate={estimate} totals={totals} company={companyInfo} />
          )}

          <Button onClick={handleSave} disabled={saving} size="sm" className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5">
            <Save size={13} />
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <button
            onClick={async () => { await removeEstimate(); toast.success('Estimate removed') }}
            className="p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors"
            title="Delete estimate"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Inline decline reason form — shown when admin clicks Decline */}
      {declineReason !== null && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-lg p-4 space-y-3">
          <p className="text-red-300 text-xs font-semibold uppercase tracking-widest">Reason for Declining</p>
          <textarea
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            rows={3}
            placeholder="Explain why this estimate was declined so the creator can revise it…"
            className="w-full rounded-md bg-zinc-900 border border-red-800/50 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-700"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="text-zinc-400 h-7" onClick={() => setDeclineReason(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={saving}
              className="bg-red-800 hover:bg-red-700 text-white h-7"
              onClick={() => handleDecline(declineReason)}>
              Confirm Decline
            </Button>
          </div>
        </div>
      )}

      {/* Declined banner — visible to everyone, Revise button for non-admins */}
      {estimate.status === 'Declined' && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-lg p-4 space-y-2">
          <p className="text-red-400 text-xs font-semibold uppercase tracking-widest">Estimate Declined</p>
          {estimate.declineReason ? (
            <p className="text-zinc-300 text-sm">{estimate.declineReason}</p>
          ) : (
            <p className="text-zinc-500 text-xs italic">No reason provided.</p>
          )}
          {!isAdmin && (
            <Button onClick={handleRevise} disabled={saving} size="sm"
              className="mt-1 bg-stone-500 hover:bg-stone-400 text-white">
              Revise &amp; Resubmit
            </Button>
          )}
        </div>
      )}

      {/* AI Estimate Assistant */}
      <div className="bg-zinc-800/60 border border-stone-500/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-stone-300" />
          <p className="text-stone-300 text-xs font-semibold uppercase tracking-widest">AI Estimate Assistant</p>
        </div>
        <textarea
          value={aiDesc}
          onChange={e => setAiDesc(e.target.value)}
          rows={3}
          placeholder={`Describe the job — e.g. "2,400 sq ft reroof, 6/12 pitch, tear off 1 layer, GAF Timberline shingles, needs permit"`}
          className="w-full rounded-md bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-stone-500"
        />
        <button
          type="button"
          onClick={generateWithAI}
          disabled={aiLoading || !aiDesc.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-stone-500 hover:bg-stone-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          <Sparkles size={13} />
          {aiLoading ? 'Generating…' : 'Generate Estimate'}
        </button>
      </div>

      {/* Repair Calculator */}
      {mode === 'repair' && (
        <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-zinc-300 text-xs font-semibold uppercase tracking-wide">Repair — Labor &amp; Materials</p>
          </div>
          <Row label="Labor Method">
            <BtnGroup
              options={['hourly', 'dayRate', 'flatRate'] as const}
              value={estimate.tradeCalc.repairLaborMethod ?? 'hourly'}
              onChange={v => updateTrade({ repairLaborMethod: v })}
              labels={{ hourly: 'Hourly', dayRate: 'Day Rate', flatRate: 'Flat Rate' }}
              small
            />
          </Row>

          {(estimate.tradeCalc.repairLaborMethod ?? 'hourly') === 'hourly' && (
            <>
              <Row label="Labor Hours"><FieldInput value={estimate.tradeCalc.laborHours} onChange={v => updateTrade({ laborHours: v })} /></Row>
              <Row label="Hourly Rate"><FieldInput prefix="$" value={estimate.tradeCalc.hourlyRate} onChange={v => updateTrade({ hourlyRate: v })} /></Row>
            </>
          )}
          {(estimate.tradeCalc.repairLaborMethod ?? 'hourly') === 'dayRate' && (
            <>
              <Row label="# Workers"><FieldInput value={estimate.tradeCalc.numWorkers} onChange={v => updateTrade({ numWorkers: v })} /></Row>
              <Row label="# Days"><FieldInput value={estimate.tradeCalc.numDays} onChange={v => updateTrade({ numDays: v })} /></Row>
              <Row label="Day Rate / Worker"><FieldInput prefix="$" value={estimate.tradeCalc.dayRate} onChange={v => updateTrade({ dayRate: v })} /></Row>
            </>
          )}
          {(estimate.tradeCalc.repairLaborMethod ?? 'hourly') === 'flatRate' && (
            <Row label="Flat Labor Amount"><FieldInput prefix="$" value={estimate.tradeCalc.flatLaborRate} onChange={v => updateTrade({ flatLaborRate: v })} /></Row>
          )}

          <Row label="Labor Burden %"><FieldInput prefix="%" value={estimate.tradeCalc.burdenPct} onChange={v => updateTrade({ burdenPct: v })} /></Row>
          <Row label="Material Cost"><FieldInput prefix="$" value={estimate.tradeCalc.materialCost} onChange={v => updateTrade({ materialCost: v })} /></Row>
          <Row label="Markup %"><FieldInput prefix="%" value={estimate.tradeCalc.markupPct} onChange={v => updateTrade({ markupPct: v })} /></Row>

          {(() => {
            const method = estimate.tradeCalc.repairLaborMethod ?? 'hourly'
            const burden = parseFloat(estimate.tradeCalc.burdenPct) || 0
            const materials = parseFloat(estimate.tradeCalc.materialCost) || 0
            const markupPct = parseFloat(estimate.tradeCalc.markupPct) || 0
            let laborBase = 0
            if (method === 'hourly') {
              laborBase = (parseFloat(estimate.tradeCalc.laborHours) || 0) * (parseFloat(estimate.tradeCalc.hourlyRate) || 0)
            } else if (method === 'dayRate') {
              laborBase = (parseFloat(estimate.tradeCalc.numWorkers) || 0) * (parseFloat(estimate.tradeCalc.numDays) || 0) * (parseFloat(estimate.tradeCalc.dayRate) || 0)
            } else {
              laborBase = parseFloat(estimate.tradeCalc.flatLaborRate) || 0
            }
            const labor = laborBase * (1 + burden / 100)
            const subtotal = labor + materials
            const markup = subtotal * (markupPct / 100)
            const total = subtotal + markup
            if (total === 0) return null
            return (
              <div className="border-t border-zinc-700 pt-3 space-y-1.5">
                {labor > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Labor (w/ burden)</span><span className="text-zinc-200 tabular-nums">{fmt(labor)}</span></div>}
                {materials > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Materials</span><span className="text-zinc-200 tabular-nums">{fmt(materials)}</span></div>}
                {markup > 0 && <div className="flex justify-between text-sm"><span className="text-zinc-400">Markup ({markupPct}%)</span><span className="text-zinc-200 tabular-nums">{fmt(markup)}</span></div>}
                <div className="border-t border-zinc-600 pt-2 flex justify-between">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-white font-bold tabular-nums">{fmt(total)}</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Full Job Trade Calculator */}
      {mode === 'full' && (
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 space-y-4">
        <p className="text-zinc-300 text-xs font-semibold uppercase tracking-wide">{job.type} Calculator</p>

        {isRoofing && (
          <div className="space-y-3">
            <Row label="Roof Area (sq ft)">
              <div className="space-y-1">
                <FieldInput value={estimate.roofCalc.squares} onChange={v => updateRoof({ squares: v })} placeholder="e.g. 2000" />
                {parseFloat(estimate.roofCalc.squares) > 0 && (
                  <p className="text-zinc-500 text-xs">= {(parseFloat(estimate.roofCalc.squares) / 100).toFixed(1)} roofing squares</p>
                )}
              </div>
            </Row>
            <Row label="Pitch">
              <Select value={estimate.roofCalc.pitch} onValueChange={v => updateRoof({ pitch: v as PitchOption })}>
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {PITCH_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Row>
            <Row label="Material Type">
              <BtnGroup
                options={['Shingle', 'Flat/TPO', 'Metal', 'Tile'] as const}
                value={estimate.roofCalc.materialType}
                onChange={v => updateRoof({ materialType: v })}
                small
              />
            </Row>
            <Row label="Material / sq (100 sq ft)"><FieldInput prefix="$" value={estimate.roofCalc.materialPerSq} onChange={v => updateRoof({ materialPerSq: v })} /></Row>
            <Row label="Waste %"><FieldInput prefix="%" value={estimate.roofCalc.wastePct} onChange={v => updateRoof({ wastePct: v })} /></Row>
            <Row label="Tear-off Layers">
              <BtnGroup options={['0', '1', '2', '3'] as const} value={estimate.roofCalc.tearOffLayers} onChange={v => updateRoof({ tearOffLayers: v })} small />
            </Row>
            {estimate.roofCalc.tearOffLayers !== '0' && (
              <Row label="Tear-off Rate / sq"><FieldInput prefix="$" value={estimate.roofCalc.tearoffRate} onChange={v => updateRoof({ tearoffRate: v })} /></Row>
            )}
            <Row label="Labor Method">
              <BtnGroup
                options={['perSq', 'dayRate', 'hourly'] as const}
                value={estimate.roofCalc.laborMethod}
                onChange={v => updateRoof({ laborMethod: v })}
                labels={{ perSq: 'Per/Sqft', dayRate: 'Day Rate', hourly: 'Hourly' }}
                small
              />
            </Row>
            {estimate.roofCalc.laborMethod === 'perSq' && (
              <Row label="Labor / sq"><FieldInput prefix="$" value={estimate.roofCalc.laborPerSq} onChange={v => updateRoof({ laborPerSq: v })} /></Row>
            )}
            {estimate.roofCalc.laborMethod === 'dayRate' && (
              <>
                <Row label="# Workers"><FieldInput value={estimate.roofCalc.numWorkers} onChange={v => updateRoof({ numWorkers: v })} /></Row>
                <Row label="# Days"><FieldInput value={estimate.roofCalc.numDays} onChange={v => updateRoof({ numDays: v })} /></Row>
                <Row label="Day Rate / worker"><FieldInput prefix="$" value={estimate.roofCalc.dayRate} onChange={v => updateRoof({ dayRate: v })} /></Row>
              </>
            )}
            {estimate.roofCalc.laborMethod === 'hourly' && (
              <>
                <Row label="# Workers"><FieldInput value={estimate.roofCalc.numWorkers} onChange={v => updateRoof({ numWorkers: v })} /></Row>
                <Row label="Hours"><FieldInput value={estimate.roofCalc.laborHours} onChange={v => updateRoof({ laborHours: v })} /></Row>
                <Row label="Hourly Rate"><FieldInput prefix="$" value={estimate.roofCalc.hourlyRate} onChange={v => updateRoof({ hourlyRate: v })} /></Row>
              </>
            )}
            <Row label="Labor Burden %"><FieldInput prefix="%" value={estimate.roofCalc.burdenPct} onChange={v => updateRoof({ burdenPct: v })} /></Row>
            <div className="border-t border-zinc-700 pt-3 space-y-3">
              <p className="text-zinc-500 text-xs uppercase tracking-wide">Additional Costs</p>
              <Row label="Permit Fee"><FieldInput prefix="$" value={estimate.roofCalc.permitFee} onChange={v => updateRoof({ permitFee: v })} /></Row>
              <Row label="Dumpster / Haul Away"><FieldInput prefix="$" value={estimate.roofCalc.dumpster} onChange={v => updateRoof({ dumpster: v })} /></Row>
              <Row label="Decking (sheets)"><FieldInput value={estimate.roofCalc.deckingSheets} onChange={v => updateRoof({ deckingSheets: v })} /></Row>
              {parseFloat(estimate.roofCalc.deckingSheets) > 0 && (
                <Row label="Cost / sheet"><FieldInput prefix="$" value={estimate.roofCalc.deckingCostPerSheet} onChange={v => updateRoof({ deckingCostPerSheet: v })} /></Row>
              )}
              <Row label="Drip Edge (LF)"><FieldInput value={estimate.roofCalc.dripEdgeLF} onChange={v => updateRoof({ dripEdgeLF: v })} /></Row>
              {parseFloat(estimate.roofCalc.dripEdgeLF) > 0 && (
                <Row label="Cost / LF"><FieldInput prefix="$" value={estimate.roofCalc.dripEdgeCostPerLF} onChange={v => updateRoof({ dripEdgeCostPerLF: v })} /></Row>
              )}
            </div>
            <Row label="Markup %"><FieldInput prefix="%" value={estimate.roofCalc.markupPct} onChange={v => updateRoof({ markupPct: v })} /></Row>
          </div>
        )}

        {!isRoofing && (
          <div className="space-y-3">
            {job.type === 'HVAC' && (
              <>
                <Row label="Equipment Cost"><FieldInput prefix="$" value={estimate.tradeCalc.equipmentCost} onChange={v => updateTrade({ equipmentCost: v })} /></Row>
                <Row label="Ductwork (LF)"><FieldInput value={estimate.tradeCalc.ductworkLF} onChange={v => updateTrade({ ductworkLF: v })} /></Row>
                {parseFloat(estimate.tradeCalc.ductworkLF) > 0 && (
                  <Row label="Ductwork Rate / LF"><FieldInput prefix="$" value={estimate.tradeCalc.ductworkRate} onChange={v => updateTrade({ ductworkRate: v })} /></Row>
                )}
              </>
            )}
            {job.type === 'Plumbing' && (
              <>
                <Row label="Service Call Fee"><FieldInput prefix="$" value={estimate.tradeCalc.serviceCallFee} onChange={v => updateTrade({ serviceCallFee: v })} /></Row>
                <Row label="# Fixtures"><FieldInput value={estimate.tradeCalc.numFixtures} onChange={v => updateTrade({ numFixtures: v })} /></Row>
                {parseFloat(estimate.tradeCalc.numFixtures) > 0 && (
                  <Row label="Hours / Fixture"><FieldInput value={estimate.tradeCalc.hoursPerFixture} onChange={v => updateTrade({ hoursPerFixture: v })} /></Row>
                )}
              </>
            )}
            {job.type === 'Electrical' && (
              <>
                <Row label="Method">
                  <BtnGroup
                    options={['sqft', 'hours'] as const}
                    value={estimate.tradeCalc.electricalMethod ?? 'sqft'}
                    onChange={v => updateTrade({ electricalMethod: v })}
                    labels={{ sqft: 'Sq Ft', hours: 'Hours' }}
                    small
                  />
                </Row>
                {estimate.tradeCalc.electricalMethod === 'sqft' ? (
                  <>
                    <Row label="Sq Ft"><FieldInput value={estimate.tradeCalc.sqFt} onChange={v => updateTrade({ sqFt: v })} /></Row>
                    <Row label="Rate / Sq Ft"><FieldInput prefix="$" value={estimate.tradeCalc.sqFtRate} onChange={v => updateTrade({ sqFtRate: v })} /></Row>
                  </>
                ) : (
                  <Row label="Labor Hours"><FieldInput value={estimate.tradeCalc.laborHours} onChange={v => updateTrade({ laborHours: v })} /></Row>
                )}
              </>
            )}
            {job.type === 'Landscaping' && (
              <>
                <Row label="Area (sq ft)"><FieldInput value={estimate.tradeCalc.areaSqFt} onChange={v => updateTrade({ areaSqFt: v })} /></Row>
                {parseFloat(estimate.tradeCalc.areaSqFt) > 0 && (
                  <Row label="Rate / Sq Ft"><FieldInput prefix="$" value={estimate.tradeCalc.ratePerSqFt} onChange={v => updateTrade({ ratePerSqFt: v })} /></Row>
                )}
                <Row label="Bulk Material (cu yd)"><FieldInput value={estimate.tradeCalc.cubicYards} onChange={v => updateTrade({ cubicYards: v })} /></Row>
                {parseFloat(estimate.tradeCalc.cubicYards) > 0 && (
                  <Row label="Rate / Cu Yd"><FieldInput prefix="$" value={estimate.tradeCalc.cubicYardRate} onChange={v => updateTrade({ cubicYardRate: v })} /></Row>
                )}
              </>
            )}
            {job.type === 'Painting' && (
              <>
                <Row label="Type">
                  <BtnGroup options={['Interior', 'Exterior'] as const} value={estimate.tradeCalc.paintType} onChange={v => updateTrade({ paintType: v })} small />
                </Row>
                <Row label="Paintable Sq Ft"><FieldInput value={estimate.tradeCalc.paintableSqFt} onChange={v => updateTrade({ paintableSqFt: v })} /></Row>
                <Row label="# Coats"><FieldInput value={estimate.tradeCalc.numCoats} onChange={v => updateTrade({ numCoats: v })} /></Row>
              </>
            )}
            {/* Shared fields for non-roofing */}
            <Row label="Labor Hours"><FieldInput value={estimate.tradeCalc.laborHours} onChange={v => updateTrade({ laborHours: v })} /></Row>
            <Row label="Hourly Rate"><FieldInput prefix="$" value={estimate.tradeCalc.hourlyRate} onChange={v => updateTrade({ hourlyRate: v })} /></Row>
            <Row label="Material Cost"><FieldInput prefix="$" value={estimate.tradeCalc.materialCost} onChange={v => updateTrade({ materialCost: v })} /></Row>
            {(job.type === 'General' || job.type === 'Other') && (
              <Row label="Subcontractor Cost"><FieldInput prefix="$" value={estimate.tradeCalc.subcontractorCost} onChange={v => updateTrade({ subcontractorCost: v })} /></Row>
            )}
            <Row label="Labor Burden %"><FieldInput prefix="%" value={estimate.tradeCalc.burdenPct} onChange={v => updateTrade({ burdenPct: v })} /></Row>
            <Row label="Markup %"><FieldInput prefix="%" value={estimate.tradeCalc.markupPct} onChange={v => updateTrade({ markupPct: v })} /></Row>
          </div>
        )}
      </div>
      )}

      {/* Line Items */}
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-zinc-300 text-xs font-semibold uppercase tracking-wide">Additional Line Items</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setPbOpen(true); setPbSearch('') }}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <BookOpen size={11} /> Price Book
            </button>
            <button
              onClick={() => setLiForm({ desc: '', qty: '1', unit: 'ea', price: '' })}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Plus size={11} /> Custom
            </button>
          </div>
        </div>

        {estimate.lineItems.length > 0 && (
          <div className="space-y-1">
            {estimate.lineItems.map(li => (
              <div key={li.id} className="flex items-center gap-3 px-3 py-2 bg-zinc-900 rounded-lg group">
                <p className="flex-1 text-zinc-200 text-sm truncate">{li.description || '—'}</p>
                <p className="text-zinc-400 text-xs shrink-0">{li.qty} {li.unit}</p>
                <p className="text-zinc-300 text-sm tabular-nums shrink-0 w-20 text-right">{fmt(li.qty * li.unitPrice)}</p>
                <button onClick={() => removeLineItem(li.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {liForm && (
          <div className="bg-zinc-900 rounded-lg p-3 space-y-2 border border-zinc-700">
            <Input value={liForm.desc} onChange={e => setLiForm(f => f && ({ ...f, desc: e.target.value }))}
              placeholder="Description" className="bg-zinc-800 border-zinc-700 text-white text-sm h-8" />
            <div className="grid grid-cols-3 gap-2">
              <Input value={liForm.qty} onChange={e => setLiForm(f => f && ({ ...f, qty: e.target.value }))}
                placeholder="Qty" className="bg-zinc-800 border-zinc-700 text-white text-sm h-8" />
              <Input value={liForm.unit} onChange={e => setLiForm(f => f && ({ ...f, unit: e.target.value }))}
                placeholder="Unit" className="bg-zinc-800 border-zinc-700 text-white text-sm h-8" />
              <Input value={liForm.price} onChange={e => setLiForm(f => f && ({ ...f, price: e.target.value }))}
                placeholder="Unit $" className="bg-zinc-800 border-zinc-700 text-white text-sm h-8" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="text-zinc-400 h-7" onClick={() => setLiForm(null)}>Cancel</Button>
              <Button size="sm" className="bg-stone-500 hover:bg-stone-400 text-white h-7" onClick={() => {
                if (!liForm.desc.trim()) return
                addLineItem({ description: liForm.desc, qty: parseFloat(liForm.qty) || 1, unit: liForm.unit, unitPrice: parseFloat(liForm.price) || 0 })
                setLiForm(null)
              }}>Add</Button>
            </div>
          </div>
        )}

        {/* Price Book picker */}
        {pbOpen && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 space-y-2">
            <Input value={pbSearch} onChange={e => setPbSearch(e.target.value)}
              placeholder="Search price book…" className="bg-zinc-800 border-zinc-700 text-white text-sm h-8" />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredPb.length === 0 ? (
                <p className="text-zinc-600 text-xs text-center py-3">No items found</p>
              ) : filteredPb.map(item => (
                <button key={item.id} onClick={() => {
                  addLineItem({ description: item.name, qty: 1, unit: item.unit, unitPrice: item.unitPrice })
                  setPbOpen(false)
                }} className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-zinc-800 text-left transition-colors">
                  <div>
                    <p className="text-zinc-200 text-sm">{item.name}</p>
                    <p className="text-zinc-500 text-xs">{item.category} · {item.unit}</p>
                  </div>
                  <p className="text-zinc-300 text-sm tabular-nums">{fmt(item.unitPrice)}</p>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="text-zinc-400 h-7 w-full" onClick={() => setPbOpen(false)}>Close</Button>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4 space-y-2">
        <p className="text-zinc-300 text-xs font-semibold uppercase tracking-wide mb-3">Breakdown</p>
        {totals.breakdown.map((b, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-zinc-400">{b.label}</span>
            <span className="text-zinc-200 tabular-nums">{fmt(b.amount)}</span>
          </div>
        ))}
        {totals.breakdown.length === 0 && (
          <p className="text-zinc-600 text-xs">Fill in the calculator above to see a breakdown.</p>
        )}
        {totals.total > 0 && (
          <>
            <div className="border-t border-zinc-700 pt-2 flex justify-between text-sm">
              <span className="text-zinc-400">Subtotal</span>
              <span className="text-zinc-200 tabular-nums">{fmt(totals.subtotal)}</span>
            </div>
            {totals.markup > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Markup ({totals.markupPct}%)</span>
                <span className="text-zinc-200 tabular-nums">{fmt(totals.markup)}</span>
              </div>
            )}
            <div className="border-t border-zinc-600 pt-3 flex justify-between">
              <span className="text-white font-semibold text-base">Total</span>
              <span className="text-white font-bold text-xl tabular-nums">{fmt(totals.total)}</span>
            </div>
          </>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs">Estimate Notes</Label>
        <textarea
          value={estimate.notes}
          onChange={e => update({ notes: e.target.value })}
          rows={2}
          placeholder="Notes visible on PDF…"
          className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-500"
        />
      </div>
    </div>
  )
}
