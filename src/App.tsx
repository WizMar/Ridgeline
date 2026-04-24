import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './context/AuthContext'
import { EmployeeProvider } from './context/EmployeeContext'
import { TimeClockProvider } from './context/TimeClockContext'
import { SettingsProvider } from './context/SettingsContext'
import { JobsProvider } from './context/JobsContext'
import { EstimatesProvider } from './context/EstimatesContext'
import { PreferencesProvider } from './context/PreferencesContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import JobsPage from './pages/JobsPage'
import EstimatesPage from './pages/EstimatesPage'
import EmployeesPage from './pages/EmployeesPage'
import EmployeeProfilePage from './pages/EmployeeProfilePage'
import TimeClockPage from './pages/TimeClockPage'
import SettingsPage from './pages/SettingsPage'
import AccountPage from './pages/AccountPage'

function AppRoutes() {
  const { session, loading, can } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-400">Loading...</p>
    </div>
  )

  if (!session) return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite" element={<AcceptInvitePage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )

  return (
    <PreferencesProvider>
    <SettingsProvider>
    <EstimatesProvider>
    <JobsProvider>
    <TimeClockProvider>
    <EmployeeProvider>
      <Routes>
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/invite" element={<AcceptInvitePage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={can('view:dashboard') ? <DashboardPage /> : <Navigate to="/timeclock" replace />} />
          <Route path="/timeclock" element={<TimeClockPage />} />
          <Route path="/jobs" element={can('view:jobs:all') || can('view:jobs:assigned') ? <JobsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/estimates" element={can('view:estimates') ? <EstimatesPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/employees" element={can('view:employees') ? <EmployeesPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/employees/:id" element={can('view:employees') ? <EmployeeProfilePage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/settings" element={can('manage:settings') ? <SettingsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </EmployeeProvider>
    </TimeClockProvider>
    </JobsProvider>
    </EstimatesProvider>
    </SettingsProvider>
    </PreferencesProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster theme="dark" position="bottom-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
