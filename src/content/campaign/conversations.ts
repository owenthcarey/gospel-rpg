import type { GameState } from '../../game/types';
import { roofReturned } from '../../game/campaign/progress';
/** Every voice here is an original fictional neighbor or traveler narration. */
export function neighborhoodText(id: string, s: GameState): string {
  const c = s.campaign;
  if (id === 'amos') {
    if (c.walk.stage === 'complete')
      return 'Amos rests in the shade. “A familiar lane feels different with company. Stay a while, if you have nowhere else to be.”';
    if (c.walk.stage === 'arrived')
      return '“Here we are,” Amos says. He looks back along the lane. “Thank you for letting the walk take the time it needed.”';
    if (c.walk.stage === 'walking')
      return 'Amos looks toward the next turn. “I am with you. Let us meet just ahead.” He will pause if you leave the lane or move too far away.';
    if (c.walk.route === 'passage')
      return '“The passage is shorter,” Amos says, “but that handcart is across it. Hannah keeps its removable handle on the tool shelf. We can move it aside without rushing anyone.”';
    if (c.walk.route === 'outer')
      return '“The outer lane is a little longer. There is room for two to walk there.” Amos waits until you are ready.';
    return '“I was going to sit in the courtyard,” Amos says. “Would you walk with me? We can take the narrow passage, or go around by the outer lane.” Neither route is a better answer.';
  }
  if (id === 'hannah') {
    const prior =
      (s.episode.reflection
        ? {
            wonder: ' You remember the astonishment you carried from the lake.',
            trust: ' You remember Simon’s response and your reflection on trust.',
            community: ' You remember the other boat and your reflection on shared work.',
          }[s.episode.reflection]
        : '') +
      (s.villageMemory
        ? ' The memory of the ' +
          s.villageMemory +
          ' that you shared with Ezra stays with you here.'
        : '');
    if (c.table.stage === 'complete')
      return (
        'Hannah glances toward the ' +
        c.table.location +
        '. “Bread and water, and a place to stop. That is a welcome I know how to make.”' +
        (roofReturned(s) ? ' The afternoon holds a quiet amazement.' : ' The oven is cooling.')
      );
    if (roofReturned(s))
      return (
        'Hannah sets down a cloth. “I keep thinking of the room before, and the room after. I have no clever words for it. Will you sit for a moment?” Her response is an imagined conversation, not a quotation from the Gospel.' +
        prior
      );
    return '“There is bread on the shelf and an empty jug opposite it,” Hannah says. “We could set a table here, or out in the courtyard. If you would like to help, choose the place. Bring bread and water in whichever order suits your walk.”';
  }
  if (id === 'ruth' && c.table.stage === 'complete')
    return (
      'Ruth smiles toward the ' +
      c.table.location +
      '. “You have made a place for us. I will sit there when the afternoon is quiet.”' +
      (roofReturned(s)
        ? ' She leaves room for you to reflect on the account together.'
        : ' The gathering house remains open whenever you wish to visit.')
    );
  if (id === 'ruth')
    return roofReturned(s)
      ? 'Ruth makes room beside her. “I came with so many thoughts. For a little while, I only want to listen.” Her company does not explain the miracle; it gives your traveler a place to reflect.'
      : 'Ruth looks toward the gathering house. “There is a room full of people up ahead. You can go in, or stay among the lanes a while.” Some days have passed since the morning by the lake. The game does not give that interval an exact length.';
  if (id === 'house-viewpoint')
    return roofReturned(s)
      ? 'The room is quiet now. You remember the words, the opened roof, and a man walking away with his mat. What will your traveler carry from this account?'
      : 'This room opens a narrated presentation of Mark 2:1–12. Your traveler observes the account; no errand, route choice, or gift causes the healing. You may leave and resume at any checkpoint.';
  if (id === 'passage')
    return c.walk.gateOpen
      ? 'The handcart stands beside the wall. The passage remains open for the rest of your visit.'
      : 'A handcart rests across the narrow passage. Its handle is stored in the bakehouse. The outer lane stays open.';
  if (id === 'amos-waypoint')
    return 'This is the next meeting point. Stay near Amos as he walks; the next turn appears once you have both arrived. Menus pause the walk.';
  if (id.endsWith('-table'))
    return c.table.location
      ? 'You chose the ' +
          c.table.location +
          ' table. Bread and water placed there remain visible when you return.'
      : 'A plain table offers a place to share bread and water. Hannah can help you choose where to prepare a welcome.';
  if (id === 'bread-shelf')
    return 'A woven basket holds fresh bread. Carry one object at a time; this basket can be returned to its shelf whenever you wish.';
  if (id === 'jug-shelf')
    return 'An earthenware jug stands ready for water. Take it to the water point in the lanes, then bring it to your chosen table.';
  if (id === 'tool-shelf')
    return 'The removable handle fits the handcart outside. Borrow it after choosing the passage with Amos, then use it at the cart.';
  return 'Pause and notice the everyday details of this neighborhood. The places and objects are an artistic reconstruction; journal notes distinguish observation from scripture.';
}
