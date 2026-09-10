import type { JournalEntry } from '../campaign/journal';
import type { NainReflection, TrailEvidence, TrailInterpretation } from '../../game/road/types';
import { nainBeats } from './scenes';
export const tamarRecollection =
  'I remember a resting shelter beside a split olive. Two pale stones stood together on the way to it. There was water along the road, but the resting place itself was dry. I would like to find that place again.';
export const trailEvidence: Record<
  TrailEvidence,
  { title: string; detail: string; observation: string }
> = {
  spring: {
    title: 'Water and a carved branch',
    detail:
      'A single dark stone stands beside a shallow spring. A carved branch points west. The ground at its foot is wet.',
    observation:
      'This is a place along the way. Tamar remembers a dry resting place beside two pale stones, so the spring itself does not match.',
  },
  terrace: {
    title: 'Two pale stones',
    detail:
      'Two pale stones stand side by side at the terrace turn. A branching mark on the nearer stone points back toward the western farm. The exposed path continues east up the ridge.',
    observation:
      'The paired stones match Tamar’s recollection. Their branch mark leads toward the farm, away from the exposed ridge.',
  },
};
export const interpretationText: Record<TrailInterpretation, { label: string; response: string }> =
  {
    shelter: {
      label: 'The western farm · Shelter and a split olive',
      response:
        'Both details agree: the branch points west, and the paired stones lead to the farm. Look for the split olive beside its dry shelter.',
    },
    ridge: {
      label: 'The eastern ridge · Beyond the terrace stones',
      response:
        'The stones match, but their branching mark points back toward the farm. The exposed ridge has no resting shelter. Keep both observations and try another route.',
    },
    spring: {
      label: 'The spring · Beside the dark stone',
      response:
        'The spring has one dark stone and wet ground. Tamar remembers two pale stones and a dry place beneath a split olive. Your evidence is safe; compare it again.',
    },
  };
export const nainReflections: Record<NainReflection, JournalEntry> = {
  compassion: {
    title: 'Compassion at the gate',
    text: 'I remember the Lord seeing the mother and having compassion on her. In the ordinary places of my imagined journey, I want to make room to notice the people around me.',
  },
  restoration: {
    title: 'Given to his mother',
    text: 'I remember the son given to his mother. Luke’s account stays with me as an account of life restored and a relationship brought again into the center of the gathered people.',
  },
  wonder: {
    title: 'Wonder shared',
    text: 'I remember the people’s fear and praise, and the report that went beyond the gate. There is room in my traveler’s memory to remain with their wonder.',
  },
};
export const roadJournal: Record<string, JournalEntry> = {
  'nain-invitation': {
    title: 'Beyond Capernaum',
    text: 'At a later time in the traveler’s imagined journey, a compact road leads through Galilee to Nain. The route, farm and buildings are artistic interpretations. Luke 7:11–17 awaits at the gate; no optional task is required.',
    reference: 'Luke 7:11–17',
  },
  'nain-after-gate': {
    title: 'An open gate',
    text: 'I returned to the gate after the account. This imagined place holds a memory of the meeting described by Luke, without claiming to reconstruct the gate itself.',
  },
  'nain-after-courtyard': {
    title: 'Room to be still',
    text: 'I spent a quiet moment in the courtyard. There was no task to perform and no explanation to provide. The full account remains in my journal.',
  },
  'nain-after-neighbor': {
    title: 'Company after the account',
    text: 'Adina, a fictional neighbor, offered company beside the gate. Our conversation belongs to the original traveler story; she does not speak for the people in Luke’s account.',
  },
  'nain-complete': {
    title: 'At the gate',
    text: 'I have read Luke’s account, returned to the gate and courtyard, listened to Adina and chosen a reflection. The road, farm and Capernaum remain open.',
    reference: 'Luke 7:11–17',
  },
  'trail-invitation': {
    title: 'A way remembered',
    text:
      'Tamar shared her recollection: “' +
      tamarRecollection +
      '” I can inspect the spring and terrace markers in either order. This is an original traveler story.',
  },
  'trail-interpreted': {
    title: 'Two details agree',
    text: 'The spring is a place on the way, not the destination. Two pale stones and a branching mark point toward the western farm and its dry resting shelter.',
  },
  'trail-arrived': {
    title: 'Under a split olive',
    text: 'At the farm, two pale stones stand beside a dry shelter and a split olive. This is the place Tamar remembered. I can return to share what I found.',
  },
  'trail-ending-observation': {
    title: 'Looking closely',
    text: 'Tamar and I remembered how one detail alone could lead to the wrong place. Looking at the water, stones and branch together made the way clear.',
  },
  'trail-ending-company': {
    title: 'A place kept in company',
    text: 'Tamar and I remembered the company a resting place can hold. The shelter has become part of a shared memory along the road.',
  },
  'trail-complete': {
    title: 'A way found again',
    text: 'Tamar’s resting place is found and our chosen memory is recorded. I can revisit both markers and the shelter whenever I like.',
  },
  'company-invitation': {
    title: 'Company on the road',
    text: 'Neri welcomed company from the farm to Nain. We can walk beneath the olives or take the open terraces. He will wait wherever I leave him; the journey map will show where to meet again.',
  },
  'company-route-shade': {
    title: 'Beneath the olives',
    text: 'Neri and I chose the western shade. Olive trees and a sheltered bend mark our road to Nain.',
  },
  'company-route-terrace': {
    title: 'Across the terraces',
    text: 'Neri and I chose the open terraces. A crossing below the spring and a view from the upper bend mark our road to Nain.',
  },
  'company-arrived': {
    title: 'At Nain together',
    text: 'We arrived at the quiet courtyard together. Neri has a place beside the bench, and there is time for a final conversation.',
  },
  'company-complete': {
    title: 'A road shared',
    text: 'Our chosen route is remembered. Neri remains seated in the courtyard at Nain, glad to see a familiar traveler again.',
  },
  ...Object.fromEntries(
    Object.entries(trailEvidence).map(([id, e]) => [
      'trail-evidence-' + id,
      { title: e.title, text: e.detail + ' ' + e.observation },
    ]),
  ),
  ...Object.fromEntries(
    nainBeats.map((b) => [
      'nain-scene-' + b.id,
      { title: b.title, text: b.description, reference: b.reference },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(nainReflections).map(([id, e]) => ['nain-reflection-' + id, e]),
  ),
};
