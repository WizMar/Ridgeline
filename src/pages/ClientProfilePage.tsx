import { useState } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useClients } from '@/context/ClientsContext'
import { useJobs } from '@/context/JobsContext'
import { useEmployees } from '@/context/EmployeeContext'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ChevronLeft, Phone, Mail, FileText, MapPin, Plus, Pencil, Trash2, Home, Building2, Factory,
} from 'lucide-react'
import { toast } from 'sonner'
import { PROPERTY_TYPES, PROPERTY_TYPE_BADGE, type Property, type PropertyType } from '@/types/client'
import { JOB_TYPES, JOB_STATUSES, STATUS_BADGE, type Job, type JobStatus, type JobType } from '@/types/job'
import { usePreferences, formatDate } from '@/context/PreferencesContext'

const PROPERTY_ICONS: Record<PropertyType, React.ReactNode> = {
  residential: <Home size={14} />,
  commercial:  <Building2 size={14} />,
  industrial:  <Factory size={14} />,
}

function blankJob(): Omit<Job, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '', client: { name: '', phone: '', email: '' }, address: '',
    type: 'General', status: 'Draft', leadId: null, crewIds: [],
    notes: '', scope: '', scheduledDate: '',
    approvalRequired: false, approvalStatus: 'none',
    approvalRequestedAt: null, approvalToken: null, approvedAt: null, approverName: null,
    clientId: null, propertyId: null, amount: null,
  }
}

export default function ClientProfilePage() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  const { clients, properties, loading, updateClient, deleteClient, addProperty, updateProperty, deleteProperty } = useClients()
  const { jobs, addJob } = useJobs()
  const { employees } = useEmployees()
  const { user, can } = useAuth()
  const { prefs } = usePreferences()

  const client = clients.find(c => c.id === clientId)
  const clientProperties = properties.filter(p => p.clientId === clientId)
  const clientJobs = jobs.filter(j => j.clientId === clientId)

  const isAdmin = user?.role === 'Admin' || user?.role === 'General Manager'

  // Edit client dialog
  const [editClientOpen, setEditClientOpen] = useState(false)
  const [clientDraft, setClientDraft] = useState({ name: '', phone: '', email: '', notes: '' })

  // Add / edit property dialog
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [propDraft, setPropDraft] = useState({ address: '', type: 'residential' as PropertyType, notes: '' })

  // New job dialog
  const [jobDialogOpen, setJobDialogOpen] = useState(false)
  const [jobDraft, setJobDraft] = useState(blankJob())

  // Delete confirms
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false)
  const [confirmDeleteProperty, setConfirmDeleteProperty] = useState<string | null>(null)

  if (!loading && !client) return <Navigate to="/clients" replace />
  if (loading || !client) return <p className="text-zinc-400 p-6">Loading…</p>

  const leads = employees.filter(e =>
    e.status === 'Active' &&
    ['Admin', 'General Manager', 'Project Manager', 'Lead', 'Sales'].includes(e.role)
  )
  const crew = employees.filter(e => e.status === 'Active')

  function openEditClient() {
    setClientDraft({ name: client!.name, phone: client!.phone, email: client!.email, notes: client!.notes })
    setEditClientOpen(true)
  }

  async function handleSaveClient() {
    await updateClient({ ...client!, ...clientDraft })
    setEditClientOpen(false)
    toast.success('Client updated')
  }

  async function handleDeleteClient() {
    await deleteClient(client!.id)
    toast.success('Client deleted')
    navigate('/clients')
  }

  function openAddProperty() {
    setEditingProperty(null)
    setPropDraft({ address: '', type: 'residential', notes: '' })
    setPropertyDialogOpen(true)
  }

  function openEditProperty(prop: Property) {
    setEditingProperty(prop)
    setPropDraft({ address: prop.address, type: prop.type, notes: prop.notes })
    setPropertyDialogOpen(true)
  }

  async function handleSaveProperty() {
    if (!propDraft.address.trim()) return
    if (editingProperty) {
      await updateProperty({ ...editingProperty, ...propDraft })
      toast.success('Property updated')
    } else {
      await addProperty({ clientId: client!.id, ...propDraft })
      toast.success('Property added')
    }
    setPropertyDialogOpen(false)
  }

  async function handleDeleteProperty(id: string) {
    await deleteProperty(id)
    setConfirmDeleteProperty(null)
    toast.success('Property removed')
  }

  function openNewJob(propertyId: string) {
    const prop = properties.find(p => p.id === propertyId)
    setJobDraft({
      ...blankJob(),
      client: { name: client!.name, phone: client!.phone, email: client!.email },
      address: prop?.address ?? '',
      clientId: client!.id,
      propertyId,
    })
    setJobDialogOpen(true)
  }

  async function handleSaveJob() {
    if (!jobDraft.title.trim()) return
    const ok = await addJob({ ...jobDraft, updatedAt: new Date().toISOString() } as Omit<Job, 'id' | 'createdAt' | 'updatedAt'>)
    if (ok) {
      setJobDialogOpen(false)
      toast.success('Job created')
    } else {
      toast.error('Failed to create job. Please try again.')
    }
  }

  function toggleCrew(empId: string) {
    setJobDraft(d => ({
      ...d,
      crewIds: d.crewIds.includes(empId)
        ? d.crewIds.filter(id => id !== empId)
        : [...d.crewIds, empId],
    }))
  }

  const empName = (id: string | null) =>
    id ? (employees.find(e => e.id === id)?.name ?? 'Unknown') : '—'

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-white">
      {/* Back */}
      <button
        onClick={() => navigate('/clients')}
        className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
      >
        <ChevronLeft size={16} />
        Clients
      </button>

      {/* Client header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{client.name}</h2>
          <div className="flex flex-wrap items-center gap-4 mt-1">
            {client.phone && (
              <span className="flex items-center gap-1.5 text-zinc-400 text-sm">
                <Phone size={13} />{client.phone}
              </span>
            )}
            {client.email && (
              <span className="flex items-center gap-1.5 text-zinc-400 text-sm">
                <Mail size={13} />{client.email}
              </span>
            )}
          </div>
          {client.notes && (
            <p className="text-zinc-500 text-sm mt-2 max-w-xl">{client.notes}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={openEditClient}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
            >
              <Pencil size={13} /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteClient(true)}
              className="border-red-800 text-red-400 hover:bg-red-900/30"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
        <div>
          <p className="text-zinc-500 text-xs">Properties</p>
          <p className="text-white font-semibold text-lg">{clientProperties.length}</p>
        </div>
        <div className="w-px bg-zinc-800" />
        <div>
          <p className="text-zinc-500 text-xs">Total Jobs</p>
          <p className="text-white font-semibold text-lg">{clientJobs.length}</p>
        </div>
        <div className="w-px bg-zinc-800" />
        <div>
          <p className="text-zinc-500 text-xs">Active Jobs</p>
          <p className="text-white font-semibold text-lg">
            {clientJobs.filter(j => j.status === 'Active' || j.status === 'Scheduled').length}
          </p>
        </div>
      </div>

      {/* Properties + Jobs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Properties</h3>
          {can('create:clients') && (
            <Button
              variant="outline"
              size="sm"
              onClick={openAddProperty}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
            >
              <Plus size={13} /> Add Property
            </Button>
          )}
        </div>

        {clientProperties.length === 0 ? (
          <div className="border border-dashed border-zinc-700 rounded-lg py-10 text-center">
            <MapPin className="w-8 h-8 text-zinc-600 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-zinc-500 text-sm">No properties yet.</p>
            {can('create:clients') && (
              <button onClick={openAddProperty} className="text-stone-400 hover:text-stone-300 text-sm mt-1 underline underline-offset-2">
                Add a property
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {clientProperties.map(prop => {
              const propJobs = clientJobs.filter(j => j.propertyId === prop.id)
              return (
                <div key={prop.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                  {/* Property header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${PROPERTY_TYPE_BADGE[prop.type]}`}>
                        {PROPERTY_ICONS[prop.type]}
                        {prop.type.charAt(0).toUpperCase() + prop.type.slice(1)}
                      </span>
                      <span className="flex items-center gap-1.5 text-zinc-300 text-sm">
                        <MapPin size={13} className="text-zinc-500" />
                        {prop.address}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditProperty(prop)}
                            className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteProperty(prop.id)}
                            className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Jobs under this property */}
                  <div className="divide-y divide-zinc-800">
                    {propJobs.length === 0 ? (
                      <div className="px-4 py-5 text-center">
                        <p className="text-zinc-600 text-xs">No jobs at this property yet.</p>
                      </div>
                    ) : (
                      propJobs.map(job => (
                        <div
                          key={job.id}
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/60 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[job.status]}`}>
                              {job.status}
                            </span>
                            <div className="min-w-0">
                              <p className="text-white text-sm font-medium truncate">{job.title}</p>
                              <p className="text-zinc-500 text-xs">{job.type}{job.scheduledDate ? ` · ${formatDate(job.scheduledDate, prefs.dateFormat)}` : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {job.leadId && (
                              <span className="text-zinc-500 text-xs hidden sm:block">
                                {empName(job.leadId).split(' ')[0]}
                              </span>
                            )}
                            <FileText size={14} className="text-zinc-500" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add job to this property */}
                  {can('create:jobs') && (
                    <div className="px-4 py-3 border-t border-zinc-800">
                      <button
                        onClick={() => openNewJob(prop.id)}
                        className="flex items-center gap-1.5 text-zinc-500 hover:text-stone-400 text-xs transition-colors"
                      >
                        <Plus size={13} /> New Job at this property
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Client Dialog */}
      <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Full Name *</Label>
              <Input value={clientDraft.name} onChange={e => setClientDraft(d => ({ ...d, name: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Phone</Label>
                <Input value={clientDraft.phone} onChange={e => setClientDraft(d => ({ ...d, phone: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Email</Label>
                <Input value={clientDraft.email} onChange={e => setClientDraft(d => ({ ...d, email: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Notes</Label>
              <textarea value={clientDraft.notes} onChange={e => setClientDraft(d => ({ ...d, notes: e.target.value }))}
                rows={2} className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-500" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setEditClientOpen(false)}>Cancel</Button>
            <Button className="bg-stone-500 hover:bg-stone-400 text-white" onClick={handleSaveClient} disabled={!clientDraft.name.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Property Dialog */}
      <Dialog open={propertyDialogOpen} onOpenChange={setPropertyDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingProperty ? 'Edit Property' : 'Add Property'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Address *</Label>
              <Input value={propDraft.address} onChange={e => setPropDraft(d => ({ ...d, address: e.target.value }))}
                placeholder="123 Main St, City, CA 00000"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Property Type</Label>
              <Select value={propDraft.type} onValueChange={v => setPropDraft(d => ({ ...d, type: v as PropertyType }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {PROPERTY_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Notes</Label>
              <textarea value={propDraft.notes} onChange={e => setPropDraft(d => ({ ...d, notes: e.target.value }))}
                rows={2} placeholder="Gate code, access instructions, etc…"
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-500" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setPropertyDialogOpen(false)}>Cancel</Button>
            <Button className="bg-stone-500 hover:bg-stone-400 text-white" onClick={handleSaveProperty} disabled={!propDraft.address.trim()}>
              {editingProperty ? 'Save Changes' : 'Add Property'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Job Dialog */}
      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Job — {client.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Job Title *</Label>
              <Input value={jobDraft.title} onChange={e => setJobDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="e.g. Full Roof Replacement"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Status</Label>
                <Select value={jobDraft.status} onValueChange={v => setJobDraft(d => ({ ...d, status: v as JobStatus }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {JOB_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Job Type</Label>
                <Select value={jobDraft.type} onValueChange={v => setJobDraft(d => ({ ...d, type: v as JobType }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {JOB_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Scheduled Date</Label>
              <Input type="date" value={jobDraft.scheduledDate}
                onChange={e => setJobDraft(d => ({ ...d, scheduledDate: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Assign Lead</Label>
              <Select value={jobDraft.leadId ?? 'none'} onValueChange={v => setJobDraft(d => ({ ...d, leadId: v === 'none' ? null : v }))}>
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
                        jobDraft.crewIds.includes(e.id)
                          ? 'border-stone-500 bg-stone-500 text-white'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                      }`}>
                      {e.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Scope of Work</Label>
              <textarea value={jobDraft.scope} onChange={e => setJobDraft(d => ({ ...d, scope: e.target.value }))}
                rows={3} placeholder="Describe the work to be performed…"
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Internal Notes</Label>
              <textarea value={jobDraft.notes} onChange={e => setJobDraft(d => ({ ...d, notes: e.target.value }))}
                rows={2} placeholder="Internal notes (not visible to client)…"
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-500" />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => setJobDialogOpen(false)}>Cancel</Button>
            <Button className="bg-stone-500 hover:bg-stone-400 text-white" onClick={handleSaveJob} disabled={!jobDraft.title.trim()}>
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Client Confirm */}
      <Dialog open={confirmDeleteClient} onOpenChange={setConfirmDeleteClient}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
          <DialogHeader><DialogTitle>Delete Client?</DialogTitle></DialogHeader>
          <p className="text-zinc-400 text-sm">This will delete <span className="text-white font-medium">{client.name}</span> and all their properties. Jobs will remain but lose the client link.</p>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setConfirmDeleteClient(false)}>Cancel</Button>
            <Button className="bg-red-700 hover:bg-red-600 text-white" onClick={handleDeleteClient}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Property Confirm */}
      <Dialog open={!!confirmDeleteProperty} onOpenChange={() => setConfirmDeleteProperty(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
          <DialogHeader><DialogTitle>Remove Property?</DialogTitle></DialogHeader>
          <p className="text-zinc-400 text-sm">Jobs at this property will remain but lose the property link.</p>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setConfirmDeleteProperty(null)}>Cancel</Button>
            <Button className="bg-red-700 hover:bg-red-600 text-white" onClick={() => handleDeleteProperty(confirmDeleteProperty!)}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
