import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export type MediaCategory = 'before' | 'during' | 'damage' | 'after'
export type MediaType = 'photo' | 'video'

export type JobMedia = {
  id: string
  jobId: string
  orgId: string
  uploaderId: string | null
  url: string
  storagePath: string
  type: MediaType
  category: MediaCategory
  createdAt: string
}

function toJobMedia(row: Record<string, unknown>): JobMedia {
  return {
    id: row.id as string,
    jobId: row.job_id as string,
    orgId: row.org_id as string,
    uploaderId: (row.uploader_id as string) ?? null,
    url: row.url as string,
    storagePath: row.storage_path as string,
    type: row.type as MediaType,
    category: row.category as MediaCategory,
    createdAt: row.created_at as string,
  }
}

export function useJobMedia(jobId: string | null) {
  const { user } = useAuth()
  const [media, setMedia] = useState<JobMedia[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!jobId) { setMedia([]); return }
    setLoading(true)
    supabase
      .from('job_media')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMedia(data.map(toJobMedia))
        setLoading(false)
      })
  }, [jobId])

  const uploadMedia = useCallback(async (files: FileList, category: MediaCategory) => {
    if (!jobId || !user?.org_id || !user?.id) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const storagePath = `${user.org_id}/${jobId}/${category}/${Date.now()}-${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('job-media')
        .upload(storagePath, file, { upsert: false })
      if (uploadError) continue
      const { data: { publicUrl } } = supabase.storage.from('job-media').getPublicUrl(storagePath)
      const type: MediaType = file.type.startsWith('video/') ? 'video' : 'photo'
      const { data, error } = await supabase
        .from('job_media')
        .insert({
          job_id: jobId,
          org_id: user.org_id,
          uploader_id: user.id,
          url: publicUrl,
          storage_path: storagePath,
          type,
          category,
        })
        .select()
        .single()
      if (data && !error) setMedia(prev => [...prev, toJobMedia(data)])
    }
    setUploading(false)
  }, [jobId, user])

  const deleteMedia = useCallback(async (item: JobMedia) => {
    await supabase.storage.from('job-media').remove([item.storagePath])
    const { error } = await supabase.from('job_media').delete().eq('id', item.id)
    if (!error) setMedia(prev => prev.filter(m => m.id !== item.id))
  }, [])

  return { media, loading, uploading, uploadMedia, deleteMedia }
}
