import type { ContractSection } from '@/types/contract'

export type StarterTemplate = {
  id: string
  name: string
  trade: string
  description: string
  sections: ContractSection[]
}

// ── Shared section builders ────────────────────────────────────────────────────

function parties(): ContractSection {
  return {
    id: 'parties',
    title: 'Parties & Agreement',
    required: true,
    body: `This agreement ("Contract") is entered into as of {{today_date}} by and between {{company_name}} ("Contractor") and {{client_name}} ("Client"), collectively referred to as the "Parties."

The Contractor agrees to provide the services described in this Contract, and the Client agrees to compensate the Contractor in accordance with the payment terms set forth herein.`,
  }
}

function scopeOfWork(tradeNote = ''): ContractSection {
  return {
    id: 'scope',
    title: 'Scope of Work',
    required: true,
    body: `Contractor shall furnish all labor, materials, equipment, and supervision necessary to complete the following work at the property located at {{job_address}}:

{{job_scope}}
${tradeNote ? `\n${tradeNote}` : ''}
Work shall be performed in a professional and workmanlike manner in accordance with applicable building codes and industry standards.`,
  }
}

function paymentTerms(): ContractSection {
  return {
    id: 'payment',
    title: 'Contract Price & Payment Terms',
    required: true,
    body: `The total contract price for the work described herein is {{contract_amount}}.

Payment Schedule:
  • Deposit: {{deposit_amount}} due upon signing of this agreement
  • Balance: {{balance_due}} due upon substantial completion of the work

Payments not received within 10 days of the due date shall accrue interest at 1.5% per month. In the event of non-payment, Contractor reserves the right to suspend work and pursue all available legal remedies, including the filing of a mechanic's lien.`,
  }
}

function changeOrders(): ContractSection {
  return {
    id: 'change_orders',
    title: 'Change Orders',
    body: `Any additions, deletions, or modifications to the scope of work must be documented in a written change order signed by both parties prior to performance of such work. Change orders may result in adjustments to the contract price and/or timeline.

Contractor is not responsible for delays or additional costs arising from Client-requested changes not documented in a signed change order.`,
  }
}

function scheduling(): ContractSection {
  return {
    id: 'scheduling',
    title: 'Scheduling & Timeline',
    body: `Work is scheduled to commence on or around {{scheduled_date}}, subject to weather conditions, material availability, and permitting. Contractor shall provide Client with reasonable advance notice of the start date.

Estimated completion date: {{completion_date}}.

Contractor shall diligently pursue completion but is not responsible for delays caused by weather, material shortages, acts of God, labor disputes, or other circumstances beyond Contractor's reasonable control.`,
  }
}

function permits(): ContractSection {
  return {
    id: 'permits',
    title: 'Permits & Code Compliance',
    body: `Contractor shall obtain all required permits for the work described herein unless otherwise agreed in writing. Permit fees are included in the contract price unless itemized separately.

All work shall be performed in compliance with applicable local, state, and federal building codes and regulations. Client is responsible for ensuring property access for inspections.`,
  }
}

function workmanshipWarranty(): ContractSection {
  return {
    id: 'workmanship_warranty',
    title: 'Workmanship Warranty',
    body: `Contractor warrants all workmanship for a period of {{warranty_years}} year(s) from the date of project completion. This warranty covers defects in workmanship directly attributable to Contractor's installation and does not cover damage caused by weather events, acts of God, improper maintenance, third-party modifications, or normal wear and tear.

To make a warranty claim, Client must notify Contractor in writing within the warranty period. Contractor shall inspect the claimed defect within a reasonable time and, if confirmed to be covered, shall repair it at no charge.`,
  }
}

function insuranceLiability(): ContractSection {
  return {
    id: 'insurance',
    title: 'Insurance & Liability',
    body: `Contractor maintains general liability insurance and workers' compensation insurance as required by applicable law. Certificates of insurance are available upon request.

Client is responsible for maintaining homeowner's or property insurance covering the subject property. Contractor is not responsible for pre-existing conditions, hidden damage discovered during the work, or damage caused by circumstances beyond Contractor's control.

In no event shall Contractor's liability to Client exceed the total contract price paid under this agreement. Contractor shall not be liable for indirect, incidental, consequential, or punitive damages.`,
  }
}

function disputeResolution(): ContractSection {
  return {
    id: 'dispute',
    title: 'Dispute Resolution & Governing Law',
    body: `The parties agree to attempt to resolve any dispute arising under this Contract through good-faith negotiation. If the dispute cannot be resolved within 30 days, the parties agree to submit the matter to binding mediation before initiating legal proceedings.

This Contract shall be governed by the laws of the state in which the work is performed. The prevailing party in any legal action shall be entitled to recover reasonable attorney's fees and costs.`,
  }
}

function entireAgreement(): ContractSection {
  return {
    id: 'entire_agreement',
    title: 'Entire Agreement',
    required: true,
    body: `This Contract constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior negotiations, representations, and understandings. No modification shall be valid unless made in writing and signed by both parties.

By signing below, both parties acknowledge that they have read, understood, and agree to all terms and conditions set forth in this Contract.`,
  }
}

// ── 8 Starter Templates ────────────────────────────────────────────────────────

export const STARTER_TEMPLATES: StarterTemplate[] = [

  // 1. Roofing Standard
  {
    id: 'roofing_standard',
    name: 'Standard Roofing Agreement',
    trade: 'Roofing',
    description: 'Full reroof or re-cover — materials, tear-off, workmanship & manufacturer warranty.',
    sections: [
      parties(),
      scopeOfWork(),
      {
        id: 'roofing_materials',
        title: 'Roofing Materials & Specifications',
        body: `All materials used shall be new, of good quality, and appropriate for the application. Specific materials — including shingle manufacturer, style, color, and underlayment type — shall be agreed upon in writing prior to commencement or as specified in the approved scope.

Contractor reserves the right to substitute materials of equal or greater quality if specified materials become unavailable, subject to prior Client approval.`,
      },
      {
        id: 'tearoff',
        title: 'Tear-Off & Disposal',
        body: `Contractor shall remove and properly dispose of all existing roofing materials unless otherwise specified. Debris shall be removed from the property upon project completion.

Client shall ensure the work area is reasonably accessible and that vehicles and outdoor property near the structure are moved prior to commencement. Contractor is not responsible for damage to items left in the work area.`,
      },
      paymentTerms(),
      changeOrders(),
      scheduling(),
      permits(),
      {
        id: 'manufacturer_warranty',
        title: "Manufacturer's Warranty",
        body: `Contractor shall register applicable manufacturer warranties on Client's behalf upon completion, subject to manufacturer requirements. Warranty coverage, duration, and terms are governed solely by the manufacturer.

Manufacturer warranty claims must be submitted directly to the manufacturer. Contractor shall reasonably assist Client in the warranty claim process.`,
      },
      workmanshipWarranty(),
      {
        id: 'lien_waiver',
        title: 'Lien Waiver',
        body: `Upon receipt of final payment, Contractor shall execute and deliver to Client a full and unconditional lien waiver releasing all claims against the property for labor and materials furnished under this Contract.

Contractor shall ensure all subcontractors and material suppliers are paid upon receipt of final payment, and shall obtain lien waivers from all such parties upon request.`,
      },
      insuranceLiability(),
      disputeResolution(),
      entireAgreement(),
    ],
  },

  // 2. Roofing Insurance / AOB
  {
    id: 'roofing_insurance',
    name: 'Roofing Insurance / AOB Agreement',
    trade: 'Roofing',
    description: 'Insurance claim work — AOB language, supplement rights, ACV vs RCV terms.',
    sections: [
      parties(),
      {
        id: 'insurance_auth',
        title: 'Insurance Claim Authorization',
        body: `Client hereby authorizes {{company_name}} to act as Client's authorized representative in all communications with Client's insurance company regarding the property damage claim for the work described herein.

Contractor is authorized to submit a damage assessment, scope of work, and supplement requests to the insurance carrier on Client's behalf. Client agrees to cooperate and provide timely access to insurance-related documents, adjuster reports, and correspondence.`,
      },
      scopeOfWork('The final scope of work shall be determined by the approved insurance estimate and any supplements approved by the carrier.'),
      {
        id: 'roofing_materials',
        title: 'Roofing Materials & Specifications',
        body: `Materials shall be as specified in the insurance carrier's approved scope, or as agreed in writing if Client upgrades above the insurance allowance. Client is responsible for any costs associated with material upgrades beyond the insurer's approved allowance.`,
      },
      {
        id: 'aob',
        title: 'Assignment of Benefits (AOB)',
        body: `Client hereby assigns to {{company_name}} the right to receive insurance proceeds related to the approved scope of work under Client's property insurance policy. This assignment is limited to the amount necessary to pay for services rendered under this Contract.

Client acknowledges that by executing this assignment, the insurance company may pay Contractor directly for approved work. Client retains all rights to any proceeds in excess of the contract price.

Note: AOB laws vary by state. Client should consult their insurance carrier or legal counsel regarding the implications of this assignment.`,
      },
      {
        id: 'supplement_rights',
        title: 'Supplement Rights',
        body: `Contractor reserves the right to submit supplements to Client's insurance carrier for additional materials, labor, or code-required upgrades not included in the initial insurance estimate. Client authorizes such supplements and agrees to cooperate in obtaining approval.

Any work not approved by the insurance carrier remains the financial responsibility of the Client, and Contractor shall not perform such work without Client's written authorization.`,
      },
      {
        id: 'deductible',
        title: 'Deductible & Depreciation',
        body: `Client is responsible for payment of the insurance deductible as stated in their policy. The deductible amount is due upon commencement of work.

If the Client's policy includes recoverable depreciation, Client agrees to promptly remit any depreciation checks received from the carrier to Contractor, to be applied to the outstanding balance.

Note: It is illegal in many states for a contractor to waive, absorb, or pay a Client's insurance deductible. Client is solely responsible for their deductible obligation.`,
      },
      changeOrders(),
      scheduling(),
      permits(),
      workmanshipWarranty(),
      insuranceLiability(),
      disputeResolution(),
      entireAgreement(),
    ],
  },

  // 3. HVAC
  {
    id: 'hvac',
    name: 'HVAC Service & Installation Agreement',
    trade: 'HVAC',
    description: 'HVAC installation or replacement — equipment specs, refrigerant handling, system warranty.',
    sections: [
      parties(),
      scopeOfWork(),
      {
        id: 'hvac_equipment',
        title: 'Equipment & System Specifications',
        body: `Contractor shall furnish and install the following HVAC equipment and related components as specified in the scope of work:

{{job_scope}}

All equipment shall be new, manufacturer-approved, and installed in accordance with manufacturer specifications and applicable mechanical codes. Equipment model numbers and specifications shall be confirmed in writing prior to installation.`,
      },
      paymentTerms(),
      changeOrders(),
      scheduling(),
      permits(),
      {
        id: 'refrigerant',
        title: 'Refrigerant Handling',
        body: `All refrigerant handling shall be performed by EPA Section 608 certified technicians in accordance with federal regulations. Contractor shall not knowingly release refrigerants into the atmosphere and shall properly recover, recycle, or reclaim refrigerants as required by law.

Client acknowledges that refrigerant costs are subject to market fluctuation and may be adjusted based on actual quantities required.`,
      },
      {
        id: 'hvac_warranty',
        title: 'System & Equipment Warranty',
        body: `Equipment warranties are provided by the respective manufacturers and are subject to manufacturer terms and conditions, including registration requirements. Contractor shall register equipment on Client's behalf where applicable.

System warranties may be voided by unauthorized modifications, improper maintenance, or failure to perform recommended service intervals as specified by the manufacturer.`,
      },
      workmanshipWarranty(),
      insuranceLiability(),
      disputeResolution(),
      entireAgreement(),
    ],
  },

  // 4. Plumbing
  {
    id: 'plumbing',
    name: 'Plumbing Service Agreement',
    trade: 'Plumbing',
    description: 'Plumbing installation or repair — code compliance, water damage limitation, workmanship warranty.',
    sections: [
      parties(),
      scopeOfWork(),
      {
        id: 'plumbing_materials',
        title: 'Plumbing Materials & Standards',
        body: `All materials shall be of standard commercial grade and installed in accordance with applicable plumbing codes. Any materials requiring specific Client approval shall be confirmed in writing prior to installation.

Contractor shall use licensed plumbers for all work requiring licensure under applicable state and local law.`,
      },
      paymentTerms(),
      changeOrders(),
      scheduling(),
      {
        id: 'plumbing_permits',
        title: 'Permits & Code Compliance',
        body: `All plumbing work shall be performed in compliance with applicable state and local plumbing codes. Where required, Contractor shall obtain all necessary permits and schedule required inspections.

Client is responsible for ensuring the work area is accessible. Discovery of pre-existing code violations requiring additional work will be documented and addressed via written change order.`,
      },
      {
        id: 'water_damage',
        title: 'Water Damage Limitation',
        body: `Client acknowledges that plumbing work involves water-bearing systems and that there is inherent risk associated with unforeseen conditions. Contractor's liability for water damage is limited to direct damage caused by Contractor's negligence.

Contractor strongly recommends Client maintain adequate homeowner's or property insurance covering water damage. Contractor is not responsible for damage resulting from pre-existing plumbing defects, hidden conditions, or Client's failure to report known issues.`,
      },
      workmanshipWarranty(),
      insuranceLiability(),
      disputeResolution(),
      entireAgreement(),
    ],
  },

  // 5. Electrical
  {
    id: 'electrical',
    name: 'Electrical Service Agreement',
    trade: 'Electrical',
    description: 'Electrical installation or repair — NEC compliance, inspections, safety disclaimer.',
    sections: [
      parties(),
      scopeOfWork(),
      {
        id: 'electrical_materials',
        title: 'Electrical Materials & Standards',
        body: `All materials shall be UL-listed and appropriate for the application. Contractor shall use licensed electricians for all work requiring licensure under applicable state and local law.

Work shall be performed using materials and methods that conform to the current edition of the National Electrical Code (NEC) as adopted locally.`,
      },
      paymentTerms(),
      changeOrders(),
      scheduling(),
      {
        id: 'electrical_permits',
        title: 'Permits, Code Compliance & Inspections',
        body: `All electrical work shall be performed in strict compliance with the NEC and all applicable state and local electrical codes. Required permits shall be obtained by Contractor, and all work shall be made available for inspection by the authority having jurisdiction.

Client is responsible for providing unobstructed access to the electrical panel, meter, and all work areas. Discovery of pre-existing code violations requiring remediation will be addressed via written change order.`,
      },
      {
        id: 'electrical_safety',
        title: 'Load & Safety Disclaimer',
        body: `Contractor shall assess the electrical system only as it pertains to the agreed scope of work. Contractor does not warrant the overall condition of Client's electrical system beyond the scope performed.

Client acknowledges that older electrical systems may present safety concerns outside the scope of this Contract. Contractor shall notify Client of any observed hazards discovered during work but is not responsible for conditions outside the agreed scope.`,
      },
      workmanshipWarranty(),
      insuranceLiability(),
      disputeResolution(),
      entireAgreement(),
    ],
  },

  // 6. Landscaping
  {
    id: 'landscaping',
    name: 'Landscaping Service Agreement',
    trade: 'Landscaping',
    description: 'Landscape installation or maintenance — plant warranty, irrigation, seasonal conditions.',
    sections: [
      parties(),
      scopeOfWork('Plant selection shall be appropriate for the local climate and site conditions unless otherwise specified by Client.'),
      paymentTerms(),
      changeOrders(),
      scheduling(),
      permits(),
      {
        id: 'plant_warranty',
        title: 'Plant & Material Warranty',
        body: `Contractor warrants installed plant material for {{warranty_years}} year(s) from the date of installation, provided that: (a) Client supplies adequate water and fertilization as instructed; (b) plant material is not subjected to extreme weather beyond normal seasonal conditions; (c) Client notifies Contractor of any concerns within the warranty period.

Contractor is not responsible for plant loss due to drought, flooding, pest infestation, disease, vandalism, or neglect. Annual flowers and seasonal color plants are excluded from this warranty.`,
      },
      {
        id: 'irrigation',
        title: 'Irrigation & Drainage',
        body: `If irrigation or drainage systems are included in the scope, Contractor shall install them in accordance with manufacturer specifications and applicable codes. Client is responsible for adjusting irrigation schedules seasonally and winterizing systems in freeze-prone climates.

Contractor is not responsible for damage caused by Client's failure to properly maintain irrigation or drainage systems following installation.`,
      },
      {
        id: 'seasonal',
        title: 'Seasonal Work Conditions',
        body: `Landscaping work is subject to seasonal weather, temperature, and plant availability. Contractor shall make reasonable efforts to complete work on schedule but is not responsible for delays caused by weather, soil conditions, or material unavailability.

Certain planting may be recommended at specific times of year to ensure plant survival. Contractor shall advise Client of any timing considerations affecting the scope of work.`,
      },
      insuranceLiability(),
      disputeResolution(),
      entireAgreement(),
    ],
  },

  // 7. Painting
  {
    id: 'painting',
    name: 'Painting Service Agreement',
    trade: 'Painting',
    description: 'Interior or exterior painting — surface prep, color approval, touch-up policy.',
    sections: [
      parties(),
      {
        id: 'painting_scope',
        title: 'Painting Scope & Surfaces',
        body: `Contractor shall furnish all labor, materials, and equipment necessary to complete the following painting work at {{job_address}}:

{{job_scope}}

Work includes only the surfaces and areas specified above. Any surfaces not specifically listed are excluded from this Contract. Additional surfaces requested by Client shall be subject to a written change order.`,
      },
      paymentTerms(),
      {
        id: 'surface_prep',
        title: 'Surface Preparation',
        body: `Contractor shall perform surface preparation appropriate for the substrate and paint type, including washing, scraping, sanding, caulking, and priming as necessary.

Client is responsible for removing personal property, furniture, wall hangings, and fixtures from work areas prior to commencement. Contractor is not responsible for damage to surfaces resulting from pre-existing conditions — including rot, moisture damage, or substrate failure — discovered during preparation. Such conditions will be documented and addressed via written change order.`,
      },
      {
        id: 'paint_materials',
        title: 'Paint Materials & Color Approval',
        body: `Contractor shall use professional-grade paint products appropriate for the application. Paint brand, product line, sheen, and color shall be selected and approved by Client in writing prior to commencement.

Client is responsible for final color selection. Contractor is not responsible for color variation between paint samples and finished surfaces, as appearance varies with lighting conditions and application method. Color approval constitutes Client's acceptance of the selected color(s).`,
      },
      changeOrders(),
      scheduling(),
      permits(),
      {
        id: 'touchup',
        title: 'Touch-Up Policy',
        body: `Contractor shall perform one round of touch-up work within 30 days of project completion at no additional charge. Touch-up work covers minor imperfections in Contractor's application and does not include damage caused by Client, third parties, or normal wear and tear.

Touch-up requests must be submitted to Contractor in writing within the touch-up period. Client must ensure surfaces are accessible and free of obstacles during touch-up work.`,
      },
      workmanshipWarranty(),
      insuranceLiability(),
      disputeResolution(),
      entireAgreement(),
    ],
  },

  // 8. General Service (covers Repair, General, Other)
  {
    id: 'general',
    name: 'General Service Agreement',
    trade: 'General',
    description: 'Catch-all for repairs, general contracting, and other trade work.',
    sections: [
      parties(),
      scopeOfWork('The scope of work is limited to the items described above. Any additional work discovered during the project shall be documented in a written change order prior to performance.'),
      {
        id: 'materials_labor',
        title: 'Materials & Labor',
        body: `All materials used shall be of good commercial quality and appropriate for the intended use. Contractor shall use qualified personnel for all work requiring licensure or certification under applicable law.

Unless otherwise specified, materials furnished by Contractor remain the property of Contractor until full payment is received.`,
      },
      paymentTerms(),
      changeOrders(),
      scheduling(),
      permits(),
      workmanshipWarranty(),
      insuranceLiability(),
      disputeResolution(),
      entireAgreement(),
    ],
  },
]

export function getStarterByTrade(trade: string): StarterTemplate | undefined {
  const map: Record<string, string> = {
    Roofing:     'roofing_standard',
    HVAC:        'hvac',
    Plumbing:    'plumbing',
    Electrical:  'electrical',
    Landscaping: 'landscaping',
    Painting:    'painting',
    Repair:      'general',
    General:     'general',
    Other:       'general',
  }
  const id = map[trade]
  return id ? STARTER_TEMPLATES.find(t => t.id === id) : undefined
}
