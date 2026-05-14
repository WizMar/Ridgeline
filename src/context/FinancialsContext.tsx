import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Invoice, Payment, JobExpense } from '@/types/financial'

type FinancialsContextType = {
  invoices: Invoice[]
  payments: Payment[]
  expenses: JobExpense[]
  loading: boolean
  invoicesByJob: (jobId: string) => Invoice[]
  paymentsByJob: (jobId: string) => Payment[]
  expensesByJob: (jobId: string) => JobExpense[]
  addInvoice: (inv: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Invoice | null>
  updateInvoice: (inv: Invoice) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  addPayment: (p: Omit<Payment, 'id' | 'createdAt'>) => Promise<Payment | null>
  deletePayment: (id: string) => Promise<void>
  addExpense: (e: Omit<JobExpense, 'id' | 'createdAt'>) => Promise<JobExpense | null>
  deleteExpense: (id: string) => Promise<void>
  nextInvoiceNumber: () => Promise<string>
}

const FinancialsContext = createContext<FinancialsContextType | null>(null)

function toInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    jobId: row.job_id as string,
    invoiceNumber: (row.invoice_number as string) ?? '',
    amount: Number(row.amount ?? 0),
    issuedDate: (row.issued_date as string) ?? '',
    dueDate: (row.due_date as string) ?? null,
    status: (row.status as Invoice['status']) ?? 'draft',
    notes: (row.notes as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  }
}

function toPayment(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    jobId: row.job_id as string,
    invoiceId: (row.invoice_id as string) ?? null,
    amount: Number(row.amount ?? 0),
    paymentDate: (row.payment_date as string) ?? '',
    method: (row.method as Payment['method']) ?? 'check',
    reference: (row.reference as string) ?? '',
    notes: (row.notes as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
  }
}

function toExpense(row: Record<string, unknown>): JobExpense {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    jobId: row.job_id as string,
    category: (row.category as JobExpense['category']) ?? 'materials',
    description: (row.description as string) ?? '',
    amount: Number(row.amount ?? 0),
    date: (row.date as string) ?? '',
    vendor: (row.vendor as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
  }
}

export function FinancialsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [expenses, setExpenses] = useState<JobExpense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user?.org_id) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      supabase.from('invoices').select('*').eq('org_id', user.org_id).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('org_id', user.org_id).order('created_at', { ascending: false }),
      supabase.from('job_expenses').select('*').eq('org_id', user.org_id).order('created_at', { ascending: false }),
    ]).then(([inv, pay, exp]) => {
      if (inv.data) setInvoices(inv.data.map(toInvoice))
      if (pay.data) setPayments(pay.data.map(toPayment))
      if (exp.data) setExpenses(exp.data.map(toExpense))
      setLoading(false)
    })
  }, [user?.org_id, authLoading])

  const invoicesByJob = useCallback((jobId: string) =>
    invoices.filter(i => i.jobId === jobId), [invoices])

  const paymentsByJob = useCallback((jobId: string) =>
    payments.filter(p => p.jobId === jobId), [payments])

  const expensesByJob = useCallback((jobId: string) =>
    expenses.filter(e => e.jobId === jobId), [expenses])

  async function nextInvoiceNumber(): Promise<string> {
    if (!user?.org_id) return 'INV-0001'
    const { count } = await supabase.from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', user.org_id)
    return `INV-${String((count ?? 0) + 1).padStart(4, '0')}`
  }

  async function addInvoice(inv: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('invoices').insert({
      org_id: user.org_id,
      job_id: inv.jobId,
      invoice_number: inv.invoiceNumber,
      amount: inv.amount,
      issued_date: inv.issuedDate || null,
      due_date: inv.dueDate || null,
      status: inv.status,
      notes: inv.notes,
    }).select().single()
    if (data && !error) {
      const newInv = toInvoice(data)
      setInvoices(prev => [newInv, ...prev])
      return newInv
    }
    return null
  }

  async function updateInvoice(inv: Invoice) {
    const { error } = await supabase.from('invoices').update({
      amount: inv.amount,
      issued_date: inv.issuedDate || null,
      due_date: inv.dueDate || null,
      status: inv.status,
      notes: inv.notes,
      updated_at: new Date().toISOString(),
    }).eq('id', inv.id)
    if (!error) setInvoices(prev => prev.map(i => i.id === inv.id ? inv : i))
  }

  async function deleteInvoice(id: string) {
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (!error) setInvoices(prev => prev.filter(i => i.id !== id))
  }

  async function addPayment(p: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('payments').insert({
      org_id: user.org_id,
      job_id: p.jobId,
      invoice_id: p.invoiceId || null,
      amount: p.amount,
      payment_date: p.paymentDate,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
    }).select().single()
    if (data && !error) {
      const newPay = toPayment(data)
      setPayments(prev => [newPay, ...prev])
      return newPay
    }
    return null
  }

  async function deletePayment(id: string) {
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (!error) setPayments(prev => prev.filter(p => p.id !== id))
  }

  async function addExpense(e: Omit<JobExpense, 'id' | 'createdAt'>): Promise<JobExpense | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('job_expenses').insert({
      org_id: user.org_id,
      job_id: e.jobId,
      category: e.category,
      description: e.description,
      amount: e.amount,
      date: e.date,
      vendor: e.vendor,
    }).select().single()
    if (data && !error) {
      const newExp = toExpense(data)
      setExpenses(prev => [newExp, ...prev])
      return newExp
    }
    return null
  }

  async function deleteExpense(id: string) {
    const { error } = await supabase.from('job_expenses').delete().eq('id', id)
    if (!error) setExpenses(prev => prev.filter(e => e.id !== id))
  }

  return (
    <FinancialsContext.Provider value={{
      invoices, payments, expenses, loading,
      invoicesByJob, paymentsByJob, expensesByJob,
      addInvoice, updateInvoice, deleteInvoice,
      addPayment, deletePayment,
      addExpense, deleteExpense,
      nextInvoiceNumber,
    }}>
      {children}
    </FinancialsContext.Provider>
  )
}

export function useFinancials() {
  const ctx = useContext(FinancialsContext)
  if (!ctx) throw new Error('useFinancials must be used inside FinancialsProvider')
  return ctx
}
