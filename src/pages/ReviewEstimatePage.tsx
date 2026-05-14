import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type LineItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  unit?: string
}

type EstimateData = {
  id: string
  estimate_number: string
  client_name: string
  client_email: string
  address: string
  job_type: string
  scope: string
  notes: string
  line_items: LineItem[]
  status: string
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

type Screen = 'loading' | 'not_found' | 'already_used' | 'review' | 'declining' | 'accepted' | 'declined' | 'error'

export default function ReviewEstimatePage() {
  const { token } = useParams<{ token: string }>()
  const [estimate, setEstimate] = useState<EstimateData | null>(null)
  const [screen, setScreen] = useState<Screen>('loading')
  const [declineReason, setDeclineReason] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!token) { setScreen('not_found'); return }
    supabase.rpc('get_estimate_by_token', { p_token: token }).then(({ data, error }) => {
      if (error || !data) { setScreen('not_found'); return }
      if (data.status === 'Accepted') { setScreen('already_used'); return }
      if (data.status === 'Declined') { setScreen('already_used'); return }
      setEstimate(data as EstimateData)
      setScreen('review')
    })
  }, [token])

  async function handleAccept() {
    if (!token) return
    setWorking(true)
    const { data, error } = await supabase.rpc('accept_estimate', { p_token: token })
    setWorking(false)
    if (error || data?.error) { setScreen('error'); return }
    setScreen('accepted')
  }

  async function handleDecline() {
    if (!token || !declineReason.trim()) return
    setWorking(true)
    await supabase.rpc('decline_estimate', { p_token: token, p_reason: declineReason.trim() })
    setWorking(false)
    setScreen('declined')
  }

  const subtotal = estimate?.line_items?.reduce((s, li) => s + (li.quantity * li.unitPrice), 0) ?? 0

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-stone-400 animate-spin" />
      </div>
    )
  }

  if (screen === 'not_found' || screen === 'already_used') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-zinc-400 text-lg font-medium mb-2">
            {screen === 'not_found' ? 'Estimate not found.' : 'This estimate has already been reviewed.'}
          </p>
          <p className="text-zinc-600 text-sm">This link may be expired or invalid. Contact your contractor for a new link.</p>
        </div>
      </div>
    )
  }

  if (screen === 'accepted') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
          <p className="text-white text-xl font-bold mb-2">Estimate Accepted</p>
          <p className="text-zinc-400 text-sm">Thank you! Your contractor will be in touch shortly with a contract to sign.</p>
        </div>
      </div>
    )
  }

  if (screen === 'declined') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-white text-xl font-bold mb-2">Estimate Declined</p>
          <p className="text-zinc-400 text-sm">Your contractor has been notified. Thank you for your time.</p>
        </div>
      </div>
    )
  }

  if (screen === 'error') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-red-400 text-lg font-medium mb-2">Something went wrong.</p>
          <p className="text-zinc-600 text-sm">Please try again or contact your contractor directly.</p>
        </div>
      </div>
    )
  }

  if (!estimate) return null

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Header */}
        <div className="text-center pb-2">
          <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Estimate {estimate.estimate_number}</p>
          <h1 className="text-2xl font-bold text-white">{estimate.address}</h1>
          <p className="text-zinc-400 text-sm mt-1">{estimate.client_name}</p>
        </div>

        {/* Scope */}
        {estimate.scope && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-2">Scope of Work</p>
            <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">{estimate.scope}</p>
          </div>
        )}

        {/* Line items */}
        {estimate.line_items?.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest px-4 pt-4 pb-2">Line Items</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left text-zinc-500 text-xs font-medium px-4 pb-2">Description</th>
                  <th className="text-right text-zinc-500 text-xs font-medium px-4 pb-2">Qty</th>
                  <th className="text-right text-zinc-500 text-xs font-medium px-4 pb-2">Unit Price</th>
                  <th className="text-right text-zinc-500 text-xs font-medium px-4 pb-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {estimate.line_items.map((li, i) => (
                  <tr key={li.id ?? i} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-2.5 text-zinc-200">{li.description}</td>
                    <td className="px-4 py-2.5 text-zinc-400 text-right tabular-nums">{li.quantity}{li.unit ? ` ${li.unit}` : ''}</td>
                    <td className="px-4 py-2.5 text-zinc-400 text-right tabular-nums">{fmtMoney(li.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-white text-right tabular-nums font-medium">{fmtMoney(li.quantity * li.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center px-4 py-3 border-t border-zinc-700 bg-zinc-800/40">
              <span className="text-zinc-400 text-sm font-medium">Total</span>
              <span className="text-white text-lg font-bold tabular-nums">{fmtMoney(subtotal)}</span>
            </div>
          </div>
        )}

        {/* Notes */}
        {estimate.notes && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-2">Notes</p>
            <p className="text-zinc-400 text-sm whitespace-pre-wrap">{estimate.notes}</p>
          </div>
        )}

        {/* Actions */}
        {screen === 'review' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-zinc-300 text-sm text-center">Do you accept this estimate?</p>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-5"
                disabled={working}
                onClick={handleAccept}
              >
                <CheckCircle2 size={16} className="mr-2" />
                {working ? 'Processing…' : 'Accept Estimate'}
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-800 text-red-400 hover:bg-red-900/30 hover:text-red-300 py-5"
                disabled={working}
                onClick={() => setScreen('declining')}
              >
                Decline
              </Button>
            </div>
          </div>
        )}

        {screen === 'declining' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-zinc-300 text-sm">Please let us know why you're declining:</p>
            <textarea
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500"
              rows={3}
              placeholder="e.g. Price is too high, going with another contractor…"
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
            />
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-red-700 hover:bg-red-600 text-white"
                disabled={working || !declineReason.trim()}
                onClick={handleDecline}
              >
                {working ? 'Submitting…' : 'Submit Decline'}
              </Button>
              <Button
                variant="outline"
                className="border-zinc-600 text-zinc-400 hover:bg-zinc-800"
                onClick={() => setScreen('review')}
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
