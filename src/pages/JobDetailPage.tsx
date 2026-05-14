import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, Navigate, useSearchParams } from 'react-router-dom'
import { useJobs } from '@/context/JobsContext'
import { useClients } from '@/context/ClientsContext'
import { useEmployees } from '@/context/EmployeeContext'
import { useAuth } from '@/context/AuthContext'
import { usePreferences, formatDate } from '@/context/PreferencesContext'
import { useJobMedia, type MediaCategory } from '@/hooks/useJobMedia'
import { useContracts } from '@/context/ContractsContext'
import { useSettings } from '@/context/SettingsContext'
import { fillPlaceholders, CONTRACT_STATUS_BADGE } from '@/types/contract'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronDown, Pencil, Trash2, Upload, X, Play, Send, Copy, Check, CheckCircle2, ShieldAlert, MapPin, Users, Calendar, FileText, FileSignature, Download, Smartphone,
} from 'lucide-react'
import {
  type Job, type JobStatus, type JobType,
  JOB_STATUSES, JOB_TYPES, STATUS_BADGE,
} from '@/types/job'
import JobEstimateSection from '@/components/JobEstimateSection'
import SignatureCanvas, { type SignatureCanvasRef } from '@/components/SignatureCanvas'
import JobFinancialsTab from '@/components/JobFinancialsTab'
import JobMaterialOrdersTab from '@/components/JobMaterialOrdersTab'
import JobPermitsTab from '@/components/JobPermitsTab'
import JobCommunicationsTab from '@/components/JobCommunicationsTab'
import JobPLTab from '@/components/JobPLTab'
import { ErrorBoundary } from '@/components/ErrorBoundary'

type Tab = 'overview' | 'field' | 'paperwork' | 'financials'

const NEXT_STATUS: Partial<Record<JobStatus, JobStatus>> = {
  Draft: 'Scheduled',
  Scheduled: 'Active',
  Active: 'Completed',
  Completed: 'Invoiced',
  Invoiced: 'Paid',
}

const NEXT_LABEL: Partial<Record<JobStatus, string>> = {
  Draft: 'Schedule',
  Scheduled: 'Start Job',
  Active: 'Mark Complete',
  Completed: 'Send Invoice',
  Invoiced: 'Mark Paid',
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { jobs, loading: jobsLoading, updateJob, deleteJob, requestApproval } = useJobs()
  const { clients, properties } = useClients()
  const { employees } = useEmployees()
  const { user } = useAuth()
  const { prefs } = usePreferences()
  const { settings } = useSettings()

  const job = jobs.find(j => j.id === jobId)
  const client = job?.clientId ? clients.find(c => c.id === job.clientId) : null
  const property = job?.propertyId ? properties.find(p => p.id === job.propertyId) : null

  const isAdmin = user?.role === 'Admin' || user?.role === 'General Manager'
  const isFieldWorker = user?.role === 'Employee' || user?.role === 'Subcontractor'
  const canRequestApproval = isAdmin || user?.role === 'Project Manager' || user?.role === 'Lead'

  const myEmployee = employees.find(e => e.email === user?.email)
  const isAssigned = myEmployee
    ? job?.leadId === myEmployee.id || job?.crewIds.includes(myEmployee.id)
    : false

  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>(() => (searchParams.get('tab') as Tab) || 'overview')
  const [editOpen, setEditOpen] = useState(false)
  const [draft, setDraft] = useState<Job | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [sendingApproval, setSendingApproval] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeCategory, setActiveCategory] = useState<MediaCategory>('before')
  const [uploadKey, setUploadKey] = useState(0)

  const { media, loading: mediaLoading, uploading, uploadMedia, deleteMedia } = useJobMedia(job?.id ?? null)
  const categoryMedia = media.filter(m => m.category === activeCategory)
  const { templates, contracts, addContract, sendContract, voidContract } = useContracts()
  const [contractDraftOpen, setContractDraftOpen] = useState(false)
  const [contractTemplateId, setContractTemplateId] = useState<string>('')
  const [contractTitle, setContractTitle] = useState('')
  const [contractBody, setContractBody] = useState('')
  const [contractCopied, setContractCopied] = useState(false)
  const [statusPickerOpen, setStatusPickerOpen] = useState(false)
  const [inPersonOpen, setInPersonOpen] = useState(false)
  const [inPersonName, setInPersonName] = useState('')
  const [inPersonSaving, setInPersonSaving] = useState(false)
  const sigCanvasRef = useRef<SignatureCanvasRef>(null)
  const statusPickerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusPickerRef.current && !statusPickerRef.current.contains(e.target as Node))
        setStatusPickerOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (jobsLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-stone-400 animate-spin" /></div>
  if (!job) return <Navigate to="/jobs" replace />
  if (isFieldWorker && !isAssigned) return <Navigate to="/jobs" replace />
  const j: Job = job

  const empName = (id: string | null) =>
    id ? (employees.find(e => e.id === id)?.name ?? 'Unknown') : '—'

  const canBill = isAdmin || user?.role === 'Project Manager'
  const nextStatus = NEXT_STATUS[j.status]
  const nextLabel = NEXT_LABEL[j.status]
  const canAdvance = !!nextStatus && !isFieldWorker &&
    (j.status === 'Completed' || j.status === 'Invoiced' ? canBill : true)

  async function handleAdvanceStatus() {
    if (!nextStatus) return
    await updateJob({ ...j, status: nextStatus, updatedAt: new Date().toISOString() })
    toast.success(`Job marked ${nextStatus}`)
  }

  async function handleSetStatus(status: JobStatus) {
    setStatusPickerOpen(false)
    await updateJob({ ...j, status, updatedAt: new Date().toISOString() })
    toast.success(`Job marked ${status}`)
  }

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
    e.status === 'Active' && ['Admin', 'General Manager', 'Project Manager', 'Lead', 'Sales'].includes(e.role)
  )
  const crew = employees.filter(e => e.status === 'Active')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'field', label: `Field${media.length > 0 ? ` (${media.length})` : ''}` },
    ...(!isFieldWorker ? [
      { key: 'paperwork' as Tab, label: 'Paperwork' },
      { key: 'financials' as Tab, label: 'Financials' },
    ] : []),
  ]

  const jobContract = contracts.find(c => c.jobId === j.id && c.status !== 'voided')

  function handleTemplateSelect(templateId: string) {
    setContractTemplateId(templateId)
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return
    const companyName = settings.company?.name || 'Our Company'
    setContractTitle(tpl.name)
    setContractBody(fillPlaceholders(tpl.body, j, companyName))
  }

  async function handleCreateContract() {
    if (!contractTitle.trim() || !contractBody.trim()) return
    const result = await addContract({
      jobId: j.id,
      templateId: contractTemplateId || null,
      title: contractTitle,
      body: contractBody,
    })
    if (result) { toast.success('Contract created'); setContractDraftOpen(false) }
    else toast.error('Failed to create contract')
  }

  async function handleSendContract(contractId: string) {
    await sendContract(contractId)
    toast.success('Contract sent — share the signing link with your client')
  }

  async function handleVoidContract(contractId: string) {
    await voidContract(contractId)
    toast.success('Contract voided')
  }

  async function handleInPersonApproval() {
    if (!inPersonName.trim() || sigCanvasRef.current?.isEmpty()) return
    setInPersonSaving(true)
    await updateJob({
      ...j,
      approvalStatus: 'approved',
      approverName: inPersonName.trim(),
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setInPersonOpen(false)
    setInPersonName('')
    sigCanvasRef.current?.clear()
    toast.success('Job signed off')
    setInPersonSaving(false)
  }

  function copySignLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/sign/${token}`)
    setContractCopied(true)
    setTimeout(() => setContractCopied(false), 2000)
  }

  function downloadJobReport() {
    const companyName = settings.company?.name || 'Nexus'
    const leadName = j.leadId ? empName(j.leadId) : 'Unassigned'
    const crewNames = j.crewIds.length ? j.crewIds.map(id => empName(id)).join(', ') : 'None'
    const contract = contracts.find(c => c.jobId === j.id && c.status !== 'voided')

    const categories: MediaCategory[] = ['before', 'during', 'damage', 'after']
    const photosByCategory = categories
      .map(cat => ({ cat, items: media.filter(m => m.category === cat && m.type === 'photo') }))
      .filter(({ items }) => items.length > 0)

    const photosSection = photosByCategory.length > 0 ? `
      ${photosByCategory.map(({ cat, items }) => `
        <h2>${cat.charAt(0).toUpperCase() + cat.slice(1)} Photos</h2>
        <div class="photo-grid">
          ${items.map(m => `<img src="${m.url}" alt="${cat}" />`).join('')}
        </div>
      `).join('')}
    ` : ''

    const contractSection = contract ? `
      <h2>Contract: ${contract.title}</h2>
      ${contract.status === 'signed' ? `
        <div class="signed-banner">
          Signed by <strong>${contract.signerName}</strong>
          ${contract.signedAt ? ` &middot; ${new Date(contract.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}
        </div>` : `<p class="meta">Status: ${contract.status}</p>`}
      <div class="contract-box"><pre>${contract.body}</pre></div>
    ` : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${j.title} — Job Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 760px; margin: 40px auto; color: #111; padding: 0 24px 60px; }
    .header-meta { display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; margin-bottom: 20px; }
    h1 { font-size: 22px; font-weight: 700; }
    .badge { display: inline-block; background: #f3f4f6; border-radius: 9999px; padding: 2px 10px; font-size: 11px; font-weight: 600; margin-left: 8px; vertical-align: middle; }
    h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
    .field label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; display: block; margin-bottom: 2px; }
    .field p { font-size: 13px; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.7; color: #374151; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 12px; }
    .signed-banner { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; font-size: 13px; color: #15803d; margin-bottom: 14px; }
    .contract-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
    .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .photo-grid img { width: 100%; border-radius: 6px; object-fit: cover; aspect-ratio: 4/3; }
    @media print { body { margin: 20px auto; } .photo-grid { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header-meta">
    <span>${companyName}</span>
    <span>Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
  </div>
  <h1>${j.title}<span class="badge">${j.status}</span></h1>
  <p class="meta" style="margin-top:6px">${j.type}${j.scheduledDate ? ` &middot; Scheduled ${j.scheduledDate}` : ''}</p>

  <h2>Client</h2>
  <div class="grid">
    <div class="field"><label>Name</label><p>${j.client.name || '—'}</p></div>
    <div class="field"><label>Phone</label><p>${j.client.phone || '—'}</p></div>
    <div class="field"><label>Email</label><p>${j.client.email || '—'}</p></div>
    <div class="field"><label>Address</label><p>${j.address || '—'}</p></div>
  </div>

  <h2>Crew</h2>
  <div class="grid">
    <div class="field"><label>Lead</label><p>${leadName}</p></div>
    <div class="field"><label>Crew</label><p>${crewNames}</p></div>
  </div>

  ${j.scope ? `<h2>Scope of Work</h2><pre>${j.scope}</pre>` : ''}
  ${j.notes ? `<h2>Internal Notes</h2><pre>${j.notes}</pre>` : ''}
  ${photosSection}
  ${contractSection}

  <script>window.onload = () => window.print()</script>
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.documentElement.innerHTML = html
      setTimeout(() => win.print(), 300)
    }
  }

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
        <div className="flex items-center gap-2 shrink-0">
          {/* Next step button */}
          {canAdvance && nextLabel && (
            <Button size="sm" onClick={handleAdvanceStatus} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5">
              {nextLabel}
            </Button>
          )}

          {/* Admin status picker */}
          {isAdmin && (
            <div ref={statusPickerRef} className="relative">
              <button
                onClick={() => setStatusPickerOpen(o => !o)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors text-xs"
              >
                <ChevronDown size={13} />
              </button>
              {statusPickerOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                  {([...Object.keys(NEXT_STATUS).map(k => k as JobStatus), 'Cancelled', 'Written Off'] as JobStatus[])
                    .filter((s, i, arr) => arr.indexOf(s) === i && s !== j.status)
                    .map(s => (
                      <button
                        key={s}
                        onClick={() => handleSetStatus(s)}
                        className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {!isFieldWorker && (
            <Button variant="outline" size="sm" onClick={downloadJobReport} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5">
              <Download size={13} />
            </Button>
          )}
          {!isFieldWorker && (
            <Button variant="outline" size="sm" onClick={openEdit} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5">
              <Pencil size={13} /> Edit
            </Button>
          )}
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
            onClick={() => { setActiveTab(t.key); setSearchParams({ tab: t.key }) }}
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

      <ErrorBoundary key={activeTab}>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
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

          {job.scope && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 text-xs mb-1">Scope of Work</p>
              <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">{job.scope}</p>
            </div>
          )}

          {job.notes && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 text-xs mb-1">Internal Notes</p>
              <p className="text-zinc-400 text-sm whitespace-pre-wrap">{job.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Field — Photos (everyone) + Materials / Permits / Comms (non-field) */}
      {activeTab === 'field' && (
        <div className="space-y-8">
          {/* Photos */}
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
                        className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/70 text-white md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isFieldWorker && (
            <>
              <div className="border-t border-zinc-800 pt-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Materials</p>
                <JobMaterialOrdersTab jobId={j.id} canEdit={canBill} />
              </div>
              <div className="border-t border-zinc-800 pt-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Permits</p>
                <JobPermitsTab jobId={j.id} canEdit={canBill} />
              </div>
              <div className="border-t border-zinc-800 pt-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Communications</p>
                <JobCommunicationsTab jobId={j.id} canEdit={!isFieldWorker} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Paperwork — Estimate + Approval + Contract */}
      {activeTab === 'paperwork' && (
        <div className="space-y-8">
          {/* Estimate */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Estimate</p>
            <JobEstimateSection job={job} />
          </div>

          {/* Approval */}
          <div className="border-t border-zinc-800 pt-6 max-w-lg space-y-4">
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

              {/* Approved */}
              {job.approvalStatus === 'approved' && (
                <div className="flex items-center gap-2 bg-green-900/20 border border-green-800 rounded-md px-3 py-2">
                  <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                  <div>
                    <p className="text-green-300 text-xs font-medium">Signed off by {job.approverName}</p>
                    {job.approvedAt && (
                      <p className="text-green-600 text-xs">{new Date(job.approvedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Not yet approved */}
              {job.approvalStatus !== 'approved' && canRequestApproval && (
                <div className="space-y-3">
                  {/* In-person primary option */}
                  <button
                    onClick={() => setInPersonOpen(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-stone-500 hover:bg-stone-400 text-white transition-colors text-left"
                  >
                    <Smartphone size={16} className="shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Get Sign-off Now</p>
                      <p className="text-xs text-stone-200">Hand device to customer to sign on screen</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 text-zinc-600 text-xs">
                    <div className="flex-1 border-t border-zinc-800" />
                    or send remotely
                    <div className="flex-1 border-t border-zinc-800" />
                  </div>

                  {/* Remote option */}
                  {job.approvalStatus === 'requested' && job.approvalToken ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-800 rounded-md px-3 py-2">
                        <Send size={12} className="text-blue-400 shrink-0" />
                        <p className="text-blue-300 text-xs">
                          Request sent{job.approvalRequestedAt ? ` · ${new Date(job.approvalRequestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
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
                      <button onClick={handleRequestApproval} disabled={sendingApproval}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                        {sendingApproval ? 'Sending…' : 'Resend request'}
                      </button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" disabled={sendingApproval} onClick={handleRequestApproval}
                      className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 gap-1.5 w-full justify-center">
                      <Send size={13} />
                      {sendingApproval ? 'Sending…' : 'Send Approval Request'}
                    </Button>
                  )}
                </div>
              )}

              {job.approvalStatus !== 'approved' && !canRequestApproval && (
                <p className="text-zinc-600 text-sm">No approval requested yet.</p>
              )}
            </div>

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

          {/* In-person sign-off dialog */}
          <Dialog open={inPersonOpen} onOpenChange={open => {
            setInPersonOpen(open)
            if (!open) { setInPersonName(''); sigCanvasRef.current?.clear() }
          }}>
            <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Job Completion Sign-off</DialogTitle>
              </DialogHeader>

              <div className="space-y-5 mt-1">
                {/* Job summary */}
                <div className="bg-zinc-800 rounded-lg p-4 space-y-1.5">
                  <p className="text-white font-semibold text-sm">{j.title}</p>
                  {j.address && <p className="text-zinc-400 text-xs">{j.address}</p>}
                  {j.scope && <p className="text-zinc-400 text-xs mt-1 leading-relaxed line-clamp-4">{j.scope}</p>}
                </div>

                <p className="text-zinc-400 text-xs leading-relaxed">
                  By signing below, I confirm that the work described above has been completed to my satisfaction.
                </p>

                {/* Signature canvas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-400 text-xs">Signature</Label>
                    <button onClick={() => sigCanvasRef.current?.clear()}
                      className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
                      Clear
                    </button>
                  </div>
                  <SignatureCanvas
                    ref={sigCanvasRef}
                    className="w-full h-36 rounded-lg bg-zinc-800 border border-zinc-700 cursor-crosshair"
                  />
                  <p className="text-zinc-600 text-[10px]">Draw your signature above</p>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">Full Name</Label>
                  <input
                    type="text"
                    placeholder="Customer's full name"
                    value={inPersonName}
                    onChange={e => setInPersonName(e.target.value)}
                    className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button variant="ghost" className="text-zinc-400" onClick={() => setInPersonOpen(false)}>Cancel</Button>
                <Button
                  className="bg-stone-500 hover:bg-stone-400 text-white"
                  disabled={!inPersonName.trim() || inPersonSaving}
                  onClick={handleInPersonApproval}
                >
                  {inPersonSaving ? 'Saving…' : 'Sign Off'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Contract */}
          <div className="border-t border-zinc-800 pt-6 max-w-lg space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Contract</p>
            {!jobContract ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                <p className="text-zinc-300 text-sm font-semibold">Create Contract</p>
                {templates.length === 0 ? (
                  <p className="text-zinc-500 text-sm">No templates yet. Go to <span className="text-stone-400">Settings → Contract Templates</span> to create one.</p>
                ) : (
                  <>
                    {!contractDraftOpen ? (
                      <Button onClick={() => setContractDraftOpen(true)} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5">
                        <FileSignature size={14} /> Create Contract
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-xs">Template</Label>
                          <Select value={contractTemplateId} onValueChange={handleTemplateSelect}>
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Select a template…" /></SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {contractTemplateId && (
                          <>
                            <div className="space-y-1.5">
                              <Label className="text-zinc-400 text-xs">Title</Label>
                              <Input value={contractTitle} onChange={e => setContractTitle(e.target.value)}
                                className="bg-zinc-800 border-zinc-700 text-white" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-zinc-400 text-xs">Body</Label>
                              <textarea value={contractBody} onChange={e => setContractBody(e.target.value)} rows={10}
                                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-stone-500" />
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => setContractDraftOpen(false)}>Cancel</Button>
                              <Button className="bg-stone-500 hover:bg-stone-400 text-white" onClick={handleCreateContract}
                                disabled={!contractTitle.trim() || !contractBody.trim()}>
                                Save Contract
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-zinc-300 text-sm font-semibold">{jobContract.title}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CONTRACT_STATUS_BADGE[jobContract.status]}`}>
                    {jobContract.status.charAt(0).toUpperCase() + jobContract.status.slice(1)}
                  </span>
                </div>

                {jobContract.status === 'signed' && (
                  <div className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-800 rounded-md px-3 py-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-emerald-300 text-xs font-medium">Signed by {jobContract.signerName}</p>
                      {jobContract.signedAt && (
                        <p className="text-emerald-700 text-xs">{new Date(jobContract.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                      )}
                    </div>
                  </div>
                )}

                {jobContract.status === 'sent' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-800 rounded-md px-3 py-2">
                      <Send size={12} className="text-blue-400 shrink-0" />
                      <p className="text-blue-300 text-xs">Awaiting client signature</p>
                    </div>
                    <button onClick={() => copySignLink(jobContract.signToken)}
                      className="w-full flex items-center justify-between gap-2 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-400 hover:border-zinc-500 transition-colors">
                      <span className="truncate font-mono">{`${window.location.origin}/sign/${jobContract.signToken}`}</span>
                      <span className="shrink-0 flex items-center gap-1">
                        {contractCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        {contractCopied ? 'Copied!' : 'Copy'}
                      </span>
                    </button>
                  </div>
                )}

                {jobContract.status === 'draft' && (
                  <Button onClick={() => handleSendContract(jobContract.id)} className="bg-stone-500 hover:bg-stone-400 text-white gap-1.5" size="sm">
                    <Send size={13} /> Send for Signature
                  </Button>
                )}

                {(jobContract.status === 'draft' || jobContract.status === 'sent') && isAdmin && (
                  <button onClick={() => handleVoidContract(jobContract.id)}
                    className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                    Void contract
                  </button>
                )}

                <div className="border-t border-zinc-800 pt-3">
                  <p className="text-zinc-500 text-xs mb-2">Contract Preview</p>
                  <pre className="text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap font-sans line-clamp-6">{jobContract.body}</pre>
                  <a href={`/sign/${jobContract.signToken}`} target="_blank" rel="noopener noreferrer"
                    className="text-stone-400 hover:text-stone-300 text-xs underline underline-offset-2 mt-2 inline-block">
                    Preview signing page ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Financials — Invoices / Payments / Expenses + P&L */}
      {activeTab === 'financials' && (
        <div className="space-y-8">
          <JobFinancialsTab job={j} canEdit={canBill} />
          <div className="border-t border-zinc-800 pt-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-5">Profit & Loss</p>
            <JobPLTab job={j} />
          </div>
        </div>
      )}

      </ErrorBoundary>

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
