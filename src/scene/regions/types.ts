import type { GameState, Point, Settings } from '../../game/types';
import type { Scene } from '@babylonjs/core/scene';
export interface RegionView {
  readonly scene: Scene;
  load(progress: (message: string) => void): Promise<void>;
  activate(): void;
  deactivate(): void;
  renderFrame(): void;
  update(state: GameState): void;
  applySettings(settings: Settings): void;
  setPaused(paused: boolean): void;
  getPosition(): Point;
  dispose(): void;
}

export interface ExplorationView extends RegionView {
  setPosition(point: Point, snap?: boolean): void;
  navigate(id: string): void;
  stop(): void;
  nearest(): import('../../content/region').Interactable | undefined;
  rotate(direction: number): void;
  zoom(direction: number): void;
  resetCamera(): void;
  performInteraction(
    motion?: import('../../content/campaign/actions').ActionMotion,
    target?: string,
  ): void;
  getCompanionPosition(): Point | undefined;
  getRoadCompanionPosition(): Point | undefined;
}
export function isExplorationView(view: RegionView | undefined): view is ExplorationView {
  return Boolean(view && 'navigate' in view && 'setPosition' in view);
}
