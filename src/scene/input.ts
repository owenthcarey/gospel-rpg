import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { Scene } from '@babylonjs/core/scene';
import type { Point } from '../game/types';
export interface ExplorationInput {
  scene: Scene;
  canvas: HTMLCanvasElement;
  keys: Set<string>;
  paused: () => boolean;
  navigate: (id: string) => void;
  walk: (point: Point) => void;
  nearest: () => string | undefined;
  resetCamera: () => void;
  notice: (message: string) => void;
}
/** Every listener/observer installed here has a matching region-disposal cleanup. */
export function bindExplorationInput(input: ExplorationInput): () => void {
  const { keys, canvas, scene } = input;
  const down = (event: KeyboardEvent) => {
    if (
      input.paused() ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    const key = event.key.toLowerCase();
    if (
      [
        'w',
        'a',
        's',
        'd',
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
        'q',
        'e',
        'r',
      ].includes(key)
    )
      event.preventDefault();
    keys.add(key);
    if (key === 'e' && !event.repeat) {
      const nearest = input.nearest();
      if (nearest) input.navigate(nearest);
      else
        input.notice(
          'Move closer to a person or place to interact, or choose a destination in the map.',
        );
    }
    if (key === 'r' && !event.repeat) input.resetCamera();
  };
  const up = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  const clear = () => keys.clear();
  const context = (event: Event) => event.preventDefault();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);
  canvas.addEventListener('contextmenu', context);
  const pointer = scene.onPointerObservable.add((info) => {
    if (input.paused() || info.type !== PointerEventTypes.POINTERTAP || info.event.button !== 0)
      return;
    const pick = info.pickInfo;
    if (!pick?.hit) return;
    const id = pick.pickedMesh?.metadata?.interactionId as string | undefined;
    if (id) input.navigate(id);
    else if (pick.pickedPoint && pick.pickedMesh?.metadata?.ground)
      input.walk({ x: pick.pickedPoint.x, z: pick.pickedPoint.z });
  });
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', clear);
    canvas.removeEventListener('contextmenu', context);
    scene.onPointerObservable.remove(pointer);
    clear();
  };
}
