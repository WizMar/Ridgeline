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

export type OrgMember = {
  userId: string   // = auth.users.id = profiles.id
  name: string
  role: string
}

export function useChannels() {
  const { user } = useAuth()
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])

  useEffect(() => {
    if (!user?.org_id || !user?.id) { setLoading(false); return }

    supabase.rpc('get_org_members').then(({ data }) => {
      if (data) setOrgMembers(data.map((p: { id: string; name: string; role: string }) => ({
        userId: p.id,
        name: p.name ?? 'Unknown',
        role: p.role ?? '',
      })))
    })

    async function load() {
      const { data: memberships } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user!.id)

      if (!memberships || memberships.length === 0) { setChannels([]); setLoading(false); return }

      const ids = memberships.map(m => m.channel_id as string)

      const [{ data: chData }, { data: memData }] = await Promise.all([
        supabase.from('channels').select('*').in('id', ids).eq('org_id', user!.org_id!).order('created_at'),
        supabase.from('channel_members').select('channel_id, user_id').in('channel_id', ids),
      ])

      if (!chData) { setLoading(false); return }

      // Fetch profile names separately — profiles(name) join won't work because
      // channel_members.user_id FK points to auth.users, not profiles directly.
      const userIds = [...new Set((memData ?? []).map(m => m.user_id as string))]
      const { data: profileRows } = userIds.length > 0
        ? await supabase.from('profiles').select('id, name').in('id', userIds)
        : { data: [] as { id: string; name: string }[] }

      const nameByUser: Record<string, string> = {}
      for (const p of profileRows ?? []) {
        nameByUser[p.id as string] = (p.name as string) ?? 'Unknown'
      }

      const membersByChannel: Record<string, ChannelMember[]> = {}
      for (const m of memData ?? []) {
        const cid = m.channel_id as string
        if (!membersByChannel[cid]) membersByChannel[cid] = []
        membersByChannel[cid].push({
          userId: m.user_id as string,
          name: nameByUser[m.user_id as string] ?? 'Unknown',
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
    if (!user?.id) { toast.error('Not logged in'); return null }
    let orgId = user.org_id
    if (!orgId) {
      const { data } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      orgId = (data?.org_id as string) ?? null
    }
    if (!orgId) { toast.error('Missing organization — contact your admin'); return null }

    // Return existing DM if one already exists
    const existing = channels.find(c =>
      c.type === 'dm' &&
      c.members.some(m => m.userId === otherUserId) &&
      c.members.some(m => m.userId === user.id)
    )
    if (existing) return existing

    const channelId = crypto.randomUUID()
    const now = new Date().toISOString()

    const { error } = await supabase.rpc('create_dm_channel', {
      p_channel_id: channelId,
      p_org_id: orgId,
      p_user_id: user.id,
      p_other_user_id: otherUserId,
    })
    if (error) { toast.error(`Failed to create DM: ${error.message}`); return null }

    // Fetch other user's name
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', otherUserId).single()

    const newChannel: Channel = {
      id: channelId,
      orgId: orgId,
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
    if (!user?.id) { toast.error('Not logged in'); return null }
    let orgId = user.org_id
    if (!orgId) {
      const { data } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      orgId = (data?.org_id as string) ?? null
    }
    if (!orgId) { toast.error('Missing organization — contact your admin'); return null }

    const channelId = crypto.randomUUID()
    const now = new Date().toISOString()
    const trimmedName = name?.trim() || null
    const allIds = Array.from(new Set([user.id, ...memberIds]))

    const { error } = await supabase.rpc('create_group_channel', {
      p_channel_id: channelId,
      p_org_id: orgId,
      p_name: trimmedName,
      p_created_by: user.id,
      p_member_ids: allIds,
    })
    if (error) { toast.error(`Failed to create group: ${error.message}`); return null }

    // Fetch member names
    const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', allIds)
    const members: ChannelMember[] = (profiles ?? []).map(p => ({
      userId: p.id as string,
      name: (p.name as string) ?? 'Unknown',
    }))

    const newChannel: Channel = {
      id: channelId,
      orgId: orgId,
      type: 'group',
      name: trimmedName,
      members,
      createdAt: now,
    }
    setChannels(prev => [...prev, newChannel])
    return newChannel
  }, [user])

  const deleteChannel = useCallback(async (channelId: string): Promise<boolean> => {
    const { error } = await supabase.from('channels').delete().eq('id', channelId)
    if (!error) {
      setChannels(prev => prev.filter(c => c.id !== channelId))
    } else {
      toast.error('Failed to delete conversation')
    }
    return !error
  }, [])

  return { channels, loading, orgMembers, findOrCreateDM, createGroup, deleteChannel }
}
