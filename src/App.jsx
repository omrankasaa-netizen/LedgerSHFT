import { Toaster } from "@/components/ui/toaster"
import { LanguageProvider } from "@/lib/i18n";
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import CustomerDetail from '@/pages/CustomerDetail';
import Partners from '@/pages/Partners';
import PartnerDetail from '@/pages/PartnerDetail';
import Invoices from '@/pages/Invoices';
import InvoiceForm from '@/pages/InvoiceForm';
import InvoiceDetail from '@/pages/InvoiceDetail';
import Payments from '@/pages/Payments';
import PaymentForm from '@/pages/PaymentForm';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import PurchaseInvoices from '@/pages/PurchaseInvoices';
import PurchaseInvoiceForm from '@/pages/PurchaseInvoiceForm';

const AuthenticatedApp = () => {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  // Show loading spinner while the stored token is being checked
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="/partners/:id" element={<PartnerDetail />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/new" element={<InvoiceForm />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/invoices/:id/edit" element={<InvoiceForm />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/payments/new" element={<PaymentForm />} />
        <Route path="/imports/purchase-invoices" element={<PurchaseInvoices />} />
        <Route path="/imports/purchase-invoices/new" element={<PurchaseInvoiceForm />} />
        <Route path="/imports/purchase-invoices/:id/edit" element={<PurchaseInvoiceForm />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <LanguageProvider>
            <ScrollToTop />
            <AuthenticatedApp />
          </LanguageProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
