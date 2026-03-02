import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, User } from "lucide-react";
import logo from "@/assets/logo.png";

const Login = () => {
  const { login } = useAuth();
  const [loginVal, setLoginVal] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginVal.trim() || !password.trim()) {
      setError("Заполните все поля");
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(loginVal.trim(), password);
    if (!result.success) {
      setError(result.error || "Ошибка входа");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-40%] left-[-20%] h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-[-30%] right-[-10%] h-[400px] w-[400px] rounded-full bg-primary/3 blur-[100px]" />

      <div className="w-full max-w-sm animate-fade-in relative z-10">
        {/* Logo */}
        <div className="mb-12 flex flex-col items-center gap-4">
          <img src={logo} alt="ArtTime Logistics" className="h-14 object-contain" />
          <p className="text-sm text-muted-foreground tracking-wide">
            Войдите в систему
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Логин"
              value={loginVal}
              onChange={(e) => setLoginVal(e.target.value)}
              className="h-12 border-border bg-card/60 pl-10 text-foreground placeholder:text-muted-foreground backdrop-blur-sm focus:border-primary/50 transition-colors"
              autoComplete="username"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 border-border bg-card/60 pl-10 text-foreground placeholder:text-muted-foreground backdrop-blur-sm focus:border-primary/50 transition-colors"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full text-base font-semibold glow-red mt-2"
          >
            {loading ? "Вход..." : "Войти"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
