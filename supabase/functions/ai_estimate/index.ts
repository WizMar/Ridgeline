import "@supabase/functions-js/edge-runtime.d.ts"

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const JOB_TYPES = ['Roofing', 'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'Painting', 'General', 'Other']
const PITCH_OPTIONS = ['4/12', '5/12', '6/12', '7/12', '8/12', '9/12', '10/12', '11/12', '12/12', 'Steep (>12/12)']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { description, pricingDefaults, priceBookItems } = await req.json()

    if (!description?.trim()) {
      return new Response(
        JSON.stringify({ error: 'No description provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const systemPrompt = `You are an expert contractor estimating assistant. Given a job description, extract key details and return a structured JSON estimate.

Valid jobTypes: ${JOB_TYPES.join(', ')}
Valid pitch options for Roofing: ${PITCH_OPTIONS.join(', ')}

Return ONLY valid JSON with this structure (omit fields you have no data for):

For Roofing jobs:
{
  "jobType": "Roofing",
  "scope": "Professional 2-3 sentence scope of work for the customer proposal",
  "roofCalc": {
    "squares": "2400",
    "pitch": "6/12",
    "tearOffLayers": "1",
    "materialType": "Shingle",
    "materialPerSq": "120",
    "wastePct": "12",
    "laborPerSq": "85",
    "tearoffRate": "35"
  },
  "lineItems": [
    { "description": "Ice and water shield", "qty": 2, "unit": "sq", "unitPrice": 150 }
  ]
}

For non-Roofing jobs:
{
  "jobType": "HVAC",
  "scope": "Professional 2-3 sentence scope of work",
  "tradeCalc": {
    "laborHours": "16",
    "hourlyRate": "85",
    "materialCost": "1200",
    "equipmentCost": "3500",
    "ductworkLF": "80",
    "serviceCallFee": "150",
    "numFixtures": "3",
    "sqFt": "1800",
    "sqFtRate": "5.75",
    "areaSqFt": "2000",
    "ratePerSqFt": "8",
    "paintableSqFt": "2200",
    "numCoats": "2"
  }
}

Notes:
- squares = total roof area in SQUARE FEET (not roofing squares). 1 roofing square = 100 sq ft.
- GAF Timberline or quality 3-tab shingles: materialPerSq $90-140 per roofing square
- Typical residential roofing labor: $75-110 per roofing square
- Tear-off: $30-50 per square per layer
- Use realistic ${new Date().getFullYear()} contractor pricing for the region
- Only include tradeCalc fields relevant to the detected trade`

    const priceBookSection = priceBookItems?.length
      ? `\n\nContractor's Price Book (prefer these items for lineItems — use the exact name, unit, and unitPrice):\n${priceBookItems.map((i: { name: string; category: string; unit: string; unitPrice: number }) => `- ${i.name} | ${i.category} | ${i.unit} @ $${i.unitPrice}`).join('\n')}`
      : ''

    const userMessage = `Job description: ${description}${pricingDefaults ? `

Contractor's default rates (use these for markup and burden unless overridden):
- Markup: ${pricingDefaults.markupPct}%
- Roofing labor: $${pricingDefaults.laborPerSq}/sq
- Hourly rate: $${pricingDefaults.hourlyRate}/hr
- Burden: ${pricingDefaults.burdenPct}%` : ''}${priceBookSection}

Return ONLY the JSON object, no markdown, no explanation.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        messages: [{ role: 'user', content: userMessage }],
        system: systemPrompt,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${errorText}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''

    let estimate
    try {
      const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      estimate = JSON.parse(cleaned)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response', raw: text }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, estimate }),
      { headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    )
  }
})
