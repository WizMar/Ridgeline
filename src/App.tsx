import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './context/AuthContext'
import { EmployeeProvider } from './context/EmployeeContext'
import { TimeClockProvider } from './context/TimeClockContext'
import { SettingsProvider } from './context/SettingsContext'
import { JobsProvider } from './context/JobsContext'
import { ClientsProvider } from './context/ClientsContext'
import { EstimatesProvider } from './context/EstimatesContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { PriceBookProvider } from './context/PriceBookContext'
import { ContractsProvider } from './context/ContractsContext'
import { FinancialsProvider } from './context/FinancialsContext'
import { JobRecordsProvider } from './context/JobRecordsContext'
import { MaterialTemplatesProvider } from './context/MaterialTemplatesContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import JobsPage from './pages/JobsPage'
import JobDetailPage from './pages/JobDetailPage'
import ClientsPage from './pages/ClientsPage'
import ClientProfilePage from './pages/ClientProfilePage'
import EstimatesPage from './pages/EstimatesPage'
import EmployeesPage from './pages/EmployeesPage'
import EmployeeProfilePage from './pages/EmployeeProfilePage'
import TimeClockPage from './pages/TimeClockPage'
import SettingsPage from './pages/SettingsPage'
import AccountPage from './pages/AccountPage'
import ApprovePage from './pages/ApprovePage'
import MessagesPage from './pages/MessagesPage'
import SignContractPage from './pages/SignContractPage'
import OnboardingPage from './pages/OnboardingPage'
import RevenuePage from './pages/RevenuePage'
import ReviewEstimatePage from './pages/ReviewEstimatePage'
import CalendarPage from './pages/CalendarPage'

function AppRoutes() {
  const { session, loading, user, can } = useAuth()
  const [skipped, setSkipped] = useState(() => !!localStorage.getItem('nexus_onboarding_skipped'))

  function handleSkip() {
    localStorage.setItem('nexus_onboarding_skipped', '1')
    setSkipped(true)
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-stone-400 animate-spin" />
    </div>
  )

  if (session && !user?.org_id && !skipped) return (
    <Routes>
      <Route path="/sign/:token" element={<SignContractPage />} />
      <Route path="*" element={<OnboardingPage onSkip={handleSkip} />} />
    </Routes>
  )

  if (!session) return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite" element={<AcceptInvitePage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/approve/:token" element={<ApprovePage />} />
      <Route path="/sign/:token" element={<SignContractPage />} />
      <Route path="/review/:token" element={<ReviewEstimatePage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )

  return (
    <PreferencesProvider>
    <SettingsProvider>
    <PriceBookProvider>
    <ContractsProvider>
    <ClientsProvider>
    <EstimatesProvider>
    <JobsProvider>
    <FinancialsProvider>
    <JobRecordsProvider>
    <MaterialTemplatesProvider>
    <TimeClockProvider>
    <EmployeeProvider>
      <Routes>
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/invite" element={<AcceptInvitePage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={can('view:dashboard') ? <DashboardPage /> : <Navigate to="/timeclock" replace />} />
          <Route path="/timeclock" element={<TimeClockPage />} />
          <Route path="/clients" element={can('view:clients') ? <ClientsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/clients/:clientId" element={can('view:clients') ? <ClientProfilePage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/jobs" element={can('view:jobs:all') || can('view:jobs:assigned') ? <JobsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/jobs/:jobId" element={can('view:jobs:all') || can('view:jobs:assigned') ? <JobDetailPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/estimates" element={can('view:estimates') ? <EstimatesPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/messages" element={can('view:messages') ? <MessagesPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/employees" element={can('view:employees') ? <EmployeesPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/employees/:id" element={can('view:employees') ? <EmployeeProfilePage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/settings" element={can('manage:settings') ? <SettingsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/calendar" element={can('view:calendar') ? <CalendarPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/revenue" element={can('view:revenue') ? <RevenuePage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
        <Route path="/approve/:token" element={<ApprovePage />} />
        <Route path="/sign/:token" element={<SignContractPage />} />
        <Route path="/review/:token" element={<ReviewEstimatePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </EmployeeProvider>
    </TimeClockProvider>
    </MaterialTemplatesProvider>
    </JobRecordsProvider>
    </FinancialsProvider>
    </JobsProvider>
    </EstimatesProvider>
    </ClientsProvider>
    </ContractsProvider>
    </PriceBookProvider>
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
