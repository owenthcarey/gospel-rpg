import { describe, expect, it } from 'vitest';
import { galileeText } from '../../src/content/galilee/conversations';
import { galileeContext } from '../../src/ui/views/galilee';
import { workTarget } from '../../src/content/exploration/work';
import { roadStart } from '../helpers/road';
import { galileeAction, connectSpring } from '../helpers/galilee';

function borrowScoop() {
  let s = roadStart();
  for (const id of ['spring-start', 'spring-note-source', 'spring-note-basins', 'spring-borrow'])
    s = galileeAction(s, id);
  return s;
}

describe('spring inspections follow the physical work', () => {
  it('keeps the initial source and rack clues', () => {
    const s = roadStart();
    expect(galileeText('spring-source', s)).toBe(
      'A small source enters the stone channel from the west. Loose stones interrupt the inlet and silt fills the entry trough. Beyond it, loose sections can be turned by hand. The water will only reach a basin if their open ends meet.',
    );
    expect(galileeText('spring-tools', s)).toBe(
      'A wooden scoop lies on a low rack. Use it to lift the inlet stones and entry silt. Put it back before turning the channel with both hands. You can leave and return without losing work.',
    );
  });

  it('describes an empty rack while the scoop is borrowed, then restores its place on return', () => {
    const carrying = borrowScoop();
    expect(carrying.campaign.carrying).toBe('channel-scoop');
    expect(galileeText('spring-tools', carrying)).toContain('rack is empty while you carry');
    expect(galileeText('spring-tools', carrying)).toContain('lift the inlet stones and entry silt');
    const returned = galileeAction(carrying, 'spring-return');
    expect(galileeText('spring-tools', returned)).toContain('scoop lies on a low rack');
    expect(galileeText('spring-tools', returned)).not.toContain('rack is empty');
  });

  for (const first of ['inlet', 'silt'] as const) {
    it(`describes the actual remaining work after clearing ${first} first and returning early`, () => {
      let s = galileeAction(borrowScoop(), 'spring-clear-' + first);
      const source = galileeText('spring-source', s);
      expect(source).toContain('enters the stone channel from the west');
      expect(source).toContain('open ends meet');
      if (first === 'inlet') {
        expect(source).toContain('inlet stones lie beside the source');
        expect(source).toContain('Silt still fills the entry trough');
        expect(source).not.toContain('stones still interrupt');
      } else {
        expect(source).toContain('Loose stones still interrupt the inlet');
        expect(source).toContain('entry trough is clear of silt');
        expect(source).not.toContain('Silt still fills');
      }
      const remaining = first === 'inlet' ? 'entry silt' : 'inlet stones';
      expect(galileeText('spring-tools', s)).toContain('clear the remaining ' + remaining);
      s = galileeAction(s, 'spring-return');
      expect(galileeText('spring-tools', s)).toContain('scoop lies on a low rack');
      expect(galileeText('spring-tools', s)).toContain('clear the remaining ' + remaining);
      expect(galileeText('spring-tools', s)).not.toContain('lift the inlet stones and entry silt');
    });

    it(`keeps both-clear, carried and returned inspections truthful after ${first} first`, () => {
      let s = borrowScoop();
      for (const id of [first, first === 'inlet' ? 'silt' : 'inlet'])
        s = galileeAction(s, 'spring-clear-' + id);
      const source = galileeText('spring-source', s);
      expect(source).toContain('inlet stones lie beside the source');
      expect(source).toContain('entry trough is clear of silt');
      expect(source).not.toContain('interrupt');
      expect(source).not.toContain('fills the entry');
      expect(workTarget(s, 'spring-source')?.text).toBe(source);
      expect(galileeContext('spring-source', s)?.body).toContain(source);
      const held = galileeText('spring-tools', s);
      expect(held).toContain('rack is empty while you carry');
      expect(held).toContain('inlet and entry trough are clear');
      expect(held).toContain('Put the scoop back before turning');
      expect(held).not.toContain('Use it to');
      s = galileeAction(s, 'spring-return');
      const returned = galileeText('spring-tools', s);
      expect(returned).toContain('scoop lies on a low rack');
      expect(returned).toContain('Turn the channel sections with free hands');
      expect(returned).not.toContain('Put the scoop back');
      expect(galileeContext('spring-tools', s)?.body).toContain(returned);
    });
  }

  it('preserves the completed source and describes the rack after the work is settled', () => {
    const s = galileeAction(connectSpring(), 'spring-finish-patience');
    expect(s.galilee.spring.stage).toBe('complete');
    expect(galileeText('spring-source', s)).toBe(
      'A narrow ribbon of water follows the connected channel. The scoop rests on its rack, and the cleared stones lie beside the source. A traveler pauses at the receiving basin. The work remains part of this imagined road.',
    );
    expect(galileeText('spring-tools', s)).toBe(
      'The wooden scoop rests on its low rack. The inlet stones lie beside the source and the entry trough is clear of silt. Water follows the channel to a roadside basin. The work is remembered.',
    );
  });
});
