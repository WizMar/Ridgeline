import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { type TimeEntry, type GpsLocation } from '@/types/timeclock'

type TimeClockContextType = {
  entries: TimeEntry[]
  loading: boolean
  setEntries: React.Dispatch<React.SetStateAction<TimeEntry[]>>
  addEntry: (entry: Omit<TimeEntry, 'id'>) => Promise<TimeEntry | null>
  updateEntry: (updated: TimeEntry) => Promise<void>
  updateLocation: (entryId: string, location: GpsLocation) => void
}

const TimeClockContext = createContext<TimeClockContextType | null>(null)

function toEntry(row: Record<string, unknown>): TimeEntry {
  return {
    id: row.id as string,
    employeeId: (row.employee_id as string) ?? '',
    employeeName: '',
    clockIn: (row.clock_in as string) ?? '',
    clockOut: (row.clock_out as string) ?? null,
    lunchStart: (row.lunch_start as string) ?? null,
    lunchEnd: (row.lunch_end as string) ?? null,
    clockInLocation: (row.gps_in as GpsLocation) ?? null,
    clockOutLocation: (row.gps_out as GpsLocation) ?? null,
    currentLocation: null,
    locationUpdatedAt: null,
    status: (row.status as TimeEntry['status']) ?? 'completed',
    editRequest: (row.edit_request as string) ?? null,
    editedClockIn: (row.edited_clock_in as string) ?? null,
    editedClockOut: (row.edited_clock_out as string) ?? null,
    date: (row.date as string) ?? '',
  }
}

export function TimeClockProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.org_id) {
      setLoading(false)
      return
    }
    setLoading(true)
    supabase
      .from('time_entries')
      .select('*')
      .eq('org_id', user.org_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setEntries(data.map(toEntry))
        setLoading(false)
      })
  }, [user?.org_id])

  async function addEntry(entry: Omit<TimeEntry, 'id'>): Promise<TimeEntry | null> {
    if (!user?.org_id) return null
    const { data, error } = await supabase.from('time_entries').insert({
      org_id: user.org_id,
      employee_id: entry.employeeId,
      date: entry.date,
      clock_in: entry.clockIn,
      clock_out: entry.clockOut,
      lunch_start: entry.lunchStart,
      lunch_end: entry.lunchEnd,
      status: entry.status,
      gps_in: entry.clockInLocation,
      gps_out: entry.clockOutLocation,
    }).select().single()
    if (data && !error) {
      const newEntry = { ...toEntry(data), employeeName: entry.employeeName }
      setEntries(prev => [newEntry, ...prev])
      return newEntry
    }
    return null
  }

  async function updateEntry(updated: TimeEntry) {
    const { error } = await supabase.from('time_entries').update({
      clock_in: updated.clockIn,
      clock_out: updated.clockOut,
      lunch_start: updated.lunchStart,
      lunch_end: updated.lunchEnd,
      status: updated.status,
      gps_in: updated.clockInLocation,
      gps_out: updated.clockOutLocation,
      edit_request: updated.editRequest,
      edited_clock_in: updated.editedClockIn,
      edited_clock_out: updated.editedClockOut,
    }).eq('id', updated.id)
    if (!error) setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
  }

  const updateLocation = useCallback((entryId: string, location: GpsLocation) => {
    setEntries(prev => prev.map(e =>
      e.id === entryId
        ? { ...e, currentLocation: location, locationUpdatedAt: new Date().toISOString() }
        : e
    ))
  }, [])

  return (
    <TimeClockContext.Provider value={{ entries, loading, setEntries, addEntry, updateEntry, updateLocation }}>
      {children}
    </TimeClockContext.Provider>
  )
}

export function useTimeClock() {
  const ctx = useContext(TimeClockContext)
  if (!ctx) throw new Error('useTimeClock must be used inside TimeClockProvider')
  return ctx
}
