import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'signup' | 'forgot-password'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null)

  function switchMode(m: Mode) {
    setMode(m)
    setMessage(null)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage({ text: error.message, type: 'error' })
    setLoading(false)
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage({ text: error.message, type: 'error' })
    } else {
      setMessage({ text: 'Check your email to confirm your account, then come back to sign in.', type: 'success' })
    }
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

        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">Nexus</h1>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">

          {/* SIGN IN */}
          {mode === 'login' && (
            <>
              <CardHeader>
                <CardTitle className="text-white">Sign In</CardTitle>
                <CardDescription className="text-zinc-400">Welcome back</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Email</Label>
                    <Input type="email" placeholder="you@example.com" value={email}
                      onChange={e => setEmail(e.target.value)} required
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Password</Label>
                    <Input type="password" placeholder="••••••••" value={password}
                      onChange={e => setPassword(e.target.value)} required
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                  </div>

                  {message && (
                    <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {message.text}
                    </p>
                  )}

                  <Button type="submit" className="w-full bg-stone-500 hover:bg-stone-400 text-white" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign In'}
                  </Button>

                  <button type="button" onClick={() => switchMode('forgot-password')}
                    className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                    Forgot password?
                  </button>
                </form>

                <div className="mt-5 pt-5 border-t border-zinc-800 text-center text-sm text-zinc-500">
                  New to Nexus?{' '}
                  <button onClick={() => switchMode('signup')}
                    className="text-stone-400 hover:text-stone-300 font-medium transition-colors">
                    Create your company
                  </button>
                </div>
              </CardContent>
            </>
          )}

          {/* SIGN UP */}
          {mode === 'signup' && (
            <>
              <CardHeader>
                <CardTitle className="text-white">Create Your Account</CardTitle>
                <CardDescription className="text-zinc-400">
                  You'll set up your company after confirming your email.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Email</Label>
                    <Input type="email" placeholder="you@example.com" value={email}
                      onChange={e => setEmail(e.target.value)} required
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Password</Label>
                    <Input type="password" placeholder="Min. 6 characters" value={password}
                      onChange={e => setPassword(e.target.value)} required minLength={6}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                  </div>

                  {message && (
                    <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {message.text}
                    </p>
                  )}

                  {!message && (
                    <Button type="submit" className="w-full bg-stone-500 hover:bg-stone-400 text-white" disabled={loading}>
                      {loading ? 'Creating account…' : 'Create Account'}
                    </Button>
                  )}
                </form>

                <div className="mt-5 pt-5 border-t border-zinc-800 text-center text-sm text-zinc-500">
                  Already have an account?{' '}
                  <button onClick={() => switchMode('login')}
                    className="text-stone-400 hover:text-stone-300 font-medium transition-colors">
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
                  We'll send a reset link to your email.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Email</Label>
                    <Input type="email" placeholder="you@example.com" value={email}
                      onChange={e => setEmail(e.target.value)} required
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                  </div>

                  {message && (
                    <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {message.text}
                    </p>
                  )}

                  {!message && (
                    <Button type="submit" className="w-full bg-stone-500 hover:bg-stone-400 text-white" disabled={loading}>
                      {loading ? 'Sending…' : 'Send Reset Link'}
                    </Button>
                  )}
                </form>

                <div className="mt-5 text-center">
                  <button onClick={() => switchMode('login')}
                    className="text-sm text-stone-400 hover:text-stone-300 transition-colors">
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
