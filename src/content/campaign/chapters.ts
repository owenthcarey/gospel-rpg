import type { GameState } from '../../game/types';
import type { RegionId, StoryTrack } from '../../game/campaign/types';
import { ROOF_SOURCE } from './scripture';
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
}
const afterLake = (s: GameState) => s.episode.stage === 'complete';
export const chapters: Record<StoryTrack, ChapterDefinition> = {
  main: {
    id: 'main',
    title: 'Into the Deep',
    label: 'Chapter I · Luke 5:1–11',
    region: 'capernaum',
    optional: false,
    source: { title: 'Luke 5:1–11', url: 'https://ebible.org/engwebp/LUK05.htm' },
    available: () => true,
    complete: afterLake,
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
  },
};
export const neighborhoodChapters = ['roof', 'neighbors', 'table'] as const;
export function storyStatus(
  s: GameState,
  id: StoryTrack,
): 'unavailable' | 'available' | 'in-progress' | 'complete' {
  const chapter = chapters[id];
  if (!chapter.available(s)) return 'unavailable';
  if (chapter.complete(s)) return 'complete';
  const started =
    id === 'main'
      ? s.quest !== 'not-started'
      : id === 'village'
        ? s.villageStory !== 'not-started'
        : id === 'roof'
          ? s.campaign.roof.stage !== 'not-started'
          : id === 'neighbors'
            ? s.campaign.walk.stage !== 'not-started'
            : s.campaign.table.stage !== 'not-started';
  return started ? 'in-progress' : 'available';
}
