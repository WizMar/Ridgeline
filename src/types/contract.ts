import type { Job } from './job'

export type ContractStatus = 'draft' | 'sent' | 'signed' | 'voided'

export type ContractTemplate = {
  id: string
  name: string
  body: string
  createdAt: string
  updatedAt: string
}

export type Contract = {
  id: string
  jobId: string
  templateId: string | null
  title: string
  body: string
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
  { key: '{{client_name}}',    label: 'Client Name' },
  { key: '{{job_title}}',      label: 'Job Title' },
  { key: '{{job_scope}}',      label: 'Service Description' },
  { key: '{{job_address}}',    label: 'Job Address' },
  { key: '{{scheduled_date}}', label: 'Scheduled Date' },
  { key: '{{company_name}}',   label: 'Company Name' },
  { key: '{{today_date}}',     label: "Today's Date" },
]

export function fillPlaceholders(body: string, job: Job, companyName: string): string {
  return body
    .replace(/{{client_name}}/g,    job.client.name || '')
    .replace(/{{job_title}}/g,      job.title || '')
    .replace(/{{job_scope}}/g,      job.scope || '')
    .replace(/{{job_address}}/g,    job.address || '')
    .replace(/{{scheduled_date}}/g, job.scheduledDate || '')
    .replace(/{{company_name}}/g,   companyName)
    .replace(/{{today_date}}/g,     new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
}
