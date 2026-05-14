import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings, getPayPeriodRange } from '@/context/SettingsContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEmployees } from '@/context/EmployeeContext'
import { useTimeClock } from '@/context/TimeClockContext'
import { useAuth } from '@/context/AuthContext'
import { type TimeEntry, calcHours, fmtHours } from '@/types/timeclock'
import { usePreferences, formatTime, formatDate } from '@/context/PreferencesContext'
import { toast } from 'sonner'

async function getLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 }
    )
  })
}

const today = new Date().toISOString().split('T')[0]

export default function TimeClockPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const payPeriod = getPayPeriodRange(settings)
  const { employees } = useEmployees()
  const { entries, addEntry, updateEntry, updateLocation } = useTimeClock()
  const { user, can } = useAuth()
  const { prefs } = usePreferences()

  function fmt(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return formatTime(`${hh}:${mm}`, prefs.timeFormat)
  }

  function toLocalInput(iso: string): string {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [editModal, setEditModal] = useState<TimeEntry | null>(null)
  const [editNote, setEditNote] = useState('')
  const [editIn, setEditIn] = useState('')
  const [editOut, setEditOut] = useState('')
  const [locating, setLocating] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const isManager = can('manage:timeclock')
  const canApproveEdits = can('approve:edits')
  const canSeeLiveView = user?.role === 'Admin' || user?.role === 'General Manager'

  const myEmployee = employees.find(e => e.email === user?.email)
  const visibleEmployees = isManager ? employees.filter(e => e.status === 'Active') : (myEmployee ? [myEmployee] : [])

  const todayEntries = entries.filter(e => e.date === today)
  const activeEntries = entries.filter(e => e.status === 'active' || e.status === 'on_lunch')
  const visibleActiveEntries = canSeeLiveView
    ? activeEntries
    : activeEntries.filter(e => e.employeeId === myEmployee?.id)
  const pendingEdits = entries.filter(e => e.status === 'pending_edit')

  const activeEntriesRef = useRef(activeEntries)
  useEffect(() => { activeEntriesRef.current = activeEntries }, [activeEntries])

  useEffect(() => {
    if (!navigator.geolocation) return
    const poll = () => {
      activeEntriesRef.current.forEach(entry => {
        navigator.geolocation.getCurrentPosition(
          pos => updateLocation(entry.id, { lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {},
          { timeout: 8000 }
        )
      })
    }
    poll()
    const id = setInterval(poll, 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [updateLocation])

  function getEntryForEmployee(empId: string) {
    const active = todayEntries.find(e => e.employeeId === empId && (e.status === 'active' || e.status === 'on_lunch' || e.status === 'pending_edit'))
    if (active) return active
    return todayEntries.filter(e => e.employeeId === empId).slice(-1)[0] ?? null
  }

  async function clockIn(emp: { id: string; name: string }) {
    setLocating(emp.id)
    const location = await getLocation()
    setLocating(null)
    await addEntry({
      employeeId: emp.id,
      employeeName: emp.name,
      clockIn: new Date().toISOString(),
      clockOut: null,
      lunchStart: null,
      lunchEnd: null,
      clockInLocation: location,
      clockOutLocation: null,
      currentLocation: location,
      locationUpdatedAt: location ? new Date().toISOString() : null,
      status: 'active',
      editRequest: null,
      editedClockIn: null,
      editedClockOut: null,
      date: today,
    })
    toast.success(`${emp.name} clocked in`)
  }

  async function clockOut(entry: TimeEntry) {
    setLocating(entry.employeeId)
    const location = await getLocation()
    setLocating(null)
    updateEntry({ ...entry, clockOut: new Date().toISOString(), clockOutLocation: location, status: 'completed' })
    toast.success(`${entry.employeeName} clocked out`)
  }

  async function startLunch(entry: TimeEntry) {
    await updateEntry({ ...entry, lunchStart: new Date().toISOString(), status: 'on_lunch' })
    toast.success(`${entry.employeeName} on lunch`)
  }

  async function endLunch(entry: TimeEntry) {
    await updateEntry({ ...entry, lunchEnd: new Date().toISOString(), status: 'active' })
    toast.success(`${entry.employeeName} back from lunch`)
  }

  function openEditRequest(entry: TimeEntry) {
    setEditModal(entry)
    setEditNote('')
    setEditIn(toLocalInput(entry.clockIn))
    setEditOut(entry.clockOut ? toLocalInput(entry.clockOut) : '')
  }

  async function submitEditRequest() {
    if (!editModal) return
    const editedIn = new Date(editIn).toISOString()
    const editedOut = editOut ? new Date(editOut).toISOString() : null
    await updateEntry({ ...editModal, status: 'pending_edit', editRequest: editNote, editedClockIn: editedIn, editedClockOut: editedOut })
    setEditModal(null)
  }

  async function approveEdit(entry: TimeEntry) {
    await updateEntry({
      ...entry,
      clockIn: entry.editedClockIn ?? entry.clockIn,
      clockOut: entry.editedClockOut ?? entry.clockOut,
      editedClockIn: null,
      editedClockOut: null,
      editRequest: null,
      status: 'approved',
    })
  }

  async function denyEdit(entry: TimeEntry) {
    await updateEntry({ ...entry, status: 'completed', editRequest: null, editedClockIn: null, editedClockOut: null })
  }

  function getPeriodHours(empId: string): number {
    return entries
      .filter(e => e.employeeId === empId && e.date >= payPeriod.start && e.date <= payPeriod.end)
      .reduce((sum, e) => sum + calcHours(e), 0)
  }

  function LunchTimer({ lunchStart }: { lunchStart: string }) {
    const ms = now - new Date(lunchStart).getTime()
    const mins = Math.floor(ms / 60000)
    const secs = Math.floor((ms % 60000) / 1000)
    return <span className="tabular-nums">{mins}m {secs}s</span>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-8 text-white">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-white">Time Clock</h2>
        <p className="hidden md:block text-zinc-400 text-sm mt-1">Track employee hours with GPS location.</p>
      </div>

      {/* Live View — admin only on mobile (employees see their status in the card below) */}
      {canSeeLiveView && (
        <div>
          <h3 className="text-base md:text-lg font-semibold text-white mb-2 md:mb-3">Currently Clocked In</h3>
          {visibleActiveEntries.length === 0 ? (
            <p className="text-zinc-500 text-sm">No one is clocked in right now.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleActiveEntries.map(entry => {
                const locLabel = entry.currentLocation
                  ? `GPS updated ${fmt(entry.locationUpdatedAt)}`
                  : entry.clockInLocation ? 'Clock-in location recorded' : null
                return (
                  <Card key={entry.id} className="bg-zinc-900 border-zinc-800 text-white">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <button onClick={() => navigate(`/employees/${entry.employeeId}`)} className="font-semibold text-white hover:text-stone-300 transition-colors">{entry.employeeName}</button>
                        <span className={`text-xs px-2 py-1 rounded font-medium ${entry.status === 'on_lunch' ? 'bg-yellow-900 text-yellow-300' : 'bg-stone-800 text-stone-200'}`}>
                          {entry.status === 'on_lunch' ? 'On Lunch' : 'Clocked In'}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-sm">In: {fmt(entry.clockIn)}</p>
                      <p className="text-stone-300 text-sm tabular-nums">{fmtHours(calcHours(entry))} elapsed</p>
                      {entry.status === 'on_lunch' && entry.lunchStart && (
                        <p className="text-yellow-400 text-sm">Lunch: <LunchTimer lunchStart={entry.lunchStart} /></p>
                      )}
                      {locLabel && <p className="text-zinc-500 text-xs">{locLabel}</p>}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Employee Timecards */}
      <div>
        <h3 className="text-base md:text-lg font-semibold text-white mb-2 md:mb-3">
          {isManager ? 'Employee Timecards — Today' : 'Your Timecard — Today'}
        </h3>
        {employees.length === 0 ? (
          <p className="text-zinc-500 text-sm">No employees added yet.</p>
        ) : (
          <>
            {/* ── Mobile card layout ── */}
            <div className="md:hidden space-y-3">
              {visibleEmployees.map(emp => {
                const entry = getEntryForEmployee(emp.id)
                const isLocating = locating === emp.id
                const isDone = entry?.status === 'completed' || entry?.status === 'approved'
                const canEdit = entry && entry.status !== 'pending_edit' && entry.status !== 'approved' && entry.date >= payPeriod.start && entry.date <= payPeriod.end
                const isSelf = emp.email === user?.email

                return (
                  <div key={emp.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                    {/* Name + status badge */}
                    <div className="flex items-center justify-between">
                      <button onClick={() => navigate(`/employees/${emp.id}`)} className="font-semibold text-white text-base">
                        {emp.name}
                      </button>
                      {entry?.status === 'active' && <span className="text-xs px-2.5 py-1 rounded-full bg-stone-800 text-stone-200 font-medium">Clocked In</span>}
                      {entry?.status === 'on_lunch' && <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-900 text-yellow-300 font-medium">On Lunch</span>}
                      {entry?.status === 'pending_edit' && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-900 text-amber-300 font-medium">Edit Pending</span>}
                      {(!entry || isDone) && <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-500 font-medium">Off</span>}
                    </div>

                    {/* Time info row */}
                    {entry && (
                      <div className="flex gap-5 text-sm">
                        <div>
                          <p className="text-zinc-500 text-xs mb-0.5">In</p>
                          <p className="text-zinc-300">{fmt(entry.clockIn)}</p>
                        </div>
                        {entry.clockOut && (
                          <div>
                            <p className="text-zinc-500 text-xs mb-0.5">Out</p>
                            <p className="text-zinc-300">{fmt(entry.clockOut)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-zinc-500 text-xs mb-0.5">Hours</p>
                          <p className="text-stone-300 tabular-nums font-semibold">{fmtHours(calcHours(entry))}</p>
                        </div>
                        {entry.status === 'on_lunch' && entry.lunchStart && (
                          <div>
                            <p className="text-zinc-500 text-xs mb-0.5">Lunch</p>
                            <p className="text-yellow-400"><LunchTimer lunchStart={entry.lunchStart} /></p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Primary action buttons — only for own card */}
                    {isSelf && (
                      <div className="flex gap-2">
                        {(!entry || isDone) && (
                          <Button onClick={() => clockIn(emp)} disabled={isLocating}
                            className="flex-1 bg-stone-500 hover:bg-stone-400 text-white h-12 text-sm font-semibold rounded-lg">
                            {isLocating ? 'Getting location…' : 'Clock In'}
                          </Button>
                        )}
                        {entry?.status === 'active' && (
                          <>
                            <Button onClick={() => startLunch(entry)}
                              className="flex-1 bg-yellow-700 hover:bg-yellow-600 text-white h-12 text-sm font-semibold rounded-lg">
                              Lunch
                            </Button>
                            <Button onClick={() => clockOut(entry)} disabled={isLocating}
                              className="flex-1 bg-red-700 hover:bg-red-600 text-white h-12 text-sm font-semibold rounded-lg">
                              {isLocating ? 'Locating…' : 'Clock Out'}
                            </Button>
                          </>
                        )}
                        {entry?.status === 'on_lunch' && (
                          <Button onClick={() => endLunch(entry)}
                            className="flex-1 bg-yellow-700 hover:bg-yellow-600 text-white h-12 text-sm font-semibold rounded-lg">
                            End Lunch
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Secondary actions — only for own card */}
                    {isSelf && (isDone || canEdit || entry?.status === 'pending_edit') && (
                      <div className="flex items-center gap-3 pt-1 border-t border-zinc-800">
                        {isDone && <span className="text-stone-500 text-xs">Done for today</span>}
                        {canEdit && (
                          <button onClick={() => openEditRequest(entry!)}
                            className="text-zinc-500 hover:text-zinc-300 text-xs underline">
                            Request time edit
                          </button>
                        )}
                        {entry?.status === 'pending_edit' && (
                          <span className="text-yellow-400 text-xs">Time correction pending review</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Desktop table layout ── */}
            <Card className="hidden md:block bg-zinc-900 border-zinc-800 text-white">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400">
                      <th className="text-left px-4 py-3 font-medium">Employee</th>
                      <th className="text-left px-4 py-3 font-medium">Clock In</th>
                      <th className="text-left px-4 py-3 font-medium">Lunch</th>
                      <th className="text-left px-4 py-3 font-medium">Clock Out</th>
                      <th className="text-left px-4 py-3 font-medium">Hours</th>
                      <th className="text-left px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmployees.map(emp => {
                      const entry = getEntryForEmployee(emp.id)
                      const isLocating = locating === emp.id
                      const isSelf = emp.email === user?.email
                      return (
                        <tr key={emp.id} className="border-b border-zinc-800 hover:bg-zinc-800 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <button onClick={() => navigate(`/employees/${emp.id}`)} className="text-white hover:text-stone-300 transition-colors">{emp.name}</button>
                          </td>
                          <td className="px-4 py-3 text-zinc-400">{fmt(entry?.clockIn ?? null)}</td>
                          <td className="px-4 py-3 text-zinc-400">
                            {entry?.lunchStart ? `${fmt(entry.lunchStart)} – ${fmt(entry.lunchEnd)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">{fmt(entry?.clockOut ?? null)}</td>
                          <td className="px-4 py-3 text-stone-300 tabular-nums">{entry ? fmtHours(calcHours(entry)) : '—'}</td>
                          <td className="px-4 py-3">
                            {isSelf ? (
                              <div className="flex gap-2 flex-wrap">
                                {(!entry || entry.status === 'completed' || entry.status === 'approved') && (
                                  <Button onClick={() => clockIn(emp)} disabled={isLocating}
                                    className="bg-stone-500 hover:bg-stone-400 text-white text-xs h-7 px-3">
                                    {isLocating ? 'Locating...' : 'Clock In'}
                                  </Button>
                                )}
                                {entry?.status === 'active' && (
                                  <>
                                    <Button onClick={() => startLunch(entry)} className="bg-yellow-700 hover:bg-yellow-600 text-white text-xs h-7 px-3">Lunch</Button>
                                    <Button onClick={() => clockOut(entry)} disabled={isLocating} className="bg-red-700 hover:bg-red-600 text-white text-xs h-7 px-3">
                                      {isLocating ? 'Locating...' : 'Clock Out'}
                                    </Button>
                                  </>
                                )}
                                {entry?.status === 'on_lunch' && (
                                  <Button onClick={() => endLunch(entry)} className="bg-yellow-700 hover:bg-yellow-600 text-white text-xs h-7 px-3">End Lunch</Button>
                                )}
                                {(entry?.status === 'completed' || entry?.status === 'approved') && (
                                  <span className="text-stone-300 text-xs font-medium">Done</span>
                                )}
                                {entry && entry.status !== 'pending_edit' && entry.status !== 'approved' && entry.date >= payPeriod.start && entry.date <= payPeriod.end && (
                                  <button onClick={() => openEditRequest(entry)} className="text-zinc-400 hover:text-white text-xs underline">Request Edit</button>
                                )}
                                {entry?.status === 'pending_edit' && (
                                  <span className="text-yellow-400 text-xs">Edit Pending</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-600 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Pay Period Summary */}
      {visibleEmployees.length > 0 && (
        <div>
          <h3 className="text-base md:text-lg font-semibold text-white mb-2 md:mb-3">
            Pay Period Summary{' '}
            <span className="text-zinc-500 text-sm font-normal">
              ({formatDate(payPeriod.start, prefs.dateFormat)} – {formatDate(payPeriod.end, prefs.dateFormat)})
            </span>
          </h3>

          {/* Mobile list */}
          <div className="md:hidden space-y-2">
            {visibleEmployees.map(emp => {
              const weekHours = getPeriodHours(emp.id)
              const activeNow = activeEntries.find(e => e.employeeId === emp.id)
              return (
                <div key={emp.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                  <div>
                    <button onClick={() => navigate(`/employees/${emp.id}`)} className="text-white text-sm font-medium hover:text-stone-300 transition-colors">
                      {emp.name}
                    </button>
                    {activeNow && (
                      <p className={`text-xs mt-0.5 ${activeNow.status === 'on_lunch' ? 'text-yellow-400' : 'text-stone-400'}`}>
                        {activeNow.status === 'on_lunch' ? 'On Lunch' : 'Clocked In'}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-stone-300 tabular-nums font-semibold">{fmtHours(weekHours)}</p>
                    <p className="text-zinc-500 text-xs">this period</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block bg-zinc-900 border-zinc-800 text-white">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="text-left px-4 py-3 font-medium">Employee</th>
                    <th className="text-left px-4 py-3 font-medium">Role</th>
                    <th className="text-left px-4 py-3 font-medium">Hours This Pay Period</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map(emp => {
                    const weekHours = getPeriodHours(emp.id)
                    const activeNow = activeEntries.find(e => e.employeeId === emp.id)
                    return (
                      <tr key={emp.id} className="border-b border-zinc-800 hover:bg-zinc-800 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <button onClick={() => navigate(`/employees/${emp.id}`)} className="text-white hover:text-stone-300 transition-colors">{emp.name}</button>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{emp.role}</td>
                        <td className="px-4 py-3 text-stone-300 tabular-nums font-semibold">{fmtHours(weekHours)}</td>
                        <td className="px-4 py-3">
                          {activeNow ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${activeNow.status === 'on_lunch' ? 'bg-yellow-900 text-yellow-300' : 'bg-stone-800 text-stone-200'}`}>
                              {activeNow.status === 'on_lunch' ? 'On Lunch' : 'Clocked In'}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-700 text-zinc-400">Off</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Admin — Pending Edit Requests */}
      {canApproveEdits && pendingEdits.length > 0 && (
        <div>
          <h3 className="text-base md:text-lg font-semibold text-white mb-2 md:mb-3">Pending Edit Requests</h3>
          <div className="space-y-3">
            {pendingEdits.map(entry => (
              <Card key={entry.id} className="bg-zinc-900 border-yellow-800 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base">{entry.employeeName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-400 text-xs">Original Clock In</p>
                      <p className="text-white">{fmt(entry.clockIn)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-xs">Requested Clock In</p>
                      <p className="text-stone-300">{fmt(entry.editedClockIn)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-xs">Original Clock Out</p>
                      <p className="text-white">{fmt(entry.clockOut)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-400 text-xs">Requested Clock Out</p>
                      <p className="text-stone-300">{fmt(entry.editedClockOut)}</p>
                    </div>
                  </div>
                  {entry.editRequest && (
                    <p className="text-zinc-300 text-sm italic">"{entry.editRequest}"</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => approveEdit(entry)} className="bg-stone-500 hover:bg-stone-400 text-white text-xs h-8 px-4">Approve</Button>
                    <Button onClick={() => denyEdit(entry)} className="bg-red-700 hover:bg-red-600 text-white text-xs h-8 px-4">Deny</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Edit Request Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-lg p-6 w-full sm:max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-white font-semibold text-lg">Request Time Edit</h3>
            <div className="space-y-2">
              <label className="text-zinc-300 text-sm">Clock In</label>
              <input type="datetime-local" value={editIn} onChange={e => setEditIn(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2.5 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-zinc-300 text-sm">Clock Out</label>
              <input type="datetime-local" value={editOut} onChange={e => setEditOut(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2.5 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-zinc-300 text-sm">Reason</label>
              <textarea value={editNote} onChange={e => setEditNote(e.target.value)}
                placeholder="Explain why you need this edit..."
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2.5 text-sm resize-none h-20 placeholder:text-zinc-500" />
            </div>
            <div className="flex gap-2 justify-end pb-2">
              <Button variant="ghost" onClick={() => setEditModal(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
              <Button onClick={submitEditRequest} className="bg-stone-500 hover:bg-stone-400 text-white">Submit Request</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
