import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Contract, ContractTemplate } from '@/types/contract'

type ContractsContextType = {
  templates: ContractTemplate[]
  templatesLoading: boolean
  addTemplate: (t: { name: string; body: string; sections?: ContractTemplate['sections']; tradeType?: string | null }) => Promise<ContractTemplate | null>
  updateTemplate: (t: ContractTemplate) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>

  contracts: Contract[]
  contractsLoading: boolean
  addContract: (c: { jobId: string; templateId: string | null; title: string; body: string; sections?: Contract['sections'] }) => Promise<Contract | null>
  updateContract: (c: Contract) => Promise<void>
  deleteContract: (id: string) => Promise<void>
  sendContract: (contractId: string) => Promise<void>
  voidContract: (contractId: string) => Promise<void>
}

const ContractsContext = createContext<ContractsContextType | null>(null)

function toTemplate(row: Record<string, unknown>): ContractTemplate {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    body: (row.body as string) ?? '',
    sections: (row.sections as ContractTemplate['sections']) ?? null,
    tradeType: (row.trade_type as string) ?? null,
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  }
}

function toContract(row: Record<string, unknown>): Contract {
  return {
    id: row.id as string,
    jobId: (row.job_id as string) ?? '',
    templateId: (row.template_id as string) ?? null,
    title: (row.title as string) ?? '',
    body: (row.body as string) ?? '',
    sections: (row.sections as Contract['sections']) ?? null,
    status: (row.status as Contract['status']) ?? 'draft',
    signToken: (row.sign_token as string) ?? '',
    signerName: (row.signer_name as string) ?? null,
    signerIp: (row.signer_ip as string) ?? null,
    signedAt: (row.signed_at as string) ?? null,
    sentAt: (row.sent_at as string) ?? null,
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  }
}

export function ContractsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [contractsLoading, setContractsLoading] = useState(true)

  useEffect(() => {
    if (!user?.org_id) { setTemplatesLoading(false); setContractsLoading(false); return }

    supabase.from('contract_templates').select('*').eq('org_id', user.org_id).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setTemplates(data.map(toTemplate)); setTemplatesLoading(false) })

    supabase.from('contracts').select('*').eq('org_id', user.org_id).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setContracts(data.map(toContract)); setContractsLoading(false) })
  }, [user?.org_id])

  async function addTemplate(t: { name: string; body: string; sections?: ContractTemplate['sections']; tradeType?: string | null }): Promise<ContractTemplate | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('contract_templates').insert({
      org_id: user.org_id, name: t.name, body: t.body,
      sections: t.sections ?? null, trade_type: t.tradeType ?? null,
    }).select().single()
    if (data && !error) { const tpl = toTemplate(data); setTemplates(prev => [tpl, ...prev]); return tpl }
    return null
  }

  async function updateTemplate(t: ContractTemplate) {
    const { error } = await supabase.from('contract_templates').update({
      name: t.name, body: t.body, sections: t.sections ?? null,
      trade_type: t.tradeType ?? null, updated_at: new Date().toISOString(),
    }).eq('id', t.id)
    if (!error) setTemplates(prev => prev.map(x => x.id === t.id ? t : x))
  }

  async function deleteTemplate(id: string) {
    const { error } = await supabase.from('contract_templates').delete().eq('id', id)
    if (!error) setTemplates(prev => prev.filter(x => x.id !== id))
  }

  async function addContract(c: { jobId: string; templateId: string | null; title: string; body: string; sections?: Contract['sections'] }): Promise<Contract | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('contracts').insert({
      org_id: user.org_id, job_id: c.jobId, template_id: c.templateId,
      title: c.title, body: c.body, sections: c.sections ?? null, status: 'draft',
    }).select().single()
    if (data && !error) { const contract = toContract(data); setContracts(prev => [contract, ...prev]); return contract }
    console.error('[addContract]', error?.message)
    return null
  }

  async function updateContract(c: Contract) {
    const { error } = await supabase.from('contracts').update({
      title: c.title, body: c.body, sections: c.sections ?? null,
      status: c.status, updated_at: new Date().toISOString(),
    }).eq('id', c.id)
    if (!error) setContracts(prev => prev.map(x => x.id === c.id ? c : x))
  }

  async function deleteContract(id: string) {
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (!error) setContracts(prev => prev.filter(x => x.id !== id))
  }

  async function sendContract(contractId: string) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('contracts').update({
      status: 'sent', sent_at: now, updated_at: now,
    }).eq('id', contractId)
    if (!error) setContracts(prev => prev.map(x => x.id === contractId ? { ...x, status: 'sent', sentAt: now } : x))
  }

  async function voidContract(contractId: string) {
    const { error } = await supabase.from('contracts').update({
      status: 'voided', updated_at: new Date().toISOString(),
    }).eq('id', contractId)
    if (!error) setContracts(prev => prev.map(x => x.id === contractId ? { ...x, status: 'voided' } : x))
  }

  return (
    <ContractsContext.Provider value={{
      templates, templatesLoading, addTemplate, updateTemplate, deleteTemplate,
      contracts, contractsLoading, addContract, updateContract, deleteContract,
      sendContract, voidContract,
    }}>
      {children}
    </ContractsContext.Provider>
  )
}

export function useContracts() {
  const ctx = useContext(ContractsContext)
  if (!ctx) throw new Error('useContracts must be used inside ContractsProvider')
  return ctx
}
