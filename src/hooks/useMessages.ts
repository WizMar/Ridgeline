import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'

export type Message = {
  id: string
  orgId: string
  senderId: string
  senderName: string
  content: string
  createdAt: string
  channelId: string | null
}

export type MessageTarget = 'org' | string

const PAGE_SIZE = 40
const POLL_INTERVAL = 5000 // fallback poll every 5s if realtime drops

function toMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    orgId: (row.org_id as string) ?? '',
    senderId: row.sender_id as string,
    senderName: (row.sender_name as string) ?? 'Unknown',
    content: row.content as string,
    createdAt: row.created_at as string,
    channelId: (row.channel_id as string) ?? null,
  }
}

async function fetchWithNames(rows: Record<string, unknown>[]): Promise<Message[]> {
  if (rows.length === 0) return []
  const senderIds = [...new Set(rows.map(r => r.sender_id as string))]
  const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', senderIds)
  const nameById: Record<string, string> = {}
  for (const p of profiles ?? []) nameById[p.id as string] = (p.name as string) ?? 'Unknown'
  return rows.map(r => toMessage({ ...r, sender_name: nameById[r.sender_id as string] ?? 'Unknown' }))
}

export function useMessages(target: MessageTarget | null) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const oldestRef = useRef<string | null>(null)
  const newestRef = useRef<string | null>(null)
  const targetRef = useRef(target)
  const realtimeOkRef = useRef(false)
  targetRef.current = target

  useEffect(() => {
    if (!target || !user?.org_id) { setMessages([]); return }
    setLoading(true)
    setMessages([])
    oldestRef.current = null
    newestRef.current = null
    realtimeOkRef.current = false

    // ── Initial fetch ────────────────────────────────────────────────────────
    let query = supabase
      .from('messages')
      .select('id, org_id, sender_id, content, created_at, channel_id')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (target === 'org') {
      query = query.eq('org_id', user.org_id).is('channel_id', null)
    } else {
      query = query.eq('channel_id', target)
    }

    query.then(async ({ data }) => {
      if (data && data.length > 0) {
        const rows = await fetchWithNames(data as Record<string, unknown>[])
        const sorted = rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        setMessages(sorted)
        setHasMore(data.length === PAGE_SIZE)
        oldestRef.current = sorted[0].createdAt
        newestRef.current = sorted[sorted.length - 1].createdAt
      } else if (data) {
        setMessages([])
      }
      setLoading(false)
    })

    // ── Realtime subscription ────────────────────────────────────────────────
    const channel = supabase
      .channel(`msgs:${target}:${user.org_id}`)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
      }, payload => {
        const row = payload.old as Record<string, unknown>
        if (row?.id) setMessages(prev => prev.filter(m => m.id !== row.id))
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, async payload => {
        if (targetRef.current !== target) return
        const row = payload.new as Record<string, unknown>
        if (target === 'org') {
          if (row.channel_id !== null) return
          if (row.org_id !== user.org_id) return
        } else {
          if (row.channel_id !== target) return
        }
        const { data } = await supabase.from('profiles').select('name').eq('id', row.sender_id).single()
        const msg = toMessage({ ...row, sender_name: data?.name ?? 'Unknown' })
        if (newestRef.current === null || msg.createdAt > newestRef.current) {
          newestRef.current = msg.createdAt
        }
        setMessages(prev => {
          const tempIdx = prev.findIndex(m =>
            m.id.startsWith('temp-') && m.senderId === msg.senderId && m.content === msg.content
          )
          if (tempIdx !== -1) {
            const next = [...prev]
            next[tempIdx] = msg
            return next
          }
          // Deduplicate: ignore if already present
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      })
      .subscribe(status => {
        realtimeOkRef.current = status === 'SUBSCRIBED'
      })

    // ── Polling fallback ─────────────────────────────────────────────────────
    // Kicks in automatically when realtime is not SUBSCRIBED, ensuring
    // messages always appear within POLL_INTERVAL ms regardless of WS state.
    const poll = setInterval(async () => {
      if (realtimeOkRef.current || targetRef.current !== target) return
      if (!newestRef.current) return

      let q = supabase
        .from('messages')
        .select('id, org_id, sender_id, content, created_at, channel_id')
        .gt('created_at', newestRef.current)
        .order('created_at', { ascending: true })

      if (target === 'org') {
        q = q.eq('org_id', user.org_id).is('channel_id', null)
      } else {
        q = q.eq('channel_id', target)
      }

      const { data } = await q
      if (!data || data.length === 0) return
      const rows = await fetchWithNames(data as Record<string, unknown>[])
      if (rows.length === 0) return
      newestRef.current = rows[rows.length - 1].createdAt
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id))
        const fresh = rows.filter(m => !existingIds.has(m.id))
        if (fresh.length === 0) return prev
        // Replace any matching optimistic messages
        let next = [...prev]
        for (const msg of fresh) {
          const tempIdx = next.findIndex(m =>
            m.id.startsWith('temp-') && m.senderId === msg.senderId && m.content === msg.content
          )
          if (tempIdx !== -1) next[tempIdx] = msg
          else next = [...next, msg]
        }
        return next
      })
    }, POLL_INTERVAL)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, user?.org_id])

  const loadOlder = useCallback(async () => {
    if (!user?.org_id || !oldestRef.current || !target) return

    let query = supabase
      .from('messages')
      .select('id, org_id, sender_id, content, created_at, channel_id')
      .lt('created_at', oldestRef.current)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (target === 'org') {
      query = query.eq('org_id', user.org_id).is('channel_id', null)
    } else {
      query = query.eq('channel_id', target)
    }

    const { data } = await query
    if (data && data.length > 0) {
      const rows = await fetchWithNames(data as Record<string, unknown>[])
      const sorted = rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      setMessages(prev => [...sorted, ...prev])
      setHasMore(data.length === PAGE_SIZE)
      oldestRef.current = sorted[0].createdAt
    } else {
      setHasMore(false)
    }
  }, [user?.org_id, target])

  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!user?.org_id || !user?.id || !content.trim() || !target) return false
    setSending(true)

    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      orgId: user.org_id,
      senderId: user.id,
      senderName: user.name,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      channelId: target === 'org' ? null : target,
    }
    setMessages(prev => [...prev, optimistic])

    const { error } = await supabase.from('messages').insert({
      org_id: user.org_id,
      sender_id: user.id,
      content: content.trim(),
      channel_id: target === 'org' ? null : target,
    })
    setSending(false)
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      toast.error(`Failed to send: ${error.message}`)
      return false
    }
    return true
  }, [user, target])

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    setMessages(prev => prev.filter(m => m.id !== messageId))
    const { error, count } = await supabase
      .from('messages')
      .delete({ count: 'exact' })
      .eq('id', messageId)
      .eq('sender_id', user?.id ?? '')
    if (error || count === 0) {
      toast.error('Could not delete message — check permissions')
      return false
    }
    return true
  }, [user?.id])

  return { messages, loading, sending, hasMore, loadOlder, sendMessage, deleteMessage }
}
