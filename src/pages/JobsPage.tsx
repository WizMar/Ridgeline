import { useState } from 'react'
import { useJobs } from '@/context/JobsContext'
import { useEmployees } from '@/context/EmployeeContext'
import { usePreferences, formatDate } from '@/context/PreferencesContext'
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
  type Job, type JobStatus, type JobType,
  JOB_STATUSES, JOB_TYPES, STATUS_BADGE, STATUS_BORDER,
} from '@/types/job'
import { toast } from 'sonner'
import { Briefcase } from 'lucide-react'

function newJob(): Job {
  return {
    id: crypto.randomUUID(),
    title: '',
    client: { name: '', phone: '', email: '' },
    address: '',
    type: 'General',
    status: 'Draft',
    leadId: null,
    crewIds: [],
    notes: '',
    scope: '',
    scheduledDate: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}


function streetViewUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

export default function JobsPage() {
  const { jobs, addJob, updateJob, deleteJob } = useJobs()
  const { employees } = useEmployees()
  const { prefs } = usePreferences()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<JobStatus | 'All'>('All')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [draft, setDraft] = useState<Job>(newJob())
  const [selected, setSelected] = useState<Job | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const leads = employees.filter(e => e.status === 'Active' && (e.role === 'Admin' || e.role === 'Sub-Admin' || e.role === 'Lead' || e.role === 'Sales'))
  const crew = employees.filter(e => e.status === 'Active')

  const filtered = jobs.filter(j => {
    const matchSearch = !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.client.name.toLowerCase().includes(search.toLowerCase()) ||
      j.address.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'All' || j.status === filterStatus
    return matchSearch && matchStatus
  })

  function openCreate() {
    setDraft(newJob())
    setIsEditing(false)
    setDialogOpen(true)
  }

  function openEdit(job: Job) {
    setDraft({ ...job })
    setIsEditing(true)
    setDetailOpen(false)
    setDialogOpen(true)
  }

  function openDetail(job: Job) {
    setSelected(job)
    setDetailOpen(true)
  }

  function handleSave() {
    if (!draft.title.trim() || !draft.client.name.trim()) return
    const updated = { ...draft, updatedAt: new Date().toISOString() }
    if (isEditing) {
      updateJob(updated)
      setSelected(updated)
      toast.success('Job updated')
    } else {
      addJob(updated)
      toast.success('Job created')
    }
    setDialogOpen(false)
  }

  function handleDelete(id: string) {
    deleteJob(id)
    setConfirmDelete(null)
    setDetailOpen(false)
    toast.success('Job deleted')
  }

  function toggleCrew(empId: string) {
    setDraft(d => ({
      ...d,
      crewIds: d.crewIds.includes(empId)
        ? d.crewIds.filter(id => id !== empId)
        : [...d.crewIds, empId],
    }))
  }

  const empName = (id: string | null) =>
    id ? (employees.find(e => e.id === id)?.name ?? 'Unknown') : '—'

  const statusCounts = JOB_STATUSES.reduce((acc, s) => {
    acc[s] = jobs.filter(j => j.status === s).length
    return acc
  }, {} as Record<JobStatus, number>)

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Jobs</h2>
          <p className="text-zinc-400 text-sm mt-1">Manage your active and upcoming jobs.</p>
        </div>
        <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-500 text-white">
          + New Job
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        {(['All', ...JOB_STATUSES] as const).map(s => (
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
        placeholder="Search by job title, client, or address..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 max-w-md"
      />

      {/* Job List */}
      {filtered.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <Briefcase className="w-10 h-10 text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-500 text-sm">
              {jobs.length === 0 ? 'No jobs yet.' : 'No jobs match your search.'}
            </p>
            {jobs.length === 0 && (
              <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-500 text-white mt-1">
                + Create First Job
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(job => (
            <div
              key={job.id}
              onClick={() => openDetail(job)}
              className={`bg-zinc-900 border border-zinc-800 border-l-4 ${STATUS_BORDER[job.status]} rounded-lg overflow-hidden cursor-pointer hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors`}
            >
              {job.address && (
                <iframe
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(job.address)}&layer=c&output=embed`}
                  className="w-full h-32 border-0 pointer-events-none"
                  loading="lazy"
                />
              )}
              <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-white leading-tight line-clamp-1">{job.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[job.status]}`}>
                  {job.status}
                </span>
              </div>
              <p className="text-zinc-300 text-sm">{job.client.name}</p>
              <p className="text-zinc-500 text-xs mt-1 line-clamp-1">{job.address || 'No address'}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
                <span className="text-zinc-500 text-xs">{job.type}</span>
                <div className="flex flex-col items-end gap-0.5">
                  {job.leadId && (
                    <span className="text-zinc-400 text-xs">Lead: {empName(job.leadId).split(' ')[0]}</span>
                  )}
                  {job.scheduledDate && (
                    <span className="text-zinc-400 text-xs">{formatDate(job.scheduledDate, prefs.dateFormat)}</span>
                  )}
                </div>
              </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-4">
                  <div>
                    <DialogTitle className="text-white text-xl">{selected.title}</DialogTitle>
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${STATUS_BADGE[selected.status]}`}>
                      {selected.status}
                    </span>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Property Map */}
                {selected.address && (
                  <div className="rounded-lg overflow-hidden border border-zinc-700">
                    <iframe
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(selected.address)}&layer=c&output=embed`}
                      className="w-full border-0"
                      style={{ height: 240 }}
                      loading="lazy"
                    />
                    <a
                      href={streetViewUrl(selected.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-xs text-amber-400 hover:text-amber-300 bg-zinc-800 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open in Google Maps
                    </a>
                  </div>
                )}

                {/* Client Info */}
                <div className="bg-zinc-800 rounded-lg p-3 space-y-1">
                  <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-2">Client</p>
                  <p className="text-white font-medium">{selected.client.name}</p>
                  {selected.client.phone && <p className="text-zinc-300 text-sm">{selected.client.phone}</p>}
                  {selected.client.email && <p className="text-zinc-400 text-sm">{selected.client.email}</p>}
                </div>

                {/* Job Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <p className="text-zinc-400 text-xs mb-1">Type</p>
                    <p className="text-white text-sm">{selected.type}</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <p className="text-zinc-400 text-xs mb-1">Scheduled</p>
                    <p className="text-white text-sm">{selected.scheduledDate ? formatDate(selected.scheduledDate, prefs.dateFormat) : '—'}</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <p className="text-zinc-400 text-xs mb-1">Lead</p>
                    <p className="text-white text-sm">{empName(selected.leadId)}</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <p className="text-zinc-400 text-xs mb-1">Crew</p>
                    <p className="text-white text-sm">
                      {selected.crewIds.length === 0
                        ? '—'
                        : selected.crewIds.map(id => empName(id).split(' ')[0]).join(', ')}
                    </p>
                  </div>
                </div>

                {/* Scope */}
                {selected.scope && (
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <p className="text-zinc-400 text-xs mb-1">Scope of Work</p>
                    <p className="text-zinc-200 text-sm whitespace-pre-wrap">{selected.scope}</p>
                  </div>
                )}

                {/* Notes */}
                {selected.notes && (
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <p className="text-zinc-400 text-xs mb-1">Notes</p>
                    <p className="text-zinc-200 text-sm whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="border-red-700 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                  onClick={() => setConfirmDelete(selected.id)}
                >
                  Delete
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-500 text-white"
                  onClick={() => openEdit(selected)}
                >
                  Edit Job
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{isEditing ? 'Edit Job' : 'New Job'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Job Title *</Label>
              <Input
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="e.g. Smith Residence - Roof Replacement"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Status + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Status</Label>
                <Select value={draft.status} onValueChange={v => setDraft(d => ({ ...d, status: v as JobStatus }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {JOB_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Job Type</Label>
                <Select value={draft.type} onValueChange={v => setDraft(d => ({ ...d, type: v as JobType }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
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

            {/* Scheduled Date */}
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Scheduled Date</Label>
              <Input
                type="date"
                value={draft.scheduledDate}
                onChange={e => setDraft(d => ({ ...d, scheduledDate: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>

            {/* Client Info */}
            <div>
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-3">Client Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-zinc-300">Client Name *</Label>
                  <Input
                    value={draft.client.name}
                    onChange={e => setDraft(d => ({ ...d, client: { ...d.client, name: e.target.value } }))}
                    placeholder="John Smith"
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Phone</Label>
                  <Input
                    value={draft.client.phone}
                    onChange={e => setDraft(d => ({ ...d, client: { ...d.client, phone: e.target.value } }))}
                    placeholder="(555) 000-0000"
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Email</Label>
                  <Input
                    value={draft.client.email}
                    onChange={e => setDraft(d => ({ ...d, client: { ...d.client, email: e.target.value } }))}
                    placeholder="client@email.com"
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Property Address</Label>
              <Input
                value={draft.address}
                onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
                placeholder="123 Main St, City, CA 00000"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Lead */}
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Assign Lead</Label>
              <Select
                value={draft.leadId ?? 'none'}
                onValueChange={v => setDraft(d => ({ ...d, leadId: v === 'none' ? null : v }))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="No lead assigned" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectItem value="none">No lead assigned</SelectItem>
                  {leads.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Crew */}
            {crew.length > 0 && (
              <div className="space-y-2">
                <Label className="text-zinc-300">Assign Crew</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {crew.map(e => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleCrew(e.id)}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                        draft.crewIds.includes(e.id)
                          ? 'border-amber-600 bg-amber-900/30 text-amber-300'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {e.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Scope of Work */}
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Scope of Work</Label>
              <textarea
                value={draft.scope}
                onChange={e => setDraft(d => ({ ...d, scope: e.target.value }))}
                rows={3}
                placeholder="Describe the work to be performed..."
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Internal Notes</Label>
              <textarea
                value={draft.notes}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                rows={2}
                placeholder="Internal notes (not visible to client)..."
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

          </div>

          <DialogFooter className="mt-6">
            <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-500 text-white"
              onClick={handleSave}
              disabled={!draft.title.trim() || !draft.client.name.trim()}
            >
              {isEditing ? 'Save Changes' : 'Create Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Job?</DialogTitle>
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
