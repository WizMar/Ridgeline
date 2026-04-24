import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'create-org' | 'forgot-password'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage({ text: error.message, type: 'error' })
    setLoading(false)
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // 1. Sign up the user
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      setMessage({ text: signUpError?.message ?? 'Sign up failed', type: 'error' })
      setLoading(false)
      return
    }

    const userId = data.user.id

    // 2. Create the organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName, owner_id: userId, sub_admin_can_invite: true })
      .select()
      .single()

    if (orgError || !org) {
      setMessage({ text: orgError?.message ?? 'Failed to create organization', type: 'error' })
      setLoading(false)
      return
    }

    // 3. Create the admin profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId, name: fullName, role: 'Admin', org_id: org.id })

    if (profileError) {
      setMessage({ text: profileError.message, type: 'error' })
      setLoading(false)
      return
    }

    setMessage({ text: 'Organization created! Check your email to confirm your account.', type: 'success' })
    setLoading(false)
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setMessage({ text: error.message, type: 'error' })
    else setMessage({ text: 'Check your email for a password reset link.', type: 'success' })
    setLoading(false)
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
          {/* LOGIN */}
          {mode === 'login' && (
            <>
              <CardHeader>
                <CardTitle className="text-white">Sign In</CardTitle>
                <CardDescription className="text-zinc-400">Welcome back</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-zinc-300">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-zinc-300">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    />
                  </div>

                  {message && (
                    <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                      {message.text}
                    </p>
                  )}

                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>

                  <Button
                    variant="link"
                    className="w-full text-zinc-400 hover:text-white"
                    type="button"
                    onClick={() => { setMode('forgot-password'); setMessage(null) }}
                  >
                    Forgot password?
                  </Button>
                </form>

                <div className="mt-4 pt-4 border-t border-zinc-800 text-center text-sm text-zinc-500">
                  Starting a new company on Ridgeline?{' '}
                  <button
                    onClick={() => { setMode('create-org'); setMessage(null) }}
                    className="text-amber-500 hover:text-amber-400 font-medium"
                  >
                    Create your organization
                  </button>
                </div>
              </CardContent>
            </>
          )}

          {/* CREATE ORGANIZATION */}
          {mode === 'create-org' && (
            <>
              <CardHeader>
                <CardTitle className="text-white">Create Your Organization</CardTitle>
                <CardDescription className="text-zinc-400">
                  You'll be the Admin. Invite your team from the app.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateOrg} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="orgName" className="text-zinc-300">Company Name</Label>
                    <Input
                      id="orgName"
                      type="text"
                      placeholder="Acme Roofing"
                      value={orgName}
                      onChange={e => setOrgName(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
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
                    <Label htmlFor="email2" className="text-zinc-300">Email</Label>
                    <Input
                      id="email2"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password2" className="text-zinc-300">Password</Label>
                    <Input
                      id="password2"
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
                    {loading ? 'Creating...' : 'Create Organization'}
                  </Button>
                </form>

                <div className="mt-4 text-center text-sm text-zinc-400">
                  Already have an account?{' '}
                  <button
                    onClick={() => { setMode('login'); setMessage(null) }}
                    className="text-amber-500 hover:text-amber-400 font-medium"
                  >
                    Sign In
                  </button>
                </div>
              </CardContent>
            </>
          )}

          {/* FORGOT PASSWORD */}
          {mode === 'forgot-password' && (
            <>
              <CardHeader>
                <CardTitle className="text-white">Reset Password</CardTitle>
                <CardDescription className="text-zinc-400">
                  Enter your email and we'll send you a reset link.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-zinc-300">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    />
                  </div>

                  {message && (
                    <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                      {message.text}
                    </p>
                  )}

                  <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white" disabled={loading}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>

                <div className="mt-4 text-center text-sm text-zinc-400">
                  <button
                    onClick={() => { setMode('login'); setMessage(null) }}
                    className="text-amber-500 hover:text-amber-400 font-medium"
                  >
                    Back to Sign In
                  </button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
