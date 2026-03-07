import { useLocation, useNavigate } from "react-router-dom";
import { Wallet, Receipt, Gauge, LayoutDashboard, Settings, ArrowLeftRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMileageGate } from "@/contexts/MileageGateContext";
import { cn } from "@/lib/utils";

const adminTabs = [
  { path: "/admin", label: "Баланс", icon: LayoutDashboard },
  { path: "/admin/expenses", label: "Расходы", icon: Receipt },
  { path: "/admin/mileage", label: "Пробег", icon: Gauge },
  { path: "/admin/settings", label: "Настройки", icon: Settings },
];

const balanceTabs = [
  { path: "/balance", label: "Балансы", icon: LayoutDashboard },
  { path: "/balance/transfers", label: "Переводы", icon: ArrowLeftRight },
  { path: "/balance/expenses", label: "Расходы", icon: Receipt },
];

const BottomNav = () => {
  const { user } = useAuth();
  const { mileageSubmittedToday } = useMileageGate();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === "admin";
  const isBalance = user?.role === "balance";

  const tabs = isAdmin
    ? adminTabs
    : isBalance
      ? balanceTabs
      : mileageSubmittedToday
        ? [
            { path: "/dashboard", label: "Баланс", icon: Wallet },
            { path: "/expenses", label: "Расходы", icon: Receipt },
          ]
        : [
            { path: "/mileage", label: "Пробег", icon: Gauge },
          ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-border/60">
      <div className="mx-auto flex max-w-lg items-center justify-around py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const isActive = tab.path === "/admin/settings" ? location.pathname.startsWith("/admin/settings") || location.pathname === "/admin/drivers" || location.pathname === "/admin/categories" || location.pathname === "/admin/trucks" : location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-4 py-1.5 transition-all duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute -top-1.5 h-0.5 w-6 rounded-full bg-primary" />
              )}
              <Icon className={cn("h-6 w-6", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]")} />
              <span className="text-[9px] font-medium leading-none">{tab.label}</span>
              {isActive && (
                <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
