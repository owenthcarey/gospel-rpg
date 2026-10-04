import { expect, it } from 'vitest';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HoldView } from '../../src/scene/hold-view';

it('copies native DOMRect prototype getters into an immutable hold baseline', () => {
  const values = { left: 0, top: 0, width: 390, height: 844 };
  const bounds = Object.create({
    get left() {
      return values.left;
    },
    get top() {
      return values.top;
    },
    get width() {
      return values.width;
    },
    get height() {
      return values.height;
    },
  }) as typeof values;
  expect({ ...bounds }).toEqual({}); // Native DOMRect exposes inherited coordinates.
  const focus = Vector3.Zero();
  const transform = Matrix.LookAtLH(new Vector3(0, 20, -20), focus, Vector3.Up()).multiply(
    Matrix.PerspectiveFovLH(0.7, 390 / 844, 0.2, 220),
  );
  const viewport = { x: 0, y: 0, width: 390, height: 844 };
  const hold = HoldView.capture(transform, focus, viewport, bounds)!;
  expect(hold).toBeDefined();
  expect(hold.changed(transform, viewport, bounds)).toBe(false);
  values.left = 1;
  expect(hold.changed(transform, viewport, bounds)).toBe(true);
});
