import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Client, Property, PropertyType } from '@/types/client'

type ClientsContextType = {
  clients: Client[]
  properties: Property[]
  loading: boolean
  addClient: (data: Omit<Client, 'id' | 'orgId' | 'createdAt'>) => Promise<Client | null>
  updateClient: (client: Client) => Promise<void>
  deleteClient: (id: string) => Promise<void>
  addProperty: (data: { clientId: string; address: string; type: PropertyType; notes: string }) => Promise<Property | null>
  updateProperty: (property: Property) => Promise<void>
  deleteProperty: (id: string) => Promise<void>
}

const ClientsContext = createContext<ClientsContextType | null>(null)

function toClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: (row.name as string) ?? '',
    phone: (row.phone as string) ?? '',
    email: (row.email as string) ?? '',
    notes: (row.notes as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
  }
}

function toProperty(row: Record<string, unknown>): Property {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    orgId: row.org_id as string,
    address: (row.address as string) ?? '',
    type: (row.type as PropertyType) ?? 'residential',
    notes: (row.notes as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
  }
}

export function ClientsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.org_id) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      supabase.from('clients').select('*').eq('org_id', user.org_id).order('name'),
      supabase.from('properties').select('*').eq('org_id', user.org_id).order('created_at'),
    ]).then(([{ data: c }, { data: p }]) => {
      if (c) setClients(c.map(toClient))
      if (p) setProperties(p.map(toProperty))
      setLoading(false)
    })
  }, [user?.org_id])

  async function addClient(data: Omit<Client, 'id' | 'orgId' | 'createdAt'>): Promise<Client | null> {
    if (!user?.org_id) return null
    const { data: row, error } = await supabase
      .from('clients')
      .insert({ org_id: user.org_id, name: data.name, phone: data.phone, email: data.email, notes: data.notes })
      .select().single()
    if (error || !row) return null
    const client = toClient(row)
    setClients(prev => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)))
    return client
  }

  async function updateClient(client: Client) {
    const { error } = await supabase
      .from('clients')
      .update({ name: client.name, phone: client.phone, email: client.email, notes: client.notes })
      .eq('id', client.id)
    if (!error) setClients(prev => prev.map(c => c.id === client.id ? client : c))
  }

  async function deleteClient(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (!error) {
      setClients(prev => prev.filter(c => c.id !== id))
      setProperties(prev => prev.filter(p => p.clientId !== id))
    }
  }

  async function addProperty(data: { clientId: string; address: string; type: PropertyType; notes: string }): Promise<Property | null> {
    if (!user?.org_id) return null
    const { data: row, error } = await supabase
      .from('properties')
      .insert({ org_id: user.org_id, client_id: data.clientId, address: data.address, type: data.type, notes: data.notes })
      .select().single()
    if (error || !row) return null
    const property = toProperty(row)
    setProperties(prev => [...prev, property])
    return property
  }

  async function updateProperty(property: Property) {
    const { error } = await supabase
      .from('properties')
      .update({ address: property.address, type: property.type, notes: property.notes })
      .eq('id', property.id)
    if (!error) setProperties(prev => prev.map(p => p.id === property.id ? property : p))
  }

  async function deleteProperty(id: string) {
    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (!error) setProperties(prev => prev.filter(p => p.id !== id))
  }

  return (
    <ClientsContext.Provider value={{ clients, properties, loading, addClient, updateClient, deleteClient, addProperty, updateProperty, deleteProperty }}>
      {children}
    </ClientsContext.Provider>
  )
}

export function useClients() {
  const ctx = useContext(ClientsContext)
  if (!ctx) throw new Error('useClients must be used inside ClientsProvider')
  return ctx
}
