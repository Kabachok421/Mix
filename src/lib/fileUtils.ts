export function formatBytes(bytes?: number): string {
  if (!bytes || bytes < 0) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '';
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} с`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин`;
  const h = Math.floor(seconds / 3600);
  return `${h} ч ${Math.round((seconds % 3600) / 60)} мин`;
}

// Видео и картинки показываем как медиа, остальное как файл
export function isMediaFile(file: { type: string; name: string }): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|png|jpe?g|gif|webp)$/i.test(file.name);
}
