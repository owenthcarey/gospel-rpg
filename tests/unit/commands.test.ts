import { describe, expect, it } from 'vitest';
import { parseStoryCommand } from '../../src/game/commands';
import { noticeFor, motionFor } from '../../src/content/notices';
import { newGame } from '../../src/game/types';

describe('interface commands and notices (RFC-011 main split)', () => {
  it('turns untrusted data values into typed events only when they are known', () => {
    expect(parseStoryCommand('galilee-turn', 'north:2')).toBeDefined();
    expect(parseStoryCommand('galilee-turn', 'zz:2')).toBeUndefined();
    expect(parseStoryCommand('galilee-turn', 'a:9')).toBeUndefined();
    expect(parseStoryCommand('galilee-screen', '3')).toEqual({
      type: 'galilee-screen',
      expected: 3,
    });
    expect(parseStoryCommand('galilee-screen', '<script>')).toBeUndefined();
    expect(parseStoryCommand('road-ending', 'not-an-ending')).toBeUndefined();
    expect(parseStoryCommand('nain-next', 'approach')).toEqual({
      type: 'nain-next',
      checkpoint: 'approach',
    });
    expect(parseStoryCommand('roof-next', 'nowhere')).toBeUndefined();
    expect(parseStoryCommand('road-hint')).toEqual({ type: 'road-hint' });
    expect(parseStoryCommand('unknown-command', 'x')).toBeUndefined();
  });
  it('derives ribbons and motions from the accepted event and saved state only', () => {
    const s = newGame();
    expect(noticeFor({ type: 'track-story', story: 'main' }, s, s)).toMatch(/tracked/);
    expect(noticeFor({ type: 'collect', item: 'net' }, s, s)).toMatch(/satchel/);
    expect(noticeFor({ type: 'collect', item: 'net' }, { ...s, inventory: ['net'] }, s)).toBe(
      undefined,
    );
    expect(motionFor({ type: 'galilee-turn', id: 'north', expected: 1 }, s, s)).toEqual({
      motion: 'Repair',
      target: 'channel-north',
    });
    expect(motionFor({ type: 'track-story', story: 'main' }, s, s)).toBeUndefined();
  });
});
