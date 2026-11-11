import type { WrapStyle } from "@/lib/wraps";

/**
 * A soft two-note chime made with Web Audio, so there are no sound files.
 * Must be first called from a tap: browsers only let audio start from a user gesture.
 */
let context: AudioContext | null = null;

const NOTES: Record<WrapStyle, number[]> = {
  card: [1318.5, 1975.5], // E6, B6: bright, like struck glass
  envelope: [1046.5, 1568], // C6, G6: warmer
  ticket: [1174.7, 1760], // D6, A6
};

export function scheduleChime(kind: WrapStyle, delayMs: number) {
  try {
    const Context =
      window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    context ??= new Context();
    const ctx = context;
    void ctx.resume();

    const start = ctx.currentTime + delayMs / 1000;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    // A soft paper "pop" under the first note.
    const length = Math.floor(ctx.sampleRate * 0.09);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1500;
    band.Q.value = 0.9;
    const popGain = ctx.createGain();
    popGain.gain.setValueAtTime(0.0001, start);
    popGain.gain.exponentialRampToValueAtTime(0.09, start + 0.006);
    popGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
    noise.connect(band).connect(popGain).connect(master);
    noise.start(start);

    NOTES[kind].forEach((frequency, index) => {
      const at = start + 0.04 + index * 0.085;
      for (const [multiple, level] of [
        [1, 0.06],
        [2.01, 0.012],
      ] as const) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = frequency * multiple;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(level, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.5);
        osc.connect(gain).connect(master);
        osc.start(at);
        osc.stop(at + 1.6);
      }
    });
  } catch {
    // Sound is a nicety. If the browser refuses, carry on silently.
  }
}
