import { useState } from 'react'
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFinancials } from '@/context/FinancialsContext'
import { useJobs } from '@/context/JobsContext'
import { useAuth } from '@/context/AuthContext'
import {
  INVOICE_STATUS_BADGE, PAYMENT_METHODS, PAYMENT_METHOD_LABEL,
  EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL,
  type Invoice, type InvoiceStatus, type PaymentMethod, type ExpenseCategory,
} from '@/types/financial'
import type { Job } from '@/types/job'
import { toast } from 'sonner'

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

type Props = { job: Job; canEdit: boolean }

export default function JobFinancialsTab({ job, canEdit }: Props) {
  const { user } = useAuth()
  const orgId = user?.org_id ?? ''
  const { updateJob } = useJobs()
  const {
    invoicesByJob, paymentsByJob, expensesByJob,
    addInvoice, updateInvoice, deleteInvoice,
    addPayment, deletePayment,
    addExpense, deleteExpense,
    nextInvoiceNumber,
  } = useFinancials()

  const jobInvoices = invoicesByJob(job.id)
  const jobPayments = paymentsByJob(job.id)
  const jobExpenses = expensesByJob(job.id)

  const totalInvoiced = jobInvoices.reduce((s, i) => s + i.amount, 0)
  const totalCollected = jobPayments.reduce((s, p) => s + p.amount, 0)
  const totalExpenses = jobExpenses.reduce((s, e) => s + e.amount, 0)
  const contractAmount = job.amount ?? 0
  const balance = (totalInvoiced || contractAmount) - totalCollected

  // ── Contract amount inline edit ──
  const [editingAmount, setEditingAmount] = useState(false)
  const [amountDraft, setAmountDraft] = useState('')

  async function saveAmount() {
    const val = parseFloat(amountDraft)
    if (isNaN(val) || val < 0) { setEditingAmount(false); return }
    await updateJob({ ...job, amount: val, updatedAt: new Date().toISOString() })
    setEditingAmount(false)
    toast.success('Contract amount updated')
  }

  // ── Invoice dialog ──
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [invDraft, setInvDraft] = useState({
    amount: '',
    issuedDate: today(),
    dueDate: addDays(today(), 30),
    status: 'sent' as InvoiceStatus,
    notes: '',
  })

  function openNewInvoice() {
    setEditingInvoice(null)
    setInvDraft({
      amount: contractAmount > 0 && totalInvoiced === 0 ? String(contractAmount) : '',
      issuedDate: today(),
      dueDate: addDays(today(), 30),
      status: 'sent',
      notes: '',
    })
    setInvoiceOpen(true)
  }

  function openEditInvoice(inv: Invoice) {
    setEditingInvoice(inv)
    setInvDraft({
      amount: String(inv.amount),
      issuedDate: inv.issuedDate,
      dueDate: inv.dueDate ?? '',
      status: inv.status,
      notes: inv.notes,
    })
    setInvoiceOpen(true)
  }

  async function saveInvoice() {
    const amount = parseFloat(invDraft.amount)
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (editingInvoice) {
      await updateInvoice({ ...editingInvoice, ...invDraft, amount })
      toast.success('Invoice updated')
    } else {
      const num = await nextInvoiceNumber()
      const result = await addInvoice({
        orgId: orgId,
        jobId: job.id,
        invoiceNumber: num,
        amount,
        issuedDate: invDraft.issuedDate,
        dueDate: invDraft.dueDate || null,
        status: invDraft.status,
        notes: invDraft.notes,
      })
      if (result) toast.success(`Invoice ${num} created`)
      else toast.error('Failed to create invoice')
    }
    setInvoiceOpen(false)
  }

  async function handleDeleteInvoice(id: string) {
    await deleteInvoice(id)
    toast.success('Invoice deleted')
  }

  // ── Payment dialog ──
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [payDraft, setPayDraft] = useState({
    amount: '',
    paymentDate: today(),
    method: 'check' as PaymentMethod,
    reference: '',
    invoiceId: '',
    notes: '',
  })

  function openNewPayment() {
    const remaining = (totalInvoiced || contractAmount) - totalCollected
    setPayDraft({
      amount: remaining > 0 ? String(Math.round(remaining * 100) / 100) : '',
      paymentDate: today(),
      method: 'check',
      reference: '',
      invoiceId: jobInvoices.find(i => i.status !== 'paid')?.id ?? '',
      notes: '',
    })
    setPaymentOpen(true)
  }

  async function savePayment() {
    const amount = parseFloat(payDraft.amount)
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    const result = await addPayment({
      orgId: orgId,
      jobId: job.id,
      invoiceId: payDraft.invoiceId || null,
      amount,
      paymentDate: payDraft.paymentDate,
      method: payDraft.method,
      reference: payDraft.reference,
      notes: payDraft.notes,
    })
    if (result) toast.success('Payment recorded')
    else toast.error('Failed to record payment')
    setPaymentOpen(false)
  }

  async function handleDeletePayment(id: string) {
    await deletePayment(id)
    toast.success('Payment deleted')
  }

  // ── Expense dialog ──
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [expDraft, setExpDraft] = useState({
    category: 'materials' as ExpenseCategory,
    description: '',
    amount: '',
    date: today(),
    vendor: '',
  })

  async function saveExpense() {
    const amount = parseFloat(expDraft.amount)
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!expDraft.description.trim()) { toast.error('Enter a description'); return }
    const result = await addExpense({
      orgId: orgId,
      jobId: job.id,
      category: expDraft.category,
      description: expDraft.description,
      amount,
      date: expDraft.date,
      vendor: expDraft.vendor,
    })
    if (result) toast.success('Expense added')
    else toast.error('Failed to add expense')
    setExpenseOpen(false)
  }

  const grossProfit = totalCollected - totalExpenses

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile label="Contract" value={contractAmount} color="text-zinc-300" />
        <SummaryTile label="Invoiced" value={totalInvoiced} color="text-violet-400" />
        <SummaryTile label="Collected" value={totalCollected} color="text-emerald-400" />
        <SummaryTile
          label={balance >= 0 ? 'Balance Due' : 'Overpaid'}
          value={Math.abs(balance)}
          color={balance > 0 ? 'text-amber-400' : balance < 0 ? 'text-red-400' : 'text-zinc-500'}
        />
      </div>

      {/* Contract amount */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">Contract Amount</p>
          {canEdit && !editingAmount && (
            <button onClick={() => { setAmountDraft(String(job.amount ?? '')); setEditingAmount(true) }}
              className="text-zinc-600 hover:text-zinc-300 transition-colors">
              <Pencil size={13} />
            </button>
          )}
        </div>
        {editingAmount ? (
          <div className="flex items-center gap-2">
            <Input
              type="number" min="0" step="0.01" autoFocus
              value={amountDraft}
              onChange={e => setAmountDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveAmount(); if (e.key === 'Escape') setEditingAmount(false) }}
              className="bg-zinc-800 border-zinc-700 text-white h-8 text-sm"
            />
            <button onClick={saveAmount} className="text-emerald-400 hover:text-emerald-300"><Check size={16} /></button>
            <button onClick={() => setEditingAmount(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16} /></button>
          </div>
        ) : (
          <p className="text-2xl font-bold text-white tabular-nums">
            {contractAmount > 0 ? fmtMoney(contractAmount) : <span className="text-zinc-600">Not set</span>}
          </p>
        )}
      </div>

      {/* Invoices */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Invoices</p>
          {canEdit && (
            <button onClick={openNewInvoice}
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-300 transition-colors">
              <Plus size={13} /> New Invoice
            </button>
          )}
        </div>
        {jobInvoices.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-8 flex items-center justify-center text-zinc-600 text-sm">
            No invoices yet.
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {jobInvoices.map((inv, i) => (
              <div key={inv.id}
                className={`flex items-center justify-between px-4 py-3 ${i < jobInvoices.length - 1 ? 'border-b border-zinc-800/50' : ''}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium">{inv.invoiceNumber}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${INVOICE_STATUS_BADGE[inv.status]}`}>
                      {inv.status}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Issued {inv.issuedDate}{inv.dueDate ? ` · Due ${inv.dueDate}` : ''}
                    {inv.notes ? ` · ${inv.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold tabular-nums text-white">{fmtMoney(inv.amount)}</p>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditInvoice(inv)} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDeleteInvoice(inv.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Payments Received</p>
          {canEdit && (
            <button onClick={openNewPayment}
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-300 transition-colors">
              <Plus size={13} /> Record Payment
            </button>
          )}
        </div>
        {jobPayments.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-8 flex items-center justify-center text-zinc-600 text-sm">
            No payments recorded yet.
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {jobPayments.map((pay, i) => (
              <div key={pay.id}
                className={`flex items-center justify-between px-4 py-3 ${i < jobPayments.length - 1 ? 'border-b border-zinc-800/50' : ''}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium">{PAYMENT_METHOD_LABEL[pay.method]}</p>
                    {pay.reference && <p className="text-zinc-500 text-xs">#{pay.reference}</p>}
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {pay.paymentDate}
                    {pay.invoiceId && (() => {
                      const inv = jobInvoices.find(i => i.id === pay.invoiceId)
                      return inv ? ` · ${inv.invoiceNumber}` : ''
                    })()}
                    {pay.notes ? ` · ${pay.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold tabular-nums text-emerald-400">{fmtMoney(pay.amount)}</p>
                  {canEdit && (
                    <button onClick={() => handleDeletePayment(pay.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expenses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Job Expenses</p>
          {canEdit && (
            <button onClick={() => { setExpDraft({ category: 'materials', description: '', amount: '', date: today(), vendor: '' }); setExpenseOpen(true) }}
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-300 transition-colors">
              <Plus size={13} /> Add Expense
            </button>
          )}
        </div>
        {jobExpenses.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-8 flex items-center justify-center text-zinc-600 text-sm">
            No expenses recorded yet.
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {jobExpenses.map((exp, i) => (
              <div key={exp.id}
                className={`flex items-center justify-between px-4 py-3 ${i < jobExpenses.length - 1 ? 'border-b border-zinc-800/50' : ''}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium">{exp.description}</p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                      {EXPENSE_CATEGORY_LABEL[exp.category]}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {exp.date}{exp.vendor ? ` · ${exp.vendor}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold tabular-nums text-red-400">{fmtMoney(exp.amount)}</p>
                  {canEdit && (
                    <button onClick={() => deleteExpense(exp.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-700 bg-zinc-800/40">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total Expenses</p>
              <p className="text-sm font-bold tabular-nums text-red-400">{fmtMoney(totalExpenses)}</p>
            </div>
          </div>
        )}

        {/* Gross profit row */}
        {(totalCollected > 0 || totalExpenses > 0) && (
          <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Gross Profit</p>
            <p className={`text-sm font-bold tabular-nums ${grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtMoney(Math.abs(grossProfit))}{grossProfit < 0 ? ' loss' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Invoice dialog */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{editingInvoice ? 'Edit Invoice' : 'New Invoice'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Amount *</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                value={invDraft.amount}
                onChange={e => setInvDraft(d => ({ ...d, amount: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Issued Date</Label>
                <Input type="date" value={invDraft.issuedDate}
                  onChange={e => setInvDraft(d => ({ ...d, issuedDate: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Due Date</Label>
                <Input type="date" value={invDraft.dueDate}
                  onChange={e => setInvDraft(d => ({ ...d, dueDate: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Status</Label>
              <Select value={invDraft.status} onValueChange={v => setInvDraft(d => ({ ...d, status: v as InvoiceStatus }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {(['draft', 'sent', 'partial', 'paid', 'overdue'] as InvoiceStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Notes</Label>
              <Input placeholder="Deposit, final payment, etc."
                value={invDraft.notes}
                onChange={e => setInvDraft(d => ({ ...d, notes: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setInvoiceOpen(false)} className="border-zinc-700 text-zinc-300">Cancel</Button>
            <Button onClick={saveInvoice} className="bg-stone-500 hover:bg-stone-400 text-white">
              {editingInvoice ? 'Save' : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Amount *</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                value={payDraft.amount}
                onChange={e => setPayDraft(d => ({ ...d, amount: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Payment Date</Label>
                <Input type="date" value={payDraft.paymentDate}
                  onChange={e => setPayDraft(d => ({ ...d, paymentDate: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Method</Label>
                <Select value={payDraft.method} onValueChange={v => setPayDraft(d => ({ ...d, method: v as PaymentMethod }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Reference # (check, transaction, etc.)</Label>
              <Input placeholder="1234"
                value={payDraft.reference}
                onChange={e => setPayDraft(d => ({ ...d, reference: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>
            {jobInvoices.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Apply to Invoice (optional)</Label>
                <Select value={payDraft.invoiceId || 'none'}
                  onValueChange={v => setPayDraft(d => ({ ...d, invoiceId: v === 'none' ? '' : v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectItem value="none">None</SelectItem>
                    {jobInvoices.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} — {fmtMoney(inv.amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Notes</Label>
              <Input placeholder="Optional"
                value={payDraft.notes}
                onChange={e => setPayDraft(d => ({ ...d, notes: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPaymentOpen(false)} className="border-zinc-700 text-zinc-300">Cancel</Button>
            <Button onClick={savePayment} className="bg-stone-500 hover:bg-stone-400 text-white">Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Category</Label>
              <Select value={expDraft.category} onValueChange={v => setExpDraft(d => ({ ...d, category: v as ExpenseCategory }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Description *</Label>
              <Input placeholder="30-yr shingles, dumpster rental, etc."
                value={expDraft.description}
                onChange={e => setExpDraft(d => ({ ...d, description: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Amount *</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00"
                  value={expDraft.amount}
                  onChange={e => setExpDraft(d => ({ ...d, amount: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Date</Label>
                <Input type="date" value={expDraft.date}
                  onChange={e => setExpDraft(d => ({ ...d, date: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Vendor (optional)</Label>
              <Input placeholder="ABC Supply, Home Depot, etc."
                value={expDraft.vendor}
                onChange={e => setExpDraft(d => ({ ...d, vendor: e.target.value }))}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setExpenseOpen(false)} className="border-zinc-700 text-zinc-300">Cancel</Button>
            <Button onClick={saveExpense} className="bg-stone-500 hover:bg-stone-400 text-white">Add Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-xl font-bold tabular-nums leading-none ${value > 0 ? color : 'text-zinc-600'}`}>
        {fmtMoney(value)}
      </p>
    </div>
  )
}
