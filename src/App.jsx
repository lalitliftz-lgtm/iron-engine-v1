import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import PaymentProcessing from './pages/PaymentProcessing';
import PurchaseSuccess from './pages/PurchaseSuccess';
import Invite from './pages/Invite';
import ResetPassword from './pages/ResetPassword';

import DashboardLayout from './components/dashboard/DashboardLayout';
import Overview from './pages/dashboard/Overview';
const Subscription = lazy(() => import('./pages/dashboard/Subscription'));
const Programs = lazy(() => import('./pages/dashboard/Programs'));
const WorkoutHistory = lazy(() => import('./pages/dashboard/WorkoutHistory'));
const AssessmentWizard = lazy(() => import('./pages/dashboard/AssessmentWizard'));
const GenerateProgram = lazy(() => import('./pages/dashboard/GenerateProgram'));
const WorkoutSession = lazy(() => import('./pages/dashboard/WorkoutSession'));
const WeeklyCheckin = lazy(() => import('./pages/dashboard/WeeklyCheckin'));
const Account = lazy(() => import('./pages/dashboard/Account'));
const MyLibrary = lazy(() => import('./pages/dashboard/MyLibrary'));
const OwnerPanel = lazy(() => import('./pages/dashboard/OwnerPanel'));

const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'));
const Terms = lazy(() => import('./pages/legal/Terms'));
const RefundPolicy = lazy(() => import('./pages/legal/RefundPolicy'));
const Disclaimer = lazy(() => import('./pages/legal/Disclaimer'));
const Contact = lazy(() => import('./pages/legal/Contact'));
const About = lazy(() => import('./pages/legal/About'));

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <Router>
          {/* Pages other than Landing / Today load when opened (smaller first download on phones). */}
          <Suspense fallback={<div className="min-h-screen bg-iron" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/payment/processing" element={<PaymentProcessing />} />
            <Route path="/purchase-success" element={<ProtectedRoute><PurchaseSuccess /></ProtectedRoute>} />
            <Route path="/invite/:code" element={<Invite />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about" element={<About />} />

            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Overview />} />
              <Route path="subscription" element={<Subscription />} />
              <Route path="products" element={<Navigate to="/dashboard/library" replace />} />
              <Route path="athlete-profile" element={<Navigate to="/dashboard/account" replace />} />
              <Route path="programs" element={<Programs />} />
              <Route path="generate" element={<GenerateProgram />} />
              <Route path="workout" element={<WorkoutSession />} />
              <Route path="checkin" element={<WeeklyCheckin />} />
              <Route path="account" element={<Account />} />
              <Route path="history" element={<WorkoutHistory />} />
              <Route path="library" element={<MyLibrary />} />
              <Route path="owner" element={<OwnerPanel />} />
              <Route path="assessment" element={<AssessmentWizard />} />
              <Route path="settings" element={<Navigate to="/dashboard/account" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Router>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
