import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export type ChannelType = 'dm' | 'group'

export type ChannelMember = {
  userId: string
  name: string
}

export type Channel = {
  id: string
  orgId: string
  type: ChannelType
  name: string | null
  members: ChannelMember[]
  createdAt: string
}

export function useChannels() {
  const { user } = useAuth()
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchChannels(orgId: string, userId: string) {
    const { data: memberships } = await supabase
      .from('channel_members')
      .select('channel_id')
      .eq('user_id', userId)

    if (!memberships || memberships.length === 0) {
      setChannels([])
      setLoading(false)
      return
    }

    const ids = memberships.map(m => m.channel_id as string)

    const [{ data: chData }, { data: memData }] = await Promise.all([
      supabase.from('channels').select('*').in('id', ids).eq('org_id', orgId).order('created_at'),
      supabase.from('channel_members').select('channel_id, user_id, profiles(name)').in('channel_id', ids),
    ])

    if (!chData) { setLoading(false); return }

    const membersByChannel: Record<string, ChannelMember[]> = {}
    for (const m of memData ?? []) {
      const cid = m.channel_id as string
      if (!membersByChannel[cid]) membersByChannel[cid] = []
      membersByChannel[cid].push({
        userId: m.user_id as string,
        name: (m.profiles as unknown as { name: string } | null)?.name ?? 'Unknown',
      })
    }

    setChannels(chData.map(c => ({
      id: c.id as string,
      orgId: c.org_id as string,
      type: c.type as ChannelType,
      name: (c.name as string) ?? null,
      members: membersByChannel[c.id as string] ?? [],
      createdAt: c.created_at as string,
    })))
    setLoading(false)
  }

  useEffect(() => {
    if (!user?.org_id || !user?.id) { setLoading(false); return }
    fetchChannels(user.org_id, user.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.org_id, user?.id])

  const findOrCreateDM = useCallback(async (otherUserId: string): Promise<Channel | null> => {
    if (!user?.org_id || !user?.id) return null

    const existing = channels.find(c =>
      c.type === 'dm' &&
      c.members.length === 2 &&
      c.members.some(m => m.userId === otherUserId) &&
      c.members.some(m => m.userId === user.id)
    )
    if (existing) return existing

    const { data: ch, error } = await supabase.from('channels').insert({
      org_id: user.org_id,
      type: 'dm',
      name: null,
      created_by: user.id,
    }).select().single()

    if (error || !ch) return null

    await supabase.from('channel_members').insert([
      { channel_id: ch.id, user_id: user.id },
      { channel_id: ch.id, user_id: otherUserId },
    ])

    await fetchChannels(user.org_id, user.id)
    return channels.find(c => c.id === ch.id) ?? null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, user])

  const createGroup = useCallback(async (name: string, memberIds: string[]): Promise<Channel | null> => {
    if (!user?.org_id || !user?.id || !name.trim()) return null

    const { data: ch, error } = await supabase.from('channels').insert({
      org_id: user.org_id,
      type: 'group',
      name: name.trim(),
      created_by: user.id,
    }).select().single()

    if (error || !ch) return null

    const all = Array.from(new Set([user.id, ...memberIds]))
    await supabase.from('channel_members').insert(all.map(uid => ({ channel_id: ch.id, user_id: uid })))

    await fetchChannels(user.org_id, user.id)
    return channels.find(c => c.id === ch.id) ?? null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, user])

  return { channels, loading, findOrCreateDM, createGroup, refetch: () => user?.org_id && user?.id && fetchChannels(user.org_id, user.id) }
}
