import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '@/context/ClientsContext'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Folder, ChevronRight, Phone, Mail } from 'lucide-react'
import { toast } from 'sonner'

export default function ClientsPage() {
  const { clients, properties, loading, addClient } = useClients()
  const { can } = useAuth()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', phone: '', email: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const filtered = clients.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  function openNew() {
    setDraft({ name: '', phone: '', email: '', notes: '' })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!draft.name.trim()) return
    setSaving(true)
    const client = await addClient(draft)
    setSaving(false)
    if (client) {
      toast.success(`${client.name} added`)
      setDialogOpen(false)
      navigate(`/clients/${client.id}`)
    } else {
      toast.error('Failed to add client')
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white">Clients</h2>
          <p className="hidden md:block text-zinc-400 text-sm mt-1">Every customer and property your org has worked on.</p>
        </div>
        {can('create:clients') && (
          <Button onClick={openNew} className="bg-stone-500 hover:bg-stone-400 text-white">
            + New Client
          </Button>
        )}
      </div>

      <Input
        placeholder="Search by name, phone, or email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 max-w-md"
      />

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <Folder className="w-10 h-10 text-zinc-600" strokeWidth={1.5} />
            <p className="text-zinc-500 text-sm">
              {clients.length === 0 ? 'No clients yet.' : 'No clients match your search.'}
            </p>
            {clients.length === 0 && can('create:clients') && (
              <Button onClick={openNew} className="bg-stone-500 hover:bg-stone-400 text-white mt-1">
                + Add First Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(client => {
            const propCount = properties.filter(p => p.clientId === client.id).length
            return (
              <button
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-left hover:border-zinc-600 hover:bg-zinc-800/60 transition-colors group"
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="font-semibold text-white text-sm leading-tight line-clamp-1">{client.name}</p>
                  <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0 mt-0.5" />
                </div>
                <div className="mt-1.5 space-y-1">
                  {client.phone && (
                    <div className="flex items-center gap-1 text-zinc-400 text-xs">
                      <Phone size={10} />
                      <span className="truncate">{client.phone}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-1 text-zinc-400 text-xs">
                      <Mail size={10} />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-800">
                  <span className="text-zinc-500 text-xs">
                    {propCount} {propCount === 1 ? 'property' : 'properties'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Full Name *</Label>
              <Input
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="Jane Smith"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Phone</Label>
                <Input
                  value={draft.phone}
                  onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                  placeholder="(555) 000-0000"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Email</Label>
                <Input
                  value={draft.email}
                  onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                  placeholder="jane@email.com"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Notes</Label>
              <textarea
                value={draft.notes}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                rows={2}
                placeholder="Anything useful to remember about this client…"
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" className="text-zinc-400 hover:text-white" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-stone-500 hover:bg-stone-400 text-white"
              onClick={handleSave}
              disabled={!draft.name.trim() || saving}
            >
              {saving ? 'Saving…' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
