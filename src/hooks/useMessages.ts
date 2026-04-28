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

// 'org' = org-wide (null channel_id), string = channel uuid
export type MessageTarget = 'org' | string

const PAGE_SIZE = 40

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

export function useMessages(target: MessageTarget | null) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const oldestRef = useRef<string | null>(null)
  const targetRef = useRef(target)
  targetRef.current = target

  useEffect(() => {
    if (!target || !user?.org_id) { setMessages([]); return }
    setLoading(true)
    setMessages([])
    oldestRef.current = null

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
        const senderIds = [...new Set(data.map(r => r.sender_id as string))]
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', senderIds)
        const nameById: Record<string, string> = {}
        for (const p of profiles ?? []) nameById[p.id as string] = (p.name as string) ?? 'Unknown'
        const rows = data.map(r => toMessage({ ...r, sender_name: nameById[r.sender_id as string] ?? 'Unknown' })).reverse()
        setMessages(rows)
        setHasMore(data.length === PAGE_SIZE)
        if (rows.length > 0) oldestRef.current = rows[0].createdAt
      } else if (data) {
        setMessages([])
      }
      setLoading(false)
    })

    const channel = supabase
      .channel(`msgs:${target}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, async payload => {
        if (targetRef.current !== target) return
        const row = payload.new as Record<string, unknown>
        // Filter client-side — server-side filter can silently fail with RLS
        if (target === 'org') {
          if (row.channel_id !== null) return
          if (row.org_id !== user.org_id) return
        } else {
          if (row.channel_id !== target) return
        }
        const { data } = await supabase.from('profiles').select('name').eq('id', row.sender_id).single()
        const msg = toMessage({ ...row, sender_name: data?.name ?? 'Unknown' })
        // Replace any matching optimistic message (same sender + content), else append
        setMessages(prev => {
          const tempIdx = prev.findIndex(m =>
            m.id.startsWith('temp-') && m.senderId === msg.senderId && m.content === msg.content
          )
          if (tempIdx !== -1) {
            const next = [...prev]
            next[tempIdx] = msg
            return next
          }
          return [...prev, msg]
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
      const senderIds = [...new Set(data.map(r => r.sender_id as string))]
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', senderIds)
      const nameById: Record<string, string> = {}
      for (const p of profiles ?? []) nameById[p.id as string] = (p.name as string) ?? 'Unknown'
      const rows = data.map(r => toMessage({ ...r, sender_name: nameById[r.sender_id as string] ?? 'Unknown' })).reverse()
      setMessages(prev => [...rows, ...prev])
      setHasMore(data.length === PAGE_SIZE)
      oldestRef.current = rows[0].createdAt
    } else {
      setHasMore(false)
    }
  }, [user?.org_id, target])

  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!user?.org_id || !user?.id || !content.trim() || !target) return false
    setSending(true)

    // Optimistic update — show message immediately without waiting for Realtime
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

  return { messages, loading, sending, hasMore, loadOlder, sendMessage }
}
