import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type Employee, emptyEmployee, roleColors, statusColors } from '@/types/employee'
import { useEmployees } from '@/context/EmployeeContext'
import { useAuth, type UserRole } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/context/SettingsContext'
import { toast } from 'sonner'
import { Users } from 'lucide-react'

const ADMIN_INVITE_ROLES: UserRole[] = ['Sub-Admin', 'Project Manager', 'Sales', 'Lead', 'Employee', 'Subcontractor']
const SUB_ADMIN_INVITE_ROLES: UserRole[] = ['Project Manager', 'Sales', 'Lead', 'Employee', 'Subcontractor']

export default function EmployeesPage() {
  const navigate = useNavigate()
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployees()
  const { user, can } = useAuth()
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState(emptyEmployee)
  const [search, setSearch] = useState('')

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('Employee')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteEmailSent, setInviteEmailSent] = useState<'sending' | 'sent' | 'failed' | null>(null)

  const [inviteError, setInviteError] = useState('')
  const [subAdminCanInvite, setSubAdminCanInvite] = useState(true)

  useEffect(() => {
    if (user?.org_id) {
      supabase
        .from('organizations')
        .select('sub_admin_can_invite')
        .eq('id', user.org_id)
        .single()
        .then(({ data }) => {
          if (data) setSubAdminCanInvite(data.sub_admin_can_invite)
        })
    }
  }, [user?.org_id])

  const canInvite = can('invite:members') && (user?.role === 'Admin' || subAdminCanInvite)
  const inviteRoles = user?.role === 'Admin' ? ADMIN_INVITE_ROLES : SUB_ADMIN_INVITE_ROLES

  function openInvite() {
    setInviteEmail('')
    setInviteRole('Employee')
    setInviteLink(null)
    setInviteEmailSent(null)
    setInviteError('')
    setInviteOpen(true)
  }

  async function handleInvite() {
    if (!inviteEmail || !user?.org_id) {
      setInviteError('Could not load your organization. Try signing out and back in.')
      setInviteLoading(false)
      return
    }
    setInviteLoading(true)
    setInviteError('')
    setInviteLink(null)

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        org_id: user.org_id,
        email: inviteEmail,
        role: inviteRole,
        invited_by: user.id,
      })
      .select('token')
      .single()

    if (error || !data) {
      setInviteError(error?.message ?? 'Failed to create invitation')
      setInviteLoading(false)
      return
    }

    const link = `${window.location.origin}/invite?token=${data.token}`
    setInviteLink(link)
    setInviteLoading(false)

    // Fire email — don't block the UI on this
    const orgName = settings.company.name || 'Nexus'
    setInviteEmailSent('sending')
    supabase.functions.invoke('send-invite-email', {
      body: { email: inviteEmail, inviteLink: link, role: inviteRole, orgName },
    }).then(({ error: fnError }) => {
      setInviteEmailSent(fnError ? 'failed' : 'sent')
    })
  }

  function openAdd() {
    setEditTarget(null)
    setForm(emptyEmployee)
    setOpen(true)
  }

  function openEdit(emp: Employee) {
    setEditTarget(emp)
    setForm({ name: emp.name, phone: emp.phone, email: emp.email, role: emp.role, hireDate: emp.hireDate, birthdate: emp.birthdate, status: emp.status, address: emp.address, emergencyContact: emp.emergencyContact, emergencyPhone: emp.emergencyPhone, notes: emp.notes, profilePicture: emp.profilePicture })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.name) return
    if (editTarget) {
      const err = await updateEmployee({ ...editTarget, ...form })
      if (err) { toast.error(`Failed to update: ${err}`); return }
      toast.success('Employee updated')
      if (editTarget.role !== form.role && form.email) {
        toast.info('Role change will take effect on their next login.')
      }
    } else {
      await addEmployee(form)
      toast.success('Employee added')
    }
    setOpen(false)
  }

  async function toggleStatus(id: string) {
    const emp = employees.find(e => e.id === id)
    if (!emp) return
    const err = await updateEmployee({ ...emp, status: emp.status === 'Active' ? 'Inactive' : 'Active' })
    if (err) toast.error(`Failed: ${err}`)
  }

  async function archiveEmployee(id: string) {
    const emp = employees.find(e => e.id === id)
    if (!emp) return
    const err = await updateEmployee({ ...emp, status: 'Archived' })
    if (err) toast.error(`Failed: ${err}`)
  }

  async function handleDelete(id: string) {
    await deleteEmployee(id)
    setConfirmDelete(null)
    toast.success('Employee deleted')
  }

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-5xl mx-auto space-y-4 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white">Employees</h2>
          <p className="hidden md:block text-zinc-400 text-sm mt-1">Manage your team members and their roles.</p>
        </div>
        <div className="flex gap-2">
          {canInvite && (
            <Button onClick={openInvite} variant="outline" className="border-stone-500 text-stone-300 hover:bg-stone-500 hover:text-white">
              Invite Member
            </Button>
          )}
          <Button onClick={openAdd} className="bg-stone-500 hover:bg-stone-400 text-white">
            + Add Employee
          </Button>
        </div>
      </div>

      <Input
        placeholder="Search by name or role..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 max-w-sm"
      />

      <Card className="bg-zinc-900 border-zinc-800 text-white">
        {filtered.length === 0 ? (
          <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
            <Users className="w-10 h-10 text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-500 text-sm">
              {employees.length === 0 ? 'No employees yet.' : 'No results found.'}
            </p>
            {employees.length === 0 && (
              <Button onClick={openAdd} className="bg-stone-500 hover:bg-stone-400 text-white mt-1">
                + Add First Employee
              </Button>
            )}
          </CardContent>
        ) : (
          <CardContent className="p-3">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(emp => (
                <div key={emp.id} className="bg-zinc-800 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {emp.profilePicture ? (
                      <img src={emp.profilePicture} className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold shrink-0">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <button
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      className="text-white text-sm font-medium hover:text-stone-300 transition-colors text-left line-clamp-1"
                    >
                      {emp.name}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${roleColors[emp.role]}`}>{emp.role}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColors[emp.status]}`}>{emp.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 pt-1 border-t border-zinc-700">
                    <button onClick={() => openEdit(emp)} className="text-zinc-400 hover:text-white text-xs">Edit</button>
                    <button onClick={() => toggleStatus(emp.id)} className="text-zinc-400 hover:text-white text-xs">
                      {emp.status === 'Active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => archiveEmployee(emp.id)} className="text-yellow-500 hover:text-yellow-400 text-xs">Archive</button>
                    <button onClick={() => setConfirmDelete(emp.id)} className="text-red-500 hover:text-red-400 text-xs">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Invite Team Member</DialogTitle>
          </DialogHeader>
          {inviteLink ? (
            <div className="space-y-4 py-2">
              <p className="text-zinc-400 text-sm">Share this link with your team member:</p>
              <div className="bg-zinc-800 rounded-lg p-3 break-all text-stone-300 text-sm font-mono">
                {inviteLink}
              </div>
              <Button
                onClick={() => { navigator.clipboard.writeText(inviteLink) }}
                variant="outline"
                className="w-full border-zinc-700 text-zinc-300 hover:text-white"
              >
                Copy Link
              </Button>
              <p className="text-zinc-500 text-xs text-center">
                {inviteEmailSent === 'sending' && 'Sending invite email…'}
                {inviteEmailSent === 'sent' && <span className="text-green-400">Email sent to {inviteEmail}</span>}
                {inviteEmailSent === 'failed' && 'Email failed — share the link manually.'}
                {inviteEmailSent === null && 'Link expires in 7 days.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-zinc-300">Email Address</Label>
                <Input
                  type="email"
                  placeholder="teammate@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Role</Label>
                <Select value={inviteRole} onValueChange={val => setInviteRole(val as UserRole)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {inviteRoles.map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {inviteError && <p className="text-red-400 text-sm">{inviteError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)} className="text-zinc-400 hover:text-white">
              {inviteLink ? 'Close' : 'Cancel'}
            </Button>
            {!inviteLink && (
              <Button onClick={handleInvite} className="bg-stone-500 hover:bg-stone-400 text-white" disabled={inviteLoading || !inviteEmail}>
                {inviteLoading ? 'Creating...' : 'Send Invite'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Employee?</DialogTitle>
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

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editTarget ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-zinc-300">Full Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="John Smith" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-zinc-300">Phone</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="(555) 000-0000" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Email</Label>
                <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="john@email.com" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-zinc-300">Role</Label>
                <Select value={form.role} onValueChange={val => setForm({ ...form, role: val as Employee['role'] })}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="Lead">Lead</SelectItem>
                    <SelectItem value="Project Manager">Project Manager</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Sub-Admin">Sub-Admin</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Hire Date</Label>
                <Input type="date" value={form.hireDate} onChange={e => setForm({ ...form, hireDate: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">Cancel</Button>
            <Button onClick={handleSave} className="bg-stone-500 hover:bg-stone-400 text-white">
              {editTarget ? 'Save Changes' : 'Add Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
