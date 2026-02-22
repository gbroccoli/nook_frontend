// Генерируем стабильный псевдо-HWID на основе браузерных характеристик
// и сохраняем в localStorage, чтобы он не менялся между сессиями
export function getHwid(): string {
  const stored = localStorage.getItem('hwid')
  if (stored) return stored

  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? 0,
  ].join('|')

  // Простой хэш для формирования идентификатора
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
  }

  const hwid = Math.abs(hash).toString(16).padStart(8, '0') +
    Date.now().toString(16)

  localStorage.setItem('hwid', hwid)
  return hwid
}
