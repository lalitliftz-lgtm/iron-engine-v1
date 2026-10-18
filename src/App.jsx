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
import Subscription from './pages/dashboard/Subscription';
import Programs from './pages/dashboard/Programs';
import WorkoutHistory from './pages/dashboard/WorkoutHistory';
import AssessmentWizard from './pages/dashboard/AssessmentWizard';
import GenerateProgram from './pages/dashboard/GenerateProgram';
import WorkoutSession from './pages/dashboard/WorkoutSession';
import WeeklyCheckin from './pages/dashboard/WeeklyCheckin';
import Account from './pages/dashboard/Account';
import MyLibrary from './pages/dashboard/MyLibrary';
import OwnerPanel from './pages/dashboard/OwnerPanel';

import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import Terms from './pages/legal/Terms';
import RefundPolicy from './pages/legal/RefundPolicy';
import Disclaimer from './pages/legal/Disclaimer';
import Contact from './pages/legal/Contact';
import About from './pages/legal/About';

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <Router>
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
        </Router>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
