import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { LogOut, UserCircle, Sun, Moon } from "lucide-react";

const Profile = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <PageLayout title="Профиль">
      <div className="space-y-4 animate-fade-in">
        <Card className="card-elevated">
          <CardContent className="flex items-center gap-4 p-4">
            {user?.photo ? (
              <img src={user.photo} alt={user.name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                <UserCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="text-lg font-bold text-foreground">{user?.name}</p>
              <p className="text-sm text-muted-foreground capitalize">
                {user?.role === "admin" ? "Администратор" : "Водитель"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Theme switcher */}
        <Card className="card-elevated">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {theme === "dark" ? (
                <Moon className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Sun className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">Оформление</p>
                <p className="text-xs text-muted-foreground">
                  {theme === "dark" ? "Тёмная тема" : "Светлая тема"}
                </p>
              </div>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
          </CardContent>
        </Card>

        <Button
          variant="destructive"
          className="h-12 w-full gap-2 text-base"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" /> Выйти
        </Button>
      </div>
    </PageLayout>
  );
};

export default Profile;
