import { useEffect, useState } from "react";
import { Download, CheckCircle2, Share, MoreVertical, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));
    setIsAndroid(/android/.test(ua));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  if (isStandalone) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-[hsl(var(--success))]" />
        <h1 className="text-xl font-bold text-foreground">Приложение уже установлено</h1>
        <p className="text-sm text-muted-foreground">Вы используете ArtTime как приложение.</p>
      </div>
    );
  }

  if (installed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-[hsl(var(--success))]" />
        <h1 className="text-xl font-bold text-foreground">Готово!</h1>
        <p className="text-sm text-muted-foreground">Приложение установлено на ваш экран.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <img src={logo} alt="ArtTime" className="h-16 object-contain" />
        <h1 className="font-display text-2xl font-bold text-foreground">
          Установите ArtTime
        </h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Добавьте приложение на главный экран для быстрого доступа и работы без адресной строки.
        </p>
      </div>

      {deferredPrompt ? (
        <Button size="lg" className="gap-2 text-base" onClick={handleInstall}>
          <Download className="h-5 w-5" />
          Установить приложение
        </Button>
      ) : isIos ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Как установить на iPhone / iPad:</p>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Share className="h-5 w-5 text-primary" />
            </div>
            <span>Нажмите <strong className="text-foreground">Поделиться</strong> внизу экрана</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <PlusSquare className="h-5 w-5 text-primary" />
            </div>
            <span>Выберите <strong className="text-foreground">На экран «Домой»</strong></span>
          </div>
        </div>
      ) : isAndroid ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Как добавить на главный экран (Android):</p>
          <div className="space-y-3 text-left">
            <p><strong className="text-foreground">Chrome:</strong> меню <strong className="text-foreground">⋮</strong> (три точки) → «Установить приложение» или «Добавить на главный экран».</p>
            <p><strong className="text-foreground">Samsung Internet:</strong> меню → «Добавить страницу на» → «Главный экран».</p>
            <p className="text-xs opacity-90">Если пункта нет — откройте сайт ещё раз через несколько минут или перезагрузите страницу.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Как установить:</p>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <MoreVertical className="h-5 w-5 text-primary" />
            </div>
            <span>Откройте меню браузера <strong className="text-foreground">(⋮)</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <span>Выберите <strong className="text-foreground">Установить приложение</strong></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Install;
