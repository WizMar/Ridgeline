import { useState } from 'react'
import { Plus, Pencil, Trash2, BookOpen, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJobRecords } from '@/context/JobRecordsContext'
import { useAuth } from '@/context/AuthContext'
import { useMaterialTemplates } from '@/context/MaterialTemplatesContext'
import {
  MATERIAL_ORDER_STATUSES, MATERIAL_ORDER_STATUS_LABEL, MATERIAL_ORDER_STATUS_BADGE,
  type MaterialOrder, type MaterialOrderStatus,
} from '@/types/jobRecords'
import type { MaterialTemplateItem } from '@/types/materialTemplates'
import { toast } from 'sonner'

function fmtMoney(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function today() { return new Date().toISOString().slice(0, 10) }

type Props = { jobId: string; canEdit: boolean }

const blank = () => ({
  supplier: '', description: '', quantity: '1', unit: '', unitCost: '',
  dateOrdered: today(), status: 'ordered' as MaterialOrderStatus, notes: '',
})

type TemplatePickerStep = 'jobtype' | 'brand' | 'preview'

type PreviewItem = MaterialTemplateItem & { qty: string; cost: string; selected: boolean }

export default function JobMaterialOrdersTab({ jobId, canEdit }: Props) {
  const { user } = useAuth()
  const orgId = user?.org_id ?? ''
  const { materialOrdersByJob, addMaterialOrder, updateMaterialOrder, deleteMaterialOrder } = useJobRecords()
  const { brands, jobTypes, templates } = useMaterialTemplates()
  const orders = materialOrdersByJob(jobId)
  const totalCost = orders.reduce((s, o) => s + o.quantity * o.unitCost, 0)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MaterialOrder | null>(null)
  const [draft, setDraft] = useState(blank())
  const [saving, setSaving] = useState(false)

  // Template picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerStep, setPickerStep] = useState<TemplatePickerStep>('jobtype')
  const [pickerJobType, setPickerJobType] = useState('')
  const [pickerBrand, setPickerBrand] = useState('')
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([])
  const [loadingSaving, setLoadingSaving] = useState(false)

  function openNew() { setEditing(null); setDraft(blank()); setOpen(true) }

  function openEdit(o: MaterialOrder) {
    setEditing(o)
    setDraft({
      supplier: o.supplier, description: o.description,
      quantity: String(o.quantity), unit: o.unit, unitCost: String(o.unitCost),
      dateOrdered: o.dateOrdered ?? today(), status: o.status, notes: o.notes,
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!draft.description.trim()) { toast.error('Description is required'); return }
    setSaving(true)
    const payload = {
      orgId, jobId, supplier: draft.supplier, description: draft.description,
      quantity: parseFloat(draft.quantity) || 1, unit: draft.unit,
      unitCost: parseFloat(draft.unitCost) || 0, dateOrdered: draft.dateOrdered || null,
      status: draft.status, notes: draft.notes,
    }
    if (editing) { await updateMaterialOrder({ ...editing, ...payload }); toast.success('Order updated') }
    else { const r = await addMaterialOrder(payload); if (r) toast.success('Material added'); else toast.error('Failed') }
    setSaving(false); setOpen(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this material order?')) return
    await deleteMaterialOrder(id); toast.success('Order deleted')
  }

  // ── Template picker ────────────────────────────────────────────────────────

  function openPicker() {
    setPickerStep('jobtype'); setPickerJobType(''); setPickerBrand(''); setPreviewItems([])
    setPickerOpen(true)
  }

  function selectJobType(id: string) {
    setPickerJobType(id); setPickerBrand(''); setPickerStep('brand')
  }

  function selectBrand(brandId: string) {
    setPickerBrand(brandId)
    const template = templates.find(t => t.jobTypeId === pickerJobType && t.brandId === brandId)
    if (!template || template.items.length === 0) {
      toast.error('This list has no items yet. Add items in Settings → Material Lists.')
      return
    }
    setPreviewItems(template.items.map(item => ({
      ...item, qty: String(item.defaultQty), cost: String(item.unitCost), selected: true,
    })))
    setPickerStep('preview')
  }

  async function handleLoadTemplate() {
    const toAdd = previewItems.filter(i => i.selected)
    if (toAdd.length === 0) { toast.error('Select at least one item'); return }
    setLoadingSaving(true)
    const brand = brands.find(b => b.id === pickerBrand)?.name ?? ''
    await Promise.all(toAdd.map(item =>
      addMaterialOrder({
        orgId, jobId,
        supplier: brand,
        description: item.description ? `${item.name} – ${item.description}` : item.name,
        quantity: parseFloat(item.qty) || item.defaultQty,
        unit: item.unit,
        unitCost: parseFloat(item.cost) || item.unitCost,
        dateOrdered: today(),
        status: 'ordered',
        notes: '',
      })
    ))
    setLoadingSaving(false)
    setPickerOpen(false)
    toast.success(`${toAdd.length} item${toAdd.length !== 1 ? 's' : ''} added from template`)
  }

  const brandsForJobType = brands.filter(b =>
    templates.some(t => t.jobTypeId === pickerJobType && t.brandId === b.id)
  )

  const selectedCount = previewItems.filter(i => i.selected).length
  const previewTotal = previewItems.filter(i => i.selected)
    .reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.cost) || 0), 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Total Materials</p>
            <p className="text-white text-lg font-bold tabular-nums">{fmtMoney(totalCost)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Orders</p>
            <p className="text-white text-lg font-bold tabular-nums">{orders.length}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <Button onClick={openPicker} variant="outline" className="border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white gap-1.5">
                <BookOpen size={14} /> Load from Template
              </Button>
            )}
            <Button onClick={openNew} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5">
              <Plus size={14} /> Add Material
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      {orders.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-12 flex flex-col items-center justify-center gap-3 text-zinc-600 text-sm">
          <p>No materials recorded for this job.</p>
          {canEdit && templates.length > 0 && (
            <button onClick={openPicker} className="text-stone-400 hover:text-stone-300 text-xs underline underline-offset-2 transition-colors">
              Load from a material list template
            </button>
          )}
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-500 text-xs font-medium px-4 py-2.5">Description</th>
                  <th className="text-left text-zinc-500 text-xs font-medium px-4 py-2.5">Supplier</th>
                  <th className="text-right text-zinc-500 text-xs font-medium px-4 py-2.5">Qty</th>
                  <th className="text-right text-zinc-500 text-xs font-medium px-4 py-2.5">Unit Cost</th>
                  <th className="text-right text-zinc-500 text-xs font-medium px-4 py-2.5">Total</th>
                  <th className="text-left text-zinc-500 text-xs font-medium px-4 py-2.5">Date</th>
                  <th className="text-left text-zinc-500 text-xs font-medium px-4 py-2.5">Status</th>
                  {canEdit && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id} className={i < orders.length - 1 ? 'border-b border-zinc-800/50' : ''}>
                    <td className="px-4 py-3 text-zinc-200">
                      <p>{o.description}</p>
                      {o.notes && <p className="text-zinc-500 text-xs mt-0.5">{o.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{o.supplier || '—'}</td>
                    <td className="px-4 py-3 text-zinc-300 text-right tabular-nums">{o.quantity}{o.unit ? ` ${o.unit}` : ''}</td>
                    <td className="px-4 py-3 text-zinc-300 text-right tabular-nums">{fmtMoney(o.unitCost)}</td>
                    <td className="px-4 py-3 text-white text-right tabular-nums font-semibold">{fmtMoney(o.quantity * o.unitCost)}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{o.dateOrdered ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${MATERIAL_ORDER_STATUS_BADGE[o.status]}`}>
                        {MATERIAL_ORDER_STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(o)} className="text-zinc-500 hover:text-zinc-200 transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => handleDelete(o.id)} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-700 bg-zinc-800/40">
                  <td colSpan={4} className="px-4 py-2.5 text-zinc-400 text-sm font-medium">Total</td>
                  <td className="px-4 py-2.5 text-white text-right tabular-nums font-bold">{fmtMoney(totalCost)}</td>
                  <td colSpan={canEdit ? 3 : 2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-zinc-800">
            {orders.map(o => (
              <div key={o.id} className="p-4 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white text-sm font-medium">{o.description}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${MATERIAL_ORDER_STATUS_BADGE[o.status]}`}>
                    {MATERIAL_ORDER_STATUS_LABEL[o.status]}
                  </span>
                </div>
                {o.supplier && <p className="text-zinc-500 text-xs">{o.supplier}</p>}
                <div className="flex items-center justify-between">
                  <p className="text-zinc-400 text-xs">{o.quantity}{o.unit ? ` ${o.unit}` : ''} × {fmtMoney(o.unitCost)}</p>
                  <p className="text-white text-sm font-semibold tabular-nums">{fmtMoney(o.quantity * o.unitCost)}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => openEdit(o)} className="text-zinc-500 hover:text-zinc-200 text-xs flex items-center gap-1"><Pencil size={11} /> Edit</button>
                    <button onClick={() => handleDelete(o.id)} className="text-zinc-500 hover:text-red-400 text-xs flex items-center gap-1"><Trash2 size={11} /> Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Material' : 'Add Material'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Description *</Label>
                <Input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder="e.g. Architectural Shingles 30yr" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Supplier</Label>
                <Input value={draft.supplier} onChange={e => setDraft(d => ({ ...d, supplier: e.target.value }))}
                  placeholder="e.g. ABC Supply" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Qty</Label>
                <Input type="number" value={draft.quantity} onChange={e => setDraft(d => ({ ...d, quantity: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Unit</Label>
                <Input value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))}
                  placeholder="sq, lbs…" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Unit Cost ($)</Label>
                <Input type="number" value={draft.unitCost} onChange={e => setDraft(d => ({ ...d, unitCost: e.target.value }))}
                  placeholder="0.00" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Date Ordered</Label>
                <Input type="date" value={draft.dateOrdered} onChange={e => setDraft(d => ({ ...d, dateOrdered: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Status</Label>
                <Select value={draft.status} onValueChange={v => setDraft(d => ({ ...d, status: v as MaterialOrderStatus }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {MATERIAL_ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{MATERIAL_ORDER_STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Notes</Label>
              <textarea value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} rows={2}
                placeholder="Any additional notes…"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-500" />
            </div>
            {draft.quantity && draft.unitCost && (
              <p className="text-zinc-400 text-sm">Total: <span className="text-white font-semibold">{fmtMoney((parseFloat(draft.quantity) || 0) * (parseFloat(draft.unitCost) || 0))}</span></p>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-stone-500 hover:bg-stone-400 text-white" disabled={saving || !draft.description.trim()} onClick={handleSave}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Add Material'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pickerStep === 'jobtype' && 'Select Job Type'}
              {pickerStep === 'brand' && 'Select Brand'}
              {pickerStep === 'preview' && 'Review & Load Materials'}
            </DialogTitle>
          </DialogHeader>

          {/* Step: Job Type */}
          {pickerStep === 'jobtype' && (
            <div className="mt-2 space-y-2">
              {jobTypes.filter(jt => templates.some(t => t.jobTypeId === jt.id)).length === 0 ? (
                <p className="text-zinc-500 text-sm py-4">No material lists set up yet. Go to Settings → Material Lists to create them.</p>
              ) : (
                jobTypes
                  .filter(jt => templates.some(t => t.jobTypeId === jt.id))
                  .map(jt => (
                    <button key={jt.id} onClick={() => selectJobType(jt.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 transition-colors text-left">
                      <span className="text-white text-sm">{jt.name}</span>
                      <ChevronRight size={14} className="text-zinc-500" />
                    </button>
                  ))
              )}
            </div>
          )}

          {/* Step: Brand */}
          {pickerStep === 'brand' && (
            <div className="mt-2 space-y-2">
              <button onClick={() => setPickerStep('jobtype')} className="text-zinc-500 hover:text-zinc-300 text-xs mb-2 transition-colors">← Back</button>
              {brandsForJobType.length === 0 ? (
                <p className="text-zinc-500 text-sm py-4">No brands have a material list for this job type yet.</p>
              ) : (
                brandsForJobType.map(b => {
                  const template = templates.find(t => t.jobTypeId === pickerJobType && t.brandId === b.id)
                  return (
                    <button key={b.id} onClick={() => selectBrand(b.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-500 transition-colors text-left">
                      <div>
                        <p className="text-white text-sm">{b.name}</p>
                        <p className="text-zinc-500 text-xs">{template?.items.length ?? 0} item{template?.items.length !== 1 ? 's' : ''}</p>
                      </div>
                      <ChevronRight size={14} className="text-zinc-500" />
                    </button>
                  )
                })
              )}
            </div>
          )}

          {/* Step: Preview */}
          {pickerStep === 'preview' && (
            <div className="mt-2 space-y-3">
              <button onClick={() => setPickerStep('brand')} className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">← Back</button>
              <p className="text-zinc-400 text-xs">Adjust quantities and costs, then uncheck any items you don't need.</p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {previewItems.map((item, idx) => (
                  <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${item.selected ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900 border-zinc-800 opacity-50'}`}>
                    <input type="checkbox" checked={item.selected}
                      onChange={e => setPreviewItems(prev => prev.map((pi, i) => i === idx ? { ...pi, selected: e.target.checked } : pi))}
                      className="mt-0.5 accent-stone-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{item.name}</p>
                      {item.description && <p className="text-zinc-500 text-xs">{item.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input type="number" value={item.qty} min="0" step="0.01"
                        onChange={e => setPreviewItems(prev => prev.map((pi, i) => i === idx ? { ...pi, qty: e.target.value } : pi))}
                        className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs text-right" />
                      <span className="text-zinc-500 text-xs w-8">{item.unit}</span>
                      <span className="text-zinc-500 text-xs">×</span>
                      <input type="number" value={item.cost} min="0" step="0.01"
                        onChange={e => setPreviewItems(prev => prev.map((pi, i) => i === idx ? { ...pi, cost: e.target.value } : pi))}
                        className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs text-right" />
                    </div>
                  </div>
                ))}
              </div>
              {selectedCount > 0 && (
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                  <p className="text-zinc-400 text-sm">{selectedCount} item{selectedCount !== 1 ? 's' : ''} selected</p>
                  <p className="text-white font-semibold tabular-nums text-sm">{fmtMoney(previewTotal)}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setPickerOpen(false)}>Cancel</Button>
            {pickerStep === 'preview' && (
              <Button className="bg-stone-500 hover:bg-stone-400 text-white" disabled={loadingSaving || selectedCount === 0} onClick={handleLoadTemplate}>
                {loadingSaving ? 'Loading…' : `Load ${selectedCount} Item${selectedCount !== 1 ? 's' : ''}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
