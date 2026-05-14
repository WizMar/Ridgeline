export type MaterialOrderStatus = 'ordered' | 'received' | 'cancelled'
export const MATERIAL_ORDER_STATUSES: MaterialOrderStatus[] = ['ordered', 'received', 'cancelled']
export const MATERIAL_ORDER_STATUS_LABEL: Record<MaterialOrderStatus, string> = {
  ordered: 'Ordered',
  received: 'Received',
  cancelled: 'Cancelled',
}
export const MATERIAL_ORDER_STATUS_BADGE: Record<MaterialOrderStatus, string> = {
  ordered: 'bg-blue-900/60 text-blue-300',
  received: 'bg-emerald-900/60 text-emerald-300',
  cancelled: 'bg-zinc-700 text-zinc-400',
}

export type MaterialOrder = {
  id: string
  orgId: string
  jobId: string
  supplier: string
  description: string
  quantity: number
  unit: string
  unitCost: number
  dateOrdered: string | null
  status: MaterialOrderStatus
  notes: string
  createdAt: string
}

export type PermitStatus = 'pending' | 'approved' | 'expired'
export const PERMIT_STATUSES: PermitStatus[] = ['pending', 'approved', 'expired']
export const PERMIT_STATUS_LABEL: Record<PermitStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  expired: 'Expired',
}
export const PERMIT_STATUS_BADGE: Record<PermitStatus, string> = {
  pending: 'bg-amber-900/60 text-amber-300',
  approved: 'bg-emerald-900/60 text-emerald-300',
  expired: 'bg-red-900/60 text-red-300',
}

export type JobPermit = {
  id: string
  orgId: string
  jobId: string
  permitNumber: string
  permitType: string
  issuedBy: string
  issueDate: string | null
  expirationDate: string | null
  status: PermitStatus
  notes: string
  createdAt: string
}

export type CommType = 'email' | 'text' | 'call' | 'in-person' | 'other'
export const COMM_TYPES: CommType[] = ['email', 'text', 'call', 'in-person', 'other']
export const COMM_TYPE_LABEL: Record<CommType, string> = {
  email: 'Email',
  text: 'Text',
  call: 'Call',
  'in-person': 'In Person',
  other: 'Other',
}
export const COMM_TYPE_ICON: Record<CommType, string> = {
  email: '✉️',
  text: '💬',
  call: '📞',
  'in-person': '🤝',
  other: '📝',
}

export type JobCommunication = {
  id: string
  orgId: string
  jobId: string
  date: string
  type: CommType
  contactName: string
  summary: string
  createdAt: string
}
