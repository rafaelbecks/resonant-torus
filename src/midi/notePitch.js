/** MIDI note number for C3 — reference pitch (pitchMultiplier = 1). */
export const MIDI_REF_NOTE = 48;

/**
 * Interval ratio from a MIDI note relative to the reference.
 * C3 maps to 1.0; other notes scale by semitone ratio (whole model, chamber ratios unchanged).
 */
export function midiNoteToPitchMultiplier(note, refNote = MIDI_REF_NOTE) {
  const semitones = Number(note) - refNote;
  return Math.pow(2, semitones / 12);
}

/** Human-readable note name for status display. */
export function midiNoteName(note) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const n = Math.round(Number(note));
  const octave = Math.floor(n / 12) - 1;
  return `${names[((n % 12) + 12) % 12]}${octave}`;
}
