import type { GameState } from '../../game/types';
/** All speakers and practical details here belong to the imagined traveler’s story. */
export function lifeText(id: string, s: GameState): string | undefined {
  const { thread, bench } = s.life;
  switch (id) {
    case 'ruth':
      if (thread.stage === 'complete')
        return thread.ending === 'route'
          ? '“You noticed the small things,” Ruth says. Her blue-edged pouch rests beside her. “When I take that walk again, I will remember the way you told it.” She makes room for your company.'
          : 'Ruth’s pouch rests beside her. She looks up and makes room without hurrying you into conversation. The quiet welcome you shared is still here.';
      if (thread.stage === 'returned')
        return 'Ruth opens the pouch and finds her folded cloth safe inside. “There it is. Thank you for bringing it back.” You may tell her where the clues led, or stay for a quiet welcome. Neither asks anything more of you.';
      if (thread.stage === 'identified')
        return s.campaign.carrying === 'sewing-pouch'
          ? 'Ruth recognizes the blue edging in your hands. “You found it. Those two little stitches are mine.”'
          : 'Ruth listens as you describe the matching thread and paired stitches. “That does sound like mine. I will be here when you bring it.”';
      if (thread.stage === 'searching')
        return '“I paused at the water point, left some mending with Hannah, and walked to the shore,” Ruth recalls. “My pouch has blue edging. I sew two small stitches together, with a little space after them.” Both clues can be remembered in your journal.';
      return 'Ruth turns an empty fold of her shawl. “I have misplaced my sewing pouch. It was with me at the water point, or perhaps when I left my mending in Hannah’s bakehouse. I walked down to the shore afterward.” She would welcome help, whenever you have time.';
    case 'thread-clue':
      return thread.clues.includes('water')
        ? 'The deep blue thread remains caught on the low stone. You have remembered its color. The journal keeps it beside the other evidence.'
        : 'A short blue thread catches on the edge of the low stone. There are many colors of cloth in the lanes. Ruth’s description gives this small trace a meaning; it is a clue to compare, not a conclusion by itself.';
    case 'cloth-clue':
      return 'Hannah has kept Ruth’s mending cloth on a low tray. Blue thread borders the folded fabric. Along the seam are two short stitches together, then a little space, repeated carefully. The pattern is easy to remember once you have looked.';
    case 'sewing-rest':
      if (['returned', 'complete'].includes(thread.stage))
        return 'The little resting place is empty. Ruth’s pouch is safe beside her in the courtyard.';
      if (s.campaign.carrying === 'sewing-pouch')
        return 'This is the dry resting place where you found the pouch. You may set it back safely and recover it later; the clues and its identity will remain in your journal.';
      if (thread.stage === 'identified')
        return 'The pouch’s deep blue edging matches the water-point thread. The seam carries the same paired stitches as Ruth’s cloth. You have compared both details and can carry it back to her.';
      return 'A small cloth pouch rests above the damp sand. Its edging is blue, with an unusual seam. It may be the pouch Ruth misplaced. Before taking it, remember the thread by the water point and the cloth in the bakehouse, then compare both details here.';
    case 'landing-bench':
      if (bench.stage === 'complete')
        return (
          'The repaired bench is steady. A neighbor has stopped to rest by the landing. ' +
          (bench.method === 'lashing'
            ? 'The crossed rope lashing holds the support firmly.'
            : 'The wooden brace fits beneath the seat.') +
          ' Miriam has noticed the place made useful again.'
        );
      if (bench.stage === 'fitted')
        return 'The repair is fitted. The seat looks steady, but an empty bench cannot tell the whole story. Set down anything in your hands and sit for a moment to check it.';
      if (bench.stage === 'working')
        return (
          (bench.cleared
            ? 'The loose pieces are stacked safely beside the seat. '
            : 'Loose pieces still lie beneath the seat. Clear them before fitting the repair. ') +
          (bench.method === 'lashing'
            ? 'Spare cord waits in the basket near the landing.'
            : 'A spare wooden brace waits in the bakehouse.') +
          ' Clearing and fetching can happen in either order; you can leave and return to either step.'
        );
      return 'The landing bench rocks against a loose support. Miriam has placed the fallen pieces underneath so nobody trips over them. A rope lashing around the support would steady it; a fitted wooden brace could do the same. The bench is an ordinary village seat, separate from the boats and landing.';
    case 'cord-basket':
      return 'A small basket holds spare cord beside the landing. There is enough here for a crossing lashing on the bench support. Borrow it if you chose that method; you can put it back whenever you need free hands.';
    case 'brace-shelf':
      return 'Hannah has kept a sound offcut with a broad end that will fit beneath the bench. It is available for the wooden-brace repair. Return it to this shelf if your work needs to wait.';
  }
}
