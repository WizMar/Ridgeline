import { useState } from 'react'
import { useContracts } from '@/context/ContractsContext'
import { PLACEHOLDER_VARS, type ContractSection, type ContractTemplate } from '@/types/contract'
import { STARTER_TEMPLATES, type StarterTemplate } from '@/lib/contractTemplates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronDown, ChevronRight, Pencil, Trash2, FileSignature,
  Plus, Lock, ArrowUp, ArrowDown, FilePlus2,
} from 'lucide-react'

type View = 'list' | 'picker' | 'editor'
type Props = { onBack: () => void }

// ── Trade color chips ─────────────────────────────────────────────────────────
const TRADE_COLORS: Record<string, string> = {
  Roofing:     'bg-stone-800 text-stone-300',
  HVAC:        'bg-blue-900/60 text-blue-300',
  Plumbing:    'bg-cyan-900/60 text-cyan-300',
  Electrical:  'bg-yellow-900/60 text-yellow-300',
  Landscaping: 'bg-green-900/60 text-green-300',
  Painting:    'bg-purple-900/60 text-purple-300',
  General:     'bg-zinc-700 text-zinc-300',
}

function TradeChip({ trade }: { trade: string }) {
  const cls = TRADE_COLORS[trade] ?? 'bg-zinc-700 text-zinc-300'
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{trade}</span>
}

// ── Section editor row ────────────────────────────────────────────────────────
function SectionRow({
  section, index, total,
  onUpdate, onRemove, onMoveUp, onMoveDown,
}: {
  section: ContractSection
  index: number
  total: number
  onUpdate: (patch: Partial<ContractSection>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [open, setOpen] = useState(index === 0)

  return (
    <div className="border border-zinc-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-800/60">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {open ? <ChevronDown size={13} className="text-zinc-500 shrink-0" /> : <ChevronRight size={13} className="text-zinc-500 shrink-0" />}
          <span className="text-zinc-200 text-sm font-medium truncate">{section.title || 'Untitled Section'}</span>
          {section.required && <Lock size={10} className="text-zinc-600 shrink-0" />}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onMoveUp} disabled={index === 0} className="p-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors">
            <ArrowUp size={13} />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="p-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-30 transition-colors">
            <ArrowDown size={13} />
          </button>
          {!section.required && (
            <button onClick={onRemove} className="p-1 text-zinc-600 hover:text-red-400 transition-colors ml-1">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="p-3 space-y-2 bg-zinc-900">
          <Input
            value={section.title}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder="Section title"
            className="bg-zinc-800 border-zinc-700 text-white text-sm h-8 placeholder:text-zinc-600"
          />
          <textarea
            value={section.body}
            onChange={e => onUpdate({ body: e.target.value })}
            rows={6}
            placeholder="Section content…"
            className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 placeholder:text-zinc-600 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-stone-500 leading-relaxed"
          />
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ContractTemplateSection({ onBack }: Props) {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useContracts()

  const [view, setView] = useState<View>('list')
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null)
  const [name, setName] = useState('')
  const [sections, setSections] = useState<ContractSection[]>([])
  const [tradeType, setTradeType] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // ── Open starter picker for new template ──
  function openPicker() {
    setEditingTemplate(null)
    setName('')
    setSections([])
    setTradeType(null)
    setView('picker')
  }

  // ── Load a starter template into the editor ──
  function loadStarter(starter: StarterTemplate) {
    setName(starter.name)
    setTradeType(starter.trade)
    setSections(starter.sections.map(s => ({ ...s, id: crypto.randomUUID() })))
    setView('editor')
  }

  // ── Start blank ──
  function startBlank() {
    setName('')
    setTradeType(null)
    setSections([{
      id: crypto.randomUUID(),
      title: 'Scope of Work',
      body: '',
      required: false,
    }])
    setView('editor')
  }

  // ── Open existing template for editing ──
  function openEdit(t: ContractTemplate) {
    setEditingTemplate(t)
    setName(t.name)
    setTradeType(t.tradeType)
    setSections(
      t.sections && t.sections.length > 0
        ? t.sections
        : [{ id: crypto.randomUUID(), title: 'Contract', body: t.body, required: false }]
    )
    setView('editor')
  }

  // ── Section mutations ──
  function updateSection(id: string, patch: Partial<ContractSection>) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }
  function removeSection(id: string) {
    setSections(prev => prev.filter(s => s.id !== id))
  }
  function moveSection(index: number, dir: -1 | 1) {
    setSections(prev => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  function addSection() {
    setSections(prev => [...prev, { id: crypto.randomUUID(), title: '', body: '', required: false }])
  }

  // ── Save ──
  async function handleSave() {
    if (!name.trim() || sections.length === 0) return
    setSaving(true)
    const body = sections.map(s => `${s.title}\n\n${s.body}`).join('\n\n---\n\n')
    if (editingTemplate) {
      await updateTemplate({ ...editingTemplate, name, body, sections, tradeType })
      toast.success('Template updated')
    } else {
      const result = await addTemplate({ name, body, sections, tradeType })
      if (result) toast.success('Template created')
      else toast.error('Failed to create template')
    }
    setSaving(false)
    setView('list')
  }

  function cancelEditor() {
    setView('list')
    setEditingTemplate(null)
  }

  async function handleDelete(id: string) {
    await deleteTemplate(id)
    toast.success('Template deleted')
    setConfirmDelete(null)
  }

  const wordCount = sections.reduce((s, sec) => s + (sec.body.trim() ? sec.body.trim().split(/\s+/).length : 0), 0)
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 250))

  // ════════════════════════════════════════════════════════════════
  // VIEW: LIST
  // ════════════════════════════════════════════════════════════════
  if (view === 'list') return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-zinc-400 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h3 className="text-white font-semibold">Contract Templates</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Reusable templates for client contracts.</p>
        </div>
        <Button onClick={openPicker} className="ml-auto bg-stone-500 hover:bg-stone-400 text-white gap-1.5" size="sm">
          <Plus size={14} /> New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="border border-dashed border-zinc-700 rounded-xl py-12 flex flex-col items-center gap-3 text-center">
          <FileSignature className="w-9 h-9 text-zinc-700" strokeWidth={1.5} />
          <p className="text-zinc-500 text-sm">No contract templates yet.</p>
          <p className="text-zinc-600 text-xs max-w-xs">Start from one of our professional trade templates or build your own from scratch.</p>
          <Button onClick={openPicker} size="sm" className="bg-stone-500 hover:bg-stone-400 text-white">
            Create First Template
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => {
            const wc = t.sections
              ? t.sections.reduce((s, sec) => s + (sec.body.trim() ? sec.body.trim().split(/\s+/).length : 0), 0)
              : (t.body.trim().split(/\s+/).length)
            const pages = Math.max(1, Math.ceil(wc / 250))
            const sectionCount = t.sections?.length ?? 1
            return (
              <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium truncate">{t.name}</p>
                    {t.tradeType && <TradeChip trade={t.tradeType} />}
                  </div>
                  <p className="text-zinc-600 text-xs">
                    {sectionCount} {sectionCount === 1 ? 'section' : 'sections'} · ~{pages} {pages === 1 ? 'page' : 'pages'} · {wc.toLocaleString()} words
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(t)} className="text-zinc-400 hover:text-white transition-colors p-1" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setConfirmDelete(t.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
          <DialogHeader><DialogTitle>Delete Template?</DialogTitle></DialogHeader>
          <p className="text-zinc-400 text-sm">This will permanently delete this template. Existing contracts that used it are unaffected.</p>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button className="bg-red-700 hover:bg-red-600 text-white" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  // ════════════════════════════════════════════════════════════════
  // VIEW: PICKER
  // ════════════════════════════════════════════════════════════════
  if (view === 'picker') return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-zinc-400 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h3 className="text-white font-semibold">Choose a Starter Template</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Pick a trade — we'll pre-fill the right sections for you.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STARTER_TEMPLATES.map(starter => (
          <button
            key={starter.id}
            onClick={() => loadStarter(starter)}
            className="bg-zinc-900 border border-zinc-800 hover:border-stone-600 rounded-xl p-4 text-left space-y-2 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <TradeChip trade={starter.trade} />
              <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-300 transition-colors" />
            </div>
            <p className="text-white text-sm font-semibold">{starter.name}</p>
            <p className="text-zinc-500 text-xs leading-relaxed">{starter.description}</p>
            <p className="text-zinc-700 text-[10px]">{starter.sections.length} sections</p>
          </button>
        ))}
      </div>

      <button
        onClick={startBlank}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors text-sm"
      >
        <FilePlus2 size={15} />
        Start from scratch
      </button>
    </div>
  )

  // ════════════════════════════════════════════════════════════════
  // VIEW: EDITOR
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={cancelEditor} className="text-zinc-400 hover:text-white transition-colors shrink-0">
          <ChevronLeft size={18} />
        </button>
        <h3 className="text-white font-semibold flex-1 truncate">
          {editingTemplate ? 'Edit Template' : 'New Template'}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {wordCount > 0 && (
            <span className="text-zinc-600 text-xs">
              ~{estimatedPages}p · {wordCount.toLocaleString()}w
            </span>
          )}
          <Button variant="ghost" size="sm" className="text-zinc-400 h-8" onClick={cancelEditor}>Cancel</Button>
          <Button size="sm" className="bg-stone-500 hover:bg-stone-400 text-white h-8"
            onClick={handleSave} disabled={saving || !name.trim() || sections.length === 0}>
            {saving ? 'Saving…' : editingTemplate ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>

      {/* Template name */}
      <div className="space-y-1.5">
        <Label className="text-zinc-400 text-xs">Template Name *</Label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Standard Roofing Agreement"
          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
        />
      </div>

      {/* Sections */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-zinc-400 text-xs">Sections ({sections.length})</Label>
          <button
            onClick={addSection}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-300 transition-colors"
          >
            <Plus size={11} /> Add Section
          </button>
        </div>

        {sections.length === 0 && (
          <p className="text-zinc-600 text-xs py-2">No sections yet — add one above.</p>
        )}

        {sections.map((section, i) => (
          <SectionRow
            key={section.id}
            section={section}
            index={i}
            total={sections.length}
            onUpdate={patch => updateSection(section.id, patch)}
            onRemove={() => removeSection(section.id)}
            onMoveUp={() => moveSection(i, -1)}
            onMoveDown={() => moveSection(i, 1)}
          />
        ))}
      </div>

      {/* Placeholder reference */}
      <div className="pt-1">
        <p className="text-zinc-500 text-xs font-medium mb-2">Available placeholders — click to copy</p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDER_VARS.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => navigator.clipboard.writeText(v.key).then(() => toast.info(`Copied ${v.key}`))}
              className="text-xs px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors font-mono"
              title={v.label}
            >
              {v.key}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom save */}
      <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
        <Button variant="ghost" size="sm" className="text-zinc-400" onClick={cancelEditor}>Cancel</Button>
        <Button size="sm" className="bg-stone-500 hover:bg-stone-400 text-white"
          onClick={handleSave} disabled={saving || !name.trim() || sections.length === 0}>
          {saving ? 'Saving…' : editingTemplate ? 'Save Changes' : 'Create Template'}
        </Button>
      </div>
    </div>
  )
}
