import { useState, useEffect, useRef } from 'react'
import { useMessages, type MessageTarget } from '@/hooks/useMessages'
import { useChannels, type Channel } from '@/hooks/useChannels'
import { useAuth } from '@/context/AuthContext'
import { useEmployees } from '@/context/EmployeeContext'
import { Send, MessageSquare, Plus, Users, X, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const label = isToday ? 'Today'
    : isYesterday ? 'Yesterday'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  return { label, time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
}

function dmName(channel: Channel, myId: string) {
  return channel.members.find(m => m.userId !== myId)?.name ?? 'Unknown'
}

type NewModal = { type: 'dm' } | { type: 'group' }

function MessageThread({ target, myId }: { target: MessageTarget; myId: string }) {
  const { messages, loading, sending, hasMore, loadOlder, sendMessage } = useMessages(target)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)

  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      const prev = prevLenRef.current
      prevLenRef.current = messages.length
      if (prev === 0 || messages[messages.length - 1]?.senderId === myId) {
        bottomRef.current?.scrollIntoView({ behavior: prev === 0 ? 'instant' : 'smooth' })
      }
    }
  }, [messages, myId])

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    await sendMessage(text)
  }

  const grouped: { dateLabel: string; msgs: typeof messages }[] = []
  for (const msg of messages) {
    const { label } = formatTime(msg.createdAt)
    const last = grouped[grouped.length - 1]
    if (last?.dateLabel === label) last.msgs.push(msg)
    else grouped.push({ dateLabel: label, msgs: [msg] })
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto py-4 space-y-1 min-h-0 px-4">
        {loading ? (
          <p className="text-zinc-500 text-sm text-center py-8">Loading…</p>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center pb-2">
                <button onClick={loadOlder} className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded-full px-4 py-1.5 transition-colors">
                  Load older
                </button>
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center pt-20">
                <MessageSquare size={32} className="text-zinc-700" strokeWidth={1.5} />
                <p className="text-zinc-500 text-sm">No messages yet. Say something!</p>
              </div>
            )}
            {grouped.map(({ dateLabel, msgs }) => (
              <div key={dateLabel}>
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-zinc-600 text-xs shrink-0">{dateLabel}</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>
                {msgs.map((msg, i) => {
                  const isMine = msg.senderId === myId
                  const prev = i > 0 ? msgs[i - 1] : null
                  const showSender = !isMine && (!prev || prev.senderId !== msg.senderId)
                  const { time } = formatTime(msg.createdAt)
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} px-1 mb-0.5`}>
                      <div className={`max-w-[75%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                        {showSender && <p className="text-zinc-500 text-xs ml-1 mb-0.5">{msg.senderName}</p>}
                        <div className={`group relative px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                          isMine ? 'bg-stone-600 text-white rounded-br-sm' : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
                        }`}>
                          {msg.content}
                          <span className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 text-[10px] whitespace-nowrap px-1">
                            {time}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="px-4 pb-4 pt-2 border-t border-zinc-800 shrink-0">
        <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 focus-within:border-stone-500 transition-colors">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            rows={1}
            placeholder="Message… (Enter to send)"
            className="flex-1 bg-transparent text-white text-sm placeholder:text-zinc-600 resize-none focus:outline-none max-h-32"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button onClick={handleSend} disabled={!draft.trim() || sending}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-stone-500 hover:bg-stone-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  const { user } = useAuth()
  const { channels, loading: chLoading, findOrCreateDM, createGroup } = useChannels()
  const { employees } = useEmployees()

  const [activeTarget, setActiveTarget] = useState<MessageTarget>('org')
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [showList, setShowList] = useState(true) // mobile: toggle panel
  const [modal, setModal] = useState<NewModal | null>(null)
  const [groupName, setGroupName] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const myId = user?.id ?? ''
  const dms = channels.filter(c => c.type === 'dm')
  const groups = channels.filter(c => c.type === 'group')

  const orgMembers = employees.filter(e => e.status === 'Active' && e.id !== myId)

  function selectTarget(target: MessageTarget, channel: Channel | null = null) {
    setActiveTarget(target)
    setActiveChannel(channel)
    setShowList(false) // mobile: switch to thread view
  }

  async function handleStartDM(userId: string) {
    setCreating(true)
    setModal(null)
    const ch = await findOrCreateDM(userId)
    if (ch) {
      selectTarget(ch.id, ch)
    }
    setCreating(false)
  }

  async function handleCreateGroup() {
    if (!groupName.trim() || selectedUsers.length === 0) return
    setCreating(true)
    const ch = await createGroup(groupName, selectedUsers)
    setModal(null)
    setGroupName('')
    setSelectedUsers([])
    if (ch) selectTarget(ch.id, ch)
    setCreating(false)
  }

  function toggleUser(id: string) {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id])
  }

  const activeLabel = activeTarget === 'org'
    ? '# Team'
    : activeChannel?.type === 'dm'
    ? dmName(activeChannel, myId)
    : (activeChannel?.name ?? 'Group')

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -my-6 overflow-hidden">
      {/* Left panel — channel list */}
      <div className={`${showList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-64 border-r border-zinc-800 bg-zinc-950 shrink-0`}>
        <div className="px-4 py-4 border-b border-zinc-800">
          <p className="text-white font-semibold text-sm">Messages</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {/* Org-wide */}
          <div className="px-2 mb-1">
            <button onClick={() => selectTarget('org')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${activeTarget === 'org' ? 'bg-stone-500/20 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
              <MessageSquare size={14} className="shrink-0" />
              <span className="truncate">Team</span>
            </button>
          </div>

          {/* DMs */}
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center justify-between">
              <p className="text-zinc-600 text-xs font-medium uppercase tracking-widest">Direct</p>
              <button onClick={() => setModal({ type: 'dm' })} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                <Plus size={13} />
              </button>
            </div>
          </div>
          <div className="px-2 space-y-0.5">
            {chLoading ? <p className="text-zinc-600 text-xs px-3 py-1">Loading…</p> : null}
            {dms.map(ch => (
              <button key={ch.id} onClick={() => selectTarget(ch.id, ch)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${activeTarget === ch.id ? 'bg-stone-500/20 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
                <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-300 shrink-0">
                  {dmName(ch, myId).charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{dmName(ch, myId)}</span>
              </button>
            ))}
            {dms.length === 0 && !chLoading && (
              <p className="text-zinc-700 text-xs px-3 py-1">No DMs yet</p>
            )}
          </div>

          {/* Groups */}
          <div className="px-4 pt-4 pb-1">
            <div className="flex items-center justify-between">
              <p className="text-zinc-600 text-xs font-medium uppercase tracking-widest">Groups</p>
              <button onClick={() => { setModal({ type: 'group' }); setGroupName(''); setSelectedUsers([]) }} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                <Plus size={13} />
              </button>
            </div>
          </div>
          <div className="px-2 space-y-0.5">
            {groups.map(ch => (
              <button key={ch.id} onClick={() => selectTarget(ch.id, ch)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${activeTarget === ch.id ? 'bg-stone-500/20 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>
                <Users size={13} className="shrink-0 text-zinc-500" />
                <span className="truncate">{ch.name}</span>
                <span className="ml-auto text-zinc-600 text-xs">{ch.members.length}</span>
              </button>
            ))}
            {groups.length === 0 && !chLoading && (
              <p className="text-zinc-700 text-xs px-3 py-1">No groups yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Right panel — thread */}
      <div className={`${showList ? 'hidden' : 'flex'} md:flex flex-col flex-1 min-w-0`}>
        {/* Thread header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800 shrink-0">
          <button onClick={() => setShowList(true)} className="md:hidden text-zinc-400 hover:text-white">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">{activeLabel}</p>
            {activeChannel?.type === 'group' && (
              <p className="text-zinc-500 text-xs truncate">{activeChannel.members.map(m => m.name).join(', ')}</p>
            )}
          </div>
        </div>

        <MessageThread target={activeTarget} myId={myId} key={activeTarget} />
      </div>

      {/* New DM modal */}
      {modal?.type === 'dm' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <p className="text-white font-semibold">New Direct Message</p>
              <button onClick={() => setModal(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-1.5 max-h-72 overflow-y-auto">
              {orgMembers.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No other members in your org.</p>}
              {orgMembers.map(emp => (
                <button key={emp.id} onClick={() => handleStartDM(emp.id)} disabled={creating}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors text-left disabled:opacity-50">
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-300 shrink-0 font-medium">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm">{emp.name}</p>
                    <p className="text-zinc-500 text-xs">{emp.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Group modal */}
      {modal?.type === 'group' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <p className="text-white font-semibold">New Group Chat</p>
              <button onClick={() => setModal(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-4">
              <Input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Group name…"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
              <div className="space-y-1 max-h-52 overflow-y-auto">
                <p className="text-zinc-500 text-xs mb-2">Select members</p>
                {orgMembers.map(emp => (
                  <button key={emp.id} onClick={() => toggleUser(emp.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                      selectedUsers.includes(emp.id) ? 'bg-stone-500/20 border border-stone-500/40' : 'hover:bg-zinc-800 border border-transparent'
                    }`}>
                    <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-300 shrink-0">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-white text-sm flex-1">{emp.name}</p>
                    {selectedUsers.includes(emp.id) && <div className="w-2 h-2 rounded-full bg-stone-400 shrink-0" />}
                  </button>
                ))}
              </div>
              <Button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedUsers.length === 0 || creating}
                className="w-full bg-stone-500 hover:bg-stone-400 text-white">
                {creating ? 'Creating…' : `Create Group${selectedUsers.length > 0 ? ` (${selectedUsers.length + 1})` : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
