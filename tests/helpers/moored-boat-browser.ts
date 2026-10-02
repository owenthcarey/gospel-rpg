import { expect, type Page, type TestInfo } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Viewport } from '@babylonjs/core/Maths/math.viewport.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import '@babylonjs/loaders/glTF/2.0/glTFLoader.js';
import '@babylonjs/loaders/glTF/glTFFileLoader.js';
import { campaignLayout } from '../../src/content/campaign/layouts';
import type { Point } from '../../src/game/types';
import type { Berth } from '../../src/game/lake/types';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Observe one named native model contact, independently of later normal menu actions. */
export async function nativeHullInput(
  page: Page,
  point: { x: number; y: number },
  touch: boolean,
  hold: boolean,
  info: TestInfo,
  name: string,
  input: () => Promise<void>,
) {
  const audit = await page.evaluateHandle((point) => {
    const describe = (target: EventTarget | null) => {
      const node = target instanceof Element ? target : null,
        menu = node?.closest<HTMLElement>('[role="menu"][aria-label="Choose Option"]');
      return {
        tag: node?.tagName ?? null,
        id: node?.id ?? null,
        labelValue: node?.closest<HTMLElement>('.world-label')?.dataset.value ?? null,
        optionMenuName: menu?.getAttribute('aria-label') ?? null,
        optionMenuVisible: !!menu && !menu.hidden && menu.getClientRects().length > 0,
      };
    };
    const events: {
      type: string;
      trusted: boolean;
      pointerType: string;
      x: number;
      y: number;
      time: number;
      target: ReturnType<typeof describe>;
    }[] = [];
    const record = (event: PointerEvent) =>
      events.push({
        type: event.type,
        trusted: event.isTrusted,
        pointerType: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
        target: describe(event.target),
      });
    window.addEventListener('pointerdown', record, { capture: true, passive: true });
    window.addEventListener('pointerup', record, { capture: true, passive: true });
    return {
      preContact: describe(document.elementFromPoint(point.x, point.y)),
      events,
      cleanup: () => {
        window.removeEventListener('pointerdown', record, true);
        window.removeEventListener('pointerup', record, true);
      },
    };
  }, point);
  let result: {
    preContact: Awaited<ReturnType<typeof audit.jsonValue>>['preContact'];
    events: Awaited<ReturnType<typeof audit.jsonValue>>['events'];
  };
  try {
    await input();
  } finally {
    result = await audit.evaluate((value) => ({
      preContact: value.preContact,
      events: value.events,
    }));
    await audit.evaluate((value) => value.cleanup());
    await audit.dispose();
    await writeFile(
      info.outputPath(name + '-native-pointer.json'),
      JSON.stringify({ name, point, touch, hold, ...result }, null, 2),
    );
  }
  expect(result.preContact.id, name + ' begins on bare canvas').toBe('game-canvas');
  const down = result.events.filter((event) => event.type === 'pointerdown'),
    up = result.events.filter((event) => event.type === 'pointerup');
  expect(down, name + ' has exactly one native press').toHaveLength(1);
  expect(up, name + ' has exactly one native release').toHaveLength(1);
  for (const event of result.events) {
    expect(event.trusted, name + ' is trusted').toBe(true);
    expect(event.pointerType).toBe(touch ? 'touch' : 'mouse');
    expect(Math.abs(event.x - point.x), name + ' actual X').toBeLessThan(1);
    expect(Math.abs(event.y - point.y), name + ' actual Y').toBeLessThan(1);
    expect(event.target.labelValue, name + ' never uses a world label').toBeNull();
  }
  expect(down[0]!.target).toMatchObject({ tag: 'CANVAS', id: 'game-canvas' });
  expect(
    up[0]!.target.id === 'game-canvas' ||
      (touch &&
        hold &&
        up[0]!.target.optionMenuName === 'Choose Option' &&
        up[0]!.target.optionMenuVisible),
    name + ' only a phone hold may release into the visible options menu',
  ).toBe(true);
  if (touch && hold) expect(up[0]!.time - down[0]!.time).toBeGreaterThan(500);
  return { name, point, touch, hold, ...result };
}

/** Actual imported first visible hull triangles, entirely outside the application page. */
export async function hullFaces(
  berth: Berth,
  standing: Point,
  width: number,
  height: number,
  bearingDegrees: number,
  zoomClicks: number,
) {
  const engine = new NullEngine(),
    scene = new Scene(engine);
  try {
    const bytes = await readFile('public/assets/models/boat.glb');
    const container = await LoadAssetContainerAsync(new Uint8Array(bytes), scene, {
      pluginExtension: '.glb',
      pluginOptions: { gltf: { skipMaterials: true } },
    });
    const instance = container.instantiateModelsToScene((name) => 'moored-before:' + name, false, {
      doNotInstantiate: true,
    });
    const root = new TransformNode('moored-before', scene);
    for (const node of instance.rootNodes) node.parent = root;
    const placement = {
      x: berth === 'capernaum' ? 10 : 0,
      y: -0.03,
      z: berth === 'capernaum' ? -4 : -10,
    };
    root.position.set(placement.x, placement.y, placement.z);
    root.computeWorldMatrix(true);
    for (const node of root.getChildTransformNodes()) node.computeWorldMatrix(true);
    const material = new StandardMaterial('moored-before:finite-triangles', scene);
    material.backFaceCulling = false;
    const meshes = root.getChildMeshes().filter((mesh) => mesh.getTotalVertices());
    for (const mesh of meshes) {
      mesh.material = material;
      mesh.computeWorldMatrix(true);
    }
    const triangles = meshes.flatMap((mesh) => {
      const matrix = mesh.computeWorldMatrix(true),
        data = mesh.getPositionData(false)!,
        positions = Array.from({ length: data.length / 3 }, (_, i) =>
          Vector3.TransformCoordinates(Vector3.FromArray(data, i * 3), matrix),
        ),
        indices = mesh.getIndices()!;
      return Array.from({ length: indices.length / 3 }, (_, i) => ({
        face: i,
        mesh: mesh.name,
        vertices: [
          positions[indices[i * 3]!]!,
          positions[indices[i * 3 + 1]!]!,
          positions[indices[i * 3 + 2]!]!,
        ],
      }));
    });
    const layout = campaignLayout(berth),
      aspectScale = layout ? Math.max(1, 0.9 / (width / height)) : 1;
    const radius = Math.max(
        (layout?.camera.min ?? 16) * aspectScale,
        (layout?.camera.radius ?? 33) * aspectScale - zoomClicks * 3,
      ),
      beta = layout?.camera.beta ?? 0.78,
      alpha = -Math.PI / 2 + (bearingDegrees * Math.PI) / 180;
    const reach = layout ? layout.bounds.max - 9 : Infinity;
    const target = layout
      ? new Vector3(
          Math.max(-reach, Math.min(reach, standing.x)),
          0,
          Math.max(-reach + 1, Math.min(reach + 1, standing.z + layout.camera.targetOffset * 2)),
        )
      : new Vector3(standing.x, 0, standing.z + 2);
    const camera = target.add(
      new Vector3(
        Math.cos(alpha) * Math.sin(beta) * radius,
        Math.cos(beta) * radius,
        Math.sin(alpha) * Math.sin(beta) * radius,
      ),
    );
    const matrix = Matrix.LookAtLH(camera, target, Vector3.Up()).multiply(
      Matrix.PerspectiveFovLH(0.7, width / height, 0.2, 220),
    );
    const project = (point: Vector3) =>
      Vector3.Project(point, Matrix.Identity(), matrix, new Viewport(0, 0, width, height));
    const candidates = triangles
      .flatMap((triangle) => {
        const center = triangle.vertices[0]!.add(triangle.vertices[1]!)
            .add(triangle.vertices[2]!)
            .scale(1 / 3),
          length = Vector3.Distance(camera, center);
        const ray = new Ray(camera, center.subtract(camera).normalize(), length + 0.001),
          first = meshes
            .map((mesh) => ray.intersectsMesh(mesh, false))
            .filter((hit) => hit.hit && hit.pickedPoint && hit.faceId >= 0)
            .sort((a, b) => a.distance - b.distance)[0];
        if (!first?.pickedPoint || Vector3.Distance(first.pickedPoint, center) > 0.001) return [];
        const p = project(center),
          v = triangle.vertices.map(project),
          area =
            Math.abs(
              (v[1]!.x - v[0]!.x) * (v[2]!.y - v[0]!.y) - (v[2]!.x - v[0]!.x) * (v[1]!.y - v[0]!.y),
            ) / 2;
        return p.z > 0 &&
          p.z < 1 &&
          p.x > 8 &&
          p.x < width - 8 &&
          p.y > 8 &&
          p.y < height - 8 &&
          area >= 2
          ? [
              {
                x: p.x,
                y: p.y,
                area,
                face: triangle.face,
                mesh: triangle.mesh,
                world: center.asArray(),
                firstPickedPoint: first.pickedPoint.asArray(),
                firstFace: first.faceId,
              },
            ]
          : [];
      })
      .sort((a, b) => b.area - a.area)
      .slice(0, 18);
    return {
      assetSha256: hash(bytes),
      placement,
      triangleCount: triangles.length,
      camera: {
        target: target.asArray(),
        position: camera.asArray(),
        alpha,
        beta,
        radius,
        zoomClicks,
        bearingDegrees,
        aspectScale,
        width,
        height,
      },
      candidates,
    };
  } finally {
    engine.dispose();
  }
}
export async function fourAnimationFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0;
        const next = () => {
          if (++frames === 4) resolve();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
  );
}
