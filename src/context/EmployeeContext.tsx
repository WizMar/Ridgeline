import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { type Employee } from '@/types/employee'

type EmployeeContextType = {
  employees: Employee[]
  loading: boolean
  addEmployee: (emp: Omit<Employee, 'id'>) => Promise<void>
  updateEmployee: (updated: Employee) => Promise<string | null>
  deleteEmployee: (id: string) => Promise<void>
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>
}

const EmployeeContext = createContext<EmployeeContextType | null>(null)

function toEmployee(row: Record<string, unknown>): Employee {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    phone: (row.phone as string) ?? '',
    email: (row.email as string) ?? '',
    role: (row.role as Employee['role']) ?? 'Employee',
    hireDate: (row.hire_date as string) ?? '',
    birthdate: (row.birthdate as string) ?? '',
    status: (row.status as Employee['status']) ?? 'Active',
    address: (row.address as string) ?? '',
    emergencyContact: (row.emergency_contact as string) ?? '',
    emergencyPhone: (row.emergency_phone as string) ?? '',
    notes: (row.notes as string) ?? '',
    profilePicture: (row.profile_picture as string) ?? '',
  }
}

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.org_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('employees')
      .select('*')
      .eq('org_id', user.org_id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setEmployees(data.map(toEmployee))
        setLoading(false)
      })
  }, [user?.org_id])

  async function addEmployee(emp: Omit<Employee, 'id'>) {
    if (!user?.org_id) return
    const { data, error } = await supabase.from('employees').insert({
      org_id: user.org_id,
      name: emp.name,
      phone: emp.phone,
      email: emp.email,
      role: emp.role,
      hire_date: emp.hireDate,
      birthdate: emp.birthdate,
      status: emp.status,
      address: emp.address,
      emergency_contact: emp.emergencyContact,
      emergency_phone: emp.emergencyPhone,
      notes: emp.notes,
      profile_picture: emp.profilePicture,
    }).select().single()
    if (data && !error) setEmployees(prev => [...prev, toEmployee(data)])
  }

  async function updateEmployee(updated: Employee): Promise<string | null> {
    const { error } = await supabase.from('employees').update({
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      role: updated.role,
      hire_date: updated.hireDate,
      birthdate: updated.birthdate,
      status: updated.status,
      address: updated.address,
      emergency_contact: updated.emergencyContact,
      emergency_phone: updated.emergencyPhone,
      notes: updated.notes,
      profile_picture: updated.profilePicture,
    }).eq('id', updated.id)
    if (error) return error.message
    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e))
    if (updated.email) {
      const { error: rpcError } = await supabase.rpc('update_member_role', { p_email: updated.email, p_role: updated.role })
      if (rpcError) return rpcError.message
    }
    return null
  }

  async function deleteEmployee(id: string) {
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (!error) setEmployees(prev => prev.filter(e => e.id !== id))
  }

  return (
    <EmployeeContext.Provider value={{ employees, loading, addEmployee, updateEmployee, deleteEmployee, setEmployees }}>
      {children}
    </EmployeeContext.Provider>
  )
}

export function useEmployees() {
  const ctx = useContext(EmployeeContext)
  if (!ctx) throw new Error('useEmployees must be used inside EmployeeProvider')
  return ctx
}
