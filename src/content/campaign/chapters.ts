import type { GameState } from '../../game/types';
import type { RegionId, StoryTrack } from '../../game/campaign/types';
import { ROOF_SOURCE } from './scripture';
import { NAIN_SOURCE } from '../road/scripture';
/** Shared story metadata. Reducers own progress; views never invent unlock conditions. */
export interface ChapterDefinition {
  id: StoryTrack;
  title: string;
  label: string;
  region: RegionId;
  optional: boolean;
  source: { title: string; url: string } | null;
  available: (s: GameState) => boolean;
  complete: (s: GameState) => boolean;
  started: (s: GameState) => boolean;
}
const afterLake = (s: GameState) => s.episode.stage === 'complete';
const afterRoof = (s: GameState) => s.campaign.roof.stage === 'complete';
export const chapters: Record<StoryTrack, ChapterDefinition> = {
  spring: {
    id: 'spring',
    title: 'A spring for travelers',
    label: 'Optional · Restore a water channel',
    region: 'galilean-road',
    optional: true,
    source: null,
    available: afterRoof,
    started: (s) => s.galilee.spring.stage !== 'not-started',
    complete: (s) => s.galilee.spring.stage === 'complete',
  },
  shelter: {
    id: 'shelter',
    title: 'Room under the olives',
    label: 'Optional · Prepare a resting place',
    region: 'roadside-farm',
    optional: true,
    source: null,
    available: afterRoof,
    started: (s) => s.galilee.shelter.stage !== 'not-started',
    complete: (s) => s.galilee.shelter.stage === 'complete',
  },
  main: {
    id: 'main',
    title: 'Into the Deep',
    label: 'Chapter I · Luke 5:1–11',
    region: 'capernaum',
    optional: false,
    source: { title: 'Luke 5:1–11', url: 'https://ebible.org/engwebp/LUK05.htm' },
    available: () => true,
    complete: afterLake,
    started: (s) => s.quest !== 'not-started',
  },
  village: {
    id: 'village',
    title: 'An ordinary morning',
    label: 'Optional · Ezra’s village story',
    region: 'capernaum',
    optional: true,
    source: null,
    available: () => true,
    complete: (s) => s.villageStory === 'complete',
    started: (s) => s.villageStory !== 'not-started',
  },
  roof: {
    id: 'roof',
    title: 'Through the Roof',
    label: 'Chapter II · Mark 2:1–12',
    region: 'gathering-house',
    optional: false,
    source: ROOF_SOURCE,
    available: afterLake,
    complete: (s) => s.campaign.roof.stage === 'complete',
    started: (s) => s.campaign.roof.stage !== 'not-started',
  },
  neighbors: {
    id: 'neighbors',
    title: 'A way together',
    label: 'Optional · Walk with Amos',
    region: 'capernaum-lanes',
    optional: true,
    source: null,
    available: afterLake,
    complete: (s) => s.campaign.walk.stage === 'complete',
    started: (s) => s.campaign.walk.stage !== 'not-started',
  },
  table: {
    id: 'table',
    title: 'A table for neighbors',
    label: 'Optional · Share bread and water',
    region: 'bakehouse',
    optional: true,
    source: null,
    available: afterLake,
    complete: (s) => s.campaign.table.stage === 'complete',
    started: (s) => s.campaign.table.stage !== 'not-started',
  },
  belonging: {
    id: 'belonging',
    title: 'A familiar thread',
    label: 'Optional · Find Ruth’s sewing pouch',
    region: 'capernaum-lanes',
    optional: true,
    source: null,
    available: afterLake,
    complete: (s) => s.life.thread.stage === 'complete',
    started: (s) => s.life.thread.stage !== 'not-started',
  },
  rest: {
    id: 'rest',
    title: 'A place to rest',
    label: 'Optional · Mend the landing bench',
    region: 'capernaum',
    optional: true,
    source: null,
    available: afterLake,
    complete: (s) => s.life.bench.stage === 'complete',
    started: (s) => s.life.bench.stage !== 'not-started',
  },
  nain: {
    id: 'nain',
    title: 'At the gate',
    label: 'Chapter III · Luke 7:11–17',
    region: 'nain-gate',
    optional: false,
    source: NAIN_SOURCE,
    available: afterRoof,
    started: (s) => s.road.chapter.stage !== 'not-started',
    complete: (s) => s.road.chapter.stage === 'complete',
  },
  trail: {
    id: 'trail',
    title: 'A way remembered',
    label: 'Optional · Follow Tamar’s recollection',
    region: 'galilean-road',
    optional: true,
    source: null,
    available: afterRoof,
    started: (s) => s.road.trail.stage !== 'not-started',
    complete: (s) => s.road.trail.stage === 'complete',
  },
  company: {
    id: 'company',
    title: 'Company on the road',
    label: 'Optional · Walk with Neri to Nain',
    region: 'roadside-farm',
    optional: true,
    source: null,
    available: afterRoof,
    started: (s) => s.road.company.stage !== 'not-started',
    complete: (s) => s.road.company.stage === 'complete',
  },
};
export const neighborhoodChapters = ['roof', 'neighbors', 'table', 'belonging', 'rest'] as const;
export const roadChapters = ['nain', 'trail', 'company'] as const;
export function trackedChapter(s: GameState): ChapterDefinition {
  return chapters[
    s.tracking === 'main' && afterLake(s) ? (afterRoof(s) ? 'nain' : 'roof') : s.tracking
  ];
}
export function storyStatus(
  s: GameState,
  id: StoryTrack,
): 'unavailable' | 'available' | 'in-progress' | 'complete' {
  const chapter = chapters[id];
  if (!chapter.available(s)) return 'unavailable';
  if (chapter.complete(s)) return 'complete';
  return chapter.started(s) ? 'in-progress' : 'available';
}
