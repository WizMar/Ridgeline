import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

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
      .select('id, org_id, sender_id, content, created_at, channel_id, profiles(name)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (target === 'org') {
      query = query.eq('org_id', user.org_id).is('channel_id', null)
    } else {
      query = query.eq('channel_id', target)
    }

    query.then(({ data }) => {
      if (data) {
        const rows = data.map(r => toMessage({
          ...r,
          sender_name: (r.profiles as unknown as { name: string } | null)?.name ?? 'Unknown',
        })).reverse()
        setMessages(rows)
        setHasMore(data.length === PAGE_SIZE)
        if (rows.length > 0) oldestRef.current = rows[0].createdAt
      }
      setLoading(false)
    })

    const filter = target === 'org'
      ? `org_id=eq.${user.org_id}`
      : `channel_id=eq.${target}`

    const channel = supabase
      .channel(`msgs:${target}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter,
      }, async payload => {
        if (targetRef.current !== target) return
        const row = payload.new as Record<string, unknown>
        if (target === 'org' && row.channel_id !== null) return
        const { data } = await supabase.from('profiles').select('name').eq('id', row.sender_id).single()
        const msg = toMessage({ ...row, sender_name: data?.name ?? 'Unknown' })
        setMessages(prev => [...prev, msg])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, user?.org_id])

  const loadOlder = useCallback(async () => {
    if (!user?.org_id || !oldestRef.current || !target) return

    let query = supabase
      .from('messages')
      .select('id, org_id, sender_id, content, created_at, channel_id, profiles(name)')
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
      const rows = data.map(r => toMessage({
        ...r,
        sender_name: (r.profiles as unknown as { name: string } | null)?.name ?? 'Unknown',
      })).reverse()
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
    const { error } = await supabase.from('messages').insert({
      org_id: user.org_id,
      sender_id: user.id,
      content: content.trim(),
      channel_id: target === 'org' ? null : target,
    })
    setSending(false)
    return !error
  }, [user, target])

  return { messages, loading, sending, hasMore, loadOlder, sendMessage }
}
