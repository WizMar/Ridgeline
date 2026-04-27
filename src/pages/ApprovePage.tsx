import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, XCircle } from 'lucide-react'

type ApprovalJob = {
  id: string
  title: string
  client_name: string
  address: string
  scope: string
  approval_status: string
  approved_at: string | null
  approver_name: string | null
}

export default function ApprovePage() {
  const { token } = useParams<{ token: string }>()
  const [job, setJob] = useState<ApprovalJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [approverName, setApproverName] = useState('')
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState<Array<{ id: string; url: string; type: string; category: string }>>([])

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return }
    supabase.rpc('get_job_by_approval_token', { p_token: token }).then(({ data, error }) => {
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setNotFound(true)
      } else {
        const row: ApprovalJob = Array.isArray(data) ? data[0] : data
        setJob(row)
        if (row.approval_status === 'approved') setApproved(true)
      }
      setLoading(false)
    })
    supabase.rpc('get_job_media_by_token', { p_token: token }).then(({ data }) => {
      if (data) setPhotos(Array.isArray(data) ? data : [])
    })
  }, [token])

  async function handleApprove() {
    if (!approverName.trim()) { setError('Please enter your name to approve.'); return }
    setError('')
    setApproving(true)
    const { data, error: rpcErr } = await supabase.rpc('approve_job_by_token', {
      p_token: token,
      p_approver_name: approverName.trim(),
    })
    if (rpcErr || !data) {
      setError('Something went wrong. Please try again or contact the contractor.')
    } else {
      setApproved(true)
      setJob(prev => prev ? { ...prev, approval_status: 'approved', approver_name: approverName.trim(), approved_at: new Date().toISOString() } : prev)
    }
    setApproving(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Brand bar */}
        <div className="flex items-center gap-2 mb-8">
          <span className="text-white font-semibold text-lg">Nexus</span>
        </div>

        {loading && (
          <p className="text-zinc-400 text-center">Loading…</p>
        )}

        {!loading && notFound && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center space-y-3">
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-white font-semibold text-lg">Link Not Found</p>
            <p className="text-zinc-400 text-sm">This approval link is invalid or has already expired.</p>
          </div>
        )}

        {!loading && !notFound && job && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="bg-stone-500 px-6 py-4">
              <p className="text-white text-xs font-medium uppercase tracking-widest mb-1">Work Completion Approval</p>
              <p className="text-white text-xl font-bold leading-tight">{job.title}</p>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-3">
                <div>
                  <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Client</p>
                  <p className="text-white font-medium">{job.client_name}</p>
                </div>
                {job.address && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Property</p>
                    <p className="text-zinc-200 text-sm">{job.address}</p>
                  </div>
                )}
                {job.scope && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Scope of Work</p>
                    <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">{job.scope}</p>
                  </div>
                )}
              </div>

              {photos.length > 0 && (
                <div className="space-y-3">
                  <p className="text-zinc-500 text-xs uppercase tracking-wide">Job Photos</p>
                  {(['before', 'during', 'damage', 'after'] as const).map(cat => {
                    const catMedia = photos.filter(p => p.category === cat)
                    if (catMedia.length === 0) return null
                    return (
                      <div key={cat}>
                        <p className="text-zinc-400 text-xs capitalize mb-2">{cat}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {catMedia.map(p => (
                            <div key={p.id} className="aspect-square rounded-lg overflow-hidden bg-zinc-800">
                              {p.type === 'video' ? (
                                <video src={p.url} className="w-full h-full object-cover" controls />
                              ) : (
                                <img
                                  src={p.url}
                                  alt=""
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => window.open(p.url, '_blank')}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="border-t border-zinc-800" />

              {approved ? (
                <div className="text-center space-y-3 py-2">
                  <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto" />
                  <p className="text-white font-semibold text-lg">Work Approved</p>
                  <p className="text-zinc-400 text-sm">
                    Approved by <span className="text-white">{job.approver_name}</span>
                    {job.approved_at && ` on ${new Date(job.approved_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}.
                  </p>
                  <p className="text-zinc-500 text-xs">Thank you! Your contractor has been notified.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-zinc-200 text-sm font-medium mb-1">
                      By approving, you confirm the work described above has been completed to your satisfaction.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300 text-sm">Your Full Name *</Label>
                    <Input
                      value={approverName}
                      onChange={e => setApproverName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleApprove()}
                      placeholder="Jane Smith"
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    />
                  </div>
                  {error && <p className="text-red-400 text-sm">{error}</p>}
                  <Button
                    onClick={handleApprove}
                    disabled={approving || !approverName.trim()}
                    className="w-full bg-stone-500 hover:bg-stone-400 text-white font-semibold py-3"
                  >
                    {approving ? 'Submitting…' : '✓ Approve Completed Work'}
                  </Button>
                  <p className="text-zinc-600 text-xs text-center">
                    This approval is legally binding. Your name and timestamp will be recorded.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
