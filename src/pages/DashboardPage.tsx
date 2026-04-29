import { useNavigate } from 'react-router-dom'
import { Briefcase, FileText, Clock, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useEmployees } from '@/context/EmployeeContext'
import { useTimeClock } from '@/context/TimeClockContext'
import { useSettings, getPayPeriodRange, DEFAULT_DASHBOARD_VISIBILITY } from '@/context/SettingsContext'
import { useJobs } from '@/context/JobsContext'
import { useEstimates } from '@/context/EstimatesContext'
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

  const vis = {
    ...DEFAULT_DASHBOARD_VISIBILITY,
    ...(user?.role ? (settings.dashboardVisibility[user.role] ?? {}) : {}),
  }

  const activeEntries = entries.filter(e => e.status === 'active' || e.status === 'on_lunch')

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
  const activeJobs = jobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled').length
  const pendingEstimates = estimates.filter(e => e.status === 'Draft' || e.status === 'Submitted').length
  const recentJobs = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

  const firstName = user?.name?.split(' ')[0] ?? ''

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-white">

      {/* Greeting */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-white">
          {greeting()}{firstName ? `, ${firstName}` : ''}
        </h2>
        <p className="text-zinc-500 text-sm mt-0.5">Here's what's happening with your business today.</p>
      </div>

      {/* Stat Cards */}
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

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 opacity-50 cursor-not-allowed">
            <div className="flex items-start justify-between mb-3">
              <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Revenue</p>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <TrendingUp size={13} className="text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-zinc-700 tabular-nums leading-none">—</p>
            <p className="text-zinc-700 text-xs mt-2">Coming soon</p>
          </div>

        </div>
      )}

      {/* Charts */}
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

      {/* Quick Actions */}
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
            <Button disabled className="bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed">
              + New Estimate <span className="ml-1.5 text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-medium">Soon</span>
            </Button>
          </div>
        </div>
      )}

      {/* Recent Jobs */}
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
