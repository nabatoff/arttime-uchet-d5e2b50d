import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MileageGateProvider, useMileageGate } from "@/contexts/MileageGateContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Login from "./pages/Login";
import Dashboard from "./pages/driver/Dashboard";
import Expenses from "./pages/driver/Expenses";
import Mileage from "./pages/driver/Mileage";
import Profile from "./pages/Profile";
import BalanceDashboard from "./pages/balance/BalanceDashboard";
import BalanceTransfers from "./pages/balance/BalanceTransfers";
import BalanceExpenses from "./pages/balance/BalanceExpenses";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminMileage = lazy(() => import("./pages/admin/AdminMileage"));
const AdminDrivers = lazy(() => import("./pages/admin/AdminDrivers"));
const AdminExpenses = lazy(() => import("./pages/admin/AdminExpenses"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminLedger = lazy(() => import("./pages/admin/AdminLedger"));
const AdminTrucks = lazy(() => import("./pages/admin/AdminTrucks"));

function AdminRoutesFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { mileageSubmittedToday, loading: mileageLoading } = useMileageGate();

  if (isLoading || mileageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/install" element={<Install />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (user?.role === "admin") {
    return (
      <Suspense fallback={<AdminRoutesFallback />}>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/expenses" element={<AdminExpenses />} />
          <Route path="/admin/mileage" element={<AdminMileage />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/ledger" element={<AdminLedger />} />
          <Route path="/admin/drivers" element={<AdminDrivers backTo="/admin/settings" />} />
          <Route path="/admin/categories" element={<AdminCategories backTo="/admin/settings" />} />
          <Route path="/admin/trucks" element={<AdminTrucks backTo="/admin/settings" />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/install" element={<Install />} />
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    );
  }

  if (user?.role === "balance") {
    return (
      <Routes>
        <Route path="/balance" element={<BalanceDashboard />} />
        <Route path="/balance/transfers" element={<BalanceTransfers />} />
        <Route path="/balance/expenses" element={<BalanceExpenses />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/install" element={<Install />} />
        <Route path="/" element={<Navigate to="/balance" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // Driver: if mileage not submitted today, force to /mileage
  if (!mileageSubmittedToday) {
    return (
      <Routes>
        <Route path="/mileage" element={<Mileage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/install" element={<Install />} />
        <Route path="*" element={<Navigate to="/mileage" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/install" element={<Install />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <MileageGateProvider>
                <AppRoutes />
              </MileageGateProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
