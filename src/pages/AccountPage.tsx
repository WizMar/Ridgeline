import { useState } from 'react'
import { Check, User, Globe, Monitor } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/context/AuthContext'
import { usePreferences, DATE_FORMATS } from '@/context/PreferencesContext'

const ROLE_COLORS: Record<string, string> = {
  Admin:       'bg-amber-600/20 text-amber-400',
  'Sub-Admin': 'bg-blue-600/20 text-blue-400',
  Lead:        'bg-purple-600/20 text-purple-400',
  Sales:       'bg-yellow-600/20 text-yellow-400',
  Employee:    'bg-zinc-600/20 text-zinc-400',
  Laborer:     'bg-zinc-700/20 text-zinc-500',
}

export default function AccountPage() {
  const { user } = useAuth()
  const { prefs, setPrefs, savePrefs } = usePreferences()
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await savePrefs()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function set<K extends keyof typeof prefs>(key: K, value: typeof prefs[K]) {
    setPrefs(p => ({ ...p, [key]: value }))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-white">
      <div>
        <h2 className="text-2xl font-bold text-white">My Account</h2>
        <p className="text-zinc-400 text-sm mt-1">Personal preferences and account settings.</p>
      </div>

      {/* Profile card */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-600/20 border border-amber-600/40 flex items-center justify-center">
              <User size={22} className="text-amber-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg leading-tight">{user?.name ?? '—'}</p>
              <p className="text-zinc-400 text-sm">{user?.email}</p>
            </div>
            <span className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[user?.role ?? ''] ?? 'bg-zinc-800 text-zinc-400'}`}>
              {user?.role}
            </span>
          </div>
        </CardHeader>
      </Card>

      {/* Language & Region */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-amber-400" />
            <CardTitle className="text-white text-base">Language & Region</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">Set your preferred language and date/time display.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            <div className="space-y-2">
              <label className="text-zinc-300 text-sm font-medium">Date Format</label>
              <Select value={prefs.dateFormat} onValueChange={v => set('dateFormat', v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  {DATE_FORMATS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-zinc-300 text-sm font-medium">Time Format</label>
              <Select value={prefs.timeFormat} onValueChange={v => set('timeFormat', v as '12h' | '24h')}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                  <SelectItem value="24h">24-hour (14:30)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-zinc-300 text-sm font-medium">First Day of Week</label>
              <Select value={String(prefs.startOfWeek)} onValueChange={v => set('startOfWeek', Number(v) as 0 | 1)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-amber-400" />
            <CardTitle className="text-white text-base">Display</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">Control how the app looks for you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between py-3 border-b border-zinc-800">
            <div>
              <p className="text-white text-sm font-medium">Dark Mode</p>
              <p className="text-zinc-500 text-xs mt-0.5">Use dark theme across the app.</p>
            </div>
            <Switch
              checked={prefs.theme === 'dark'}
              onCheckedChange={v => set('theme', v ? 'dark' : 'light')}
              className="data-[state=checked]:bg-amber-600"
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-white text-sm font-medium">Light Mode</p>
              <p className="text-zinc-500 text-xs mt-0.5">Coming soon — light theme is in progress.</p>
            </div>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">Soon</span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="bg-amber-600 hover:bg-amber-500 text-white">
        {saved ? <><Check size={14} className="mr-1.5" />Saved</> : 'Save Preferences'}
      </Button>
    </div>
  )
}
