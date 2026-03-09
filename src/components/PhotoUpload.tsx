import { useState, useRef } from "react";
import { Camera, CheckCircle, Loader2, X } from "lucide-react";
import { uploadToImgBB } from "@/services/imgbb";
import { compressImage } from "@/services/imageCompression";
import { cn } from "@/lib/utils";

interface PhotoUploadProps {
  onUpload: (url: string) => void;
  /** Called with the raw compressed File for offline storage */
  onFileReady?: (file: File) => void;
  label?: string;
  className?: string;
  /** If true, skip network upload — just provide the file locally */
  offlineMode?: boolean;
}

const PhotoUpload = ({ onUpload, onFileReady, label = "Загрузить фото", className, offlineMode }: PhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Выберите изображение");
      return;
    }

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setError("");
    setUploaded(false);

    try {
      const compressed = await compressImage(file);

      // Provide file for offline storage
      onFileReady?.(compressed);

      if (offlineMode || !navigator.onLine) {
        // Don't upload, just keep locally
        onUpload("__offline__");
        setUploaded(true);
      } else {
        const url = await uploadToImgBB(compressed);
        onUpload(url);
        setUploaded(true);
      }
    } catch {
      // If upload fails, save for offline
      try {
        const compressed = await compressImage(file);
        onFileReady?.(compressed);
        onUpload("__offline__");
        setUploaded(true);
        setError("Нет сети — фото сохранено локально");
      } catch {
        setError("Ошибка загрузки. Попробуйте снова.");
        setPreview(null);
      }
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setUploaded(false);
    setError("");
    onUpload("");
    onFileReady?.(undefined as unknown as File);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { e.target.files?.[0] && handleFile(e.target.files[0]); e.target.value = ""; }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { e.target.files?.[0] && handleFile(e.target.files[0]); e.target.value = ""; }}
      />

      {!preview ? (
        <div className="space-y-2">
          {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card py-4 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Camera className="h-5 w-5" />
            <span className="text-sm font-medium">Сфотографировать</span>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card py-4 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <span className="text-sm font-medium">Из галереи</span>
          </button>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-lg">
          <img src={preview} alt="Превью" className="h-40 w-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {uploaded && (
            <div className="absolute right-2 top-2">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
          )}
          <button
            type="button"
            onClick={reset}
            className="absolute left-2 top-2 rounded-full bg-background/80 p-1"
          >
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>
      )}

      {error && <p className={cn("text-xs", error.includes("локально") ? "text-warning" : "text-destructive")}>{error}</p>}
    </div>
  );
};

export default PhotoUpload;
