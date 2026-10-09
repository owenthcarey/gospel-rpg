import type { ActorClip } from './assets';

/**
 * Cosmetic gestures the traveler can perform from the Emotes tab. Each plays an existing
 * clip once; none changes a story, a save or another person.
 */
export interface Emote {
  id: string;
  label: string;
  clip: ActorClip;
}

export const EMOTES: readonly Emote[] = [
  { id: 'wave', label: 'Wave', clip: 'Wave' },
  { id: 'bow', label: 'Bow', clip: 'Bow' },
  { id: 'cheer', label: 'Cheer', clip: 'Cheer' },
  { id: 'clap', label: 'Clap', clip: 'Clap' },
  { id: 'greet', label: 'Greet', clip: 'Greet' },
  { id: 'explain', label: 'Explain', clip: 'Gesture' },
  { id: 'listen', label: 'Listen', clip: 'Listen' },
  { id: 'kneel', label: 'Kneel', clip: 'Kneel' },
  { id: 'agree', label: 'Agree', clip: 'Respond' },
  { id: 'think', label: 'Think', clip: 'Think' },
  { id: 'shrug', label: 'Shrug', clip: 'Shrug' },
  { id: 'beckon', label: 'Beckon', clip: 'Beckon' },
  { id: 'yes', label: 'Yes', clip: 'Yes' },
  { id: 'no', label: 'No', clip: 'No' },
];

export function emote(id: string | undefined): Emote | undefined {
  return EMOTES.find((e) => e.id === id);
}
