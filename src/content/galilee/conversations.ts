import type { GameState } from '../../game/types';
import { REST_LAYOUTS } from '../../game/galilee/arrangement';
export function galileeText(id: string, s: GameState): string {
  const g = s.galilee;
  if (id === 'leah') {
    if (g.shelter.stage === 'complete')
      return `Leah pauses beside the path. “There is company at ${g.shelter.site === 'shade' ? 'the shaded place' : 'the open resting place'} now. The approach you left clear makes it easy to join them.” ${g.spring.stage === 'complete' ? 'She has heard that water reaches the roadside basin again. “A useful stop on either side of the journey,” she says.' : 'She looks toward the road. “A small place can make a long walk easier.”'}`;
    if (g.shelter.stage === 'ready')
      return 'Leah looks over the resting place. “A mat, water, shelter, and room to enter. You thought about the person who would arrive.” She invites you to remember the welcome or the care that went into it.';
    return 'Leah folds a length of linen beside the farm path. “Some travelers would welcome a place to stop. There is shade west of the path and a breezier patch to the east. Look at both before choosing. The rack has a mat, a jar of water and a folding screen. You may move them again if the first arrangement does not suit.”';
  }
  if (id === 'spring-source')
    return g.spring.stage === 'complete'
      ? 'A narrow ribbon of water follows the connected channel. The scoop rests on its rack, and the cleared stones lie beside the source. A traveler pauses at the receiving basin. The work remains part of this imagined road.'
      : 'A small source enters the stone channel from the west. Loose stones interrupt the inlet and silt fills the entry trough. Beyond it, loose sections can be turned by hand. The water will only reach a basin if their open ends meet.';
  if (id === 'spring-basins')
    return 'Two shallow basins stand east of the work, one north and one south. Both are useful. Follow the openings from the source through the entry, central turn and one branch. The unused branch can remain dry.';
  if (id === 'spring-tools')
    return 'A wooden scoop lies on a low rack. Use it to lift the inlet stones and entry silt. Put it back before turning the channel with both hands. You can leave and return without losing work.';
  if (id === 'rest-supplies')
    return 'Leah has set aside one woven mat, one jar of water and one folding reed screen. Carry one at a time. Unplaced supplies remain here; placed supplies can be picked up again until you finish with Leah.';
  if (id === 'rest-shade' || id === 'rest-breeze')
    return REST_LAYOUTS[id === 'rest-shade' ? 'shade' : 'breeze'].description;
  return 'This section has two open ends. Turn it a quarter turn clockwise, then follow the openings on the plan. A straight section connects opposite sides; a bend connects neighboring sides. Test the route at the source.';
}
export function galileeAcknowledgement(id: string, s: GameState): string {
  if (!['tamar', 'neri', 'adina', 'ruth', 'miriam'].includes(id)) return '';
  const lines: string[] = [];
  if (s.galilee.spring.stage === 'complete')
    lines.push(
      id === 'tamar'
        ? 'Tamar remembers the water now reaching a basin beside her road.'
        : 'News of a useful spring beside the road has traveled between neighbors.',
    );
  if (s.galilee.shelter.stage === 'complete')
    lines.push(
      id === 'neri'
        ? 'Neri remembers the resting place at the farm, without leaving the place where your own walk brought him.'
        : 'Leah’s resting place welcomes travelers back at the farm.',
    );
  if (lines.length && s.episode.reflection === 'community')
    lines.push('It recalls the company you remembered after the boats returned.');
  if (lines.length && s.villageMemory === 'olive')
    lines.push('The shade brings back the grove you remembered with Ezra.');
  return lines.join(' ');
}
