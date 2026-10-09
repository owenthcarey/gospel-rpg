import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GameAudio } from '../../src/scene/audio';
import { newGame } from '../../src/game/types';
import { importSave } from '../../src/persistence/schema';
import { cueForState } from '../../src/content/audio/cues';

describe('chosen music', () => {
  it('replaces area music while exploring and returns to it when cleared', () => {
    const audio = new GameAudio();
    const state = newGame();
    audio.update(state);
    expect(audio.diagnostics().track).toBe(cueForState(state).track);
    audio.setManualTrack('open-door');
    expect(audio.diagnostics().track).toBe('open-door');
    audio.update(state);
    expect(audio.diagnostics().track).toBe('open-door');
    audio.setManualTrack(undefined);
    expect(audio.diagnostics().track).toBe(cueForState(state).track);
  });

  it('lets a Gospel account keep its own score, then resumes the choice', () => {
    const audio = new GameAudio();
    const storm = importSave(
      readFileSync('tests/fixtures/saves/v9-storm-waking.json', 'utf8'),
    ).state;
    audio.setManualTrack('first-light');
    audio.update(storm);
    expect(audio.diagnostics().track).toBe(cueForState(storm).track);
    expect(audio.manualTrack).toBe('first-light');
    audio.update(newGame());
    expect(audio.diagnostics().track).toBe('first-light');
  });
});
