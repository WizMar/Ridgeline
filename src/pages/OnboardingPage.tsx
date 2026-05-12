import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const INDUSTRIES = [
  'Roofing', 'HVAC', 'Plumbing', 'Electrical', 'Landscaping', 'Painting',
  'Cleaning', 'Construction', 'Consulting', 'Staffing', 'Other',
]

type Props = { onSkip?: () => void }

export default function OnboardingPage({ onSkip }: Props) {
  const { user, refreshPermissions } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [userName, setUserName] = useState(user?.name || '')
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim() || !userName.trim()) return
    setLoading(true)
    setError('')

    const { error } = await supabase.rpc('setup_organization', {
      p_org_name: orgName.trim(),
      p_user_name: userName.trim(),
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Refresh auth so org_id and role are loaded
    await refreshPermissions()
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Welcome to Nexus</h1>
          <p className="text-zinc-400 text-sm">Let's set up your company. This takes 30 seconds.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">

          <div className="space-y-1.5">
            <Label className="text-zinc-300">Your Name *</Label>
            <Input
              value={userName}
              onChange={e => setUserName(e.target.value)}
              placeholder="John Smith"
              required
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-300">Company Name *</Label>
            <Input
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="Acme Services LLC"
              required
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-zinc-300">Industry <span className="text-zinc-600">(optional)</span></Label>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map(ind => (
                <button
                  key={ind}
                  type="button"
                  onClick={() => setIndustry(i => i === ind ? '' : ind)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    industry === ind
                      ? 'bg-stone-500 border-stone-500 text-white'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <Button
            type="submit"
            disabled={!orgName.trim() || !userName.trim() || loading}
            className="w-full bg-stone-500 hover:bg-stone-400 text-white font-semibold h-11"
          >
            {loading ? 'Setting up…' : 'Get Started →'}
          </Button>
        </form>

        <p className="text-zinc-600 text-xs text-center">
          You'll be the Admin. Invite your team from the app once you're in.
        </p>

        {onSkip && (
          <button onClick={onSkip} className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Skip for now — I'll finish this in Settings
          </button>
        )}
      </div>
    </div>
  )
}
