export type JobStatus = 'Draft' | 'Scheduled' | 'In Progress' | 'Completed' | 'Invoiced'
export type JobType = 'Roofing' | 'HVAC' | 'Plumbing' | 'Electrical' | 'Landscaping' | 'Painting' | 'General' | 'Other'

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
}

export const JOB_TYPES: JobType[] = [
  'Roofing', 'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'Painting', 'General', 'Other',
]

export const JOB_STATUSES: JobStatus[] = [
  'Draft', 'Scheduled', 'In Progress', 'Completed', 'Invoiced',
]

export const STATUS_COLORS: Record<JobStatus, string> = {
  Draft: '#52525b',
  Scheduled: '#60a5fa',
  'In Progress': '#f59e0b',
  Completed: '#4ade80',
  Invoiced: '#a78bfa',
}

export const STATUS_BADGE: Record<JobStatus, string> = {
  Draft: 'bg-zinc-700 text-zinc-300',
  Scheduled: 'bg-blue-900/60 text-blue-300',
  'In Progress': 'bg-amber-900/60 text-amber-300',
  Completed: 'bg-green-900/60 text-green-300',
  Invoiced: 'bg-violet-900/60 text-violet-300',
}

export const STATUS_BORDER: Record<JobStatus, string> = {
  Draft: 'border-l-zinc-500',
  Scheduled: 'border-l-blue-500',
  'In Progress': 'border-l-orange-500',
  Completed: 'border-l-amber-500',
  Invoiced: 'border-l-purple-500',
}
