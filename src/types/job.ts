export type JobStatus = 'Draft' | 'Scheduled' | 'In Progress' | 'Completed' | 'Invoiced'
export type JobType = 'Roofing' | 'HVAC' | 'Plumbing' | 'Electrical' | 'Landscaping' | 'Painting' | 'General' | 'Repair' | 'Other'
export type ApprovalStatus = 'none' | 'requested' | 'approved'

export type Job = {
  id: string
  title: string
  client: {
    name: string
    phone: string
    email: string
  }
  address: string
  type: JobType
  status: JobStatus
  leadId: string | null
  crewIds: string[]
  notes: string
  scope: string
  scheduledDate: string
  createdAt: string
  updatedAt: string
  approvalRequired: boolean
  approvalStatus: ApprovalStatus
  approvalRequestedAt: string | null
  approvalToken: string | null
  approvedAt: string | null
  approverName: string | null
  clientId: string | null
  propertyId: string | null
}

export const JOB_TYPES: JobType[] = [
  'Roofing', 'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'Painting', 'General', 'Repair', 'Other',
]

export const JOB_STATUSES: JobStatus[] = [
  'Draft', 'Scheduled', 'In Progress', 'Completed', 'Invoiced',
]

export const STATUS_COLORS: Record<JobStatus, string> = {
  Draft: '#52525b',
  Scheduled: '#60a5fa',
  'In Progress': '#d6d3d1',
  Completed: '#4ade80',
  Invoiced: '#a78bfa',
}

export const STATUS_BADGE: Record<JobStatus, string> = {
  Draft: 'bg-zinc-700 text-zinc-300',
  Scheduled: 'bg-blue-900/60 text-blue-300',
  'In Progress': 'bg-stone-800/60 text-stone-200',
  Completed: 'bg-green-900/60 text-green-300',
  Invoiced: 'bg-violet-900/60 text-violet-300',
}

export const STATUS_BORDER: Record<JobStatus, string> = {
  Draft: 'border-l-zinc-500',
  Scheduled: 'border-l-blue-500',
  'In Progress': 'border-l-orange-500',
  Completed: 'border-l-stone-400',
  Invoiced: 'border-l-purple-500',
}
