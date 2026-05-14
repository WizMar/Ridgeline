export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue'

export type Invoice = {
  id: string
  orgId: string
  jobId: string
  invoiceNumber: string
  amount: number
  issuedDate: string
  dueDate: string | null
  status: InvoiceStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export const INVOICE_STATUS_BADGE: Record<InvoiceStatus, string> = {
  draft:   'bg-zinc-700 text-zinc-300',
  sent:    'bg-blue-900/60 text-blue-300',
  paid:    'bg-emerald-900/60 text-emerald-300',
  partial: 'bg-amber-900/60 text-amber-300',
  overdue: 'bg-red-900/60 text-red-300',
}

export type PaymentMethod = 'check' | 'cash' | 'card' | 'zelle' | 'ach' | 'other'

export const PAYMENT_METHODS: PaymentMethod[] = ['check', 'cash', 'card', 'zelle', 'ach', 'other']

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  check:  'Check',
  cash:   'Cash',
  card:   'Card',
  zelle:  'Zelle',
  ach:    'ACH / Wire',
  other:  'Other',
}

export type Payment = {
  id: string
  orgId: string
  jobId: string
  invoiceId: string | null
  amount: number
  paymentDate: string
  method: PaymentMethod
  reference: string
  notes: string
  createdAt: string
}

export type ExpenseCategory = 'materials' | 'subcontractor' | 'equipment' | 'permits' | 'disposal' | 'labor' | 'other'

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'materials', 'subcontractor', 'equipment', 'permits', 'disposal', 'labor', 'other',
]

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  materials:    'Materials',
  subcontractor:'Subcontractor',
  equipment:    'Equipment',
  permits:      'Permits',
  disposal:     'Disposal / Haul Away',
  labor:        'Labor',
  other:        'Other',
}

export type JobExpense = {
  id: string
  orgId: string
  jobId: string
  category: ExpenseCategory
  description: string
  amount: number
  date: string
  vendor: string
  createdAt: string
}
