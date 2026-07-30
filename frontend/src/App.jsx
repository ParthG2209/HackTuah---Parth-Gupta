import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Teams from './pages/Teams';
import Coach from './pages/Coach';
import Tasks from './pages/Tasks';
import Pitch from './pages/Pitch';
import PresentationStudio from './pages/PresentationStudio';
import Profile from './pages/Profile';

const Loader = () => (
  <div style={{ display: 'flex', height: '100vh', width: '100vw', justifyContent: 'center', alignItems: 'center', backgroundColor: '#08090c' }}>
    <div style={{ fontFamily: 'Outfit', fontSize: '24px', color: '#8b5cf6' }}>●</div>
  </div>
);

// Route guard for authenticated + profiled users
const ProtectedRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/" replace />;
  if (!profile) return <Navigate to="/onboarding" replace />;
  return children;
};

// Route guard for onboarding (authenticated but no profile yet)
const ProtectedRouteOnboarding = ({ children }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/" replace />;
  if (profile) return <Navigate to="/dashboard" replace />;
  return children;
};

import Aurora from './components/Aurora';
import VoiceAssistantWidget from './components/VoiceAssistantWidget';

const MainLayout = ({ children }) => (
  <div className="app-container-full" style={{ position: 'relative', overflow: 'hidden', minHeight: '100vh', display: 'flex' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, opacity: 0.8 }}>
      <Aurora
        colorStops={["#6a00f4", "#8900f2", "#a100f2"]}
        blend={0.5}
        amplitude={1.0}
        speed={0.2}
      />
    </div>
    <Sidebar />
    <div className="app-content-wrapper-full" style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
    <VoiceAssistantWidget />
  </div>
);

function AppContent() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/onboarding" element={
          <ProtectedRouteOnboarding><Onboarding /></ProtectedRouteOnboarding>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>
        } />
        <Route path="/teams" element={
          <ProtectedRoute><MainLayout><Teams /></MainLayout></ProtectedRoute>
        } />
        <Route path="/coach" element={
          <ProtectedRoute><MainLayout><Coach /></MainLayout></ProtectedRoute>
        } />
        <Route path="/tasks" element={
          <ProtectedRoute><MainLayout><Tasks /></MainLayout></ProtectedRoute>
        } />
        <Route path="/pitch" element={
          <ProtectedRoute><MainLayout><Pitch /></MainLayout></ProtectedRoute>
        } />
        <Route path="/presentation" element={
          <ProtectedRoute><MainLayout><PresentationStudio /></MainLayout></ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute><MainLayout><Profile /></MainLayout></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
