let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/**
 * Plays a two-tone chime via Web Audio API — no audio file needed.
 * First tone is a soft high note, second resolves down, like a
 * gentle "task complete" notification.
 */
export function playCompletionSound(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume();

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
