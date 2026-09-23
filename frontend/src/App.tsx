import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { LandingPage } from './pages/LandingPage'
import { ConsolePage } from './pages/ConsolePage'
import { IncidentDetailPage } from './pages/IncidentDetailPage'
import { LoginPage } from './pages/LoginPage'
import { DocsPage } from './pages/DocsPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#f1f3f7] text-neutral-900 font-sans flex flex-col selection:bg-black selection:text-white">
        {/* Global Navbar */}
        <Navbar />

        {/* Route Pages */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/console" element={<ConsolePage />} />
            <Route path="/dashboard" element={<Navigate to="/console" replace />} />
            <Route path="/incident/:id" element={<IncidentDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/docs" element={<DocsPage />} />
            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
