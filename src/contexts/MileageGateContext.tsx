import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { startOfDay } from "date-fns";

interface MileageGateContextType {
  mileageSubmittedToday: boolean;
  loading: boolean;
  markSubmitted: () => void;
}

const MileageGateContext = createContext<MileageGateContextType>({
  mileageSubmittedToday: false,
  loading: true,
  markSubmitted: () => {},
});

export const useMileageGate = () => useContext(MileageGateContext);

export const MileageGateProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [mileageSubmittedToday, setMileageSubmittedToday] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role === "admin") {
      setMileageSubmittedToday(true);
      setLoading(false);
      return;
    }

    const check = async () => {
      const result = await api.getMileage(user.id);
      if (result.success && result.data) {
        const todayStart = startOfDay(new Date()).getTime();
        const hasToday = result.data.some(
          (r) => new Date(r.date).getTime() >= todayStart
        );
        setMileageSubmittedToday(hasToday);
      }
      setLoading(false);
    };
    check();
  }, [user]);

  const markSubmitted = useCallback(() => {
    setMileageSubmittedToday(true);
  }, []);

  return (
    <MileageGateContext.Provider value={{ mileageSubmittedToday, loading, markSubmitted }}>
      {children}
    </MileageGateContext.Provider>
  );
};
