import type { Job } from './job'

export type ContractStatus = 'draft' | 'sent' | 'signed' | 'voided'

export type ContractSection = {
  id: string
  title: string
  body: string
  required?: boolean
}

export type ContractTemplate = {
  id: string
  name: string
  body: string
  sections: ContractSection[] | null
  tradeType: string | null
  createdAt: string
  updatedAt: string
}

export type Contract = {
  id: string
  jobId: string
  templateId: string | null
  title: string
  body: string
  sections: ContractSection[] | null
  status: ContractStatus
  signToken: string
  signerName: string | null
  signerIp: string | null
  signedAt: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

export const CONTRACT_STATUS_BADGE: Record<ContractStatus, string> = {
  draft:  'bg-zinc-800 text-zinc-300',
  sent:   'bg-blue-900/40 text-blue-300',
  signed: 'bg-emerald-900/40 text-emerald-300',
  voided: 'bg-red-900/30 text-red-400',
}

export const PLACEHOLDER_VARS = [
  { key: '{{client_name}}',       label: 'Client Name' },
  { key: '{{job_title}}',         label: 'Job Title' },
  { key: '{{job_scope}}',         label: 'Scope of Work' },
  { key: '{{job_address}}',       label: 'Job Address' },
  { key: '{{job_type}}',          label: 'Trade / Job Type' },
  { key: '{{scheduled_date}}',    label: 'Scheduled Date' },
  { key: '{{company_name}}',      label: 'Company Name' },
  { key: '{{today_date}}',        label: "Today's Date" },
  { key: '{{contract_amount}}',   label: 'Contract Amount' },
  { key: '{{deposit_amount}}',    label: 'Deposit Amount' },
  { key: '{{balance_due}}',       label: 'Balance Due' },
  { key: '{{warranty_years}}',    label: 'Warranty Years' },
  { key: '{{completion_date}}',   label: 'Est. Completion Date' },
]

export function fillPlaceholders(
  body: string,
  job: Job,
  companyName: string,
  extra?: Record<string, string>,
): string {
  const amount = job.amount ?? 0
  const deposit = extra?.deposit_amount ?? ''
  const balance = deposit
    ? String(amount - parseFloat(deposit.replace(/[^0-9.]/g, '') || '0'))
    : ''

  return body
    .replace(/{{client_name}}/g,     job.client.name || '')
    .replace(/{{job_title}}/g,       job.title || '')
    .replace(/{{job_scope}}/g,       job.scope || '')
    .replace(/{{job_address}}/g,     job.address || '')
    .replace(/{{job_type}}/g,        job.type || '')
    .replace(/{{scheduled_date}}/g,  job.scheduledDate || '')
    .replace(/{{company_name}}/g,    companyName)
    .replace(/{{today_date}}/g,      new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
    .replace(/{{contract_amount}}/g, amount > 0 ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '')
    .replace(/{{deposit_amount}}/g,  deposit)
    .replace(/{{balance_due}}/g,     balance)
    .replace(/{{warranty_years}}/g,  extra?.warranty_years ?? '1')
    .replace(/{{completion_date}}/g, extra?.completion_date ?? '')
}

export function fillSections(
  sections: ContractSection[],
  job: Job,
  companyName: string,
  extra?: Record<string, string>,
): ContractSection[] {
  return sections.map(s => ({
    ...s,
    body: fillPlaceholders(s.body, job, companyName, extra),
  }))
}
