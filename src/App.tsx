import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMileage from "./pages/admin/AdminMileage";
import AdminDrivers from "./pages/admin/AdminDrivers";
import AdminExpenses from "./pages/admin/AdminExpenses";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

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
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (user?.role === "admin") {
    return (
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/expenses" element={<AdminExpenses />} />
        <Route path="/admin/mileage" element={<AdminMileage />} />
        <Route path="/admin/drivers" element={<AdminDrivers />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
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
        <Route path="*" element={<Navigate to="/mileage" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/profile" element={<Profile />} />
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
