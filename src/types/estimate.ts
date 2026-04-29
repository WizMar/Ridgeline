import type { JobType } from './job'
export type { JobType }

export type EstimateStatus = 'Draft' | 'Submitted' | 'Approved' | 'Sent' | 'Declined'

export type PitchOption =
  | '4/12' | '5/12' | '6/12'
  | '7/12' | '8/12' | '9/12'
  | '10/12' | '11/12' | '12/12'
  | 'Steep (>12/12)'

export const PITCH_OPTIONS: PitchOption[] = [
  '4/12', '5/12', '6/12',
  '7/12', '8/12', '9/12',
  '10/12', '11/12', '12/12',
  'Steep (>12/12)',
]

export const PITCH_MULTIPLIER: Record<PitchOption, number> = {
  '4/12': 1.0,
  '5/12': 1.06,
  '6/12': 1.12,
  '7/12': 1.18,
  '8/12': 1.25,
  '9/12': 1.31,
  '10/12': 1.37,
  '11/12': 1.43,
  '12/12': 1.5,
  'Steep (>12/12)': 1.65,
}

export type LineItem = {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
}

export type RoofCalc = {
  squares: string
  pitch: PitchOption
  // tearOff: boolean — replaced by tearOffLayers
  tearOffLayers: string     // '0' | '1' | '2' | '3'
  materialType: 'Shingle' | 'Flat/TPO' | 'Metal' | 'Tile'
  materialPerSq: string
  wastePct: string
  markupPct: string
  laborPerSq: string
  tearoffRate: string
  burdenPct: string
  // Labor method
  laborMethod: 'perSq' | 'dayRate' | 'hourly'
  numWorkers: string
  laborHours: string   // used in hourly mode: workers × hours × rate
  numDays: string
  dayRate: string
  hourlyRate: string
  // Additional line items
  permitFee: string
  dumpster: string
  deckingSheets: string
  deckingCostPerSheet: string
  dripEdgeLF: string
  dripEdgeCostPerLF: string
  // Pricing
  pricingMethod: 'markup' | 'sellPrice'
  sellPricePerSq: string
}

export type TradeCalc = {
  markupPct: string
  burdenPct: string
  pricingMethod: 'markup' | 'sellPrice'
  sellPrice: string

  // Shared labor
  laborHours: string
  hourlyRate: string

  // Shared materials
  materialCost: string

  // HVAC
  equipmentCost: string
  ductworkLF: string
  ductworkRate: string

  // Plumbing
  serviceCallFee: string
  numFixtures: string
  hoursPerFixture: string

  // Electrical
  electricalMethod: 'sqft' | 'hours'
  sqFt: string
  sqFtRate: string

  // Landscaping
  areaSqFt: string
  ratePerSqFt: string
  cubicYards: string
  cubicYardRate: string

  // Painting
  paintType: 'Interior' | 'Exterior'
  paintableSqFt: string
  numCoats: string
  prepWork: boolean
  prepSurcharge: string

  // General / Other
  subcontractorCost: string

  // Repair / T&M
  repairLaborMethod: 'hourly' | 'dayRate' | 'flatRate'
  numWorkers: string
  numDays: string
  dayRate: string
  flatLaborRate: string

  // Repair additional fees (serviceCallFee reused from Plumbing above)
  emergencySurcharge: string  // after-hours / emergency premium
  permitFee: string           // repair permit
  equipmentRental: string     // scaffold, lift, special tools
  disposalFee: string         // haul away / dump fee
}

export type Estimate = {
  id: string
  estimateNumber: string
  status: EstimateStatus
  client: {
    name: string
    phone: string
    email: string
  }
  address: string
  jobType: JobType
  roofCalc: RoofCalc
  tradeCalc: TradeCalc
  lineItems: LineItem[]
  notes: string
  scope: string
  declineReason?: string
  createdAt: string
  updatedAt: string
  convertedJobId: string | null
  jobId: string | null
}

export const ESTIMATE_STATUSES: EstimateStatus[] = ['Draft', 'Submitted', 'Approved', 'Sent', 'Declined']

export const STATUS_BADGE: Record<EstimateStatus, string> = {
  Draft: 'bg-zinc-700 text-zinc-300',
  Submitted: 'bg-yellow-900/60 text-yellow-300',
  Approved: 'bg-stone-800/60 text-stone-200',
  Sent: 'bg-blue-900/60 text-blue-300',
  Declined: 'bg-red-900/60 text-red-300',
}

export type BreakdownItem = { label: string; amount: number }

export type EstimateTotals = {
  breakdown: BreakdownItem[]
  subtotal: number
  markup: number
  markupPct: number
  total: number
}

export function calcEstimateTotal(e: Estimate): EstimateTotals {
  const extraItems = e.lineItems.reduce((sum, li) => sum + li.qty * li.unitPrice, 0)
  const breakdown: BreakdownItem[] = []

  function finish(costs: number, markupPct: number, sellPriceOverride?: number): EstimateTotals {
    e.lineItems.forEach(li => {
      const amount = li.qty * li.unitPrice
      if (amount !== 0) breakdown.push({ label: li.description || 'Line Item', amount })
    })
    const subtotal = costs + extraItems
    if (sellPriceOverride !== undefined && sellPriceOverride > 0) {
      return { breakdown, subtotal, markup: sellPriceOverride - subtotal, markupPct, total: sellPriceOverride }
    }
    const markupAmt = subtotal * (markupPct / 100)
    return { breakdown, subtotal, markup: markupAmt, markupPct, total: subtotal + markupAmt }
  }

  function withBurden(laborBase: number, burdenPct: number): { labor: number; burden: number } {
    const burden = laborBase * (burdenPct / 100)
    return { labor: laborBase, burden }
  }

  if (e.jobType === 'Roofing') {
    const sq = (parseFloat(e.roofCalc.squares) || 0) / 100  // stored as sq ft, converted to squares
    const waste = parseFloat(e.roofCalc.wastePct) / 100 || 0
    const mPct = parseFloat(e.roofCalc.markupPct) || 0
    const burdenPct = parseFloat(e.roofCalc.burdenPct) || 0
    const matPerSq = parseFloat(e.roofCalc.materialPerSq) || 0
    const tearoffRate = parseFloat(e.roofCalc.tearoffRate) || 0
    const pitchMult = PITCH_MULTIPLIER[e.roofCalc.pitch] ?? 1.0
    const adjustedSq = sq * (1 + waste)
    const mat = adjustedSq * matPerSq

    // Labor by method
    const laborMethod = e.roofCalc.laborMethod ?? 'perSq'
    let laborBase = 0
    if (laborMethod === 'perSq') {
      laborBase = sq * (parseFloat(e.roofCalc.laborPerSq) || 0) * pitchMult
    } else if (laborMethod === 'dayRate') {
      laborBase = (parseFloat(e.roofCalc.numDays) || 0) * (parseFloat(e.roofCalc.dayRate) || 0)
    } else {
      laborBase = (parseFloat(e.roofCalc.numWorkers) || 0) * (parseFloat(e.roofCalc.laborHours ?? '') || 0) * (parseFloat(e.roofCalc.hourlyRate) || 0)
    }
    const { labor, burden } = withBurden(laborBase, burdenPct)

    // Tear-off
    const tearOffLayers = parseInt(e.roofCalc.tearOffLayers ?? '0') || 0
    const tearoff = tearOffLayers > 0 ? tearOffLayers * sq * tearoffRate : 0

    // Additional line items
    const permitFee = parseFloat(e.roofCalc.permitFee) || 0
    const dumpster = parseFloat(e.roofCalc.dumpster) || 0
    const decking = (parseFloat(e.roofCalc.deckingSheets) || 0) * (parseFloat(e.roofCalc.deckingCostPerSheet) || 0)
    const dripEdge = (parseFloat(e.roofCalc.dripEdgeLF) || 0) * (parseFloat(e.roofCalc.dripEdgeCostPerLF) || 0)
    const additionals = permitFee + dumpster + decking + dripEdge

    if (mat > 0) breakdown.push({ label: 'Material', amount: mat })
    if (labor > 0) breakdown.push({ label: 'Labor', amount: labor })
    if (burden > 0) breakdown.push({ label: `Labor Burden (${burdenPct}%)`, amount: burden })
    if (tearoff > 0) breakdown.push({ label: `Tear-off (${tearOffLayers} layer${tearOffLayers > 1 ? 's' : ''})`, amount: tearoff })
    if (permitFee > 0) breakdown.push({ label: 'Permit Fee', amount: permitFee })
    if (dumpster > 0) breakdown.push({ label: 'Dumpster / Haul Away', amount: dumpster })
    if (decking > 0) breakdown.push({ label: 'Decking', amount: decking })
    if (dripEdge > 0) breakdown.push({ label: 'Drip Edge / Flashing', amount: dripEdge })

    const coreCost = mat + labor + burden + tearoff + additionals

    const pricingMethod = e.roofCalc.pricingMethod ?? 'markup'
    const sellPriceOverride = pricingMethod === 'sellPrice' && sq > 0
      ? sq * (parseFloat(e.roofCalc.sellPricePerSq) || 0)
      : undefined

    return finish(coreCost, mPct, sellPriceOverride)
  }

  if (e.jobType === 'HVAC') {
    const equip = parseFloat(e.tradeCalc.equipmentCost) || 0
    const ductwork = (parseFloat(e.tradeCalc.ductworkLF) || 0) * (parseFloat(e.tradeCalc.ductworkRate) || 0)
    const laborBase = (parseFloat(e.tradeCalc.laborHours) || 0) * (parseFloat(e.tradeCalc.hourlyRate) || 0)
    const { labor, burden } = withBurden(laborBase, parseFloat(e.tradeCalc.burdenPct) || 0)
    const mat = parseFloat(e.tradeCalc.materialCost) || 0
    if (equip > 0) breakdown.push({ label: 'Equipment', amount: equip })
    if (ductwork > 0) breakdown.push({ label: 'Ductwork', amount: ductwork })
    if (labor > 0) breakdown.push({ label: 'Labor', amount: labor })
    if (burden > 0) breakdown.push({ label: `Labor Burden (${e.tradeCalc.burdenPct}%)`, amount: burden })
    if (mat > 0) breakdown.push({ label: 'Materials', amount: mat })
    const coreCost = equip + ductwork + labor + burden + mat
    const mPct = parseFloat(e.tradeCalc.markupPct) || 0
    const sellPriceOverride = e.tradeCalc.pricingMethod === 'sellPrice'
      ? (parseFloat(e.tradeCalc.sellPrice) || undefined)
      : undefined
    return finish(coreCost, mPct, sellPriceOverride)
  }

  if (e.jobType === 'Plumbing') {
    const serviceCall = parseFloat(e.tradeCalc.serviceCallFee) || 0
    const fixtureHours = (parseFloat(e.tradeCalc.numFixtures) || 0) * (parseFloat(e.tradeCalc.hoursPerFixture) || 0)
    const directHours = parseFloat(e.tradeCalc.laborHours) || 0
    const laborBase = (fixtureHours + directHours) * (parseFloat(e.tradeCalc.hourlyRate) || 0)
    const { labor, burden } = withBurden(laborBase, parseFloat(e.tradeCalc.burdenPct) || 0)
    const mat = parseFloat(e.tradeCalc.materialCost) || 0
    if (serviceCall > 0) breakdown.push({ label: 'Service Call', amount: serviceCall })
    if (labor > 0) breakdown.push({ label: 'Labor', amount: labor })
    if (burden > 0) breakdown.push({ label: `Labor Burden (${e.tradeCalc.burdenPct}%)`, amount: burden })
    if (mat > 0) breakdown.push({ label: 'Materials', amount: mat })
    const coreCost = serviceCall + labor + burden + mat
    const mPct = parseFloat(e.tradeCalc.markupPct) || 0
    const sellPriceOverride = e.tradeCalc.pricingMethod === 'sellPrice'
      ? (parseFloat(e.tradeCalc.sellPrice) || undefined)
      : undefined
    return finish(coreCost, mPct, sellPriceOverride)
  }

  if (e.jobType === 'Electrical') {
    const elMethod = e.tradeCalc.electricalMethod ?? 'sqft'
    const sqFtCost = elMethod === 'sqft'
      ? (parseFloat(e.tradeCalc.sqFt) || 0) * (parseFloat(e.tradeCalc.sqFtRate) || 0)
      : 0
    const hoursCost = elMethod === 'hours'
      ? (parseFloat(e.tradeCalc.laborHours) || 0) * (parseFloat(e.tradeCalc.hourlyRate) || 0)
      : 0
    const laborBase = sqFtCost > 0 ? sqFtCost : hoursCost
    const { labor, burden } = withBurden(laborBase, parseFloat(e.tradeCalc.burdenPct) || 0)
    const mat = parseFloat(e.tradeCalc.materialCost) || 0
    if (sqFtCost > 0) breakdown.push({ label: 'Labor (sq ft)', amount: labor })
    else if (hoursCost > 0) breakdown.push({ label: 'Labor', amount: labor })
    if (burden > 0) breakdown.push({ label: `Labor Burden (${e.tradeCalc.burdenPct}%)`, amount: burden })
    if (mat > 0) breakdown.push({ label: 'Materials', amount: mat })
    const coreCost = labor + burden + mat
    const mPct = parseFloat(e.tradeCalc.markupPct) || 0
    const sellPriceOverride = e.tradeCalc.pricingMethod === 'sellPrice'
      ? (parseFloat(e.tradeCalc.sellPrice) || undefined)
      : undefined
    return finish(coreCost, mPct, sellPriceOverride)
  }

  if (e.jobType === 'Landscaping') {
    const areaCost = (parseFloat(e.tradeCalc.areaSqFt) || 0) * (parseFloat(e.tradeCalc.ratePerSqFt) || 0)
    const laborBase = (parseFloat(e.tradeCalc.laborHours) || 0) * (parseFloat(e.tradeCalc.hourlyRate) || 0)
    const { labor, burden } = withBurden(laborBase, parseFloat(e.tradeCalc.burdenPct) || 0)
    const bulkMat = (parseFloat(e.tradeCalc.cubicYards) || 0) * (parseFloat(e.tradeCalc.cubicYardRate) || 0)
    const mat = parseFloat(e.tradeCalc.materialCost) || 0
    if (areaCost > 0) breakdown.push({ label: 'Area Work', amount: areaCost })
    if (labor > 0) breakdown.push({ label: 'Labor', amount: labor })
    if (burden > 0) breakdown.push({ label: `Labor Burden (${e.tradeCalc.burdenPct}%)`, amount: burden })
    if (bulkMat > 0) breakdown.push({ label: 'Bulk Materials', amount: bulkMat })
    if (mat > 0) breakdown.push({ label: 'Plants & Materials', amount: mat })
    const coreCost = areaCost + labor + burden + bulkMat + mat
    const mPct = parseFloat(e.tradeCalc.markupPct) || 0
    const sellPriceOverride = e.tradeCalc.pricingMethod === 'sellPrice'
      ? (parseFloat(e.tradeCalc.sellPrice) || undefined)
      : undefined
    return finish(coreCost, mPct, sellPriceOverride)
  }

  if (e.jobType === 'Painting') {
    const paintSqFt = parseFloat(e.tradeCalc.paintableSqFt) || 0
    const numCoats = parseFloat(e.tradeCalc.numCoats) || 1
    const rate = parseFloat(e.tradeCalc.hourlyRate) || 0
    const laborHours = paintSqFt > 0
      ? (paintSqFt * numCoats) / 200
      : (parseFloat(e.tradeCalc.laborHours) || 0)
    const exteriorMult = e.tradeCalc.paintType === 'Exterior' ? 1.3 : 1.0
    const laborBase = laborHours * rate * exteriorMult
    const { labor, burden } = withBurden(laborBase, parseFloat(e.tradeCalc.burdenPct) || 0)
    const prep = e.tradeCalc.prepWork ? (parseFloat(e.tradeCalc.prepSurcharge) || 0) : 0
    const mat = parseFloat(e.tradeCalc.materialCost) || 0
    if (labor > 0) breakdown.push({ label: `Labor (${e.tradeCalc.paintType})`, amount: labor })
    if (burden > 0) breakdown.push({ label: `Labor Burden (${e.tradeCalc.burdenPct}%)`, amount: burden })
    if (prep > 0) breakdown.push({ label: 'Prep Work', amount: prep })
    if (mat > 0) breakdown.push({ label: 'Paint & Materials', amount: mat })
    const coreCost = labor + burden + prep + mat
    const mPct = parseFloat(e.tradeCalc.markupPct) || 0
    const sellPriceOverride = e.tradeCalc.pricingMethod === 'sellPrice'
      ? (parseFloat(e.tradeCalc.sellPrice) || undefined)
      : undefined
    return finish(coreCost, mPct, sellPriceOverride)
  }

  if (e.jobType === 'Repair') {
    const method = e.tradeCalc.repairLaborMethod ?? 'hourly'
    const burdenPct = parseFloat(e.tradeCalc.burdenPct) || 0
    let laborBase = 0
    if (method === 'hourly') {
      laborBase = (parseFloat(e.tradeCalc.laborHours) || 0) * (parseFloat(e.tradeCalc.hourlyRate) || 0)
    } else if (method === 'dayRate') {
      laborBase = (parseFloat(e.tradeCalc.numWorkers) || 0) * (parseFloat(e.tradeCalc.numDays) || 0) * (parseFloat(e.tradeCalc.dayRate) || 0)
    } else {
      laborBase = parseFloat(e.tradeCalc.flatLaborRate) || 0
    }
    const { labor, burden } = withBurden(laborBase, burdenPct)
    const mat = parseFloat(e.tradeCalc.materialCost) || 0
    const serviceCall = parseFloat(e.tradeCalc.serviceCallFee) || 0
    const emergency = parseFloat(e.tradeCalc.emergencySurcharge) || 0
    const permit = parseFloat(e.tradeCalc.permitFee) || 0
    const equipment = parseFloat(e.tradeCalc.equipmentRental) || 0
    const disposal = parseFloat(e.tradeCalc.disposalFee) || 0
    const sub = parseFloat(e.tradeCalc.subcontractorCost) || 0
    const mPct = parseFloat(e.tradeCalc.markupPct) || 0
    if (labor > 0) breakdown.push({ label: 'Labor', amount: labor })
    if (burden > 0) breakdown.push({ label: `Labor Burden (${burdenPct}%)`, amount: burden })
    if (mat > 0) breakdown.push({ label: 'Materials', amount: mat })
    if (serviceCall > 0) breakdown.push({ label: 'Service / Trip Charge', amount: serviceCall })
    if (emergency > 0) breakdown.push({ label: 'Emergency / After-hours', amount: emergency })
    if (permit > 0) breakdown.push({ label: 'Permit Fee', amount: permit })
    if (equipment > 0) breakdown.push({ label: 'Equipment Rental', amount: equipment })
    if (disposal > 0) breakdown.push({ label: 'Disposal / Haul Away', amount: disposal })
    if (sub > 0) breakdown.push({ label: 'Subcontractors', amount: sub })
    const coreCost = labor + burden + mat + serviceCall + emergency + permit + equipment + disposal + sub
    return finish(coreCost, mPct)
  }

  // General / Other
  const laborBase = (parseFloat(e.tradeCalc.laborHours) || 0) * (parseFloat(e.tradeCalc.hourlyRate) || 0)
  const { labor, burden } = withBurden(laborBase, parseFloat(e.tradeCalc.burdenPct) || 0)
  const mat = parseFloat(e.tradeCalc.materialCost) || 0
  const sub = parseFloat(e.tradeCalc.subcontractorCost) || 0
  if (labor > 0) breakdown.push({ label: 'Labor', amount: labor })
  if (burden > 0) breakdown.push({ label: `Labor Burden (${e.tradeCalc.burdenPct}%)`, amount: burden })
  if (mat > 0) breakdown.push({ label: 'Materials', amount: mat })
  if (sub > 0) breakdown.push({ label: 'Subcontractors', amount: sub })
  const coreCost = labor + burden + mat + sub
  const mPct = parseFloat(e.tradeCalc.markupPct) || 0
  const sellPriceOverride = e.tradeCalc.pricingMethod === 'sellPrice'
    ? (parseFloat(e.tradeCalc.sellPrice) || undefined)
    : undefined
  return finish(coreCost, mPct, sellPriceOverride)
}
