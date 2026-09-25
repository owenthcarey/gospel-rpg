import type { ActorClip } from '../assets';
import type { SceneId } from '../../game/episode/types';

/** Complete, independent tableaux for all ten durable Into the Deep scenes. */
export interface LakeComposition {
  boat: [number, number];
  partner: [number, number];
  target: [number, number, number];
  extent: number;
  alpha: number;
  beta: number;
  simon: ActorClip;
  jesus: ActorClip;
  partners: ActorClip;
  net: 'none' | 'folded' | 'cast' | 'full';
  cargo: boolean;
}
export const lakeCompositions: Record<SceneId, LakeComposition> = {
  gathering: {
    boat: [-7, 0],
    partner: [-6, 6],
    target: [-8, 0.5, 1],
    extent: 5.6,
    alpha: -1.1,
    beta: 0.85,
    simon: 'Haul',
    jesus: 'Sit',
    partners: 'Haul',
    net: 'folded',
    cargo: false,
  },
  teaching: {
    boat: [-5, 0],
    partner: [-6, 6],
    target: [-6, 0.8, 1],
    extent: 5,
    alpha: -1.05,
    beta: 0.9,
    simon: 'Sit',
    jesus: 'Sit',
    partners: 'Sit',
    net: 'folded',
    cargo: false,
  },
  invitation: {
    boat: [0, 0],
    partner: [-5, 6],
    target: [0, 0.6, 1],
    extent: 3.7,
    alpha: -0.9,
    beta: 0.9,
    simon: 'Row',
    jesus: 'Sit',
    partners: 'Sit',
    net: 'folded',
    cargo: false,
  },
  answer: {
    boat: [0, 0],
    partner: [-5, 6],
    target: [0, 1, 0.2],
    extent: 2.7,
    alpha: -1.42,
    beta: 1.02,
    simon: 'Respond',
    jesus: 'Sit',
    partners: 'Sit',
    net: 'folded',
    cargo: false,
  },
  lowering: {
    boat: [1, 1],
    partner: [-4, 7],
    target: [1, 0.4, 1],
    extent: 3.3,
    alpha: -0.8,
    beta: 0.82,
    simon: 'Haul',
    jesus: 'Sit',
    partners: 'Sit',
    net: 'cast',
    cargo: false,
  },
  abundance: {
    boat: [1, 1],
    partner: [-3, 6],
    target: [1.4, 0.5, 1],
    extent: 3.3,
    alpha: -0.8,
    beta: 0.83,
    simon: 'Haul',
    jesus: 'Sit',
    partners: 'Gesture',
    net: 'full',
    cargo: false,
  },
  partners: {
    boat: [1, 1],
    partner: [3.5, 2],
    target: [2.3, 0.6, 1.6],
    extent: 3.7,
    alpha: -0.8,
    beta: 0.85,
    simon: 'Haul',
    jesus: 'Sit',
    partners: 'Haul',
    net: 'full',
    cargo: true,
  },
  astonishment: {
    boat: [1, 1],
    partner: [3.5, 2],
    target: [1, 0.9, 1],
    extent: 2.5,
    alpha: -0.9,
    beta: 0.85,
    simon: 'Kneel',
    jesus: 'Sit',
    partners: 'Idle',
    net: 'folded',
    cargo: true,
  },
  calling: {
    boat: [1, 1],
    partner: [3.5, 2],
    target: [1.7, 0.9, 1],
    extent: 2.65,
    alpha: -0.95,
    beta: 0.9,
    simon: 'Kneel',
    jesus: 'Gesture',
    partners: 'Idle',
    net: 'folded',
    cargo: true,
  },
  return: {
    boat: [-7, 0],
    partner: [-5.5, 5],
    target: [-10, 0.7, 1.5],
    extent: 6.3,
    alpha: -1.05,
    beta: 0.88,
    simon: 'Row',
    jesus: 'Sit',
    partners: 'Row',
    net: 'folded',
    cargo: true,
  },
};
