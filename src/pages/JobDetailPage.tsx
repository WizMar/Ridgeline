import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useJobs } from '@/context/JobsContext'
import { useClients } from '@/context/ClientsContext'
import { useEmployees } from '@/context/EmployeeContext'
import { useAuth } from '@/context/AuthContext'
import { usePreferences, formatDate } from '@/context/PreferencesContext'
import { useJobMedia, type MediaCategory } from '@/hooks/useJobMedia'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ChevronLeft, Pencil, Trash2, Upload, X, Play, Send, Copy, Check, CheckCircle2, ShieldAlert, MapPin, Users, Calendar, FileText,
} from 'lucide-react'
import {
  type Job, type JobStatus, type JobType,
  JOB_STATUSES, JOB_TYPES, STATUS_BADGE,
} from '@/types/job'
import { useSettings } from '@/context/SettingsContext'
import JobEstimateSection from '@/components/JobEstimateSection'

type Tab = 'overview' | 'photos' | 'estimate' | 'approval'

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { jobs, updateJob, deleteJob, requestApproval } = useJobs()
  const { clients, properties } = useClients()
  const { employees } = useEmployees()
  const { user } = useAuth()
  const { prefs } = usePreferences()
  const { settings } = useSettings()

  const job = jobs.find(j => j.id === jobId)
  const client = job?.clientId ? clients.find(c => c.id === job.clientId) : null
  const property = job?.propertyId ? properties.find(p => p.id === job.propertyId) : null

  const isAdmin = user?.role === 'Admin' || user?.role === 'Sub-Admin'
  const canRequestApproval = isAdmin || user?.role === 'Project Manager' || user?.role === 'Lead'

  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState<Job | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sendingApproval, setSendingApproval] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeCategory, setActiveCategory] = useState<MediaCategory>('before')
  const [uploadKey, setUploadKey] = useState(0)

  const { media, loading: mediaLoading, uploading, uploadMedia, deleteMedia } = useJobMedia(job?.id ?? null)
  const categoryMedia = media.filter(m => m.category === activeCategory)

  if (!job) return <Navigate to="/jobs" replace />
  const j: Job = job

  const empName = (id: string | null) =>
    id ? (employees.find(e => e.id === id)?.name ?? 'Unknown') : '—'

  const backPath = client ? `/clients/${client.id}` : '/jobs'
  const backLabel = client ? client.name : 'Jobs'

  function openEdit() {
    setDraft({ ...j })
    setEditOpen(true)
  }

  async function handleSave() {
    if (!draft || !draft.title.trim()) return
    await updateJob({ ...draft, updatedAt: new Date().toISOString() } as Job)
    setEditOpen(false)
    toast.success('Job updated')
  }

  async function handleDelete() {
    await deleteJob(j.id)
    toast.success('Job deleted')
    navigate(backPath)
  }

  function toggleCrew(empId: string) {
    if (!draft) return
    setDraft(d => d && ({
      ...d,
      crewIds: d.crewIds.includes(empId)
        ? d.crewIds.filter(id => id !== empId)
        : [...d.crewIds, empId],
    }))
  }

  async function handleRequestApproval() {
    setSendingApproval(true)
    const token = await requestApproval(j.id)
    if (token) {
      const approvalLink = `${window.location.origin}/approve/${token}`
      const orgName = settings.company?.name || 'Nexus'
      const hasContact = !!(j.client.email || j.client.phone)
      if (hasContact) {
        toast.success(`Approval request sent to ${j.client.name || 'client'}`)
        supabase.functions.invoke('send-approval-request', {
          body: { clientEmail: j.client.email, clientPhone: j.client.phone, clientName: j.client.name, jobTitle: j.title, approvalLink, orgName },
        })
      } else {
        toast.success('Approval link ready — no email or phone on file')
      }
    } else {
      toast.error('Failed to generate approval link')
    }
    setSendingApproval(false)
  }

  function handleCopyLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/approve/${token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function toggleApprovalRequired() {
    await updateJob({ ...j, approvalRequired: !j.approvalRequired })
    toast.success(j.approvalRequired ? 'Sign-off requirement removed' : 'Sign-off required')
  }

  const leads = employees.filter(e =>
    e.status === 'Active' && ['Admin', 'Sub-Admin', 'Project Manager', 'Lead', 'Sales'].includes(e.role)
  )
  const crew = employees.filter(e => e.status === 'Active')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'photos', label: `Photos${media.length > 0 ? ` (${media.length})` : ''}` },
    { key: 'estimate', label: 'Estimate' },
    { key: 'approval', label: 'Approval' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5 text-white">
      {/* Back */}
      <button onClick={() => navigate(backPath)} className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors">
        <ChevronLeft size={16} />
        {backLabel}
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold text-white">{job.title}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[job.status]}`}>{job.status}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-zinc-400 text-sm">
            <span>{job.type}</span>
            {job.scheduledDate && (
              <span className="flex items-center gap-1"><Calendar size={13} />{formatDate(job.scheduledDate, prefs.dateFormat)}</span>
            )}
            {property && (
              <span className="flex items-center gap-1"><MapPin size={13} />{property.address}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={openEdit} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5">
            <Pencil size={13} /> Edit
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="border-red-800 text-red-400 hover:bg-red-900/30">
              <Trash2 size={13} />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? 'border-stone-500 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Client + Property */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {client && (
              <button onClick={() => navigate(`/clients/${client.id}`)} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-left hover:border-zinc-600 transition-colors group">
                <p className="text-zinc-500 text-xs mb-1">Client</p>
                <p className="text-white font-medium">{client.name}</p>
                {client.phone && <p className="text-zinc-400 text-sm">{client.phone}</p>}
                {client.email && <p className="text-zinc-500 text-xs">{client.email}</p>}
              </button>
            )}
            {property && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <p className="text-zinc-500 text-xs mb-1">Property</p>
                <p className="text-white font-medium">{property.address}</p>
                <p className="text-zinc-400 text-sm capitalize">{property.type}</p>
                {property.notes && <p className="text-zinc-500 text-xs mt-1">{property.notes}</p>}
              </div>
            )}
          </div>

          {/* Map */}
          {job.address && (
            <div className="rounded-lg overflow-hidden border border-zinc-800">
              <iframe
                src={`https://maps.google.com/maps?q=${encodeURIComponent(job.address)}&layer=c&output=embed`}
                className="w-full border-0"
                style={{ height: 200 }}
                loading="lazy"
              />
            </div>
          )}

          {/* Lead + Crew */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <p className="text-zinc-500 text-xs mb-1">Lead</p>
              <p className="text-white text-sm">{empName(job.leadId)}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users size={12} className="text-zinc-500" />
                <p className="text-zinc-500 text-xs">Crew ({job.crewIds.length})</p>
              </div>
              <p className="text-white text-sm">
                {job.crewIds.length === 0 ? '—' : job.crewIds.map(id => empName(id).split(' ')[0]).join(', ')}
              </p>
            </div>
          </div>

          {/* Scope */}
          {job.scope && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 text-xs mb-1">Scope of Work</p>
              <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">{job.scope}</p>
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 text-xs mb-1">Internal Notes</p>
              <p className="text-zinc-400 text-sm whitespace-pre-wrap">{job.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Photos */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {(['before', 'during', 'damage', 'after'] as MediaCategory[]).map(cat => {
                const count = media.filter(m => m.category === cat).length
                return (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                      activeCategory === cat ? 'bg-stone-500 border-stone-500 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {cat}{count > 0 ? ` (${count})` : ''}
                  </button>
                )
              })}
            </div>
            <label className={uploading ? 'opacity-50 pointer-events-none cursor-not-allowed' : 'cursor-pointer'}>
              <input key={uploadKey} type="file" multiple accept="image/*,video/*" className="hidden"
                onChange={async e => { if (e.target.files) { await uploadMedia(e.target.files, activeCategory); setUploadKey(k => k + 1) } }}
              />
              <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200 transition-colors">
                <Upload size={12} />{uploading ? 'Uploading…' : 'Upload'}
              </span>
            </label>
          </div>

          {mediaLoading ? (
            <p className="text-zinc-500 text-sm text-center py-8">Loading…</p>
          ) : categoryMedia.length === 0 ? (
            <div className="border border-dashed border-zinc-700 rounded-lg py-12 text-center">
              <p className="text-zinc-600 text-sm">No {activeCategory} photos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {categoryMedia.map(item => (
                <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden bg-zinc-900">
                  {item.type === 'video' ? (
                    <>
                      <video src={item.url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer" onClick={() => window.open(item.url, '_blank')}>
                        <Play size={22} className="text-white" fill="white" />
                      </div>
                    </>
                  ) : (
                    <img src={item.url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => window.open(item.url, '_blank')} />
                  )}
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); deleteMedia(item) }}
                      className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Estimate */}
      {activeTab === 'estimate' && (
        <JobEstimateSection job={job} />
      )}

      {/* Approval */}
      {activeTab === 'approval' && (
        <div className="max-w-lg space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-zinc-300 text-sm font-semibold">Customer Sign-off</p>
              {isAdmin && (
                <button onClick={toggleApprovalRequired}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    job.approvalRequired ? 'bg-stone-800/40 border-stone-500 text-stone-200' : 'border-zinc-600 text-zinc-500 hover:border-zinc-400'
                  }`}
                >
                  <ShieldAlert size={11} />
                  {job.approvalRequired ? 'Required' : 'Require sign-off'}
                </button>
              )}
            </div>

            {job.approvalRequired && job.approvalStatus !== 'approved' && (
              <div className="flex items-center gap-2 bg-stone-800/20 border border-amber-800 rounded-md px-3 py-2">
                <ShieldAlert size={13} className="text-stone-300 shrink-0" />
                <p className="text-stone-200 text-xs">This job requires customer sign-off before it can be invoiced.</p>
              </div>
            )}

            {job.approvalStatus === 'approved' && (
              <div className="flex items-center gap-2 bg-green-900/20 border border-green-800 rounded-md px-3 py-2">
                <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                <div>
                  <p className="text-green-300 text-xs font-medium">Approved by {job.approverName}</p>
                  {job.approvedAt && (
                    <p className="text-green-600 text-xs">{new Date(job.approvedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  )}
                </div>
              </div>
            )}

            {job.approvalStatus === 'requested' && job.approvalToken && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-800 rounded-md px-3 py-2">
                  <Send size={12} className="text-blue-400 shrink-0" />
                  <p className="text-blue-300 text-xs">
                    Approval requested{job.approvalRequestedAt ? ` · ${new Date(job.approvalRequestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                  </p>
                </div>
                <button onClick={() => handleCopyLink(job.approvalToken!)}
                  className="w-full flex items-center justify-between gap-2 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors">
                  <span className="truncate font-mono">{`${window.location.origin}/approve/${job.approvalToken}`}</span>
                  <span className="shrink-0 flex items-center gap-1">
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </span>
                </button>
              </div>
            )}

            {job.approvalStatus === 'none' && canRequestApproval && (
              <Button variant="outline" size="sm" disabled={sendingApproval} onClick={handleRequestApproval}
                className="border-zinc-600 text-zinc-300 hover:bg-zinc-700 gap-1.5">
                <Send size={13} />
                {sendingApproval ? 'Generating…' : 'Request Customer Approval'}
              </Button>
            )}

            {job.approvalStatus === 'none' && !canRequestApproval && (
              <p className="text-zinc-600 text-sm">No approval requested yet.</p>
            )}
          </div>

          {/* Customer preview link */}
          {job.approvalToken && (
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-zinc-500" />
              <a href={`/approve/${job.approvalToken}`} target="_blank" rel="noopener noreferrer"
                className="text-stone-400 hover:text-stone-300 text-xs underline underline-offset-2">
                Preview customer approval page
              </a>
            </div>
          )}
        </div>
      )}

      {/* Edit Job Dialog */}
      {draft && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Job</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Job Title *</Label>
                <Input value={draft.title} onChange={e => setDraft(d => d && ({ ...d, title: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Status</Label>
                  <Select value={draft.status} onValueChange={v => setDraft(d => d && ({ ...d, status: v as JobStatus }))}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                      {JOB_STATUSES.map(s => {
                        const blocked = s === 'Invoiced' && draft.approvalRequired && draft.approvalStatus !== 'approved'
                        return <SelectItem key={s} value={s} disabled={blocked}>{s}{blocked ? ' — requires approval' : ''}</SelectItem>
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Job Type</Label>
                  <Select value={draft.type} onValueChange={v => setDraft(d => d && ({ ...d, type: v as JobType }))}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                      {JOB_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Scheduled Date</Label>
                <Input type="date" value={draft.scheduledDate} onChange={e => setDraft(d => d && ({ ...d, scheduledDate: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Assign Lead</Label>
                <Select value={draft.leadId ?? 'none'} onValueChange={v => setDraft(d => d && ({ ...d, leadId: v === 'none' ? null : v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="No lead assigned" /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectItem value="none">No lead assigned</SelectItem>
                    {leads.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.role})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {crew.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-zinc-300">Assign Crew</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {crew.map(e => (
                      <button key={e.id} type="button" onClick={() => toggleCrew(e.id)}
                        className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                          draft.crewIds.includes(e.id) ? 'border-stone-500 bg-stone-500 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                        }`}>
                        {e.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Scope of Work</Label>
                <textarea value={draft.scope} onChange={e => setDraft(d => d && ({ ...d, scope: e.target.value }))} rows={3}
                  className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Internal Notes</Label>
                <textarea value={draft.notes} onChange={e => setDraft(d => d && ({ ...d, notes: e.target.value }))} rows={2}
                  className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-500" />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button className="bg-stone-500 hover:bg-stone-400 text-white" onClick={handleSave} disabled={!draft.title.trim()}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
          <DialogHeader><DialogTitle>Delete Job?</DialogTitle></DialogHeader>
          <p className="text-zinc-400 text-sm">This will permanently delete <span className="text-white font-medium">{job.title}</span>. Photos and estimates will also be removed.</p>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button className="bg-red-700 hover:bg-red-600 text-white" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
