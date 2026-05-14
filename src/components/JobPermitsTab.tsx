import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJobRecords } from '@/context/JobRecordsContext'
import { useAuth } from '@/context/AuthContext'
import {
  PERMIT_STATUSES, PERMIT_STATUS_LABEL, PERMIT_STATUS_BADGE,
  type JobPermit, type PermitStatus,
} from '@/types/jobRecords'
import { toast } from 'sonner'

type Props = { jobId: string; canEdit: boolean }

const blank = (): Draft => ({
  permitNumber: '', permitType: '', issuedBy: '',
  issueDate: '', expirationDate: '', status: 'pending', notes: '',
})

type Draft = {
  permitNumber: string; permitType: string; issuedBy: string
  issueDate: string; expirationDate: string; status: PermitStatus; notes: string
}

export default function JobPermitsTab({ jobId, canEdit }: Props) {
  const { user } = useAuth()
  const orgId = user?.org_id ?? ''
  const { permitsByJob, addPermit, updatePermit, deletePermit } = useJobRecords()
  const permits = permitsByJob(jobId)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<JobPermit | null>(null)
  const [draft, setDraft] = useState<Draft>(blank())
  const [saving, setSaving] = useState(false)

  function openNew() {
    setEditing(null)
    setDraft(blank())
    setOpen(true)
  }

  function openEdit(p: JobPermit) {
    setEditing(p)
    setDraft({
      permitNumber: p.permitNumber, permitType: p.permitType, issuedBy: p.issuedBy,
      issueDate: p.issueDate ?? '', expirationDate: p.expirationDate ?? '',
      status: p.status, notes: p.notes,
    })
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      orgId, jobId,
      permitNumber: draft.permitNumber,
      permitType: draft.permitType,
      issuedBy: draft.issuedBy,
      issueDate: draft.issueDate || null,
      expirationDate: draft.expirationDate || null,
      status: draft.status,
      notes: draft.notes,
    }
    if (editing) {
      await updatePermit({ ...editing, ...payload })
      toast.success('Permit updated')
    } else {
      const r = await addPermit(payload)
      if (r) toast.success('Permit added')
      else toast.error('Failed to add permit')
    }
    setSaving(false)
    setOpen(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this permit?')) return
    await deletePermit(id)
    toast.success('Permit deleted')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-sm">{permits.length} permit{permits.length !== 1 ? 's' : ''} on this job</p>
        {canEdit && (
          <Button onClick={openNew} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5">
            <Plus size={14} /> Add Permit
          </Button>
        )}
      </div>

      {permits.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-12 flex items-center justify-center text-zinc-600 text-sm">
          No permits recorded for this job.
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
          {permits.map(p => (
            <div key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.permitNumber && (
                      <span className="text-white text-sm font-semibold font-mono">#{p.permitNumber}</span>
                    )}
                    {p.permitType && (
                      <span className="text-zinc-300 text-sm">{p.permitType}</span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PERMIT_STATUS_BADGE[p.status]}`}>
                      {PERMIT_STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                    {p.issuedBy && <span>Issued by: <span className="text-zinc-300">{p.issuedBy}</span></span>}
                    {p.issueDate && <span>Issued: <span className="text-zinc-300">{p.issueDate}</span></span>}
                    {p.expirationDate && <span>Expires: <span className="text-zinc-300">{p.expirationDate}</span></span>}
                  </div>
                  {p.notes && <p className="text-zinc-500 text-xs mt-1">{p.notes}</p>}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEdit(p)} className="text-zinc-500 hover:text-zinc-200 transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(p.id)} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Permit' : 'Add Permit'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Permit Number</Label>
                <Input value={draft.permitNumber} onChange={e => setDraft(d => ({ ...d, permitNumber: e.target.value }))}
                  placeholder="e.g. 2026-00123" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Permit Type</Label>
                <Input value={draft.permitType} onChange={e => setDraft(d => ({ ...d, permitType: e.target.value }))}
                  placeholder="e.g. Roofing, Building" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Issued By</Label>
              <Input value={draft.issuedBy} onChange={e => setDraft(d => ({ ...d, issuedBy: e.target.value }))}
                placeholder="e.g. City of Los Angeles" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Issue Date</Label>
                <Input type="date" value={draft.issueDate} onChange={e => setDraft(d => ({ ...d, issueDate: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Expiration Date</Label>
                <Input type="date" value={draft.expirationDate} onChange={e => setDraft(d => ({ ...d, expirationDate: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Status</Label>
                <Select value={draft.status} onValueChange={v => setDraft(d => ({ ...d, status: v as PermitStatus }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {PERMIT_STATUSES.map(s => <SelectItem key={s} value={s}>{PERMIT_STATUS_LABEL[s]}</SelectItem>)}
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
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-stone-500 hover:bg-stone-400 text-white" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Add Permit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
