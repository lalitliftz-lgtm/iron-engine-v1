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

import DashboardLayout from './components/dashboard/DashboardLayout';
import Overview from './pages/dashboard/Overview';
import Subscription from './pages/dashboard/Subscription';
import MyProducts from './pages/dashboard/MyProducts';
import AthleteProfile from './pages/dashboard/AthleteProfile';
import Programs from './pages/dashboard/Programs';
import WorkoutHistory from './pages/dashboard/WorkoutHistory';
import Settings from './pages/dashboard/Settings';
import AssessmentWizard from './pages/dashboard/AssessmentWizard';
import GenerateProgram from './pages/dashboard/GenerateProgram';
import WorkoutSession from './pages/dashboard/WorkoutSession';
import MyLibrary from './pages/dashboard/MyLibrary';
import TechniqueLab from './pages/dashboard/TechniqueLab';
import ExerciseDetail from './pages/dashboard/ExerciseDetail';

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
            <Route path="/purchase-success" element={<PurchaseSuccess />} />
            
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about" element={<About />} />

            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Overview />} />
              <Route path="subscription" element={<Subscription />} />
              <Route path="products" element={<MyProducts />} />
              <Route path="athlete-profile" element={<AthleteProfile />} />
              <Route path="programs" element={<Programs />} />
              <Route path="generate" element={<GenerateProgram />} />
              <Route path="workout" element={<WorkoutSession />} />
              <Route path="history" element={<WorkoutHistory />} />
              <Route path="library" element={<MyLibrary />} />
              <Route path="technique-lab" element={<TechniqueLab />} />
              <Route path="technique-lab/:id" element={<ExerciseDetail />} />
              <Route path="assessment" element={<AssessmentWizard />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
