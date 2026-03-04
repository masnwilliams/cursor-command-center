let audioCtx: AudioContext | null = null;

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
 * is unlocked for future programmatic playback (e.g. when an agent
 * finishes in the background). Mobile browsers and PWAs require a
 * user gesture to move the context out of "suspended" state.
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
}

/**
 * Plays a two-tone chime via Web Audio API — no audio file needed.
 * First tone is a soft high note, second resolves up, like a
 * gentle "task complete" notification.
 */
export async function playCompletionSound(): Promise<void> {
  try {
    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // Re-read currentTime after resume — it may have been frozen at 0
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
  } catch {
    // Web Audio not available — silently ignore
  }
}

let _listenerAttached = false;

/**
 * Registers global interaction listeners that unlock the AudioContext
 * on every tap/click/keydown. Kept permanent (not one-shot) because
 * iOS PWAs re-suspend the AudioContext when backgrounded — we need
 * to re-unlock on the next interaction after returning to foreground.
 * Safe to call multiple times — only attaches once.
 */
export function ensureAudioUnlockListener(): void {
  if (_listenerAttached || typeof window === "undefined") return;
  _listenerAttached = true;

  const onInteraction = () => unlockAudio();

  window.addEventListener("click", onInteraction, true);
  window.addEventListener("touchstart", onInteraction, true);
  window.addEventListener("keydown", onInteraction, true);
}
