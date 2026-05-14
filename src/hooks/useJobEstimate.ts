import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Estimate, RoofCalc, TradeCalc, LineItem } from '@/types/estimate'
import type { Job } from '@/types/job'

function toEstimate(row: Record<string, unknown>): Estimate {
  return {
    id: row.id as string,
    estimateNumber: (row.estimate_number as string) ?? '',
    status: (row.status as Estimate['status']) ?? 'Draft',
    client: {
      name: (row.client_name as string) ?? '',
      phone: (row.client_phone as string) ?? '',
      email: (row.client_email as string) ?? '',
    },
    address: (row.address as string) ?? '',
    jobType: (row.job_type as Estimate['jobType']) ?? 'General',
    roofCalc: (row.roof_calc as RoofCalc) ?? {},
    tradeCalc: (row.trade_calc as TradeCalc) ?? {},
    lineItems: (row.line_items as LineItem[]) ?? [],
    notes: (row.notes as string) ?? '',
    scope: (row.scope as string) ?? '',
    declineReason: (row.decline_reason as string) ?? '',
    convertedJobId: (row.converted_job_id as string) ?? null,
    jobId: (row.job_id as string) ?? null,
    reviewToken: (row.review_token as string) ?? null,
    createdAt: (row.created_at as string) ?? '',
    updatedAt: (row.updated_at as string) ?? '',
  }
}

export function useJobEstimate(job: Job | null) {
  const { user } = useAuth()
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!job?.id) { setEstimate(null); return }
    setLoading(true)
    supabase
      .from('estimates')
      .select('*')
      .eq('job_id', job.id)
      .maybeSingle()
      .then(({ data }) => {
        setEstimate(data ? toEstimate(data) : null)
        setLoading(false)
      })
  }, [job?.id])

  const createEstimate = useCallback(async (defaults: { wastePct: string; markupPct: string; laborPerSq: string; tearoffRate: string; hourlyRate: string; burdenPct: string }): Promise<Estimate | null> => {
    if (!user?.org_id || !job) return null

    const { count } = await supabase
      .from('estimates')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', user.org_id)
    const num = `EST-${String((count ?? 0) + 1).padStart(4, '0')}`

    const roofCalc: RoofCalc = {
      squares: '', pitch: '4/12', tearOffLayers: '0', materialType: 'Shingle',
      materialPerSq: '', wastePct: defaults.wastePct, markupPct: defaults.markupPct,
      laborPerSq: defaults.laborPerSq, tearoffRate: defaults.tearoffRate,
      burdenPct: defaults.burdenPct, laborMethod: 'perSq',
      numWorkers: '', laborHours: '', numDays: '', dayRate: '',
      hourlyRate: defaults.hourlyRate, permitFee: '', dumpster: '',
      deckingSheets: '', deckingCostPerSheet: '', dripEdgeLF: '', dripEdgeCostPerLF: '',
      pricingMethod: 'markup', sellPricePerSq: '',
    }
    const tradeCalc: TradeCalc = {
      markupPct: defaults.markupPct, burdenPct: defaults.burdenPct,
      pricingMethod: 'markup', sellPrice: '', laborHours: '',
      hourlyRate: defaults.hourlyRate, materialCost: '', equipmentCost: '',
      ductworkLF: '', ductworkRate: '18', serviceCallFee: '', numFixtures: '',
      hoursPerFixture: '', electricalMethod: 'sqft', sqFt: '', sqFtRate: '',
      areaSqFt: '', ratePerSqFt: '', cubicYards: '', cubicYardRate: '',
      paintType: 'Exterior', paintableSqFt: '', numCoats: '2', prepWork: false,
      prepSurcharge: '', subcontractorCost: '',
      repairLaborMethod: 'hourly', numWorkers: '', numDays: '', dayRate: '', flatLaborRate: '',
      emergencySurcharge: '', permitFee: '', equipmentRental: '', disposalFee: '',
    }

    const { data, error } = await supabase.from('estimates').insert({
      org_id: user.org_id,
      job_id: job.id,
      estimate_number: num,
      status: 'Draft',
      client_name: job.client.name,
      client_phone: job.client.phone,
      client_email: job.client.email,
      address: job.address,
      job_type: job.type,
      roof_calc: roofCalc,
      trade_calc: tradeCalc,
      line_items: [],
      notes: '',
      scope: job.scope,
      converted_job_id: null,
    }).select().single()

    if (error || !data) return null
    const est = toEstimate(data)
    setEstimate(est)
    return est
  }, [job, user])

  const saveEstimate = useCallback(async (est: Estimate): Promise<boolean> => {
    setSaving(true)
    const { error } = await supabase.from('estimates').update({
      status: est.status,
      roof_calc: est.roofCalc,
      trade_calc: est.tradeCalc,
      line_items: est.lineItems,
      notes: est.notes,
      scope: est.scope,
      decline_reason: est.declineReason ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', est.id)
    setSaving(false)
    if (!error) setEstimate(est)
    return !error
  }, [])

  const removeEstimate = useCallback(async () => {
    if (!estimate) return
    await supabase.from('estimates').delete().eq('id', estimate.id)
    setEstimate(null)
  }, [estimate])

  return { estimate, setEstimate, loading, saving, createEstimate, saveEstimate, removeEstimate }
}
