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
