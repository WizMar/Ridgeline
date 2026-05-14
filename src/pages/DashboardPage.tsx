import { useNavigate } from 'react-router-dom'
import { Briefcase, FileText, Clock, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useEmployees } from '@/context/EmployeeContext'
import { useTimeClock } from '@/context/TimeClockContext'
import { useSettings, getPayPeriodRange, DEFAULT_DASHBOARD_VISIBILITY } from '@/context/SettingsContext'
import { useJobs } from '@/context/JobsContext'
import { useEstimates } from '@/context/EstimatesContext'
import { calcEstimateTotal } from '@/types/estimate'
import { useAuth } from '@/context/AuthContext'
import { calcHours, fmtHours } from '@/types/timeclock'
import { STATUS_COLORS, STATUS_BADGE, JOB_STATUSES } from '@/types/job'
import type { JobStatus } from '@/types/job'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { employees } = useEmployees()
  const { entries } = useTimeClock()
  const { settings } = useSettings()
  const { jobs } = useJobs()
  const { estimates } = useEstimates()
  const payPeriod = getPayPeriodRange(settings)

  const role = user?.role
  const firstName = user?.name?.split(' ')[0] ?? ''

  const myEmployee = employees.find(e => e.email === user?.email)

  // My personal time data
  const myActiveEntry = entries.find(e =>
    e.employeeId === myEmployee?.id && (e.status === 'active' || e.status === 'on_lunch')
  )
  const myPeriodEntries = entries.filter(e =>
    e.employeeId === myEmployee?.id && e.date >= payPeriod.start && e.date <= payPeriod.end
  )
  const myPeriodHours = myPeriodEntries.reduce((sum, e) => sum + calcHours(e), 0)

  // My jobs
  const myJobs = jobs.filter(j =>
    j.leadId === myEmployee?.id || j.crewIds.includes(myEmployee?.id ?? '')
  )
  const myActiveJobs = myJobs.filter(j => j.status === 'Active' || j.status === 'Scheduled')

  // Org-wide data
  const activeEntries = entries.filter(e => e.status === 'active' || e.status === 'on_lunch')
  const activeJobs = jobs.filter(j => j.status === 'Active' || j.status === 'Scheduled').length
  const pendingEstimates = estimates.filter(e => e.status === 'Draft' || e.status === 'Submitted').length
  const recentJobs = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

  const periodHours = employees
    .filter(e => e.status === 'Active')
    .map(emp => ({
      name: emp.name.split(' ')[0],
      hours: parseFloat(entries
        .filter(e => e.employeeId === emp.id && e.date >= payPeriod.start && e.date <= payPeriod.end)
        .reduce((sum, e) => sum + calcHours(e), 0)
        .toFixed(1)),
    }))
    .filter(e => e.hours > 0)

  const jobStatusData = JOB_STATUSES.map(s => ({
    name: s,
    value: jobs.filter(j => j.status === s).length,
  }))
  const hasJobData = jobStatusData.some(d => d.value > 0)

  const thisMonthCollected = (() => {
    const now = new Date()
    const estimateByJobId = new Map<string, number>()
    for (const est of estimates) {
      if (est.convertedJobId) estimateByJobId.set(est.convertedJobId, calcEstimateTotal(est).total)
    }
    return jobs
      .filter(j => {
        if (j.status !== 'Paid' || !j.updatedAt) return false
        const d = new Date(j.updatedAt)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      })
      .reduce((sum, j) => sum + (j.amount ?? estimateByJobId.get(j.id) ?? 0), 0)
  })()

  function fmtMoney(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
    return `$${Math.round(n).toLocaleString('en-US')}`
  }

  const vis = {
    ...DEFAULT_DASHBOARD_VISIBILITY,
    ...(user?.role ? (settings.dashboardVisibility[user.role] ?? {}) : {}),
  }

  const isPM = role === 'Project Manager'
  const isSales = role === 'Sales'
  const isLead = role === 'Lead'
  const isWorker = role === 'Employee' || role === 'Subcontractor'

  // Clock status badge helper
  function ClockStatusCard() {
    const clocked = !!myActiveEntry
    const onLunch = myActiveEntry?.status === 'on_lunch'
    const hoursToday = myActiveEntry ? calcHours(myActiveEntry) : 0

    return (
      <div className={`rounded-xl border p-4 ${clocked ? 'bg-teal-950/40 border-teal-800/50' : 'bg-zinc-900 border-zinc-800'}`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">My Status</p>
          <div className={`w-2 h-2 rounded-full ${clocked && !onLunch ? 'bg-teal-400 animate-pulse' : onLunch ? 'bg-amber-400' : 'bg-zinc-600'}`} />
        </div>
        <p className="text-xl font-bold text-white">
          {onLunch ? 'On Lunch' : clocked ? 'Clocked In' : 'Not Clocked In'}
        </p>
        {clocked && (
          <p className="text-zinc-400 text-xs mt-1">{fmtHours(hoursToday)} today</p>
        )}
        <button
          onClick={() => navigate('/timeclock')}
          className="mt-3 text-xs text-teal-400 hover:text-teal-300 transition-colors"
        >
          Go to Time Clock →
        </button>
      </div>
    )
  }

  function MyHoursCard() {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">My Hours</p>
        <p className="text-2xl font-bold text-white tabular-nums">{fmtHours(myPeriodHours)}</p>
        <p className="text-zinc-600 text-xs mt-1">This pay period</p>
      </div>
    )
  }

  // ─── Employee / Subcontractor ───────────────────────────────────────────────
  if (isWorker) {
    return (
      <div className="max-w-2xl mx-auto space-y-5 text-white">
        <div>
          <h2 className="text-xl font-bold text-white">{greeting()}{firstName ? `, ${firstName}` : ''}</h2>
          <p className="text-zinc-500 text-sm mt-0.5">Here's your day at a glance.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ClockStatusCard />
          <MyHoursCard />
        </div>

        {myActiveJobs.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">My Active Jobs</p>
            <div className="space-y-2">
              {myActiveJobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{job.title}</p>
                    <p className="text-zinc-500 text-xs">{job.client.name}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[job.status]}`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {myActiveJobs.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-10 flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="w-8 h-8 text-zinc-700" strokeWidth={1.5} />
            <p className="text-zinc-500 text-sm">No active jobs assigned to you.</p>
          </div>
        )}
      </div>
    )
  }

  // ─── Lead ───────────────────────────────────────────────────────────────────
  if (isLead) {
    const leadingJobs = jobs.filter(j => j.leadId === myEmployee?.id)
    const activeLeadingJobs = leadingJobs.filter(j => j.status === 'Active' || j.status === 'Scheduled')

    return (
      <div className="max-w-2xl mx-auto space-y-5 text-white">
        <div>
          <h2 className="text-xl font-bold text-white">{greeting()}{firstName ? `, ${firstName}` : ''}</h2>
          <p className="text-zinc-500 text-sm mt-0.5">Your jobs and crew overview.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ClockStatusCard />
          <MyHoursCard />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">Leading</p>
            <p className="text-2xl font-bold text-white">{activeLeadingJobs.length}</p>
            <p className="text-zinc-600 text-xs mt-1">Active jobs</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">Crew In</p>
            <p className="text-2xl font-bold text-white">{activeEntries.length}</p>
            <p className="text-zinc-600 text-xs mt-1">Clocked in now</p>
          </div>
        </div>

        {activeLeadingJobs.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Jobs You're Leading</p>
            <div className="space-y-2">
              {activeLeadingJobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{job.title}</p>
                    <p className="text-zinc-500 text-xs">{job.client.name} · {job.crewIds.length} crew</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[job.status]}`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Sales ──────────────────────────────────────────────────────────────────
  if (isSales) {
    const draftEst = estimates.filter(e => e.status === 'Draft').length
    const submittedEst = estimates.filter(e => e.status === 'Submitted').length
    const approvedEst = estimates.filter(e => e.status === 'Approved').length
    return (
      <div className="max-w-3xl mx-auto space-y-5 text-white">
        <div>
          <h2 className="text-xl font-bold text-white">{greeting()}{firstName ? `, ${firstName}` : ''}</h2>
          <p className="text-zinc-500 text-sm mt-0.5">Your sales pipeline at a glance.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => navigate('/estimates')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:bg-zinc-800/50 transition-colors">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">Draft</p>
            <p className="text-2xl font-bold text-white">{draftEst}</p>
            <p className="text-zinc-600 text-xs mt-1">Estimates</p>
          </button>
          <button onClick={() => navigate('/estimates')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Sent</p>
              <AlertCircle size={12} className="text-amber-400 mt-0.5" />
            </div>
            <p className="text-2xl font-bold text-white">{submittedEst}</p>
            <p className="text-zinc-600 text-xs mt-1">Awaiting</p>
          </button>
          <button onClick={() => navigate('/estimates')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Won</p>
              <CheckCircle2 size={12} className="text-emerald-400 mt-0.5" />
            </div>
            <p className="text-2xl font-bold text-white">{approvedEst}</p>
            <p className="text-zinc-600 text-xs mt-1">Approved</p>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ClockStatusCard />
          <MyHoursCard />
        </div>

        {hasJobData && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-white text-sm font-semibold mb-4">Jobs by Status</p>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={jobStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {jobStatusData.map(entry => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name as JobStatus]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '10px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
              {jobStatusData.filter(s => s.value > 0).map(s => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s.name as JobStatus] }} />
                  {s.name} <span className="text-zinc-600">({s.value})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Project Manager ────────────────────────────────────────────────────────
  if (isPM) {
    return (
      <div className="max-w-3xl mx-auto space-y-5 text-white">
        <div>
          <h2 className="text-xl font-bold text-white">{greeting()}{firstName ? `, ${firstName}` : ''}</h2>
          <p className="text-zinc-500 text-sm mt-0.5">Operations overview.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ClockStatusCard />
          <MyHoursCard />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => navigate('/jobs')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:bg-zinc-800/50 transition-colors">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">Active Jobs</p>
            <p className="text-2xl font-bold text-white">{activeJobs}</p>
            <p className="text-zinc-600 text-xs mt-1">In Progress & Scheduled</p>
          </button>
          <button onClick={() => navigate('/timeclock')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:bg-zinc-800/50 transition-colors">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">Clocked In</p>
            <p className="text-2xl font-bold text-white">{activeEntries.length}</p>
            <p className="text-zinc-600 text-xs mt-1">Working now</p>
          </button>
          <button onClick={() => navigate('/estimates')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:bg-zinc-800/50 transition-colors">
            <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">Estimates</p>
            <p className="text-2xl font-bold text-white">{pendingEstimates}</p>
            <p className="text-zinc-600 text-xs mt-1">Draft & Submitted</p>
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-baseline gap-2 mb-4">
            <p className="text-white text-sm font-semibold">Team Hours</p>
            <span className="text-zinc-600 text-xs">{payPeriod.start} – {payPeriod.end}</span>
          </div>
          {periodHours.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-zinc-600 text-sm">No hours logged this pay period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={periodHours} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '10px', fontSize: '12px' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  formatter={(v) => [fmtHours(Number(v)), 'Hours']}
                />
                <Bar dataKey="hours" fill="#a8a29e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {recentJobs.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Recent Jobs</p>
            <div className="space-y-2">
              {recentJobs.slice(0, 4).map(job => (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{job.title}</p>
                    <p className="text-zinc-500 text-xs">{job.client.name}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[job.status]}`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Admin / General Manager ──────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto space-y-6 text-white">

      <div>
        <h2 className="text-xl md:text-2xl font-bold text-white">
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </h2>
        <p className="text-zinc-500 text-sm mt-0.5">Here's what's happening with your business today.</p>
      </div>

      {vis.summaryCards && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button onClick={() => navigate('/jobs')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 hover:bg-zinc-800/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all duration-200 text-left w-full">
            <div className="flex items-start justify-between mb-3">
              <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Active Jobs</p>
              <div className="w-7 h-7 rounded-lg bg-stone-500/10 flex items-center justify-center shrink-0">
                <Briefcase size={13} className="text-stone-400" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white tabular-nums leading-none">{activeJobs}</p>
            <p className="text-zinc-600 text-xs mt-2">In Progress & Scheduled</p>
          </button>

          <button onClick={() => navigate('/estimates')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 hover:bg-zinc-800/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all duration-200 text-left w-full">
            <div className="flex items-start justify-between mb-3">
              <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Estimates</p>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <FileText size={13} className="text-amber-400" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white tabular-nums leading-none">{pendingEstimates}</p>
            <p className="text-zinc-600 text-xs mt-2">Draft & Submitted</p>
          </button>

          <button onClick={() => navigate('/timeclock')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 hover:bg-zinc-800/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all duration-200 text-left w-full">
            <div className="flex items-start justify-between mb-3">
              <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Clocked In</p>
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                <Clock size={13} className="text-teal-400" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white tabular-nums leading-none">{activeEntries.length}</p>
            <p className="text-zinc-600 text-xs mt-2">Working right now</p>
          </button>

          <button onClick={() => navigate('/revenue')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 hover:bg-zinc-800/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all duration-200 text-left w-full">
            <div className="flex items-start justify-between mb-3">
              <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Collected</p>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <TrendingUp size={13} className="text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white tabular-nums leading-none">{fmtMoney(thisMonthCollected)}</p>
            <p className="text-zinc-600 text-xs mt-2">This month</p>
          </button>
        </div>
      )}

      {(vis.jobsChart || vis.hoursChart) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {vis.jobsChart && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 md:p-5">
              <p className="text-white text-sm font-semibold mb-4">Jobs by Status</p>
              {!hasJobData ? (
                <div className="h-40 flex items-center justify-center text-zinc-600 text-sm">No jobs yet.</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={jobStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                        {jobStatusData.map(entry => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name as JobStatus]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '10px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                    {jobStatusData.filter(s => s.value > 0).map(s => (
                      <div key={s.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s.name as JobStatus] }} />
                        {s.name} <span className="text-zinc-600">({s.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {vis.hoursChart && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 md:p-5">
              <div className="flex items-baseline gap-2 mb-4">
                <p className="text-white text-sm font-semibold">Hours This Pay Period</p>
                <span className="text-zinc-600 text-xs">{payPeriod.start} – {payPeriod.end}</span>
              </div>
              {periodHours.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-zinc-600 text-sm">No hours logged this pay period.</div>
              ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={periodHours} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '10px', fontSize: '12px' }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      formatter={(v) => [fmtHours(Number(v)), 'Hours']}
                    />
                    <Bar dataKey="hours" fill="#a8a29e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      )}

      {vis.quickActions && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Quick Actions</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/jobs')} className="bg-stone-500 hover:bg-stone-400 text-white shadow-sm">
              + New Job
            </Button>
            <Button onClick={() => navigate('/employees')} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 shadow-sm">
              + Add Employee
            </Button>
          </div>
        </div>
      )}

      {vis.recentJobs && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Recent Jobs</p>
          {recentJobs.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-12 flex flex-col items-center gap-3 text-center">
              <Briefcase className="w-9 h-9 text-zinc-700" strokeWidth={1.5} />
              <p className="text-zinc-500 text-sm">No jobs yet.</p>
              <Button onClick={() => navigate('/jobs')} className="bg-stone-500 hover:bg-stone-400 text-white mt-1">
                + Create First Job
              </Button>
            </div>
          ) : (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/80">
                      <th className="text-left text-zinc-600 text-xs font-semibold uppercase tracking-wider px-4 py-3">Job</th>
                      <th className="text-left text-zinc-600 text-xs font-semibold uppercase tracking-wider px-4 py-3">Client</th>
                      <th className="text-left text-zinc-600 text-xs font-semibold uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Type</th>
                      <th className="text-left text-zinc-600 text-xs font-semibold uppercase tracking-wider px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((job, i) => (
                      <tr
                        key={job.id}
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className={`cursor-pointer hover:bg-zinc-800/40 transition-colors ${i < recentJobs.length - 1 ? 'border-b border-zinc-800/50' : ''}`}
                      >
                        <td className="px-4 py-3 text-white font-medium">{job.title}</td>
                        <td className="px-4 py-3 text-zinc-400">{job.client.name}</td>
                        <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">{job.type}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[job.status]}`}>
                            {job.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
