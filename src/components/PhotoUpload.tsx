import { useState, useRef } from "react";
import { Camera, CheckCircle, Loader2, X } from "lucide-react";
import { uploadToImgBB } from "@/services/imgbb";
import { cn } from "@/lib/utils";

interface PhotoUploadProps {
  onUpload: (url: string) => void;
  label?: string;
  className?: string;
}

const PhotoUpload = ({ onUpload, label = "Загрузить фото", className }: PhotoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
      const url = await uploadToImgBB(file);
      onUpload(url);
      setUploaded(true);
    } catch {
      setError("Ошибка загрузки. Попробуйте снова.");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setUploaded(false);
    setError("");
    onUpload("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {!preview ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card p-6 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Camera className="h-5 w-5" />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-[10px] opacity-80">(камера или галерея)</span>
        </button>
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

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default PhotoUpload;
