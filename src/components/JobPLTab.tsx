import { Printer } from 'lucide-react'
import { useFinancials } from '@/context/FinancialsContext'
import { useJobRecords } from '@/context/JobRecordsContext'
import type { Job } from '@/types/job'

function fmtMoney(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type Props = { job: Job }

export default function JobPLTab({ job }: Props) {
  const { invoicesByJob, paymentsByJob, expensesByJob } = useFinancials()
  const { materialOrdersByJob } = useJobRecords()

  const invoices = invoicesByJob(job.id)
  const payments = paymentsByJob(job.id)
  const expenses = expensesByJob(job.id)
  const materialOrders = materialOrdersByJob(job.id)

  const contractAmount = job.amount ?? 0
  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0)
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0)
  const outstanding = totalInvoiced - totalCollected

  // Cost breakdown by category
  const expenseByCategory = (cat: string) =>
    expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)

  const materialFromOrders = materialOrders.reduce((s, o) => s + o.quantity * o.unitCost, 0)
  const materialFromExpenses = expenseByCategory('materials')

  const costRows: { label: string; amount: number }[] = [
    { label: 'Labor', amount: expenseByCategory('labor') },
    { label: 'Materials', amount: materialFromExpenses + materialFromOrders },
    { label: 'Subcontractors', amount: expenseByCategory('subcontractor') },
    { label: 'Equipment', amount: expenseByCategory('equipment') },
    { label: 'Permits', amount: expenseByCategory('permits') },
    { label: 'Disposal / Haul Away', amount: expenseByCategory('disposal') },
    { label: 'Other', amount: expenseByCategory('other') },
  ].filter(r => r.amount > 0)

  const totalCosts = costRows.reduce((s, r) => s + r.amount, 0)
  const grossProfit = totalCollected - totalCosts
  const margin = totalCollected > 0 ? ((grossProfit / totalCollected) * 100).toFixed(1) : null

  function handlePrint() {
    const html = `<!DOCTYPE html>
<html>
<head>
<title>P&L — ${job.title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; background: #fff; padding: 40px; font-size: 14px; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 32px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 10px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 7px 0; border-bottom: 1px solid #f0f0f0; }
  td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .total-row td { font-weight: 700; border-top: 2px solid #111; border-bottom: none; padding-top: 10px; }
  .summary { background: #f9f9f9; border-radius: 8px; padding: 20px; display: flex; gap: 32px; flex-wrap: wrap; }
  .summary-item { }
  .summary-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 4px; }
  .summary-value { font-size: 24px; font-weight: 800; }
  .profit { color: ${grossProfit >= 0 ? '#16a34a' : '#dc2626'}; }
  .footer { margin-top: 40px; color: #aaa; font-size: 11px; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <h1>${job.title || 'Job P&L'}</h1>
  <p class="meta">${[job.client.name, job.address].filter(Boolean).join(' · ')} · Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

  <div class="section">
    <div class="section-title">Revenue</div>
    <table>
      <tr><td>Contract Amount</td><td>${fmtMoney(contractAmount)}</td></tr>
      <tr><td>Total Invoiced</td><td>${fmtMoney(totalInvoiced)}</td></tr>
      <tr><td>Total Collected</td><td>${fmtMoney(totalCollected)}</td></tr>
      ${outstanding > 0 ? `<tr><td style="color:#888">Outstanding Balance</td><td style="color:#888">${fmtMoney(outstanding)}</td></tr>` : ''}
    </table>
  </div>

  ${costRows.length > 0 ? `
  <div class="section">
    <div class="section-title">Costs</div>
    <table>
      ${costRows.map(r => `<tr><td>${r.label}</td><td>${fmtMoney(r.amount)}</td></tr>`).join('')}
      <tr class="total-row"><td>Total Costs</td><td>${fmtMoney(totalCosts)}</td></tr>
    </table>
  </div>` : ''}

  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">Gross Profit</div>
      <div class="summary-value profit">${fmtMoney(grossProfit)}</div>
    </div>
    ${margin !== null ? `<div class="summary-item">
      <div class="summary-label">Gross Margin</div>
      <div class="summary-value profit">${margin}%</div>
    </div>` : ''}
    <div class="summary-item">
      <div class="summary-label">Total Collected</div>
      <div class="summary-value">${fmtMoney(totalCollected)}</div>
    </div>
  </div>

  <div class="footer">Generated by Nexus · ${new Date().toLocaleDateString()}</div>
</body>
</html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.onload = () => w.print()
  }

  const Row = ({ label, value, muted }: { label: string; value: number; muted?: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
      <span className={muted ? 'text-zinc-500 text-sm' : 'text-zinc-300 text-sm'}>{label}</span>
      <span className={`tabular-nums text-sm font-medium ${muted ? 'text-zinc-500' : 'text-white'}`}>{fmtMoney(value)}</span>
    </div>
  )

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Print button */}
      <div className="flex justify-end">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Printer size={13} />
          Print P&L
        </button>
      </div>

      {/* Revenue */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">Revenue</p>
        <Row label="Contract Amount" value={contractAmount} />
        <Row label="Total Invoiced" value={totalInvoiced} />
        <Row label="Total Collected" value={totalCollected} />
        {outstanding > 0 && <Row label="Outstanding Balance" value={outstanding} muted />}
      </div>

      {/* Costs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">Costs</p>
        {costRows.length === 0 ? (
          <p className="text-zinc-600 text-sm py-2">No expenses recorded yet. Add expenses above or materials in the Field tab.</p>
        ) : (
          <>
            {costRows.map(r => <Row key={r.label} label={r.label} value={r.amount} />)}
            <div className="flex items-center justify-between pt-3 mt-1 border-t border-zinc-700">
              <span className="text-zinc-300 text-sm font-semibold">Total Costs</span>
              <span className="text-white text-sm font-bold tabular-nums">{fmtMoney(totalCosts)}</span>
            </div>
          </>
        )}
      </div>

      {/* Summary */}
      <div className={`rounded-xl border p-5 ${grossProfit >= 0 ? 'bg-emerald-900/20 border-emerald-800' : 'bg-red-900/20 border-red-800'}`}>
        <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-3">Summary</p>
        <div className="flex gap-6 flex-wrap">
          <div>
            <p className="text-zinc-500 text-xs mb-1">Gross Profit</p>
            <p className={`text-3xl font-black tabular-nums ${grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtMoney(grossProfit)}
            </p>
          </div>
          {margin !== null && (
            <div>
              <p className="text-zinc-500 text-xs mb-1">Gross Margin</p>
              <p className={`text-3xl font-black tabular-nums ${grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {margin}%
              </p>
            </div>
          )}
          <div>
            <p className="text-zinc-500 text-xs mb-1">Collected</p>
            <p className="text-3xl font-black tabular-nums text-white">{fmtMoney(totalCollected)}</p>
          </div>
        </div>
        {totalCollected === 0 && totalCosts === 0 && (
          <p className="text-zinc-600 text-xs mt-3">Add financial data in the Financials, Materials, and Expenses tabs to see your P&L.</p>
        )}
      </div>
    </div>
  )
}
