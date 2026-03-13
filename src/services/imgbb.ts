import { IMGBB_API_KEY } from "@/config";

export async function uploadToImgBB(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("key", IMGBB_API_KEY);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error?.message || "Ошибка загрузки изображения");
  }

  // Прямая ссылка на изображение для <img src> (display_url или url; не url_viewer — это страница)
  return data.data.display_url || data.data.url || data.data.url_viewer;
}
