import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { MaterialBrand, MaterialJobType, MaterialTemplate, MaterialTemplateItem } from '@/types/materialTemplates'

type ContextType = {
  brands: MaterialBrand[]
  jobTypes: MaterialJobType[]
  templates: MaterialTemplate[]
  loading: boolean
  addBrand: (name: string) => Promise<MaterialBrand | null>
  updateBrand: (id: string, name: string) => Promise<void>
  deleteBrand: (id: string) => Promise<void>
  addJobType: (name: string) => Promise<MaterialJobType | null>
  updateJobType: (id: string, name: string) => Promise<void>
  deleteJobType: (id: string) => Promise<void>
  addTemplate: (brandId: string, jobTypeId: string, name: string) => Promise<MaterialTemplate | null>
  deleteTemplate: (id: string) => Promise<void>
  addTemplateItem: (templateId: string, item: Omit<MaterialTemplateItem, 'id' | 'templateId' | 'createdAt'>) => Promise<void>
  updateTemplateItem: (item: MaterialTemplateItem) => Promise<void>
  deleteTemplateItem: (id: string, templateId: string) => Promise<void>
  templatesByBrandAndJobType: (brandId: string, jobTypeId: string) => MaterialTemplate[]
}

const Ctx = createContext<ContextType | null>(null)

function toBrand(row: Record<string, unknown>): MaterialBrand {
  return { id: row.id as string, orgId: row.org_id as string, name: row.name as string, createdAt: row.created_at as string }
}

function toJobType(row: Record<string, unknown>): MaterialJobType {
  return { id: row.id as string, orgId: row.org_id as string, name: row.name as string, createdAt: row.created_at as string }
}

function toItem(row: Record<string, unknown>): MaterialTemplateItem {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    unit: (row.unit as string) ?? 'ea',
    unitCost: (row.unit_cost as number) ?? 0,
    defaultQty: (row.default_qty as number) ?? 1,
    sortOrder: (row.sort_order as number) ?? 0,
    createdAt: row.created_at as string,
  }
}

function toTemplate(row: Record<string, unknown>, items: MaterialTemplateItem[]): MaterialTemplate {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    brandId: row.brand_id as string,
    jobTypeId: row.job_type_id as string,
    name: (row.name as string) ?? '',
    createdAt: row.created_at as string,
    items: items.filter(i => i.templateId === (row.id as string)).sort((a, b) => a.sortOrder - b.sortOrder),
  }
}

export function MaterialTemplatesProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [brands, setBrands] = useState<MaterialBrand[]>([])
  const [jobTypes, setJobTypes] = useState<MaterialJobType[]>([])
  const [templates, setTemplates] = useState<MaterialTemplate[]>([])
  const [allItems, setAllItems] = useState<MaterialTemplateItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user?.org_id) { setLoading(false); return }

    async function load() {
      const orgId = user!.org_id
      const [brandsRes, jobTypesRes, templatesRes, itemsRes] = await Promise.all([
        supabase.from('material_brands').select('*').eq('org_id', orgId).order('name'),
        supabase.from('material_job_types').select('*').eq('org_id', orgId).order('name'),
        supabase.from('material_templates').select('*').eq('org_id', orgId).order('created_at'),
        supabase.from('material_template_items').select('*').order('sort_order'),
      ])

      const items = (itemsRes.data ?? []).map(toItem)
      setAllItems(items)
      setBrands((brandsRes.data ?? []).map(toBrand))
      setJobTypes((jobTypesRes.data ?? []).map(toJobType))
      setTemplates((templatesRes.data ?? []).map(r => toTemplate(r, items)))
      setLoading(false)
    }

    load()
  }, [authLoading, user?.org_id])

  // Rebuild templates when items change
  useEffect(() => {
    setTemplates(prev => prev.map(t => ({ ...t, items: allItems.filter(i => i.templateId === t.id).sort((a, b) => a.sortOrder - b.sortOrder) })))
  }, [allItems])

  async function addBrand(name: string): Promise<MaterialBrand | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('material_brands').insert({ org_id: user.org_id, name }).select().single()
    if (error || !data) return null
    const brand = toBrand(data)
    setBrands(prev => [...prev, brand].sort((a, b) => a.name.localeCompare(b.name)))
    return brand
  }

  async function updateBrand(id: string, name: string) {
    await supabase.from('material_brands').update({ name }).eq('id', id)
    setBrands(prev => prev.map(b => b.id === id ? { ...b, name } : b).sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function deleteBrand(id: string) {
    await supabase.from('material_brands').delete().eq('id', id)
    setBrands(prev => prev.filter(b => b.id !== id))
    setTemplates(prev => prev.filter(t => t.brandId !== id))
  }

  async function addJobType(name: string): Promise<MaterialJobType | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('material_job_types').insert({ org_id: user.org_id, name }).select().single()
    if (error || !data) return null
    const jt = toJobType(data)
    setJobTypes(prev => [...prev, jt].sort((a, b) => a.name.localeCompare(b.name)))
    return jt
  }

  async function updateJobType(id: string, name: string) {
    await supabase.from('material_job_types').update({ name }).eq('id', id)
    setJobTypes(prev => prev.map(j => j.id === id ? { ...j, name } : j).sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function deleteJobType(id: string) {
    await supabase.from('material_job_types').delete().eq('id', id)
    setJobTypes(prev => prev.filter(j => j.id !== id))
    setTemplates(prev => prev.filter(t => t.jobTypeId !== id))
  }

  async function addTemplate(brandId: string, jobTypeId: string, name: string): Promise<MaterialTemplate | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('material_templates').insert({ org_id: user.org_id, brand_id: brandId, job_type_id: jobTypeId, name }).select().single()
    if (error || !data) return null
    const t = toTemplate(data, [])
    setTemplates(prev => [...prev, t])
    return t
  }

  async function deleteTemplate(id: string) {
    await supabase.from('material_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    setAllItems(prev => prev.filter(i => i.templateId !== id))
  }

  async function addTemplateItem(templateId: string, item: Omit<MaterialTemplateItem, 'id' | 'templateId' | 'createdAt'>) {
    const sortOrder = allItems.filter(i => i.templateId === templateId).length
    const { data, error } = await supabase.from('material_template_items').insert({
      template_id: templateId,
      name: item.name,
      description: item.description,
      unit: item.unit,
      unit_cost: item.unitCost,
      default_qty: item.defaultQty,
      sort_order: sortOrder,
    }).select().single()
    if (error || !data) return
    setAllItems(prev => [...prev, toItem(data)])
  }

  async function updateTemplateItem(item: MaterialTemplateItem) {
    await supabase.from('material_template_items').update({
      name: item.name,
      description: item.description,
      unit: item.unit,
      unit_cost: item.unitCost,
      default_qty: item.defaultQty,
      sort_order: item.sortOrder,
    }).eq('id', item.id)
    setAllItems(prev => prev.map(i => i.id === item.id ? item : i))
  }

  async function deleteTemplateItem(id: string, templateId: string) {
    await supabase.from('material_template_items').delete().eq('id', id)
    setAllItems(prev => {
      const remaining = prev.filter(i => i.id !== id)
      // Re-index sort order for remaining items in same template
      let order = 0
      return remaining.map(i => i.templateId === templateId ? { ...i, sortOrder: order++ } : i)
    })
  }

  const templatesByBrandAndJobType = useCallback((brandId: string, jobTypeId: string) =>
    templates.filter(t => t.brandId === brandId && t.jobTypeId === jobTypeId),
    [templates])

  return (
    <Ctx.Provider value={{
      brands, jobTypes, templates, loading,
      addBrand, updateBrand, deleteBrand,
      addJobType, updateJobType, deleteJobType,
      addTemplate, deleteTemplate,
      addTemplateItem, updateTemplateItem, deleteTemplateItem,
      templatesByBrandAndJobType,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useMaterialTemplates() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMaterialTemplates must be used inside MaterialTemplatesProvider')
  return ctx
}
