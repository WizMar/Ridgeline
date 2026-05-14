import { useParams, useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type Employee, roleColors, statusColors, timeWithCompany } from '@/types/employee'
import { useEmployees } from '@/context/EmployeeContext'
import { useTimeClock } from '@/context/TimeClockContext'
import { calcHours, fmtHours } from '@/types/timeclock'
import { usePreferences, formatDate, formatTime } from '@/context/PreferencesContext'
import { toast } from 'sonner'

export default function EmployeeProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employees, updateEmployee } = useEmployees()
  const { entries } = useTimeClock()
  const { prefs } = usePreferences()

  function fmt(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return formatTime(`${hh}:${mm}`, prefs.timeFormat)
  }

  const empEntries = entries
    .filter(e => e.employeeId === id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const employee = employees.find(e => e.id === id)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Employee | null>(employee ?? null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!employee || !form) {
    return (
      <div className="text-center text-zinc-400 mt-20">
        <p>Employee not found.</p>
        <Button onClick={() => navigate('/employees')} className="mt-4 bg-stone-500 hover:bg-stone-400 text-white">Back to Employees</Button>
      </div>
    )
  }

  function handlePicChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const pic = reader.result as string
      setForm(f => f ? { ...f, profilePicture: pic } : null)
      if (employee) updateEmployee({ ...employee, profilePicture: pic })
    }
    reader.readAsDataURL(file)
  }

  function handleSave() {
    if (!form) return
    updateEmployee(form)
    setEditing(false)
    toast.success('Profile saved')
  }

  function handleCancel() {
    setForm(employee ?? null)
    setEditing(false)
  }

  const data = editing ? form : employee

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-white">
      {/* Back */}
      <button onClick={() => navigate('/employees')} className="text-zinc-400 hover:text-white text-sm flex items-center gap-1">
        ← Back to Employees
      </button>

      {/* Profile Header */}
      <Card className="bg-zinc-900 border-zinc-800 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              {data.profilePicture ? (
                <img src={data.profilePicture} className="w-24 h-24 rounded-full object-cover border-2 border-zinc-700" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-zinc-700 flex items-center justify-center text-3xl font-bold text-zinc-300 border-2 border-zinc-600">
                  {data.name.charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 bg-stone-500 hover:bg-stone-400 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs"
                title="Upload photo"
              >
                +
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePicChange} />
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{employee.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-1 rounded text-xs font-medium ${roleColors[employee.role]}`}>{employee.role}</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[employee.status]}`}>{employee.status}</span>
              </div>
              <p className="text-zinc-400 text-sm mt-2">With the company for <span className="text-stone-300 font-medium">{timeWithCompany(employee.hireDate)}</span></p>
            </div>

            <div>
              {editing ? (
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="bg-stone-500 hover:bg-stone-400 text-white text-sm">Save</Button>
                  <Button onClick={handleCancel} variant="ghost" className="text-zinc-400 hover:text-white text-sm">Cancel</Button>
                </div>
              ) : (
                <Button onClick={() => setEditing(true)} className="bg-zinc-700 hover:bg-zinc-600 text-white text-sm">Edit Profile</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <Field label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
                <Field label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
                <Field label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} />
              </>
            ) : (
              <>
                <InfoRow label="Phone" value={employee.phone} />
                <InfoRow label="Email" value={employee.email} />
                <InfoRow label="Address" value={employee.address} />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium">Employment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <Field label="Hire Date" value={form.hireDate} onChange={v => setForm({ ...form, hireDate: v })} type="date" />
                <div className="space-y-1">
                  <Label className="text-zinc-500 text-xs">Role</Label>
                  <Select value={form.role} onValueChange={v => setForm({ ...form, role: v as Employee['role'] })}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectItem value="Employee">Employee</SelectItem>
                      <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Project Manager">Project Manager</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="General Manager">General Manager</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-500 text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Employee['status'] })}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <InfoRow label="Hire Date" value={formatDate(employee.hireDate, prefs.dateFormat)} />
                <InfoRow label="Time with Company" value={timeWithCompany(employee.hireDate)} />
                <InfoRow label="Role" value={employee.role} />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium">Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <Field label="Birthday" value={form.birthdate} onChange={v => setForm({ ...form, birthdate: v })} type="date" />
            ) : (
              <InfoRow label="Birthday" value={formatDate(employee.birthdate, prefs.dateFormat)} />
            )}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400 font-medium">Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <Field label="Name" value={form.emergencyContact} onChange={v => setForm({ ...form, emergencyContact: v })} />
                <Field label="Phone" value={form.emergencyPhone} onChange={v => setForm({ ...form, emergencyPhone: v })} />
              </>
            ) : (
              <>
                <InfoRow label="Name" value={employee.emergencyContact} />
                <InfoRow label="Phone" value={employee.emergencyPhone} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <Card className="bg-zinc-900 border-zinc-800 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-400 font-medium">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Add notes about this employee..."
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md p-2 placeholder:text-zinc-500 resize-none h-24 focus:outline-none focus:ring-1 focus:ring-stone-500"
            />
          ) : (
            <p className="text-zinc-300 text-sm whitespace-pre-wrap">{employee.notes || '—'}</p>
          )}
        </CardContent>
      </Card>

      {/* Time History */}
      <Card className="bg-zinc-900 border-zinc-800 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-zinc-400 font-medium">Time History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {empEntries.length === 0 ? (
            <p className="text-zinc-500 text-sm px-4 py-6">No time records yet.</p>
          ) : (
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Clock In</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Lunch</th>
                  <th className="text-left px-4 py-3 font-medium">Clock Out</th>
                  <th className="text-left px-4 py-3 font-medium">Total</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {empEntries.map(entry => (
                  <tr key={entry.id} className="border-b border-zinc-800 hover:bg-zinc-800 transition-colors">
                    <td className="px-4 py-3 text-white">{formatDate(entry.date, prefs.dateFormat)}</td>
                    <td className="px-4 py-3 text-zinc-400">{fmt(entry.clockIn)}</td>
                    <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell">
                      {entry.lunchStart ? `${fmt(entry.lunchStart)} – ${fmt(entry.lunchEnd)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{fmt(entry.clockOut)}</td>
                    <td className="px-4 py-3 text-stone-300 tabular-nums">{fmtHours(calcHours(entry))}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.status === 'approved' ? 'bg-stone-800 text-stone-200' :
                        entry.status === 'completed' ? 'bg-zinc-700 text-zinc-300' :
                        entry.status === 'pending_edit' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-blue-900 text-blue-300'
                      }`}>
                        {entry.status === 'approved' ? 'Approved' :
                         entry.status === 'completed' ? 'Completed' :
                         entry.status === 'pending_edit' ? 'Edit Pending' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-zinc-500 text-xs">{label}</p>
      <p className="text-white text-sm">{value || '—'}</p>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-zinc-500 text-xs">{label}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm" />
    </div>
  )
}
