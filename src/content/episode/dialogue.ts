import type { Dialogue, Choice } from '../story';
import type { GameState } from '../../game/types';
import type { EpisodeActionId, NoteId, ReflectionId } from '../../game/episode/types';
import { actionAvailable, actionFor } from './interactions';
import { aftermathReady, hasReturned, preparationsReady } from '../../game/episode/progress';
import { noteEntries, reflectionEntries } from './journal';

const leave: Choice = { label: 'Return to the path', close: true };
const original = 'Original dialogue' as const;
const narration = 'Original narration' as const;
function action(state: GameState, id: EpisodeActionId): Choice[] {
  return actionAvailable(state, id)
    ? [{ label: actionFor(id).label, event: { type: 'episode-action', id }, close: true }]
    : [];
}
function noteChoice(state: GameState, id: NoteId): Choice[] {
  return state.episode.stage !== 'not-started' && !state.episode.notes.includes(id)
    ? [{ label: 'Remember this observation', event: { type: 'episode-note', id }, close: true }]
    : [];
}
function observation(state: GameState, id: NoteId): Dialogue {
  return {
    speaker: noteEntries[id].title,
    subtitle: 'An observation · Artistic interpretation',
    provenance: narration,
    text: noteEntries[id].text,
    choices: [...noteChoice(state, id), leave],
  };
}
function reflectionChoices(): Choice[] {
  return (Object.keys(reflectionEntries) as ReflectionId[]).map((id) => ({
    label: reflectionEntries[id].title,
    next: 'reflection-' + id,
  }));
}

/** Override only the episode-specific branches; legacy village conversations remain independent. */
export function episodeDialogue(id: string, s: GameState): Dialogue | null {
  const e = s.episode;
  if (id === 'simon' && s.quest === 'complete') {
    if (e.stage === 'not-started')
      return {
        speaker: 'Simon',
        subtitle: 'Into the Deep · The morning continues',
        provenance: original,
        text: 'Thank you for the net and bread. There are a few small things left to put in order on the shore. An empty basket by Miriam’s stall needs a place at the landing, and a loose rope is lying across the path. Would you help make room for the people who are gathering?',
        choices: [
          {
            label: 'I’ll help make room on the shore',
            event: { type: 'start-episode' },
            close: true,
          },
          { label: 'Tell me about the boats', next: 'boat-study' },
          { label: 'I’ll return when I am ready', close: true },
        ],
      };
    return {
      speaker: hasReturned(e) ? 'The boats at rest' : 'Simon',
      subtitle: hasReturned(e) ? 'The road ahead' : 'Making room on the shore',
      provenance: hasReturned(e) ? narration : original,
      text: hasReturned(e)
        ? 'The boats are here, but Simon and his partners have followed Jesus. Their departure belongs to Luke’s account. Your imagined traveler can remain with the village, or read the account again in the journal.'
        : preparationsReady(e)
          ? 'Everything is in its place. Find a spot near the water, friend. There is room for you to listen.'
          : 'There is an empty basket beside Miriam’s stall. Set it at the landing, coil the loose rope by the boats, and find a place at the edge of the gathering. Take your time.',
      choices: [{ label: 'About the work by the water', next: 'landing' }, leave],
    };
  }
  if (id === 'miriam' && hasReturned(e))
    return {
      speaker: 'Miriam',
      subtitle: 'After the boats return',
      provenance: original,
      text:
        (e.reflection
          ? 'You have the look of someone carrying a memory. ' +
            {
              wonder:
                'Keep a little room for surprise, traveler. There will be ordinary mornings again, and perhaps you will see them differently.',
              trust:
                'There are paths we know, and steps we have yet to take. I hope you find good company along yours.',
              community:
                'Then remember that there is room beside the stall whenever you return. A neighbor is glad to be remembered.',
            }[e.reflection]
          : 'The shore seems quieter now. I have no great speech for such a morning. There is still bread to share, though, and a place beside me if you would like to sit. Sometimes company is enough.') +
        (s.life.bench.stage === 'complete'
          ? ' The bench beside the landing is steady again. A neighbor has already stopped there. Thank you for making that little place useful.'
          : ''),
      choices: [
        ...action(s, 'talk-miriam'),
        { label: 'Tell me about the village', next: 'miriam-village' },
        leave,
      ],
    };
  if (id === 'ezra' && hasReturned(e) && !e.aftermath.includes('ezra'))
    return {
      speaker: 'Ezra',
      subtitle: 'A question for the road',
      provenance: original,
      text: 'A morning can leave more than one kind of memory. When you are ready, tell yourself what will stay with you. It need not be the same thing that stays with anyone else. There is no answer I am waiting for you to give.',
      choices: [
        ...action(s, 'talk-ezra'),
        { label: 'About our ordinary morning', next: 'ezra-village' },
        leave,
      ],
    };
  if (id === 'ezra-after' || (id === 'ezra' && hasReturned(e) && e.aftermath.includes('ezra')))
    return {
      speaker: 'Ezra',
      subtitle: 'What stays with you',
      provenance: original,
      text: e.reflection
        ? {
            wonder:
              'Wonder is a good companion if you let it ask its questions. You need not put the whole morning into words before you go.',
            trust:
              'Then carry that question gently. A journey is made of steps, and there is time to notice each one.',
            community:
              'I am glad you remember the people. A place is more than its paths and buildings; it is also the company we find there.',
          }[e.reflection]
        : 'Water, boats, voices on the shore: you have a morning to remember. When you have visited Miriam and helped by the landing, return to the viewpoint and choose a memory of your own.',
      choices: [
        ...action(s, 'talk-ezra'),
        { label: 'About our ordinary morning', next: 'ezra-village' },
        leave,
      ],
    };
  switch (id) {
    case 'supply-basket':
      return {
        speaker: 'The basket beside the stall',
        subtitle: 'Carry · An imagined act of help',
        provenance: narration,
        text: e.preparations.includes('basket')
          ? 'The empty basket you carried is at the landing now. There are other baskets beside the stall, but none needs to be moved.'
          : e.carrying
            ? 'You already have the empty basket in your hands. The landing is beside Simon’s boats.'
            : 'An empty woven basket stands beside the stall. Simon asked you to carry it to the landing. Its woven handles fit comfortably in your hands.',
        choices: [...action(s, 'take-basket'), leave],
      };
    case 'landing':
      return {
        speaker: 'The landing',
        subtitle: hasReturned(e) ? 'Assist · Back on shore' : 'Place · Beside the boats',
        provenance: narration,
        text: hasReturned(e)
          ? e.aftermath.includes('landing')
            ? 'A filled basket rests beside the landing. The boats are quiet, their cargo still visible. The fishermen have followed Jesus; the imagined village aftermath is yours to explore.'
            : 'You are back with your imagined traveler. The boats have returned, and a filled basket waits at the edge of the landing. You can help set it down nearby. This action is connective fiction after the Gospel scene.'
          : e.carrying
            ? 'There is a clear patch of ground beside the landing. You can set the empty basket here, within reach of anyone returning from the boats.'
            : e.preparations.includes('basket')
              ? 'The empty basket is where you left it. The landing is ready. A short path leads north to the gathering and the shoreline viewpoint.'
              : 'A clear patch of shore offers a place to put things down. In the traveler’s imagined errand, an empty basket waits by Miriam’s stall.',
        choices: [
          ...action(s, hasReturned(e) ? 'receive-catch' : 'place-basket'),
          { label: 'Look more closely at the landing', next: 'landing-study' },
          leave,
        ],
      };
    case 'mooring':
      return {
        speaker: 'A loose mooring rope',
        subtitle: 'Assist · An imagined act of help',
        provenance: narration,
        text: e.preparations.includes('mooring')
          ? 'The rope rests in a tidy coil beside the post. The path is clear. Your small task is finished.'
          : 'A loose length of rope lies beside the mooring post. Coil it out of the path so the gathering has room to pass.',
        choices: [
          ...action(s, 'secure-mooring'),
          { label: 'Look at the boat', next: 'boat-study' },
          leave,
        ],
      };
    case 'gathering':
      return {
        speaker: 'At the edge of the gathering',
        subtitle: 'Assist · A place to listen',
        provenance: narration,
        text: e.preparations.includes('gathering')
          ? 'There is room here for another neighbor. People face the water, leaving a little space between them. When the shore is ready, the viewpoint will lead into the Gospel scene.'
          : 'A few neighbors are finding their places. You step to the side, leaving room for someone else. The gathering settles, with a little space for each new arrival.',
        choices: [...action(s, 'join-gathering'), leave],
      };
    case 'viewpoint':
      if (e.stage === 'complete')
        return {
          speaker: 'The shore, and the road ahead',
          subtitle: 'Into the Deep · Complete',
          provenance: narration,
          text:
            reflectionEntries[e.reflection!].text +
            ' The episode is complete. The full account remains in your journal, and the village is open for walking, conversation, and Ezra’s optional story.',
          choices: [
            { label: 'Remember the reflection I chose', next: 'reflection-' + e.reflection },
            leave,
          ],
        };
      if (e.stage === 'aftermath')
        return {
          speaker: 'What stays with you',
          subtitle: 'A reflection of your own',
          provenance: narration,
          text: aftermathReady(e)
            ? 'You have helped at the landing and spent a little time with Miriam and Ezra. Pause beside the water. Which part of this morning would you like to carry in your journal? There is no preferred answer.'
            : 'The boats are back, and your traveler has returned to the village. Help set down a filled basket at the landing, visit Miriam, and speak with Ezra. Then return here to choose a memory of your own.',
          choices: aftermathReady(e) ? reflectionChoices() : [leave],
        };
      if (e.stage === 'witnessing')
        return {
          speaker: 'A view across the water',
          subtitle: 'Resume the Gospel account',
          provenance: narration,
          text: 'Your place in the narrated account has been kept. Return to the same scene whenever you are ready. Your traveler remains on shore while the presentation takes a closer view of the boats.',
          choices: [
            {
              label: 'Resume the account on the lake',
              event: { type: 'enter-scene' },
              close: true,
            },
            leave,
          ],
        };
      return {
        speaker: 'A view across the water',
        subtitle: 'Into the Deep · Luke 5:1–11',
        provenance: narration,
        text: preparationsReady(e)
          ? 'The shore is ready. Your traveler finds a place near the water. The next scenes are a narrated dramatization of Luke’s account, with closer views of the boats. Read at your own pace. You can pause, return to the village, or finish with a summary at any time.'
          : 'From here, you can look toward the boats. First, speak with Simon and help make room on the shore. The basket, loose rope, and gathering each offer a small imagined act of help.',
        choices:
          e.stage === 'preparing' && preparationsReady(e)
            ? [
                {
                  label: 'Witness the account on the lake',
                  event: { type: 'enter-scene' },
                  close: true,
                },
                leave,
              ]
            : [leave],
      };
    case 'landing-study':
      return observation(s, 'landing');
    case 'boat-study':
      return observation(s, 'boat');
    case 'net-study':
      return observation(s, 'net');
    case 'james':
    case 'john':
      return {
        speaker: id === 'james' ? 'James by the boat' : 'John beside the nets',
        subtitle: 'A narrated introduction · Luke 5:10',
        provenance: narration,
        reference: 'Luke 5:10',
        text: 'Luke names James and John, sons of Zebedee, as Simon’s partners. Here by the boats, the tools of their shared work are close at hand.',
        choices: [{ label: 'Notice the work around the boats', next: 'net-study' }, leave],
      };
    case 'reflection-wonder':
    case 'reflection-trust':
    case 'reflection-community': {
      const reflection = id.replace('reflection-', '') as ReflectionId;
      const entry = reflectionEntries[reflection];
      return {
        speaker: entry.title,
        subtitle: e.stage === 'complete' ? 'Your remembered reflection' : 'A page for your journal',
        provenance: narration,
        text: entry.text,
        choices:
          e.stage === 'aftermath' && aftermathReady(e)
            ? [
                {
                  label: 'Carry this memory with me',
                  event: { type: 'reflect', id: reflection },
                  close: true,
                },
                { label: 'Consider another memory', next: 'viewpoint' },
              ]
            : [leave],
      };
    }
    default:
      return null;
  }
}
