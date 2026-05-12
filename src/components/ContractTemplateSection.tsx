import { useState, useRef } from 'react'
import { useContracts } from '@/context/ContractsContext'
import { PLACEHOLDER_VARS, type ContractTemplate } from '@/types/contract'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ChevronLeft, Pencil, Trash2, FileSignature, Plus, Upload, Maximize2, Minimize2, FileText } from 'lucide-react'
import mammoth from 'mammoth'

type Props = { onBack: () => void }

const DEFAULT_BODY = `This agreement is entered into on {{today_date}} between {{company_name}} ("Company") and {{client_name}} ("Client").

PROJECT: {{job_title}}
LOCATION: {{job_address}}
SCHEDULED DATE: {{scheduled_date}}

SERVICES:
{{job_scope}}

TERMS:
1. The Client agrees to the services described above.
2. Payment is due upon completion unless otherwise agreed in writing.
3. This agreement constitutes the entire contract between both parties.

By signing below, both parties agree to the terms outlined in this contract.`

export default function ContractTemplateSection({ onBack }: Props) {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useContracts()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ContractTemplate | null>(null)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openCreate() {
    setEditing(null)
    setName('')
    setBody(DEFAULT_BODY)
    setFullscreen(false)
    setDialogOpen(true)
  }

  function openEdit(t: ContractTemplate) {
    setEditing(t)
    setName(t.name)
    setBody(t.body)
    setFullscreen(false)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!name.trim() || !body.trim()) return
    if (editing) {
      await updateTemplate({ ...editing, name, body })
      toast.success('Template updated')
    } else {
      const result = await addTemplate({ name, body })
      if (result) toast.success('Template created')
      else toast.error('Failed to create template')
    }
    setDialogOpen(false)
  }

  async function handleDelete(id: string) {
    await deleteTemplate(id)
    toast.success('Template deleted')
    setConfirmDelete(null)
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'txt') {
        const text = await file.text()
        setBody(text)
        if (!name) setName(file.name.replace(/\.[^.]+$/, ''))
        toast.success('Text file imported')

      } else if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        setBody(result.value)
        if (!name) setName(file.name.replace(/\.[^.]+$/, ''))
        if (result.messages.length > 0) toast.info('Imported — some formatting was removed')
        else toast.success('Word document imported')

      } else {
        toast.error('Unsupported format. Use .docx or .txt')
      }
    } catch {
      toast.error('Failed to read file')
    }

    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0
  const estimatedPages = Math.ceil(wordCount / 250)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-zinc-400 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h3 className="text-white font-semibold">Contract Templates</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Reusable templates for client contracts.</p>
        </div>
        <Button onClick={openCreate} className="ml-auto bg-stone-500 hover:bg-stone-400 text-white gap-1.5" size="sm">
          <Plus size={14} /> New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="border border-dashed border-zinc-700 rounded-xl py-12 flex flex-col items-center gap-3 text-center">
          <FileSignature className="w-9 h-9 text-zinc-700" strokeWidth={1.5} />
          <p className="text-zinc-500 text-sm">No contract templates yet.</p>
          <p className="text-zinc-600 text-xs max-w-xs">Start from scratch or import an existing contract from a Word (.docx) or text (.txt) file.</p>
          <Button onClick={openCreate} size="sm" className="bg-stone-500 hover:bg-stone-400 text-white">
            Create First Template
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => {
            const wc = t.body.trim().split(/\s+/).length
            const pages = Math.ceil(wc / 250)
            return (
              <div key={t.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{t.name}</p>
                  <p className="text-zinc-600 text-xs mt-0.5">~{pages} {pages === 1 ? 'page' : 'pages'} · {wc.toLocaleString()} words</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(t)} className="text-zinc-400 hover:text-white transition-colors p-1">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setConfirmDelete(t.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`bg-zinc-900 border-zinc-700 text-white transition-all duration-200 ${
          fullscreen
            ? 'max-w-none w-screen h-screen rounded-none m-0 flex flex-col'
            : 'max-w-3xl max-h-[90vh] overflow-y-auto'
        }`}>
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle>{editing ? 'Edit Template' : 'New Contract Template'}</DialogTitle>
              <div className="flex items-center gap-2">
                {/* Import file button */}
                <label className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={12} />
                  {importing ? 'Importing…' : 'Import File'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.docx"
                    className="hidden"
                    onChange={handleFileImport}
                  />
                </label>
                {/* Fullscreen toggle */}
                <button
                  onClick={() => setFullscreen(f => !f)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className={`space-y-4 mt-2 ${fullscreen ? 'flex-1 flex flex-col overflow-hidden' : ''}`}>
            <div className="space-y-1.5 shrink-0">
              <Label className="text-zinc-300">Template Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Standard Service Agreement"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>

            {/* Supported formats tip */}
            <div className="flex items-center gap-2 text-xs text-zinc-600 shrink-0">
              <FileText size={12} />
              <span>Import supports <span className="text-zinc-400">.docx</span> (Word, Google Docs) and <span className="text-zinc-400">.txt</span> — PDF: open in your reader, select all, paste below.</span>
            </div>

            <div className={`space-y-1.5 ${fullscreen ? 'flex-1 flex flex-col' : ''}`}>
              <div className="flex items-center justify-between shrink-0">
                <Label className="text-zinc-300">Contract Body *</Label>
                {body && (
                  <span className="text-zinc-600 text-xs">
                    ~{estimatedPages} {estimatedPages === 1 ? 'page' : 'pages'} · {wordCount.toLocaleString()} words
                  </span>
                )}
              </div>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                className={`w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-stone-500 ${
                  fullscreen ? 'flex-1 resize-none' : 'resize-y'
                }`}
                style={fullscreen ? {} : { minHeight: '320px' }}
                placeholder="Type or import your contract text…"
              />
            </div>

            {!fullscreen && (
              <div className="shrink-0">
                <p className="text-zinc-500 text-xs font-medium mb-2">Available placeholders — click to copy</p>
                <div className="flex flex-wrap gap-1.5">
                  {PLACEHOLDER_VARS.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => navigator.clipboard.writeText(v.key).then(() => toast.info(`Copied ${v.key}`))}
                      className="text-xs px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors font-mono"
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 shrink-0">
            <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-stone-500 hover:bg-stone-400 text-white" onClick={handleSave}
              disabled={!name.trim() || !body.trim()}>
              {editing ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
}
