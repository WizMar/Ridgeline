import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  // Active entries (clocked in right now)
  const activeEntries = entries.filter(e => e.status === 'active' || e.status === 'on_lunch')

  // Pay period hours per employee
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

  // Job status distribution from real data
  const jobStatusData = JOB_STATUSES.map(s => ({
    name: s,
    value: jobs.filter(j => j.status === s).length,
  }))

  const hasJobData = jobStatusData.some(d => d.value > 0)
  const activeJobs = jobs.filter(j => j.status === 'In Progress' || j.status === 'Scheduled').length
  const pendingEstimates = estimates.filter(e => e.status === 'Draft' || e.status === 'Submitted').length
  const recentJobs = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

  return (
    <div className="max-w-7xl mx-auto space-y-8 text-white">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-stone-400 text-sm mt-1">Here's what's going on with your business.</p>
      </div>

      {/* Summary Cards */}
      {vis.summaryCards && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-stone-900 border-stone-800 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-stone-400">Active Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-400">{activeJobs}</p>
            </CardContent>
          </Card>
          <Card className="bg-stone-900 border-stone-800 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-stone-400">Pending Estimates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-400">{pendingEstimates}</p>
            </CardContent>
          </Card>
          <Card className="bg-stone-900 border-stone-800 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-stone-400">Clocked In Now</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-400">{activeEntries.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-stone-900 border-stone-800 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-stone-400">Revenue This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-400">$0</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      {(vis.jobsChart || vis.hoursChart) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {vis.jobsChart && (
            <Card className="bg-stone-900 border-stone-800 text-white">
              <CardHeader>
                <CardTitle className="text-white text-base">Jobs by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {!hasJobData ? (
                  <div className="h-48 flex items-center justify-center text-stone-500 text-sm">No jobs yet.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={jobStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {jobStatusData.map(entry => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name as JobStatus]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #44403c', color: '#fff', borderRadius: '8px' }} labelStyle={{ color: '#a8a29e' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {jobStatusData.map(s => (
                    <div key={s.name} className="flex items-center gap-1 text-xs text-stone-400">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.name as JobStatus] }} />
                      {s.name} ({s.value})
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {vis.hoursChart && (
            <Card className="bg-stone-900 border-stone-800 text-white">
              <CardHeader>
                <CardTitle className="text-white text-base">
                  Hours This Pay Period
                  <span className="text-stone-500 text-xs font-normal ml-2">({payPeriod.start} – {payPeriod.end})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {periodHours.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-stone-500 text-sm">No hours logged this pay period.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={periodHours} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} style={{ background: 'transparent' }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#44403c" />
                      <XAxis dataKey="name" tick={{ fill: '#a8a29e', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#a8a29e', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1c1917', border: '1px solid #44403c', color: '#fff', borderRadius: '8px' }}
                        labelStyle={{ color: '#a8a29e' }}
                        formatter={(v) => [fmtHours(Number(v)), 'Hours']}
                      />
                      <Bar dataKey="hours" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} cursor="default" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Quick Actions */}
      {vis.quickActions && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/estimates')} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              + New Estimate
            </Button>
            <Button onClick={() => navigate('/jobs')} className="bg-stone-700 hover:bg-stone-600 text-white">
              + New Job
            </Button>
            <Button onClick={() => navigate('/employees')} className="bg-stone-700 hover:bg-stone-600 text-white">
              + Add Employee
            </Button>
          </div>
        </div>
      )}

      {/* Recent Jobs */}
      {vis.recentJobs && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Recent Jobs</h3>
          {recentJobs.length === 0 ? (
            <Card className="bg-stone-900 border-stone-800">
              <CardContent className="py-12 text-center text-stone-500">
                No jobs yet. Create your first job to get started.
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-stone-900 border-stone-800">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-800">
                      <th className="text-left text-stone-400 font-medium px-4 py-3">Job</th>
                      <th className="text-left text-stone-400 font-medium px-4 py-3">Client</th>
                      <th className="text-left text-stone-400 font-medium px-4 py-3 hidden sm:table-cell">Type</th>
                      <th className="text-left text-stone-400 font-medium px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((job, i) => (
                      <tr
                        key={job.id}
                        onClick={() => navigate('/jobs')}
                        className={`cursor-pointer hover:bg-stone-800/50 transition-colors ${i < recentJobs.length - 1 ? 'border-b border-stone-800/50' : ''}`}
                      >
                        <td className="px-4 py-3 text-white font-medium">{job.title}</td>
                        <td className="px-4 py-3 text-stone-300">{job.client.name}</td>
                        <td className="px-4 py-3 text-stone-400 hidden sm:table-cell">{job.type}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[job.status]}`}>
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
