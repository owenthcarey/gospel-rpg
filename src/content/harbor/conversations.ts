import type { GameState } from '../../game/types';
export function harborText(id: string, s: GameState): string {
  const h = s.harbor;
  if (id === 'eliab')
    return h.stage === 'complete'
      ? `The ${h.plank} crossing is still clear. ${h.ending === 'patience' ? 'You took time to look and try again. I have put that patience to work here.' : 'You left room for the next person. The cargo is safe, and the landing can be used again.'} Stay awhile; there is no more work you owe me.`
      : h.stage === 'ready'
        ? 'There is a dry way through. The cargo is safe, and I can reach the water again. What will you remember about the work?'
        : h.stage === 'not-started'
          ? 'This little landing has become awkward to use. Would you look at the water marks and the passage with me? We can move a plank and store the cargo. There is no hurry, and either side will do.'
          : 'Look at the marks on the stone before moving anything. Then try a crossing and check both ends. The plank and cargo can always be moved back.';
  if (id === 'harbor-water')
    return 'Water marks darken the middle strip. The north and south edges both have dry stone on either side. The plank must span the gap east–west, with its ends supported.';
  if (id === 'harbor-entrance')
    return 'The working passage runs from this western entrance to the landing on the east. A loose rope, a wet strip and cargo at the corners interrupt it. Either northern or southern crossing can make a useful route.';
  if (id === 'harbor-plank')
    return 'A stout plank rests on a low rack when not in use. It can span the north or south gap. Turn it so both ends rest on dry stone; placing it along the water leaves the crossing unsupported.';
  return id === 'harbor-nets'
    ? 'The bundled nets occupy the northern approach. A marked storage bay just beyond them keeps the cargo within reach while opening the corner.'
    : 'The jars stand at the southern approach. Their storage bay leaves room beside the plank without taking the cargo away from the landing.';
}
