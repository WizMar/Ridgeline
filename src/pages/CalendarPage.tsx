import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { useJobs } from '@/context/JobsContext'
import { useAuth } from '@/context/AuthContext'
import { useEmployees } from '@/context/EmployeeContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { JobType } from '@/types/job'

type View = 'month' | 'week'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const STATUS_CHIP: Record<string, string> = {
  Scheduled: 'bg-blue-900/80 text-blue-200 border-blue-800',
  Active:     'bg-emerald-900/80 text-emerald-200 border-emerald-800',
  Draft:      'bg-zinc-800 text-zinc-400 border-zinc-700',
  Completed:  'bg-stone-800 text-stone-300 border-stone-700',
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isToday(d: Date): boolean {
  const t = new Date()
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const { jobs, addJob } = useJobs()
  const { can, user } = useAuth()
  const { employees } = useEmployees()
  const canCreate = can('create:jobs')

  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d
  })
  const [quickDate, setQuickDate] = useState<string | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const calJobs = useMemo(() =>
    jobs.filter(j => j.scheduledDate && ['Scheduled', 'Active', 'Draft', 'Completed'].includes(j.status)),
    [jobs]
  )

  function jobsOn(dateStr: string) {
    return calJobs.filter(j => j.scheduledDate === dateStr)
  }

  // ── Month grid ──
  const monthCells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstDow = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const total = Math.ceil((firstDow + daysInMonth) / 7) * 7
    return Array.from({ length: total }, (_, i) => {
      const dayNum = i - firstDow + 1
      if (dayNum < 1 || dayNum > daysInMonth) return null
      return new Date(year, month, dayNum)
    })
  }, [cursor])

  // ── Week days ──
  const weekDays = useMemo(() => {
    const ref = view === 'week' ? cursor : new Date()
    const dow = ref.getDay()
    const start = new Date(ref)
    start.setDate(ref.getDate() - dow)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor, view])

  function prevPeriod() {
    setCursor(prev => {
      const d = new Date(prev)
      if (view === 'month') d.setMonth(d.getMonth() - 1)
      else d.setDate(d.getDate() - 7)
      return d
    })
  }

  function nextPeriod() {
    setCursor(prev => {
      const d = new Date(prev)
      if (view === 'month') d.setMonth(d.getMonth() + 1)
      else d.setDate(d.getDate() + 7)
      return d
    })
  }

  function goToday() {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0)
    setCursor(view === 'month' ? d : new Date())
  }

  function openQuick(dateStr: string) {
    if (!canCreate) return
    setQuickDate(dateStr)
    setQuickTitle('')
  }

  async function handleQuickSave() {
    if (!quickTitle.trim() || !quickDate) return
    setSaving(true)
    const myEmployee = employees.find(e => e.id === user?.id)
    const ok = await addJob({
      title: quickTitle.trim(),
      status: 'Scheduled',
      type: 'General' as JobType,
      client: { name: '', phone: '', email: '' },
      address: '',
      scheduledDate: quickDate,
      notes: '',
      scope: '',
      leadId: myEmployee?.id ?? null,
      crewIds: [],
      clientId: null,
      propertyId: null,
      amount: null,
      approvalRequired: false,
      approvalStatus: 'none',
      approvalToken: null,
      approvalRequestedAt: null,
      approvedAt: null,
      approverName: null,
    })
    setSaving(false)
    if (ok) {
      toast.success('Job created')
      setQuickDate(null)
    } else {
      toast.error('Failed to create job')
    }
  }

  const headerLabel = view === 'month'
    ? cursor.toLocaleString('default', { month: 'long', year: 'numeric' })
    : `Week of ${weekDays[0].toLocaleString('default', { month: 'short', day: 'numeric' })}`

  return (
    <div className="max-w-5xl mx-auto space-y-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-bold text-white w-52 text-center">{headerLabel}</h2>
          <button onClick={nextPeriod} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <ChevronRight size={18} />
          </button>
          <button onClick={goToday} className="text-xs text-zinc-500 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 px-2.5 py-1 rounded-lg transition-colors ml-1">
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            {(['month', 'week'] as View[]).map(v => (
              <button
                key={v}
                onClick={() => { setView(v); goToday() }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                  view === v ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {[['Scheduled', 'bg-blue-500'], ['Active', 'bg-emerald-500']].map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-zinc-500 text-xs">{label}</span>
          </div>
        ))}
      </div>

      {/* Month view */}
      {view === 'month' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-zinc-800">
            {DOW.map((d, i) => (
              <div key={d} className="py-2 text-center">
                <span className="hidden sm:inline text-zinc-500 text-xs font-semibold">{d}</span>
                <span className="sm:hidden text-zinc-500 text-xs font-semibold">{DOW_SHORT[i]}</span>
              </div>
            ))}
          </div>
          {/* Cells */}
          <div className="grid grid-cols-7">
            {monthCells.map((day, i) => {
              if (!day) return (
                <div key={`empty-${i}`} className="min-h-[80px] sm:min-h-[100px] border-b border-r border-zinc-800/50 bg-zinc-950/30" />
              )
              const dateStr = toDateStr(day)
              const dayJobs = jobsOn(dateStr)
              const today = isToday(day)
              return (
                <div
                  key={dateStr}
                  onClick={() => openQuick(dateStr)}
                  className={`min-h-[80px] sm:min-h-[100px] border-b border-r border-zinc-800/50 p-1 sm:p-1.5 cursor-pointer hover:bg-zinc-800/30 transition-colors ${
                    today ? 'bg-stone-900/20' : ''
                  }`}
                >
                  <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    today ? 'bg-stone-500 text-white' : 'text-zinc-400'
                  }`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayJobs.slice(0, 3).map(job => (
                      <div
                        key={job.id}
                        onClick={e => { e.stopPropagation(); navigate(`/jobs/${job.id}`) }}
                        className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded border truncate cursor-pointer hover:brightness-125 transition-all ${
                          STATUS_CHIP[job.status] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        <span className="hidden sm:inline">{job.title || job.client.name || 'Untitled'}</span>
                        <span className="sm:hidden">●</span>
                      </div>
                    ))}
                    {dayJobs.length > 3 && (
                      <p className="text-[10px] text-zinc-600 pl-1">+{dayJobs.length - 3} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Week view */}
      {view === 'week' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-zinc-800">
            {weekDays.map(day => {
              const dateStr = toDateStr(day)
              const dayJobs = jobsOn(dateStr)
              const today = isToday(day)
              return (
                <div key={dateStr} className="flex flex-col min-h-[240px]">
                  {/* Day header */}
                  <div
                    onClick={() => openQuick(dateStr)}
                    className={`py-2 px-1 text-center border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/40 transition-colors ${
                      today ? 'bg-stone-900/30' : ''
                    }`}
                  >
                    <p className="text-zinc-500 text-[10px] font-semibold uppercase">{DOW_SHORT[day.getDay()]}</p>
                    <div className={`mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold ${
                      today ? 'bg-stone-500 text-white' : 'text-zinc-300'
                    }`}>
                      {day.getDate()}
                    </div>
                  </div>
                  {/* Jobs */}
                  <div
                    onClick={() => openQuick(dateStr)}
                    className="flex-1 p-1.5 space-y-1 cursor-pointer hover:bg-zinc-800/20 transition-colors"
                  >
                    {dayJobs.map(job => (
                      <div
                        key={job.id}
                        onClick={e => { e.stopPropagation(); navigate(`/jobs/${job.id}`) }}
                        className={`text-xs px-2 py-1.5 rounded border cursor-pointer hover:brightness-125 transition-all ${
                          STATUS_CHIP[job.status] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        <p className="font-medium truncate">{job.title || 'Untitled'}</p>
                        {job.client.name && (
                          <p className="text-[10px] opacity-70 truncate">{job.client.name}</p>
                        )}
                      </div>
                    ))}
                    {canCreate && dayJobs.length === 0 && (
                      <div className="flex items-center justify-center h-8 opacity-0 hover:opacity-100 transition-opacity">
                        <Plus size={14} className="text-zinc-600" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick-add dialog */}
      <Dialog open={!!quickDate} onOpenChange={() => setQuickDate(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center justify-between">
              New Job
              <button onClick={() => setQuickDate(null)} className="text-zinc-500 hover:text-white">
                <X size={16} />
              </button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Job Title *</Label>
              <Input
                autoFocus
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuickSave()}
                placeholder="e.g. Smith Roof Replacement"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Scheduled Date</Label>
              <Input
                type="date"
                value={quickDate ?? ''}
                onChange={e => setQuickDate(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <p className="text-zinc-600 text-xs">You can fill in client info, crew, and more after creating.</p>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400" onClick={() => setQuickDate(null)}>Cancel</Button>
            <Button
              className="bg-stone-500 hover:bg-stone-400 text-white"
              disabled={!quickTitle.trim() || saving}
              onClick={handleQuickSave}
            >
              {saving ? 'Creating…' : 'Create Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
