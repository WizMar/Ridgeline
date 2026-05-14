import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMaterialTemplates } from '@/context/MaterialTemplatesContext'
import { MATERIAL_UNITS } from '@/types/materialTemplates'
import type { MaterialTemplate, MaterialTemplateItem } from '@/types/materialTemplates'
import { toast } from 'sonner'

type View = 'home' | 'brands' | 'jobtypes' | 'lists' | 'template'

const cardCls = 'bg-zinc-900 border border-zinc-800 rounded-xl'

export default function MaterialListsSettings() {
  const {
    brands, jobTypes, templates,
    addBrand, updateBrand, deleteBrand,
    addJobType, updateJobType, deleteJobType,
    addTemplate, deleteTemplate,
    addTemplateItem, updateTemplateItem, deleteTemplateItem,
  } = useMaterialTemplates()

  const [view, setView] = useState<View>('home')
  const [activeTemplate, setActiveTemplate] = useState<MaterialTemplate | null>(null)

  // Name dialog (shared for brands + job types)
  const [nameDialog, setNameDialog] = useState<{ open: boolean; type: 'brand' | 'jobtype'; editing: { id: string; name: string } | null }>({ open: false, type: 'brand', editing: null })
  const [nameDraft, setNameDraft] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  // New template dialog
  const [newTemplateDialog, setNewTemplateDialog] = useState(false)
  const [newTemplateBrand, setNewTemplateBrand] = useState('')
  const [newTemplateJobType, setNewTemplateJobType] = useState('')
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateSaving, setNewTemplateSaving] = useState(false)

  // Item dialog
  const [itemDialog, setItemDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<MaterialTemplateItem | null>(null)
  const [itemDraft, setItemDraft] = useState({ name: '', description: '', unit: 'ea', unitCost: '', defaultQty: '1' })
  const [itemSaving, setItemSaving] = useState(false)

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openNewName(type: 'brand' | 'jobtype') {
    setNameDialog({ open: true, type, editing: null })
    setNameDraft('')
  }

  function openEditName(type: 'brand' | 'jobtype', id: string, name: string) {
    setNameDialog({ open: true, type, editing: { id, name } })
    setNameDraft(name)
  }

  async function handleSaveName() {
    if (!nameDraft.trim()) return
    setNameSaving(true)
    if (nameDialog.type === 'brand') {
      if (nameDialog.editing) { await updateBrand(nameDialog.editing.id, nameDraft.trim()); toast.success('Brand updated') }
      else { const r = await addBrand(nameDraft.trim()); if (r) toast.success('Brand added'); else { toast.error('Failed'); setNameSaving(false); return } }
    } else {
      if (nameDialog.editing) { await updateJobType(nameDialog.editing.id, nameDraft.trim()); toast.success('Job type updated') }
      else { const r = await addJobType(nameDraft.trim()); if (r) toast.success('Job type added'); else { toast.error('Failed'); setNameSaving(false); return } }
    }
    setNameSaving(false)
    setNameDialog(d => ({ ...d, open: false }))
  }

  async function handleDeleteBrand(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? All material lists using this brand will also be deleted.`)) return
    await deleteBrand(id); toast.success('Brand deleted')
  }

  async function handleDeleteJobType(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? All material lists using this job type will also be deleted.`)) return
    await deleteJobType(id); toast.success('Job type deleted')
  }

  async function handleCreateTemplate() {
    if (!newTemplateBrand || !newTemplateJobType) { toast.error('Select a brand and job type'); return }
    setNewTemplateSaving(true)
    const brand = brands.find(b => b.id === newTemplateBrand)
    const jt = jobTypes.find(j => j.id === newTemplateJobType)
    const name = newTemplateName.trim() || `${brand?.name} – ${jt?.name}`
    const t = await addTemplate(newTemplateBrand, newTemplateJobType, name)
    setNewTemplateSaving(false)
    if (!t) { toast.error('Failed to create list'); return }
    toast.success('Material list created')
    setNewTemplateDialog(false)
    setNewTemplateBrand(''); setNewTemplateJobType(''); setNewTemplateName('')
    setActiveTemplate(t); setView('template')
  }

  async function handleDeleteTemplate(t: MaterialTemplate) {
    const brand = brands.find(b => b.id === t.brandId)?.name ?? ''
    const jt = jobTypes.find(j => j.id === t.jobTypeId)?.name ?? ''
    if (!window.confirm(`Delete "${t.name || `${brand} – ${jt}`}"?`)) return
    await deleteTemplate(t.id); toast.success('Material list deleted')
    if (activeTemplate?.id === t.id) { setActiveTemplate(null); setView('lists') }
  }

  function openNewItem() {
    setEditingItem(null)
    setItemDraft({ name: '', description: '', unit: 'ea', unitCost: '', defaultQty: '1' })
    setItemDialog(true)
  }

  function openEditItem(item: MaterialTemplateItem) {
    setEditingItem(item)
    setItemDraft({ name: item.name, description: item.description, unit: item.unit, unitCost: String(item.unitCost), defaultQty: String(item.defaultQty) })
    setItemDialog(true)
  }

  async function handleSaveItem() {
    if (!liveTemplate) return
    if (!itemDraft.name.trim()) { toast.error('Name is required'); return }
    setItemSaving(true)
    const payload = {
      name: itemDraft.name.trim(), description: itemDraft.description.trim(),
      unit: itemDraft.unit, unitCost: parseFloat(itemDraft.unitCost) || 0,
      defaultQty: parseFloat(itemDraft.defaultQty) || 1,
      sortOrder: editingItem?.sortOrder ?? liveTemplate.items.length,
    }
    if (editingItem) {
      await updateTemplateItem({ ...editingItem, ...payload })
      toast.success('Item updated')
    } else {
      await addTemplateItem(liveTemplate.id, payload)
      toast.success('Item added')
    }
    setItemSaving(false); setItemDialog(false)
  }

  async function handleDeleteItem(item: MaterialTemplateItem) {
    if (!liveTemplate) return
    await deleteTemplateItem(item.id, liveTemplate.id)
    toast.success('Item removed')
  }

  const liveTemplate = activeTemplate ? templates.find(t => t.id === activeTemplate.id) ?? activeTemplate : null

  // ── Sub-components ────────────────────────────────────────────────────────

  const BackBar = ({ label, to }: { label: string; to: View }) => (
    <button onClick={() => setView(to)} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-4 transition-colors">
      <ArrowLeft size={14} /> {label}
    </button>
  )

  const NameDialog = () => (
    <Dialog open={nameDialog.open} onOpenChange={o => setNameDialog(d => ({ ...d, open: o }))}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle>{nameDialog.editing ? `Edit ${nameDialog.type === 'brand' ? 'Brand' : 'Job Type'}` : `Add ${nameDialog.type === 'brand' ? 'Brand' : 'Job Type'}`}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-1.5">
          <Label className="text-zinc-300">{nameDialog.type === 'brand' ? 'Brand' : 'Job Type'} Name *</Label>
          <Input value={nameDraft} onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
            placeholder={nameDialog.type === 'brand' ? 'e.g. GAF, CertainTeed, Carlisle' : 'e.g. Shingle Reroof, Flat Roof, Siding'}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" autoFocus />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" className="text-zinc-400" onClick={() => setNameDialog(d => ({ ...d, open: false }))}>Cancel</Button>
          <Button className="bg-stone-500 hover:bg-stone-400 text-white" disabled={nameSaving || !nameDraft.trim()} onClick={handleSaveName}>
            {nameSaving ? 'Saving…' : nameDialog.editing ? 'Update' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ── Views ─────────────────────────────────────────────────────────────────

  if (view === 'home') return (
    <div className="space-y-3">
      {[
        { id: 'brands' as View, label: 'Brands', desc: 'Manufacturers & suppliers your crew uses', count: brands.length },
        { id: 'jobtypes' as View, label: 'Job Types', desc: 'Types of work your crew performs', count: jobTypes.length },
        { id: 'lists' as View, label: 'Material Lists', desc: 'Pre-built lists by brand & job type', count: templates.length },
      ].map(t => (
        <button key={t.id} onClick={() => setView(t.id)}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800 transition-colors text-left">
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">{t.label}</p>
            <p className="text-zinc-500 text-xs mt-0.5">{t.desc}</p>
          </div>
          <span className="text-zinc-500 text-xs mr-1">{t.count}</span>
          <ChevronRight size={16} className="text-zinc-600 shrink-0" />
        </button>
      ))}
    </div>
  )

  if (view === 'brands') return (
    <div className="space-y-4">
      <BackBar label="Material Lists" to="home" />
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-sm">{brands.length} brand{brands.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => openNewName('brand')} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5" size="sm"><Plus size={13} /> Add Brand</Button>
      </div>
      {brands.length === 0
        ? <div className={`${cardCls} py-10 flex items-center justify-center text-zinc-600 text-sm`}>No brands yet.</div>
        : <div className={`${cardCls} divide-y divide-zinc-800`}>
            {brands.map(b => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-white text-sm">{b.name}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => openEditName('brand', b.id, b.name)} className="text-zinc-500 hover:text-zinc-200 transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => handleDeleteBrand(b.id, b.name)} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
      }
      <NameDialog />
    </div>
  )

  if (view === 'jobtypes') return (
    <div className="space-y-4">
      <BackBar label="Material Lists" to="home" />
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-sm">{jobTypes.length} job type{jobTypes.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => openNewName('jobtype')} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5" size="sm"><Plus size={13} /> Add Job Type</Button>
      </div>
      {jobTypes.length === 0
        ? <div className={`${cardCls} py-10 flex items-center justify-center text-zinc-600 text-sm`}>No job types yet.</div>
        : <div className={`${cardCls} divide-y divide-zinc-800`}>
            {jobTypes.map(j => (
              <div key={j.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-white text-sm">{j.name}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => openEditName('jobtype', j.id, j.name)} className="text-zinc-500 hover:text-zinc-200 transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => handleDeleteJobType(j.id, j.name)} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
      }
      <NameDialog />
    </div>
  )

  if (view === 'lists') {
    const grouped = templates.reduce<Record<string, MaterialTemplate[]>>((acc, t) => {
      const jt = jobTypes.find(j => j.id === t.jobTypeId)?.name ?? 'Unknown'
      ;(acc[jt] ??= []).push(t)
      return acc
    }, {})

    return (
      <div className="space-y-4">
        <BackBar label="Material Lists" to="home" />
        <div className="flex items-center justify-between">
          <p className="text-zinc-400 text-sm">{templates.length} list{templates.length !== 1 ? 's' : ''}</p>
          <Button onClick={() => setNewTemplateDialog(true)} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5" size="sm"
            disabled={brands.length === 0 || jobTypes.length === 0}>
            <Plus size={13} /> New List
          </Button>
        </div>

        {(brands.length === 0 || jobTypes.length === 0) ? (
          <div className={`${cardCls} p-5 text-zinc-500 text-sm`}>
            Add at least one{' '}
            <button onClick={() => setView('brands')} className="text-stone-400 underline underline-offset-2">brand</button>
            {' '}and one{' '}
            <button onClick={() => setView('jobtypes')} className="text-stone-400 underline underline-offset-2">job type</button>
            {' '}before creating a material list.
          </div>
        ) : templates.length === 0 ? (
          <div className={`${cardCls} py-10 flex items-center justify-center text-zinc-600 text-sm`}>No material lists yet.</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([jtName, list]) => (
              <div key={jtName}>
                <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-2">{jtName}</p>
                <div className={`${cardCls} divide-y divide-zinc-800`}>
                  {list.map(t => {
                    const brand = brands.find(b => b.id === t.brandId)?.name ?? '—'
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <button onClick={() => { setActiveTemplate(t); setView('template') }} className="flex-1 text-left">
                          <p className="text-white text-sm">{brand}</p>
                          <p className="text-zinc-500 text-xs">{t.items.length} item{t.items.length !== 1 ? 's' : ''}</p>
                        </button>
                        <button onClick={() => { setActiveTemplate(t); setView('template') }} className="text-zinc-600 hover:text-zinc-300 transition-colors"><ChevronRight size={14} /></button>
                        <button onClick={() => handleDeleteTemplate(t)} className="text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={newTemplateDialog} onOpenChange={setNewTemplateDialog}>
          <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
            <DialogHeader><DialogTitle>New Material List</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Job Type</Label>
                <Select value={newTemplateJobType} onValueChange={setNewTemplateJobType}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Select job type" /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {jobTypes.map(j => <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Brand</Label>
                <Select value={newTemplateBrand} onValueChange={setNewTemplateBrand}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">List Name <span className="text-zinc-600">(optional)</span></Label>
                <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
                  placeholder="Auto-generated from brand & job type"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" className="text-zinc-400" onClick={() => setNewTemplateDialog(false)}>Cancel</Button>
              <Button className="bg-stone-500 hover:bg-stone-400 text-white" disabled={newTemplateSaving || !newTemplateBrand || !newTemplateJobType} onClick={handleCreateTemplate}>
                {newTemplateSaving ? 'Creating…' : 'Create List'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (view === 'template' && liveTemplate) {
    const brand = brands.find(b => b.id === liveTemplate.brandId)?.name ?? '—'
    const jt = jobTypes.find(j => j.id === liveTemplate.jobTypeId)?.name ?? '—'

    return (
      <div className="space-y-4">
        <BackBar label="Material Lists" to="lists" />
        <div>
          <p className="text-white font-semibold">{liveTemplate.name || `${brand} – ${jt}`}</p>
          <p className="text-zinc-500 text-xs mt-0.5">{brand} · {jt}</p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-zinc-400 text-sm">{liveTemplate.items.length} item{liveTemplate.items.length !== 1 ? 's' : ''}</p>
          <Button onClick={openNewItem} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5" size="sm"><Plus size={13} /> Add Item</Button>
        </div>

        {liveTemplate.items.length === 0
          ? <div className={`${cardCls} py-10 flex items-center justify-center text-zinc-600 text-sm`}>No items yet. Add materials to this list.</div>
          : <div className={`${cardCls} overflow-hidden`}>
              <div className="hidden sm:grid grid-cols-[1fr_60px_60px_90px_56px] text-[10px] font-semibold uppercase tracking-wider text-zinc-600 px-4 py-2 border-b border-zinc-800">
                <span>Material</span><span className="text-right">Qty</span><span className="text-right">Unit</span><span className="text-right">Unit Cost</span><span></span>
              </div>
              {liveTemplate.items.map(item => (
                <div key={item.id} className="flex sm:grid sm:grid-cols-[1fr_60px_60px_90px_56px] items-center px-4 py-3 border-b border-zinc-800 last:border-0 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{item.name}</p>
                    {item.description && <p className="text-zinc-500 text-xs">{item.description}</p>}
                    <p className="text-zinc-500 text-xs sm:hidden">{item.defaultQty} {item.unit} · ${item.unitCost.toFixed(2)}</p>
                  </div>
                  <span className="text-zinc-300 text-sm tabular-nums text-right hidden sm:block">{item.defaultQty}</span>
                  <span className="text-zinc-500 text-xs text-right hidden sm:block">{item.unit}</span>
                  <span className="text-zinc-300 text-sm tabular-nums text-right hidden sm:block">${item.unitCost.toFixed(2)}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEditItem(item)} className="text-zinc-600 hover:text-zinc-300 transition-colors"><Pencil size={12} /></button>
                    <button onClick={() => handleDeleteItem(item)} className="text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
        }

        <Dialog open={itemDialog} onOpenChange={setItemDialog}>
          <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
            <DialogHeader><DialogTitle>{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Material Name *</Label>
                <Input value={itemDraft.name} onChange={e => setItemDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Architectural Shingles" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Description <span className="text-zinc-600">(optional)</span></Label>
                <Input value={itemDraft.description} onChange={e => setItemDraft(d => ({ ...d, description: e.target.value }))}
                  placeholder="e.g. Timberline HDZ, Charcoal" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Default Qty</Label>
                  <Input type="number" min="0" step="0.01" value={itemDraft.defaultQty}
                    onChange={e => setItemDraft(d => ({ ...d, defaultQty: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Unit</Label>
                  <Select value={itemDraft.unit} onValueChange={v => setItemDraft(d => ({ ...d, unit: v }))}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                      {MATERIAL_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Unit Cost</Label>
                  <Input type="number" min="0" step="0.01" value={itemDraft.unitCost}
                    onChange={e => setItemDraft(d => ({ ...d, unitCost: e.target.value }))}
                    placeholder="0.00" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="ghost" className="text-zinc-400" onClick={() => setItemDialog(false)}>Cancel</Button>
              <Button className="bg-stone-500 hover:bg-stone-400 text-white" disabled={itemSaving || !itemDraft.name.trim()} onClick={handleSaveItem}>
                {itemSaving ? 'Saving…' : editingItem ? 'Update' : 'Add Item'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return null
}
