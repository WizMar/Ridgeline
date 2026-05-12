import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CheckCircle2, FileSignature } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ContractData = {
  id: string
  title: string
  body: string
  status: string
  signer_name: string | null
  signed_at: string | null
}

export default function SignContractPage() {
  const { token } = useParams<{ token: string }>()
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return }
    supabase.rpc('get_contract_by_token', { p_token: token }).then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        setNotFound(true)
      } else {
        setContract(data[0])
        if (data[0].status === 'signed') setSigned(true)
      }
      setLoading(false)
    })
  }, [token])

  async function handleSign() {
    if (!signerName.trim() || !agreed || !token) return
    setSigning(true)
    const { data, error } = await supabase.rpc('sign_contract', {
      p_token: token,
      p_name: signerName.trim(),
      p_ip: '',
    })
    if (!error && data) {
      setSigned(true)
      setContract(c => c ? { ...c, status: 'signed', signer_name: signerName.trim(), signed_at: new Date().toISOString() } : c)
    }
    setSigning(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-stone-400 animate-spin" />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center">
        <FileSignature className="w-12 h-12 text-zinc-700 mx-auto mb-4" strokeWidth={1.5} />
        <h2 className="text-white font-bold text-lg mb-2">Contract Not Found</h2>
        <p className="text-zinc-500 text-sm">This link may be invalid or the contract has been voided.</p>
      </div>
    </div>
  )

  if (contract?.status === 'draft') return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center">
        <FileSignature className="w-12 h-12 text-zinc-700 mx-auto mb-4" strokeWidth={1.5} />
        <h2 className="text-white font-bold text-lg mb-2">Not Ready Yet</h2>
        <p className="text-zinc-500 text-sm">This contract hasn't been sent for signing yet.</p>
      </div>
    </div>
  )

  if (signed) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-900/30 border border-emerald-700 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-white font-bold text-xl mb-2">Contract Signed</h2>
        <p className="text-zinc-400 text-sm">
          {contract?.signer_name
            ? <>Signed by <span className="text-white font-medium">{contract.signer_name}</span>.</>
            : 'This contract has been signed.'}
        </p>
        {contract?.signed_at && (
          <p className="text-zinc-600 text-xs mt-2">
            {new Date(contract.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-600 flex items-center justify-center shrink-0">
            <FileSignature size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{contract?.title}</h1>
            <p className="text-zinc-500 text-xs">Please read carefully before signing</p>
          </div>
        </div>

        {/* Contract body */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <pre className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">
            {contract?.body}
          </pre>
        </div>

        {/* Signature section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <p className="text-white font-semibold text-sm">Sign this contract</p>

          <div className="space-y-1.5">
            <label className="text-zinc-400 text-xs">Full Name *</label>
            <Input
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Type your full name"
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="mt-0.5 accent-stone-500 w-4 h-4 shrink-0"
            />
            <span className="text-zinc-400 text-sm leading-relaxed">
              I have read and agree to the terms of this contract. I understand that typing my name above constitutes a legally binding electronic signature.
            </span>
          </label>

          <Button
            onClick={handleSign}
            disabled={!signerName.trim() || !agreed || signing}
            className="w-full bg-stone-500 hover:bg-stone-400 text-white font-semibold"
          >
            {signing ? 'Signing…' : 'Sign Contract'}
          </Button>
        </div>

        <p className="text-zinc-600 text-xs text-center">
          Protected under the U.S. Electronic Signatures in Global and National Commerce Act (E-SIGN).
        </p>
      </div>
    </div>
  )
}
