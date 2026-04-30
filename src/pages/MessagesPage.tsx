import { useState, useEffect, useRef } from 'react'
import { useMessages, type MessageTarget } from '@/hooks/useMessages'
import { useChannels, type Channel } from '@/hooks/useChannels'
import { useAuth } from '@/context/AuthContext'
import { Send, MessageSquare, Users, X, ChevronLeft, UserPlus, UsersRound, PanelLeftOpen, PanelLeftClose, Trash2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const AVATAR_PALETTE = [
  'bg-indigo-500', 'bg-violet-500', 'bg-teal-500', 'bg-orange-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

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
  const { messages, loading, sending, hasMore, loadOlder, sendMessage, deleteMessage } = useMessages(target)
  const [draft, setDraft] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLenRef = useRef(0)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function startLongPress(msgId: string) {
    longPressTimer.current = setTimeout(() => {
      setSelectedId(msgId)
      navigator.vibrate?.(50)
    }, 500)
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

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
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-zinc-600 text-xs shrink-0">{dateLabel}</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>
                {msgs.map((msg, i) => {
                  const isMine = msg.senderId === myId
                  const prev = i > 0 ? msgs[i - 1] : null
                  const next = i < msgs.length - 1 ? msgs[i + 1] : null
                  const showSender = !isMine && (!prev || prev.senderId !== msg.senderId)
                  const isLastInRun = !next || next.senderId !== msg.senderId
                  const { time } = formatTime(msg.createdAt)
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} px-1 ${isLastInRun ? 'mb-2' : 'mb-0.5'} group`}>
                      <div className={`max-w-[78%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                        {showSender && (
                          <p className="text-zinc-500 text-xs ml-1 mb-1 font-medium">{msg.senderName}</p>
                        )}
                        <div className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div
                            onTouchStart={() => isMine && startLongPress(msg.id)}
                            onTouchEnd={cancelLongPress}
                            onTouchMove={cancelLongPress}
                            onContextMenu={e => { if (isMine) { e.preventDefault(); setSelectedId(msg.id) } }}
                            className={`px-3.5 py-2 text-sm leading-relaxed select-none ${
                              isMine
                                ? 'bg-stone-600 text-white rounded-2xl rounded-br-sm'
                                : 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-bl-sm'
                            }`}
                          >
                            {msg.content}
                          </div>
                          {/* Desktop-only hover delete */}
                          {isMine && !msg.id.startsWith('temp-') && (
                            <button
                              onClick={() => { deleteMessage(msg.id); setSelectedId(null) }}
                              className="hidden md:flex shrink-0 p-1 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                              title="Delete message"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                        {isLastInRun && (
                          <p className="text-zinc-600 text-[10px] mt-1 mx-1">{time}</p>
                        )}
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
        <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-2.5 focus-within:border-stone-500 transition-colors">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            rows={1}
            placeholder="Message…"
            className="flex-1 bg-transparent text-white text-sm placeholder:text-zinc-600 resize-none focus:outline-none max-h-32"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button onClick={handleSend} disabled={!draft.trim() || sending}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-stone-500 hover:bg-stone-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <Send size={13} className="text-white ml-0.5" />
          </button>
        </div>
      </div>

      {/* Mobile long-press action sheet */}
      {selectedId && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setSelectedId(null)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 rounded-t-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mt-3 mb-2" />
            <button
              onClick={() => { deleteMessage(selectedId); setSelectedId(null) }}
              className="w-full flex items-center gap-3 px-6 py-4 text-red-400 active:bg-zinc-800 transition-colors text-sm font-medium"
            >
              <Trash2 size={16} />
              Delete Message
            </button>
            <div className="h-px bg-zinc-800 mx-6" />
            <button
              onClick={() => setSelectedId(null)}
              className="w-full px-6 py-4 text-zinc-400 active:bg-zinc-800 transition-colors text-sm font-medium pb-8"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MessagesPage() {
  const { user } = useAuth()
  const { channels, loading: chLoading, findOrCreateDM, createGroup, orgMembers, deleteChannel } = useChannels()

  const [activeTarget, setActiveTarget] = useState<MessageTarget>('org')
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [showList, setShowList] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [modal, setModal] = useState<NewModal | null>(null)
  const [groupName, setGroupName] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const channelLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelLongPressActivated = useRef(false)
  const channelTouchStart = useRef<{ x: number; y: number } | null>(null)

  function startChannelLongPress(e: React.TouchEvent, chId: string) {
    channelLongPressActivated.current = false
    channelTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    channelLongPressTimer.current = setTimeout(() => {
      channelLongPressActivated.current = true
      setSelectedChannelId(chId)
      navigator.vibrate?.(50)
    }, 500)
  }

  function handleChannelTouchMove(e: React.TouchEvent) {
    if (!channelTouchStart.current || !channelLongPressTimer.current) return
    const dx = Math.abs(e.touches[0].clientX - channelTouchStart.current.x)
    const dy = Math.abs(e.touches[0].clientY - channelTouchStart.current.y)
    // Only cancel if finger moved enough to be a scroll — ignore micro-tremors
    if (dx > 8 || dy > 8) {
      clearTimeout(channelLongPressTimer.current)
      channelLongPressTimer.current = null
    }
  }

  function handleChannelTouchEnd(e: React.TouchEvent) {
    if (channelLongPressTimer.current) {
      clearTimeout(channelLongPressTimer.current)
      channelLongPressTimer.current = null
    }
    if (channelLongPressActivated.current) {
      e.preventDefault()
      channelLongPressActivated.current = false
    }
  }

  async function handleDeleteChannel(chId: string) {
    setSelectedChannelId(null)
    const ok = await deleteChannel(chId)
    if (ok && activeTarget === chId) {
      setActiveTarget('org')
      setActiveChannel(null)
      setShowList(true)
    }
  }

  const myId = user?.id ?? ''
  const dms = channels.filter(c => c.type === 'dm')
  const groups = channels.filter(c => c.type === 'group')

  function selectTarget(target: MessageTarget, channel: Channel | null = null) {
    setActiveTarget(target)
    setActiveChannel(channel)
    setShowList(false)
  }

  async function handleStartDM(userId: string) {
    setCreating(true)
    const ch = await findOrCreateDM(userId)
    setCreating(false)
    if (ch) { setModal(null); selectTarget(ch.id, ch) }
  }

  async function handleCreateGroup() {
    if (selectedUsers.length === 0) return
    setCreating(true)
    const ch = await createGroup(groupName || null, selectedUsers)
    setCreating(false)
    if (ch) { setModal(null); setGroupName(''); setSelectedUsers([]); selectTarget(ch.id, ch) }
  }

  function toggleUser(id: string) {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id])
  }

  function groupLabel(ch: Channel) {
    return ch.name || ch.members.filter(m => m.userId !== myId).map(m => m.name).join(', ') || 'Group'
  }

  const activeLabel = activeTarget === 'org' ? 'General'
    : activeChannel?.type === 'dm' ? dmName(activeChannel, myId)
    : activeChannel ? groupLabel(activeChannel) : 'Group'

  const activeInitial = activeTarget === 'org' ? null
    : activeChannel?.type === 'dm' ? dmName(activeChannel, myId).charAt(0).toUpperCase()
    : activeChannel ? (groupLabel(activeChannel).charAt(0).toUpperCase()) : null

  const activeColor = activeChannel ? getAvatarColor(activeLabel) : 'bg-stone-600'

  return (
    <div className="flex h-[calc(100vh-6.5rem)] md:h-[calc(100vh-4rem)] -mx-4 -my-4 md:-mx-6 md:-my-6 overflow-hidden">

      {/* Left panel — conversations list */}
      <div className={`${showList ? 'flex' : 'hidden'} ${sidebarOpen ? 'md:flex' : 'md:hidden'} flex-col w-full md:w-72 border-r border-zinc-800 bg-zinc-950 shrink-0`}>

        {/* Header */}
        <div className="px-4 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <p className="text-white font-bold text-base">Messages</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setModal({ type: 'dm' })}
              title="New direct message"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <UserPlus size={15} />
            </button>
            <button
              onClick={() => { setModal({ type: 'group' }); setGroupName(''); setSelectedUsers([]) }}
              title="New group"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <UsersRound size={15} />
            </button>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">

          {/* Team */}
          <button
            onClick={() => selectTarget('org')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors ${activeTarget === 'org' ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}`}
          >
            <div className="w-11 h-11 rounded-full bg-stone-600 flex items-center justify-center shrink-0">
              <Users size={18} className="text-white" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-white text-sm font-semibold">General</p>
              <p className="text-zinc-500 text-xs truncate">Everyone in your org</p>
            </div>
          </button>

          {/* Divider */}
          {(dms.length > 0 || groups.length > 0) && (
            <div className="mx-4 my-1 h-px bg-zinc-800" />
          )}

          {/* DMs */}
          {chLoading && <p className="text-zinc-600 text-xs px-4 py-3">Loading…</p>}
          {dms.map(ch => {
            const name = dmName(ch, myId)
            const color = getAvatarColor(name)
            return (
              <div key={ch.id}
                className={`group/row flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer select-none ${activeTarget === ch.id ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}`}
                style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}
                onClick={() => { if (!channelLongPressActivated.current) selectTarget(ch.id, ch) }}
                onTouchStart={e => startChannelLongPress(e, ch.id)}
                onTouchEnd={handleChannelTouchEnd}
                onTouchMove={handleChannelTouchMove}
                onContextMenu={e => { e.preventDefault(); setSelectedChannelId(ch.id) }}
              >
                <div className={`w-11 h-11 rounded-full ${color} flex items-center justify-center text-white text-sm font-semibold shrink-0`}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{name}</p>
                  <p className="text-zinc-500 text-xs">Direct message</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setSelectedChannelId(ch.id) }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 active:text-zinc-300 transition-colors shrink-0"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            )
          })}

          {/* Groups */}
          {groups.map(ch => {
            const label = groupLabel(ch)
            const color = getAvatarColor(label)
            const memberNames = ch.members.filter(m => m.userId !== myId).map(m => m.name.split(' ')[0]).join(', ')
            return (
              <div key={ch.id}
                className={`group/row flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer select-none ${activeTarget === ch.id ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}`}
                style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}
                onClick={() => { if (!channelLongPressActivated.current) selectTarget(ch.id, ch) }}
                onTouchStart={e => startChannelLongPress(e, ch.id)}
                onTouchEnd={handleChannelTouchEnd}
                onTouchMove={handleChannelTouchMove}
                onContextMenu={e => { e.preventDefault(); setSelectedChannelId(ch.id) }}
              >
                <div className={`w-11 h-11 rounded-full ${color} flex items-center justify-center text-white text-sm font-semibold shrink-0`}>
                  {label.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{label}</p>
                  <p className="text-zinc-500 text-xs truncate">{memberNames || `${ch.members.length} members`}</p>
                </div>
                {/* Mobile: always-visible ··· button */}
                <button
                  onClick={e => { e.stopPropagation(); setSelectedChannelId(ch.id) }}
                  className="flex md:hidden w-7 h-7 items-center justify-center rounded-lg text-zinc-600 active:text-zinc-300 shrink-0"
                >
                  <MoreHorizontal size={16} />
                </button>
                {/* Desktop: hover trash */}
                <button
                  onClick={e => { e.stopPropagation(); setSelectedChannelId(ch.id) }}
                  className="hidden md:flex opacity-0 group-hover/row:opacity-100 w-7 h-7 items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                  title="Delete group"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}

          {!chLoading && dms.length === 0 && groups.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-zinc-600 text-sm">No conversations yet</p>
              <p className="text-zinc-700 text-xs mt-1">Start a DM or create a group</p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — thread */}
      <div className={`${showList ? 'hidden' : 'flex'} md:flex flex-col flex-1 min-w-0 bg-zinc-950`}>

        {/* Thread header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0 bg-zinc-950">
          <button onClick={() => setShowList(true)} className="md:hidden text-zinc-400 hover:text-white mr-1">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => setSidebarOpen(o => !o)} className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          {activeTarget === 'org' ? (
            <div className="w-9 h-9 rounded-full bg-stone-600 flex items-center justify-center shrink-0">
              <Users size={15} className="text-white" />
            </div>
          ) : (
            <div className={`w-9 h-9 rounded-full ${activeColor} flex items-center justify-center text-white text-sm font-semibold shrink-0`}>
              {activeInitial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{activeLabel}</p>
            {activeChannel?.type === 'group' && (
              <p className="text-zinc-500 text-xs truncate">
                {activeChannel.members.map(m => m.name.split(' ')[0]).join(', ')}
              </p>
            )}
            {activeTarget === 'org' && (
              <p className="text-zinc-500 text-xs">Org-wide channel</p>
            )}
          </div>
        </div>

        <MessageThread target={activeTarget} myId={myId} key={activeTarget} />
      </div>

      {/* New DM modal */}
      {modal?.type === 'dm' && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 pt-16">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <p className="text-white font-semibold">New Message</p>
              <button onClick={() => setModal(null)} className="text-zinc-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto">
              {orgMembers.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-6">No other members in your org.</p>
              )}
              {orgMembers.map(emp => (
                <button key={emp.userId} onClick={() => handleStartDM(emp.userId)} disabled={creating}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-800 transition-colors text-left disabled:opacity-50">
                  <div className={`w-10 h-10 rounded-full ${getAvatarColor(emp.name)} flex items-center justify-center text-sm font-semibold text-white shrink-0`}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{emp.name}</p>
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 pt-16">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <p className="text-white font-semibold">New Group</p>
              <button onClick={() => setModal(null)} className="text-zinc-500 hover:text-white w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <Input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Group name (optional)"
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 rounded-xl"
              />
              <div>
                <p className="text-zinc-400 text-xs font-medium mb-2">Add people</p>
                <div className="space-y-0.5 max-h-56 overflow-y-auto -mx-1">
                  {orgMembers.map(emp => (
                    <button key={emp.userId} onClick={() => toggleUser(emp.userId)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                        selectedUsers.includes(emp.userId) ? 'bg-stone-500/20' : 'hover:bg-zinc-800'
                      }`}>
                      <div className={`w-9 h-9 rounded-full ${getAvatarColor(emp.name)} flex items-center justify-center text-sm font-semibold text-white shrink-0`}>
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-white text-sm flex-1">{emp.name}</p>
                      {selectedUsers.includes(emp.userId) && (
                        <div className="w-5 h-5 rounded-full bg-stone-500 flex items-center justify-center shrink-0">
                          <span className="text-white text-[10px] font-bold">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={handleCreateGroup}
                disabled={selectedUsers.length === 0 || creating}
                className="w-full bg-stone-500 hover:bg-stone-400 text-white rounded-xl">
                {creating ? 'Creating…' : `Create Group${selectedUsers.length > 0 ? ` (${selectedUsers.length + 1})` : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Channel delete sheet — works on all screen sizes */}
      {selectedChannelId && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setSelectedChannelId(null)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 rounded-t-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mt-3 mb-2" />
            <button
              onClick={() => handleDeleteChannel(selectedChannelId)}
              className="w-full flex items-center gap-3 px-6 py-4 text-red-400 active:bg-zinc-800 hover:bg-zinc-800 transition-colors text-sm font-medium"
            >
              <Trash2 size={16} />
              Delete Conversation
            </button>
            <div className="h-px bg-zinc-800 mx-6" />
            <button
              onClick={() => setSelectedChannelId(null)}
              className="w-full px-6 py-4 text-zinc-400 active:bg-zinc-800 hover:bg-zinc-800 transition-colors text-sm font-medium pb-8"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
