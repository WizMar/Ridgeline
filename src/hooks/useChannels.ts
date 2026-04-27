import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'

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

  useEffect(() => {
    if (!user?.org_id || !user?.id) { setLoading(false); return }

    async function load() {
      const { data: memberships } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user!.id)

      if (!memberships || memberships.length === 0) { setChannels([]); setLoading(false); return }

      const ids = memberships.map(m => m.channel_id as string)

      const [{ data: chData }, { data: memData }] = await Promise.all([
        supabase.from('channels').select('*').in('id', ids).eq('org_id', user!.org_id!).order('created_at'),
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

    load()
  }, [user?.org_id, user?.id])

  const findOrCreateDM = useCallback(async (otherUserId: string): Promise<Channel | null> => {
    if (!user?.org_id || !user?.id) {
      toast.error('Session missing org — try signing out and back in')
      return null
    }

    // Return existing DM if one already exists
    const existing = channels.find(c =>
      c.type === 'dm' &&
      c.members.some(m => m.userId === otherUserId) &&
      c.members.some(m => m.userId === user.id)
    )
    if (existing) return existing

    // Generate ID client-side so we don't need to read back after insert
    const channelId = crypto.randomUUID()
    const now = new Date().toISOString()

    const { error: chErr } = await supabase
      .from('channels')
      .insert({ id: channelId, org_id: user.org_id, type: 'dm', created_by: user.id, created_at: now })
    if (chErr) { toast.error(`Failed to create DM: ${chErr.message}`); return null }

    // Insert both members
    const { error: memErr } = await supabase.from('channel_members').insert([
      { channel_id: channelId, user_id: user.id },
      { channel_id: channelId, user_id: otherUserId },
    ])
    if (memErr) { toast.error(`Failed to add members: ${memErr.message}`); return null }

    // Fetch other user's name
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', otherUserId).single()

    const newChannel: Channel = {
      id: channelId,
      orgId: user.org_id,
      type: 'dm',
      name: null,
      members: [
        { userId: user.id, name: user.name },
        { userId: otherUserId, name: (profile?.name as string) ?? 'Unknown' },
      ],
      createdAt: now,
    }
    setChannels(prev => [...prev, newChannel])
    return newChannel
  }, [channels, user])

  const createGroup = useCallback(async (name: string | null, memberIds: string[]): Promise<Channel | null> => {
    if (!user?.org_id || !user?.id) {
      toast.error('Session missing org — try signing out and back in')
      return null
    }

    const channelId = crypto.randomUUID()
    const now = new Date().toISOString()
    const trimmedName = name?.trim() || null

    const { error: chErr } = await supabase
      .from('channels')
      .insert({ id: channelId, org_id: user.org_id, type: 'group', name: trimmedName, created_by: user.id, created_at: now })
    if (chErr) { toast.error(`Failed to create group: ${chErr.message}`); return null }

    const allIds = Array.from(new Set([user.id, ...memberIds]))
    const { error: memErr } = await supabase.from('channel_members').insert(
      allIds.map(uid => ({ channel_id: channelId, user_id: uid }))
    )
    if (memErr) { toast.error(`Failed to add members: ${memErr.message}`); return null }

    // Fetch member names
    const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', allIds)
    const members: ChannelMember[] = (profiles ?? []).map(p => ({
      userId: p.id as string,
      name: (p.name as string) ?? 'Unknown',
    }))

    const newChannel: Channel = {
      id: channelId,
      orgId: user.org_id,
      type: 'group',
      name: trimmedName,
      members,
      createdAt: now,
    }
    setChannels(prev => [...prev, newChannel])
    return newChannel
  }, [user])

  return { channels, loading, findOrCreateDM, createGroup }
}
