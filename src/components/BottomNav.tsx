import { useLocation, useNavigate } from "react-router-dom";
import { Wallet, Receipt, Gauge, UserCircle, LayoutDashboard, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const driverTabs = [
  { path: "/dashboard", label: "Баланс", icon: Wallet },
  { path: "/expenses", label: "Расходы", icon: Receipt },
  { path: "/mileage", label: "Пробег", icon: Gauge },
  { path: "/profile", label: "Профиль", icon: UserCircle },
];

const adminTabs = [
  { path: "/admin", label: "Панель", icon: LayoutDashboard },
  { path: "/admin/expenses", label: "Расходы", icon: Receipt },
  { path: "/admin/mileage", label: "Пробег", icon: Gauge },
  { path: "/admin/drivers", label: "Водители", icon: Users },
  { path: "/profile", label: "Профиль", icon: UserCircle },
];

const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = user?.role === "admin" ? adminTabs : driverTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
