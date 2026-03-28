import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Лайтбокс на весь экран через портал в document.body — иначе position:fixed
 * «прилипает» к предку с transform (например PageTransition + GSAP) и картинка оказывается смещённой вниз.
 */
export function FullScreenImageOverlay({
  url,
  onClose,
  alt = "Изображение",
}: {
  url: string | null;
  onClose: () => void;
  alt?: string;
}) {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (url) setLoadError(false);
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [url]);

  if (typeof document === "undefined" || !url) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/92 p-4"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
      onClick={() => {
        onClose();
        setLoadError(false);
      }}
    >
      <div className="relative flex min-h-0 min-w-0 max-h-[min(85dvh,calc(100dvh-3rem))] max-w-[min(90vw,100%)] shrink-0 items-center justify-center">
        {loadError ? (
          <div
            className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-muted-foreground">Не удалось загрузить изображение</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline"
            >
              Открыть в новой вкладке
            </a>
          </div>
        ) : (
          <img
            key={url}
            src={url}
            alt={alt}
            referrerPolicy="no-referrer"
            decoding="async"
            onClick={(e) => e.stopPropagation()}
            onError={() => setLoadError(true)}
            className="relative z-[1] max-h-[min(85dvh,calc(100dvh-3rem))] max-w-full rounded-lg border border-white/10 bg-neutral-950 object-contain shadow-lg"
          />
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          setLoadError(false);
        }}
        className="absolute z-10 rounded-full bg-background/90 p-2 text-foreground hover:bg-background"
        style={{
          top: "max(1rem, env(safe-area-inset-top))",
          right: "max(1rem, env(safe-area-inset-right))",
        }}
        aria-label="Закрыть"
      >
        <X className="h-5 w-5" />
      </button>
    </div>,
    document.body,
  );
}
