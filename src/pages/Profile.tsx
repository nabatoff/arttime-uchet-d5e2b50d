import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LogOut, UserCircle, Sun, Moon } from "lucide-react";

const Profile = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleLogout = () => {
    setLogoutOpen(false);
    logout();
  };

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
                {user?.role === "admin"
                  ? "Администратор"
                  : user?.role === "balance"
                    ? "Баланс"
                    : "Водитель"}
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

        <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <Button
            variant="destructive"
            className="h-12 w-full gap-2 text-base"
            onClick={() => setLogoutOpen(true)}
          >
            <LogOut className="h-4 w-4" /> Выйти
          </Button>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Выйти из аккаунта?</AlertDialogTitle>
              <AlertDialogDescription>
                Вы сможете снова войти, введя логин и пароль.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Выйти
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageLayout>
  );
};

export default Profile;
