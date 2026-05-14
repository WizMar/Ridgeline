import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useJobs } from '@/context/JobsContext'
import { useEstimates } from '@/context/EstimatesContext'
import { useFinancials } from '@/context/FinancialsContext'
import { calcEstimateTotal } from '@/types/estimate'
import { STATUS_BADGE } from '@/types/job'
import type { JobStatus } from '@/types/job'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type Period = 'month' | 'quarter' | 'ytd' | 'all'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'Last 3 Mo' },
  { key: 'ytd', label: 'YTD' },
  { key: 'all', label: 'All Time' },
]

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function inPeriod(dateStr: string | null | undefined, period: Period): boolean {
  if (period === 'all') return true
  if (!dateStr) return false
  const date = new Date(dateStr)
  const now = new Date()
  if (period === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }
  if (period === 'quarter') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    return date >= start
  }
  return date.getFullYear() === now.getFullYear()
}

function KpiTile({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">{label}</p>
      <p className={`text-2xl font-bold tabular-nums leading-none ${value > 0 ? color : 'text-zinc-600'}`}>
        {fmtMoney(value)}
      </p>
      <p className="text-zinc-600 text-xs mt-2">{sub}</p>
    </div>
  )
}

export default function RevenuePage() {
  const navigate = useNavigate()
  const { jobs } = useJobs()
  const { estimates } = useEstimates()
  const { invoices, payments } = useFinancials()
  const [period, setPeriod] = useState<Period>('month')

  const estimateByJobId = useMemo(() => {
    const map = new Map<string, number>()
    for (const est of estimates) {
      if (est.convertedJobId) {
        map.set(est.convertedJobId, calcEstimateTotal(est).total)
      }
    }
    return map
  }, [estimates])

  const jobValue = (j: { id: string; amount: number | null }, map: Map<string, number>) =>
    j.amount ?? map.get(j.id) ?? 0

  const pipeline = useMemo(
    () => estimates
      .filter(e => e.status === 'Submitted' && inPeriod(e.createdAt, period))
      .reduce((sum, e) => sum + calcEstimateTotal(e).total, 0),
    [estimates, period]
  )

  const contracted = useMemo(
    () => estimates
      .filter(e => e.status === 'Approved' && inPeriod(e.updatedAt, period))
      .reduce((sum, e) => sum + calcEstimateTotal(e).total, 0),
    [estimates, period]
  )

  // Use actual invoice amounts; fall back to job-status approach if no invoices recorded
  const invoiced = useMemo(() => {
    const fromInvoices = invoices
      .filter(inv => inPeriod(inv.issuedDate || inv.createdAt, period))
      .reduce((sum, inv) => sum + inv.amount, 0)
    if (fromInvoices > 0) return fromInvoices
    return jobs
      .filter(j => j.status === 'Invoiced' && inPeriod(j.updatedAt, period))
      .reduce((sum, j) => sum + jobValue(j, estimateByJobId), 0)
  }, [invoices, jobs, estimateByJobId, period])

  // Use actual payment amounts; fall back to job-status approach if no payments recorded
  const collected = useMemo(() => {
    const fromPayments = payments
      .filter(p => inPeriod(p.paymentDate, period))
      .reduce((sum, p) => sum + p.amount, 0)
    if (fromPayments > 0) return fromPayments
    return jobs
      .filter(j => j.status === 'Paid' && inPeriod(j.updatedAt, period))
      .reduce((sum, j) => sum + jobValue(j, estimateByJobId), 0)
  }, [payments, jobs, estimateByJobId, period])

  // Chart: payment amounts by month (fall back to paid job values if no payments)
  const monthlyData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const fromPayments = payments
        .filter(p => p.paymentDate.startsWith(monthStr))
        .reduce((sum, p) => sum + p.amount, 0)
      const revenue = fromPayments > 0
        ? fromPayments
        : jobs
          .filter(j => j.status === 'Paid' && j.updatedAt.startsWith(monthStr))
          .reduce((sum, j) => sum + jobValue(j, estimateByJobId), 0)
      return { label: d.toLocaleString('default', { month: 'short' }), revenue }
    })
  }, [payments, jobs, estimateByJobId])

  const collectedJobs = useMemo(
    () => jobs
      .filter(j => j.status === 'Paid' && inPeriod(j.updatedAt, period))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [jobs, period]
  )

  const invoicedJobs = useMemo(
    () => jobs
      .filter(j => j.status === 'Invoiced' && inPeriod(j.updatedAt, period))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [jobs, period]
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-white">
      {/* Header + period toggle */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Revenue</h2>
          <p className="text-zinc-500 text-sm mt-0.5">Financial overview for your business.</p>
        </div>
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 shrink-0">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p.key ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile label="Pipeline" value={pipeline} sub="Submitted estimates" color="text-amber-400" />
        <KpiTile label="Contracted" value={contracted} sub="Approved estimates" color="text-blue-400" />
        <KpiTile label="Invoiced" value={invoiced} sub="Awaiting payment" color="text-purple-400" />
        <KpiTile label="Collected" value={collected} sub="Jobs paid" color="text-emerald-400" />
      </div>

      {/* Monthly bar chart — always shows last 6 months regardless of period toggle */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 md:p-5">
        <p className="text-white text-sm font-semibold mb-4">Monthly Revenue — Last 6 Months</p>
        {monthlyData.every(d => d.revenue === 0) ? (
          <div className="h-40 flex items-center justify-center text-zinc-600 text-sm">No paid jobs yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => fmtMoney(Number(v))}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '10px', fontSize: '12px' }}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                formatter={(v) => [fmtMoney(Number(v)), 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Invoiced jobs (money owed) */}
      {invoicedJobs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Awaiting Payment</p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {invoicedJobs.map((job, i) => {
              const amount = jobValue(job, estimateByJobId)
              return (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors ${
                    i < invoicedJobs.length - 1 ? 'border-b border-zinc-800/50' : ''
                  }`}
                >
                  <div>
                    <p className="text-white text-sm font-medium">{job.title}</p>
                    <p className="text-zinc-500 text-xs">{job.client.name} · {job.updatedAt.slice(0, 10)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={`text-sm font-semibold tabular-nums ${amount > 0 ? 'text-purple-400' : 'text-zinc-600'}`}>
                      {amount > 0 ? fmtMoney(amount) : '—'}
                    </p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[job.status as JobStatus]}`}>
                      Invoiced
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Collected jobs */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-3">Collected</p>
        {collectedJobs.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-10 flex items-center justify-center text-zinc-600 text-sm">
            No paid jobs in this period.
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {collectedJobs.map((job, i) => {
              const amount = jobValue(job, estimateByJobId)
              return (
                <div
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors ${
                    i < collectedJobs.length - 1 ? 'border-b border-zinc-800/50' : ''
                  }`}
                >
                  <div>
                    <p className="text-white text-sm font-medium">{job.title}</p>
                    <p className="text-zinc-500 text-xs">{job.client.name} · {job.updatedAt.slice(0, 10)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={`text-sm font-semibold tabular-nums ${amount > 0 ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {amount > 0 ? fmtMoney(amount) : '—'}
                    </p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[job.status as JobStatus]}`}>
                      Paid
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
