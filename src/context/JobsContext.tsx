import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Job } from '@/types/job'

type JobsContextType = {
  jobs: Job[]
  loading: boolean
  addJob: (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>
  updateJob: (job: Job) => Promise<void>
  deleteJob: (id: string) => Promise<void>
  requestApproval: (jobId: string) => Promise<string | null>
}

const JobsContext = createContext<JobsContextType | null>(null)

function toJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    title: (row.title as string) ?? '',
    client: {
      name: (row.client_name as string) ?? '',
      phone: (row.client_phone as string) ?? '',
      email: (row.client_email as string) ?? '',
    },
    address: (row.address as string) ?? '',
    type: (row.type as Job['type']) ?? 'General',
    status: (row.status as Job['status']) ?? 'Draft',
    leadId: (row.lead_id as string) ?? null,
    crewIds: (row.crew_ids as string[]) ?? [],
    notes: (row.notes as string) ?? '',
    scope: (row.scope as string) ?? '',
    scheduledDate: (row.scheduled_date as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
    approvalRequired: (row.approval_required as boolean) ?? false,
    approvalStatus: (row.approval_status as Job['approvalStatus']) ?? 'none',
    approvalRequestedAt: (row.approval_requested_at as string) ?? null,
    approvalToken: (row.approval_token as string) ?? null,
    approvedAt: (row.approved_at as string) ?? null,
    approverName: (row.approver_name as string) ?? null,
    clientId: (row.client_id as string) ?? null,
    propertyId: (row.property_id as string) ?? null,
  }
}

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user?.org_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('jobs')
      .select('*')
      .eq('org_id', user.org_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setJobs(data.map(toJob))
        setLoading(false)
      })
  }, [user?.org_id, authLoading])

  async function addJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
    if (!user?.org_id) return false
    const { data, error } = await supabase.from('jobs').insert({
      org_id: user.org_id,
      title: job.title,
      client_name: job.client.name,
      client_phone: job.client.phone,
      client_email: job.client.email,
      address: job.address,
      type: job.type,
      status: job.status,
      lead_id: job.leadId || null,
      crew_ids: job.crewIds,
      notes: job.notes,
      scope: job.scope,
      scheduled_date: job.scheduledDate || null,
      approval_required: false,
      approval_status: 'none',
      client_id: job.clientId || null,
      property_id: job.propertyId || null,
    }).select().single()
    if (data && !error) { setJobs(prev => [toJob(data), ...prev]); return true }
    console.error('[addJob]', error?.message, error?.details)
    return false
  }

  async function updateJob(job: Job) {
    const { error } = await supabase.from('jobs').update({
      title: job.title,
      client_name: job.client.name,
      client_phone: job.client.phone,
      client_email: job.client.email,
      address: job.address,
      type: job.type,
      status: job.status,
      lead_id: job.leadId || null,
      crew_ids: job.crewIds,
      notes: job.notes,
      scope: job.scope,
      scheduled_date: job.scheduledDate || null,
      approval_required: job.approvalRequired,
      approval_status: job.approvalStatus,
      approval_requested_at: job.approvalRequestedAt,
      approval_token: job.approvalToken,
      approved_at: job.approvedAt,
      approver_name: job.approverName,
      client_id: job.clientId || null,
      property_id: job.propertyId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id)
    if (!error) setJobs(prev => prev.map(j => j.id === job.id ? job : j))
  }

  async function deleteJob(id: string) {
    const { error } = await supabase.from('jobs').delete().eq('id', id)
    if (!error) setJobs(prev => prev.filter(j => j.id !== id))
  }

  async function requestApproval(jobId: string): Promise<string | null> {
    const token = crypto.randomUUID()
    const now = new Date().toISOString()
    const { error } = await supabase.from('jobs').update({
      approval_token: token,
      approval_status: 'requested',
      approval_requested_at: now,
      updated_at: now,
    }).eq('id', jobId)
    if (error) return null
    setJobs(prev => prev.map(j => j.id === jobId
      ? { ...j, approvalToken: token, approvalStatus: 'requested', approvalRequestedAt: now }
      : j
    ))
    return token
  }

  return (
    <JobsContext.Provider value={{ jobs, loading, addJob, updateJob, deleteJob, requestApproval }}>
      {children}
    </JobsContext.Provider>
  )
}

export function useJobs() {
  const ctx = useContext(JobsContext)
  if (!ctx) throw new Error('useJobs must be used inside JobsProvider')
  return ctx
}
