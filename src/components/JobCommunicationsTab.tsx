import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJobRecords } from '@/context/JobRecordsContext'
import { useAuth } from '@/context/AuthContext'
import { COMM_TYPES, COMM_TYPE_LABEL, COMM_TYPE_ICON, type CommType } from '@/types/jobRecords'
import { toast } from 'sonner'

function today() { return new Date().toISOString().slice(0, 10) }

type Props = { jobId: string; canEdit: boolean }

export default function JobCommunicationsTab({ jobId, canEdit }: Props) {
  const { user } = useAuth()
  const orgId = user?.org_id ?? ''
  const { communicationsByJob, addCommunication, deleteCommunication } = useJobRecords()
  const comms = communicationsByJob(jobId)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ date: today(), type: 'call' as CommType, contactName: '', summary: '' })
  const [saving, setSaving] = useState(false)

  function openNew() {
    setDraft({ date: today(), type: 'call', contactName: '', summary: '' })
    setOpen(true)
  }

  async function handleSave() {
    if (!draft.summary.trim()) { toast.error('Summary is required'); return }
    setSaving(true)
    const r = await addCommunication({ orgId, jobId, ...draft })
    setSaving(false)
    if (r) { toast.success('Interaction logged'); setOpen(false) }
    else toast.error('Failed to log interaction')
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this interaction log?')) return
    await deleteCommunication(id)
    toast.success('Entry deleted')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-sm">{comms.length} interaction{comms.length !== 1 ? 's' : ''} logged</p>
        {canEdit && (
          <Button onClick={openNew} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5">
            <Plus size={14} /> Log Interaction
          </Button>
        )}
      </div>

      {comms.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-12 flex items-center justify-center text-zinc-600 text-sm">
          No interactions logged yet.
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-zinc-800" />
          <div className="space-y-3">
            {comms.map(c => (
              <div key={c.id} className="relative flex gap-4">
                {/* Dot */}
                <div className="shrink-0 w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-base z-10">
                  {COMM_TYPE_ICON[c.type]}
                </div>
                {/* Card */}
                <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-4 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-zinc-300 text-xs font-semibold uppercase tracking-wide">{COMM_TYPE_LABEL[c.type]}</span>
                        <span className="text-zinc-600 text-xs">{c.date}</span>
                        {c.contactName && <span className="text-zinc-500 text-xs">· {c.contactName}</span>}
                      </div>
                      <p className="text-zinc-200 text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">{c.summary}</p>
                    </div>
                    {canEdit && (
                      <button onClick={() => handleDelete(c.id)} className="text-zinc-600 hover:text-red-400 transition-colors shrink-0 mt-0.5">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Log Interaction</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Date</Label>
                <Input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Type</Label>
                <Select value={draft.type} onValueChange={v => setDraft(d => ({ ...d, type: v as CommType }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {COMM_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{COMM_TYPE_ICON[t]} {COMM_TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Contact Name</Label>
              <Input value={draft.contactName} onChange={e => setDraft(d => ({ ...d, contactName: e.target.value }))}
                placeholder="e.g. John Smith – Homeowner" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Summary *</Label>
              <textarea value={draft.summary} onChange={e => setDraft(d => ({ ...d, summary: e.target.value }))} rows={4}
                placeholder="What was discussed, agreed upon, or communicated…"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-500" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-stone-500 hover:bg-stone-400 text-white" disabled={saving || !draft.summary.trim()} onClick={handleSave}>
              {saving ? 'Saving…' : 'Log Interaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
