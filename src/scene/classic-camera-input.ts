import { ArcRotateCameraPointersInput } from '@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import {
  PointerEventTypes,
  type PointerInfoPre,
  type PointerTouch,
} from '@babylonjs/core/Events/pointerEvents';
import type { IWheelEvent } from '@babylonjs/core/Events/deviceInputEvents';
import type { Observer } from '@babylonjs/core/Misc/observable';

export interface ClassicCameraInputOptions {
  manual?: () => void;
  enabled?: () => boolean;
}

function mapOrbitButtons(camera: ArcRotateCamera) {
  const input = camera.movement.input;
  input.inputMap = input.inputMap.filter((entry) => entry.source !== 'pointer');
  input.addEntry({ source: 'pointer', button: 1, interaction: 'rotate' });
  input.addEntry({ source: 'pointer', button: 2, interaction: 'rotate' });
}

/** Preserve primary taps while middle/right drags and two fingers control the camera. */
export class ClassicCameraPointersInput extends ArcRotateCameraPointersInput {
  private attached = false;
  private wheelObserver?: Observer<PointerInfoPre>;
  constructor(private options: ClassicCameraInputOptions = {}) {
    super();
    // Touch down/up uses button 0; registering it is necessary for pinch tracking.
    this.buttons = [0, 1, 2];
    this.angularSensibilityX = 1000;
    this.angularSensibilityY = 1000;
    this.panningSensibility = 0;
    this.pinchDeltaPercentage = 0.01;
  }
  override getClassName() {
    return 'ClassicCameraPointersInput';
  }
  override attachControl(noPreventDefault?: boolean) {
    if (this.attached) return;
    // Camera.attachControl applies legacy panning mappings before attaching its inputs.
    mapOrbitButtons(this.camera);
    super.attachControl(noPreventDefault);
    this.wheelObserver = this.camera.getScene().onPrePointerObservable.add((info) => {
      if (info.skipOnPointerObservable) return;
      if (this.options.enabled?.() === false) {
        info.skipOnPointerObservable = true;
        return;
      }
      const event = info.event as IWheelEvent;
      // Hand off before the existing wheel input calculates its radius-dependent delta.
      if (Number.isFinite(event.deltaY) && event.deltaY !== 0) this.options.manual?.();
    }, PointerEventTypes.POINTERWHEEL);
    this.attached = true;
  }
  override detachControl() {
    if (!this.attached) return;
    this.camera.getScene().onPrePointerObservable.remove(this.wheelObserver!);
    this.wheelObserver = undefined;
    super.detachControl();
    this.attached = false;
  }
  override onTouch(point: PointerTouch | null, offsetX: number, offsetY: number) {
    if (
      !point ||
      point.type === 'touch' ||
      (point.button !== 1 && point.button !== 2) ||
      (offsetX === 0 && offsetY === 0) ||
      this.options.enabled?.() === false
    )
      return;
    this.options.manual?.();
    super.onTouch(point, offsetX, offsetY);
  }
  protected override _computeMultiTouchPanning(
    previous: PointerTouch | null,
    current: PointerTouch | null,
  ) {
    if (!previous || !current || this.options.enabled?.() === false) return;
    const dx = current.x - previous.x,
      dy = current.y - previous.y;
    if (dx === 0 && dy === 0) return;
    this.options.manual?.();
    const movement = this.camera.movement;
    movement.activeInput = true;
    movement.rotationAccumulatedPixels.x -= dx / this.angularSensibilityX;
    movement.rotationAccumulatedPixels.y -= dy / this.angularSensibilityY;
  }
  protected override _computePinchZoom(previous: number, current: number) {
    if (previous <= 0 || current <= 0 || previous === current || this.options.enabled?.() === false)
      return;
    this.options.manual?.();
    super._computePinchZoom(previous, current);
  }
}

/** Replace pointer input while retaining the camera's wheel, keyboard, limits and inertia. */
export function installClassicCameraInput(
  camera: ArcRotateCamera,
  options: ClassicCameraInputOptions = {},
): ClassicCameraPointersInput {
  const previous = camera.inputs.attached.pointers;
  if (previous) camera.inputs.remove(previous);
  mapOrbitButtons(camera);
  const pointers = new ClassicCameraPointersInput(options);
  camera.inputs.add(pointers);
  return pointers;
}
