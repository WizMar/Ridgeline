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
}

const PAGE_SIZE = 40

function toMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    senderId: row.sender_id as string,
    senderName: (row.sender_name as string) ?? 'Unknown',
    content: row.content as string,
    createdAt: row.created_at as string,
  }
}

export function useMessages() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const oldestRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user?.org_id) { setLoading(false); return }

    supabase
      .from('messages')
      .select('id, org_id, sender_id, content, created_at, profiles(name)')
      .eq('org_id', user.org_id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data }) => {
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

    const channel = supabase
      .channel(`messages:${user.org_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `org_id=eq.${user.org_id}`,
      }, async payload => {
        const row = payload.new as Record<string, unknown>
        const { data } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', row.sender_id)
          .single()
        const msg = toMessage({ ...row, sender_name: data?.name ?? 'Unknown' })
        setMessages(prev => [...prev, msg])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.org_id])

  const loadOlder = useCallback(async () => {
    if (!user?.org_id || !oldestRef.current) return
    const { data } = await supabase
      .from('messages')
      .select('id, org_id, sender_id, content, created_at, profiles(name)')
      .eq('org_id', user.org_id)
      .lt('created_at', oldestRef.current)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
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
  }, [user?.org_id])

  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!user?.org_id || !user?.id || !content.trim()) return false
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      org_id: user.org_id,
      sender_id: user.id,
      content: content.trim(),
    })
    setSending(false)
    return !error
  }, [user])

  return { messages, loading, sending, hasMore, loadOlder, sendMessage }
}
