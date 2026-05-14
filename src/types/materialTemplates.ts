export type MaterialBrand = {
  id: string
  orgId: string
  name: string
  createdAt: string
}

export type MaterialJobType = {
  id: string
  orgId: string
  name: string
  createdAt: string
}

export type MaterialTemplateItem = {
  id: string
  templateId: string
  name: string
  description: string
  unit: string
  unitCost: number
  defaultQty: number
  sortOrder: number
  createdAt: string
}

export type MaterialTemplate = {
  id: string
  orgId: string
  brandId: string
  jobTypeId: string
  name: string
  createdAt: string
  items: MaterialTemplateItem[]
}

export const MATERIAL_UNITS = ['ea', 'sqft', 'lft', 'sq', 'bundle', 'roll', 'sheet', 'bag', 'box', 'gal', 'lb', 'ton', 'yd', 'lot']
