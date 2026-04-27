export type PropertyType = 'residential' | 'commercial' | 'industrial'

export const PROPERTY_TYPES: PropertyType[] = ['residential', 'commercial', 'industrial']

export const PROPERTY_TYPE_BADGE: Record<PropertyType, string> = {
  residential: 'bg-stone-800/60 text-stone-300',
  commercial:  'bg-blue-900/60 text-blue-300',
  industrial:  'bg-amber-900/60 text-amber-300',
}

export type Client = {
  id: string
  orgId: string
  name: string
  phone: string
  email: string
  notes: string
  createdAt: string
}

export type Property = {
  id: string
  clientId: string
  orgId: string
  address: string
  type: PropertyType
  notes: string
  createdAt: string
}
