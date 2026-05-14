import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { MaterialOrder, JobPermit, JobCommunication, MaterialOrderStatus, PermitStatus, CommType } from '@/types/jobRecords'

type JobRecordsContextType = {
  materialOrders: MaterialOrder[]
  permits: JobPermit[]
  communications: JobCommunication[]
  loading: boolean
  materialOrdersByJob: (jobId: string) => MaterialOrder[]
  permitsByJob: (jobId: string) => JobPermit[]
  communicationsByJob: (jobId: string) => JobCommunication[]
  addMaterialOrder: (o: Omit<MaterialOrder, 'id' | 'createdAt'>) => Promise<MaterialOrder | null>
  updateMaterialOrder: (o: MaterialOrder) => Promise<void>
  deleteMaterialOrder: (id: string) => Promise<void>
  addPermit: (p: Omit<JobPermit, 'id' | 'createdAt'>) => Promise<JobPermit | null>
  updatePermit: (p: JobPermit) => Promise<void>
  deletePermit: (id: string) => Promise<void>
  addCommunication: (c: Omit<JobCommunication, 'id' | 'createdAt'>) => Promise<JobCommunication | null>
  deleteCommunication: (id: string) => Promise<void>
}

const JobRecordsContext = createContext<JobRecordsContextType | null>(null)

function toOrder(row: Record<string, unknown>): MaterialOrder {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    jobId: row.job_id as string,
    supplier: (row.supplier as string) ?? '',
    description: (row.description as string) ?? '',
    quantity: Number(row.quantity ?? 1),
    unit: (row.unit as string) ?? '',
    unitCost: Number(row.unit_cost ?? 0),
    dateOrdered: (row.date_ordered as string) ?? null,
    status: (row.status as MaterialOrderStatus) ?? 'ordered',
    notes: (row.notes as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
  }
}

function toPermit(row: Record<string, unknown>): JobPermit {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    jobId: row.job_id as string,
    permitNumber: (row.permit_number as string) ?? '',
    permitType: (row.permit_type as string) ?? '',
    issuedBy: (row.issued_by as string) ?? '',
    issueDate: (row.issue_date as string) ?? null,
    expirationDate: (row.expiration_date as string) ?? null,
    status: (row.status as PermitStatus) ?? 'pending',
    notes: (row.notes as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
  }
}

function toComm(row: Record<string, unknown>): JobCommunication {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    jobId: row.job_id as string,
    date: (row.date as string) ?? '',
    type: (row.type as CommType) ?? 'call',
    contactName: (row.contact_name as string) ?? '',
    summary: (row.summary as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
  }
}

export function JobRecordsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [materialOrders, setMaterialOrders] = useState<MaterialOrder[]>([])
  const [permits, setPermits] = useState<JobPermit[]>([])
  const [communications, setCommunications] = useState<JobCommunication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user?.org_id) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      supabase.from('job_material_orders').select('*').eq('org_id', user.org_id).order('created_at', { ascending: false }),
      supabase.from('job_permits').select('*').eq('org_id', user.org_id).order('created_at', { ascending: false }),
      supabase.from('job_communications').select('*').eq('org_id', user.org_id).order('date', { ascending: false }),
    ]).then(([ord, per, com]) => {
      if (ord.data) setMaterialOrders(ord.data.map(toOrder))
      if (per.data) setPermits(per.data.map(toPermit))
      if (com.data) setCommunications(com.data.map(toComm))
      setLoading(false)
    })
  }, [user?.org_id, authLoading])

  const materialOrdersByJob = useCallback((jobId: string) =>
    materialOrders.filter(o => o.jobId === jobId), [materialOrders])
  const permitsByJob = useCallback((jobId: string) =>
    permits.filter(p => p.jobId === jobId), [permits])
  const communicationsByJob = useCallback((jobId: string) =>
    communications.filter(c => c.jobId === jobId), [communications])

  async function addMaterialOrder(o: Omit<MaterialOrder, 'id' | 'createdAt'>): Promise<MaterialOrder | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('job_material_orders').insert({
      org_id: user.org_id, job_id: o.jobId, supplier: o.supplier, description: o.description,
      quantity: o.quantity, unit: o.unit, unit_cost: o.unitCost,
      date_ordered: o.dateOrdered || null, status: o.status, notes: o.notes,
    }).select().single()
    if (data && !error) { const r = toOrder(data); setMaterialOrders(prev => [r, ...prev]); return r }
    return null
  }

  async function updateMaterialOrder(o: MaterialOrder) {
    const { error } = await supabase.from('job_material_orders').update({
      supplier: o.supplier, description: o.description, quantity: o.quantity,
      unit: o.unit, unit_cost: o.unitCost, date_ordered: o.dateOrdered || null,
      status: o.status, notes: o.notes,
    }).eq('id', o.id)
    if (!error) setMaterialOrders(prev => prev.map(x => x.id === o.id ? o : x))
  }

  async function deleteMaterialOrder(id: string) {
    const { error } = await supabase.from('job_material_orders').delete().eq('id', id)
    if (!error) setMaterialOrders(prev => prev.filter(x => x.id !== id))
  }

  async function addPermit(p: Omit<JobPermit, 'id' | 'createdAt'>): Promise<JobPermit | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('job_permits').insert({
      org_id: user.org_id, job_id: p.jobId, permit_number: p.permitNumber,
      permit_type: p.permitType, issued_by: p.issuedBy,
      issue_date: p.issueDate || null, expiration_date: p.expirationDate || null,
      status: p.status, notes: p.notes,
    }).select().single()
    if (data && !error) { const r = toPermit(data); setPermits(prev => [r, ...prev]); return r }
    return null
  }

  async function updatePermit(p: JobPermit) {
    const { error } = await supabase.from('job_permits').update({
      permit_number: p.permitNumber, permit_type: p.permitType, issued_by: p.issuedBy,
      issue_date: p.issueDate || null, expiration_date: p.expirationDate || null,
      status: p.status, notes: p.notes,
    }).eq('id', p.id)
    if (!error) setPermits(prev => prev.map(x => x.id === p.id ? p : x))
  }

  async function deletePermit(id: string) {
    const { error } = await supabase.from('job_permits').delete().eq('id', id)
    if (!error) setPermits(prev => prev.filter(x => x.id !== id))
  }

  async function addCommunication(c: Omit<JobCommunication, 'id' | 'createdAt'>): Promise<JobCommunication | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('job_communications').insert({
      org_id: user.org_id, job_id: c.jobId, date: c.date,
      type: c.type, contact_name: c.contactName, summary: c.summary,
    }).select().single()
    if (data && !error) { const r = toComm(data); setCommunications(prev => [r, ...prev]); return r }
    return null
  }

  async function deleteCommunication(id: string) {
    const { error } = await supabase.from('job_communications').delete().eq('id', id)
    if (!error) setCommunications(prev => prev.filter(x => x.id !== id))
  }

  return (
    <JobRecordsContext.Provider value={{
      materialOrders, permits, communications, loading,
      materialOrdersByJob, permitsByJob, communicationsByJob,
      addMaterialOrder, updateMaterialOrder, deleteMaterialOrder,
      addPermit, updatePermit, deletePermit,
      addCommunication, deleteCommunication,
    }}>
      {children}
    </JobRecordsContext.Provider>
  )
}

export function useJobRecords() {
  const ctx = useContext(JobRecordsContext)
  if (!ctx) throw new Error('useJobRecords must be used inside JobRecordsProvider')
  return ctx
}
