import { soundStore } from '../lib/soundStore';

// Notification Service for Mix Messenger
// Handles audio chimes, desktop browser notifications, in-app banners, and tab title flashing.

export interface NotificationSettings {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  inAppBannerEnabled: boolean;
  customSoundName: string | null; // имя загруженного пользователем звука (сам файл хранится в IndexedDB)
}

const MAX_SOUND_BYTES = 2 * 1024 * 1024;
const MAX_SOUND_SECONDS = 10;

const SETTINGS_KEY = 'mix_notification_settings';

class NotificationService {
  private settings: NotificationSettings = {
    soundEnabled: true,
    desktopEnabled: true,
    inAppBannerEnabled: true,
    customSoundName: null,
  };

  private audioCtx: AudioContext | null = null;
  private customBuffer: AudioBuffer | null = null;
  private customSource: AudioBufferSourceNode | null = null;
  private originalTitle: string = document.title || 'Mix Messenger';
  private titleFlashInterval: NodeJS.Timeout | null = null;
  private inAppNotificationListeners: Array<(notif: InAppNotification) => void> = [];

  constructor() {
    this.loadSettings();
    void this.restoreCustomSound();
    this.originalTitle = document.title || 'Mix Messenger';

    // Clear flashing title when window gains focus
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.clearTitleFlash();
      });

      // Warm up audio context on first user interaction to comply with autoplay policy
      const unlockAudio = () => {
        this.getAudioContext();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
    }
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load notification settings from localStorage', e);
    }
  }

  public saveSettings(newSettings: Partial<NotificationSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save notification settings to localStorage', e);
    }
  }

  public getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked', e);
      return null;
    }
  }

  public hasCustomSound(): boolean {
    return this.customBuffer !== null;
  }

  // Декодируем через OfflineAudioContext: не нужен жест пользователя и нет предупреждений автовоспроизведения
  private decodeAudio(data: ArrayBuffer): Promise<AudioBuffer> {
    const Offline = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    return new Offline(2, 1, 44100).decodeAudioData(data);
  }

  // Загрузка собственного звука пользователя. Бросает Error с понятным текстом.
  public async setCustomSound(file: File): Promise<void> {
    if (file.size > MAX_SOUND_BYTES) throw new Error('Файл больше 2 МБ');
    let buffer: AudioBuffer;
    try {
      buffer = await this.decodeAudio(await file.arrayBuffer());
    } catch {
      throw new Error('Не удалось прочитать звук. Подойдут MP3, WAV, OGG или M4A');
    }
    if (buffer.duration > MAX_SOUND_SECONDS) throw new Error('Звук длиннее 10 секунд');

    const name = file.name.slice(0, 60);
    try {
      await soundStore.save({ name, blob: file });
    } catch {
      throw new Error('Не удалось сохранить звук на этом устройстве');
    }
    this.customBuffer = buffer;
    this.saveSettings({ customSoundName: name });
  }

  public async clearCustomSound(): Promise<void> {
    this.stopCustom();
    this.customBuffer = null;
    this.saveSettings({ customSoundName: null });
    try {
      await soundStore.clear();
    } catch (e) {
      console.warn('Failed to clear custom notification sound', e);
    }
  }

  private async restoreCustomSound(): Promise<void> {
    if (!this.settings.customSoundName) return;
    try {
      const stored = await soundStore.load();
      if (!stored) {
        this.saveSettings({ customSoundName: null });
        return;
      }
      this.customBuffer = await this.decodeAudio(await stored.blob.arrayBuffer());
    } catch (e) {
      console.warn('Failed to restore custom notification sound', e);
    }
  }

  private stopCustom() {
    try {
      this.customSource?.stop();
    } catch {
      // уже остановлен
    }
    this.customSource = null;
  }

  private playCustom(): boolean {
    if (!this.customBuffer) return false;
    const ctx = this.getAudioContext();
    if (!ctx) return false;
    try {
      this.stopCustom();
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = this.customBuffer;
      gain.gain.value = 0.9;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.onended = () => {
        if (this.customSource === src) this.customSource = null;
      };
      src.start();
      this.customSource = src;
      return true;
    } catch (e) {
      console.warn('Failed to play custom notification sound', e);
      return false;
    }
  }

  // Звук нового сообщения. В открытом чате ('soft') остаётся тихий стандартный сигнал.
  public playNotificationSound(variant: 'incoming' | 'soft' = 'incoming') {
    if (!this.settings.soundEnabled) return;
    this.playSound(variant);
  }

  // Прослушать звук, даже если звук сообщений выключен
  public previewSound() {
    this.playSound('incoming');
  }

  private playSound(variant: 'incoming' | 'soft') {
    if (variant === 'incoming' && this.playCustom()) return;
    this.playDefaultChime(variant);
  }

  // Synthesizes a crisp, elegant two-tone chime
  private playDefaultChime(variant: 'incoming' | 'soft') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (variant === 'soft') {
        // Soft subtle pop/ping for active chat
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(784, now); // G5
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
        return;
      }

      // Rich dual-tone chime: Note 1 (E5 659.25Hz) -> Note 2 (A5 880Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.28, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.28);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.09);
      gain2.gain.setValueAtTime(0, now + 0.09);
      gain2.gain.linearRampToValueAtTime(0.32, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.6);
    } catch (err) {
      console.warn('Failed to play notification audio:', err);
    }
  }

  public isDesktopNotificationSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermissionStatus(): NotificationPermission {
    if (!this.isDesktopNotificationSupported()) return 'denied';
    return Notification.permission;
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isDesktopNotificationSupported()) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('Error requesting notification permission:', e);
      return 'denied';
    }
  }

  // Flash document title when window is in background
  public flashTitle(message: string) {
    if (typeof window === 'undefined') return;
    this.clearTitleFlash();

    let toggle = false;
    this.originalTitle = document.title.includes('💬') ? 'Mix Messenger' : document.title;

    this.titleFlashInterval = setInterval(() => {
      document.title = toggle ? `💬 ${message}` : this.originalTitle;
      toggle = !toggle;
    }, 1200);
  }

  public clearTitleFlash() {
    if (this.titleFlashInterval) {
      clearInterval(this.titleFlashInterval);
      this.titleFlashInterval = null;
    }
    if (this.originalTitle) {
      document.title = this.originalTitle;
    }
  }

  // In-app notifications listener
  public onInAppNotification(callback: (notif: InAppNotification) => void) {
    this.inAppNotificationListeners.push(callback);
    return () => {
      this.inAppNotificationListeners = this.inAppNotificationListeners.filter(cb => cb !== callback);
    };
  }

  // Main dispatch method for when a new message is received
  public notifyNewMessage(params: {
    chatId: string;
    senderName: string;
    senderAvatar?: string;
    text: string;
    isCurrentChatActive: boolean;
    onOpenChat: (chatId: string) => void;
  }) {
    const { chatId, senderName, senderAvatar, text, isCurrentChatActive, onOpenChat } = params;

    const isWindowFocused = typeof document !== 'undefined' && document.hasFocus() && !document.hidden;

    // If user is actively reading this exact chat and tab is focused, just play a soft sound
    if (isCurrentChatActive && isWindowFocused) {
      this.playNotificationSound('soft');
      return;
    }

    // Play full chime
    this.playNotificationSound('incoming');

    // If window is not focused or hidden, flash tab title
    if (!isWindowFocused) {
      this.flashTitle(`${senderName}: ${text}`);
    }

    // Trigger Browser Desktop Notification if enabled and allowed
    if (this.settings.desktopEnabled && this.isDesktopNotificationSupported() && Notification.permission === 'granted') {
      try {
        const notif = new Notification(senderName, {
          body: text,
          icon: senderAvatar || '/favicon.ico',
          tag: `chat-${chatId}`,
          badge: '/favicon.ico',
          silent: true // We play our own audio chime
        });

        notif.onclick = () => {
          window.focus();
          this.clearTitleFlash();
          onOpenChat(chatId);
          notif.close();
        };
      } catch (e) {
        console.warn('Failed to display browser notification:', e);
      }
    }

    // Trigger In-App Banner if user is currently looking at the app but in a different chat or chat list
    if (this.settings.inAppBannerEnabled && (!isCurrentChatActive || !isWindowFocused)) {
      const notifItem: InAppNotification = {
        id: `${chatId}_${Date.now()}`,
        chatId,
        senderName,
        senderAvatar,
        text,
        timestamp: Date.now(),
        onClick: () => {
          this.clearTitleFlash();
          onOpenChat(chatId);
        }
      };

      this.inAppNotificationListeners.forEach(listener => {
        try {
          listener(notifItem);
        } catch (e) {
          console.error('Error in in-app notification listener:', e);
        }
      });
    }
  }
}

export interface InAppNotification {
  id: string;
  chatId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: number;
  onClick: () => void;
}

export const notificationService = new NotificationService();
