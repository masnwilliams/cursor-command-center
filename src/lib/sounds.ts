let audioCtx: AudioContext | null = null;
let _pendingSound = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Call on any user gesture (click/tap) to ensure the AudioContext
 * is unlocked for future programmatic playback. Mobile browsers and
 * PWAs require a user gesture to move the context out of "suspended"
 * state. Also plays any queued sound that couldn't play earlier.
 */
export function unlockAudio(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  } catch {
    // Web Audio not available
  }

  if (_pendingSound) {
    _pendingSound = false;
    playChime();
  }
}

export function hasPendingSound(): boolean {
  return _pendingSound;
}

export function clearPendingSound(): void {
  _pendingSound = false;
}

/**
 * Internal: plays the two-tone chime via Web Audio API.
 * Returns true if the context was running and the sound was scheduled.
 */
async function playChime(): Promise<boolean> {
  try {
    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (ctx.state !== "running") return false;

    const now = ctx.currentTime;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.setValueAtTime(0.15, now + 0.12);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.connect(gain);
    osc1.start(now);
    osc1.stop(now + 0.14);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1318.5, now + 0.14); // E6
    osc2.connect(gain);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.7);

    return true;
  } catch {
    return false;
  }
}

/**
 * Plays the completion chime. If AudioContext is suspended (common on
 * iOS PWAs when called outside a user gesture), the sound is queued
 * and will play on the next user interaction via unlockAudio().
 * Also attempts vibration as a tactile fallback.
 */
export async function playCompletionSound(): Promise<void> {
  const played = await playChime();

  if (!played) {
    _pendingSound = true;
    try {
      navigator?.vibrate?.([80, 60, 80]);
    } catch {
      /* not available */
    }
  }
}

/**
 * Show a system notification when an agent finishes. Works even when
 * the PWA is backgrounded. Falls back silently if permission not granted.
 */
export function showCompletionNotification(agentName: string): void {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification("Agent finished", {
      body: agentName || "An agent has completed its task",
      icon: "/icons/icon.svg",
      tag: `agent-complete-${Date.now()}`,
    });
  } catch {
    // Notification API not available in this context
  }
}

/**
 * Request notification permission (must be called from user gesture).
 * Returns true if permission was granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

let _listenerAttached = false;

/**
 * Registers global interaction listeners that unlock the AudioContext
 * on every tap/click/keydown. Kept permanent (not one-shot) because
 * iOS PWAs re-suspend the AudioContext when backgrounded — we need
 * to re-unlock on the next interaction after returning to foreground.
 * Also re-attempts playing any queued sounds.
 * Safe to call multiple times — only attaches once.
 */
export function ensureAudioUnlockListener(): void {
  if (_listenerAttached || typeof window === "undefined") return;
  _listenerAttached = true;

  const onInteraction = () => unlockAudio();

  window.addEventListener("click", onInteraction, true);
  window.addEventListener("touchstart", onInteraction, true);
  window.addEventListener("keydown", onInteraction, true);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      try {
        const ctx = getAudioContext();
        if (ctx.state === "suspended") {
          ctx.resume();
        }
      } catch {
        /* ignore */
      }
    }
  });
}
