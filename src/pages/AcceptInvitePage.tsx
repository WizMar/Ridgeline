import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

type InviteStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'accepted'

type Invitation = {
  id: string
  org_id: string
  email: string
  role: string
  token: string
  status: string
  expires_at: string
  organizations: { name: string } | null
}

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [inviteStatus, setInviteStatus] = useState<InviteStatus>('loading')
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)

  useEffect(() => {
    if (!token) {
      setInviteStatus('invalid')
      return
    }
    loadInvitation(token)
  }, [token])

  async function loadInvitation(token: string) {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !data) {
      setInviteStatus('invalid')
      return
    }

    if (data.status === 'accepted') {
      setInviteStatus('accepted')
      return
    }

    if (new Date(data.expires_at) < new Date()) {
      setInviteStatus('expired')
      return
    }

    setInvitation(data as Invitation)
    setInviteStatus('valid')
  }

  async function handleAccept(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!invitation) return
    setLoading(true)
    setMessage(null)

    // 1. Sign up the user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: invitation.email,
      password,
    })

    if (signUpError || !data.user) {
      setMessage({ text: signUpError?.message ?? 'Sign up failed', type: 'error' })
      setLoading(false)
      return
    }

    const userId = data.user.id

    // 2. If no session yet (email confirmation pending), sign in now so RLS works
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password,
      })
      if (signInError) {
        setMessage({ text: 'Account created but could not sign in automatically. Please sign in manually.', type: 'error' })
        setLoading(false)
        return
      }
    }

    // 3. Create their profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId, name: fullName, role: invitation.role, org_id: invitation.org_id })

    if (profileError) {
      setMessage({ text: profileError.message, type: 'error' })
      setLoading(false)
      return
    }

    // 4. Create their employee record so they appear in the org's employee list
    const { error: employeeError } = await supabase
      .from('employees')
      .insert({
        org_id: invitation.org_id,
        name: fullName,
        email: invitation.email,
        role: invitation.role,
        status: 'Active',
        phone: '',
        hire_date: new Date().toISOString().split('T')[0],
        birthdate: '',
        address: '',
        emergency_contact: '',
        emergency_phone: '',
        notes: '',
        profile_picture: '',
      })

    if (employeeError) {
      setMessage({ text: employeeError.message, type: 'error' })
      setLoading(false)
      return
    }

    // 6. Mark invitation as accepted
    await supabase
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id)

    setMessage({ text: 'Account created! Redirecting to sign in...', type: 'success' })
    setLoading(false)
    setTimeout(() => navigate('/login'), 3000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polyline points="2,32 20,10 38,32" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <polyline points="10,32 20,18 30,32" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5"/>
            </svg>
            <h1 className="text-4xl font-bold text-white tracking-tight">Ridgeline</h1>
          </div>
          <p className="text-zinc-400 text-sm">Built for the Trades</p>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          {inviteStatus === 'loading' && (
            <CardContent className="pt-6">
              <p className="text-zinc-400 text-center">Verifying your invitation...</p>
            </CardContent>
          )}

          {inviteStatus === 'invalid' && (
            <CardContent className="pt-6 text-center space-y-3">
              <p className="text-red-400">This invitation link is invalid.</p>
              <button onClick={() => navigate('/login')} className="text-amber-500 hover:text-amber-400 text-sm">
                Back to Sign In
              </button>
            </CardContent>
          )}

          {inviteStatus === 'expired' && (
            <CardContent className="pt-6 text-center space-y-3">
              <p className="text-red-400">This invitation has expired. Ask your admin to send a new one.</p>
              <button onClick={() => navigate('/login')} className="text-amber-500 hover:text-amber-400 text-sm">
                Back to Sign In
              </button>
            </CardContent>
          )}

          {inviteStatus === 'accepted' && (
            <CardContent className="pt-6 text-center space-y-3">
              <p className="text-zinc-400">This invitation has already been used.</p>
              <button onClick={() => navigate('/login')} className="text-amber-500 hover:text-amber-400 text-sm">
                Sign In
              </button>
            </CardContent>
          )}

          {inviteStatus === 'valid' && invitation && (
            <>
              <CardHeader>
                <CardTitle className="text-white">You're invited!</CardTitle>
                <CardDescription className="text-zinc-400">
                  Join <span className="text-white font-medium">{invitation.organizations?.name ?? 'your team'}</span> as{' '}
                  <span className="text-amber-400 font-medium">{invitation.role}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAccept} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Email</Label>
                    <Input
                      type="email"
                      value={invitation.email}
                      disabled
                      className="bg-zinc-800 border-zinc-700 text-zinc-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-zinc-300">Your Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Smith"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-zinc-300">Set Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    />
                  </div>

                  {message && (
                    <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                      {message.text}
                    </p>
                  )}

                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white" disabled={loading}>
                    {loading ? 'Creating account...' : 'Accept Invitation'}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
