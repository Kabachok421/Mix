// Серверы для установки прямого соединения. По умолчанию бесплатные STUN от Google: они помогают, когда оба
// устройства за обычным роутером. Если прямое соединение не получается (мобильный интернет, строгие роутеры),
// нужен ретранслятор TURN. Его можно подключить при сборке переменными окружения:
//   VITE_ICE_SERVERS = [{"urls":"turn:turn.example.com:3478","username":"...","credential":"..."}]
const DEFAULT_ICE: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

export function getIceServers(): RTCIceServer[] {
  try {
    const raw = (import.meta as any).env?.VITE_ICE_SERVERS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return [...parsed, ...DEFAULT_ICE];
    }
  } catch {
    console.warn('VITE_ICE_SERVERS содержит некорректный JSON, используются серверы по умолчанию');
  }
  return DEFAULT_ICE;
}
