import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    approvalRequired: false,
    approvalStatus: 'none',
    approvalRequestedAt: null,
    approvalToken: null,
    approvedAt: null,
    approverName: null,
    clientId: null,
    propertyId: null,
  }
}

export default function JobsPage() {
  const navigate = useNavigate()
  const { jobs, addJob } = useJobs()
  const { employees } = useEmployees()
  const { prefs } = usePreferences()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<JobStatus | 'All'>('All')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<Job>(newJob())

  const leads = employees.filter(e => e.status === 'Active' && (e.role === 'Admin' || e.role === 'Sub-Admin' || e.role === 'Project Manager' || e.role === 'Lead' || e.role === 'Sales'))
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
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!draft.title.trim() || !draft.client.name.trim()) return
    const ok = await addJob(draft)
    if (ok) {
      toast.success('Job created')
      setDialogOpen(false)
    } else {
      toast.error('Failed to create job. Please try again.')
    }
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

  const jobGroups = Object.entries(
    filtered.reduce((acc, job) => {
      const key = job.address?.trim() || job.client.name || 'No Address'
      if (!acc[key]) acc[key] = []
      acc[key].push(job)
      return acc
    }, {} as Record<string, typeof filtered>)
  ).sort(([, a], [, b]) => {
    const latest = (arr: typeof filtered) => Math.max(...arr.map(j => new Date(j.createdAt).getTime()))
    return latest(b) - latest(a)
  })

  return (
    <div className="max-w-7xl mx-auto space-y-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white">Jobs</h2>
          <p className="hidden md:block text-zinc-400 text-sm mt-1">Manage your active and upcoming jobs.</p>
        </div>
        <Button onClick={openCreate} className="bg-stone-500 hover:bg-stone-400 text-white">
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
                ? 'bg-stone-500 border-stone-500 text-white'
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
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <Briefcase className="w-10 h-10 text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-500 text-sm">
              {jobs.length === 0 ? 'No jobs yet.' : 'No jobs match your search.'}
            </p>
            {jobs.length === 0 && (
              <Button onClick={openCreate} className="bg-stone-500 hover:bg-stone-400 text-white mt-1">
                + Create First Job
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {jobGroups.map(([groupKey, groupJobs]) => (
            <div key={groupKey}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-medium text-zinc-400 truncate">{groupKey}</p>
                {groupJobs.length > 1 && (
                  <span className="text-[10px] text-zinc-600 shrink-0">{groupJobs.length} jobs</span>
                )}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {groupJobs.map(job => (
                  <div
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className={`bg-zinc-900 border border-zinc-800 border-l-4 ${STATUS_BORDER[job.status]} rounded-lg overflow-hidden cursor-pointer hover:border-zinc-600 hover:bg-zinc-800/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all duration-200`}
                  >
                    {job.address && (
                      <iframe
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(job.address)}&layer=c&output=embed`}
                        className="hidden sm:block w-full h-32 border-0 pointer-events-none"
                        loading="lazy"
                      />
                    )}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <p className="font-semibold text-white text-sm leading-tight line-clamp-1">{job.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[job.status]}`}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-zinc-300 text-xs">{job.client.name}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
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
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">New Job</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Job Title *</Label>
              <Input
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="e.g. Smith Residence - Roof Replacement"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Status</Label>
                <Select value={draft.status} onValueChange={v => setDraft(d => ({ ...d, status: v as JobStatus }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {JOB_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                    {JOB_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300">Scheduled Date</Label>
              <Input
                type="date"
                value={draft.scheduledDate}
                onChange={e => setDraft(d => ({ ...d, scheduledDate: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>

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

            <div className="space-y-1.5">
              <Label className="text-zinc-300">Property Address</Label>
              <Input
                value={draft.address}
                onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
                placeholder="123 Main St, City, CA 00000"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

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
                          ? 'border-stone-500 bg-stone-500 text-white'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {e.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-zinc-300">Scope of Work</Label>
              <textarea
                value={draft.scope}
                onChange={e => setDraft(d => ({ ...d, scope: e.target.value }))}
                rows={3}
                placeholder="Describe the work to be performed..."
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-zinc-300">Internal Notes</Label>
              <textarea
                value={draft.notes}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                rows={2}
                placeholder="Internal notes (not visible to client)..."
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-stone-500 hover:bg-stone-400 text-white"
              onClick={handleSave}
              disabled={!draft.title.trim() || !draft.client.name.trim()}
            >
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
