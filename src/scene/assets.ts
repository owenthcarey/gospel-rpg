import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import { isActorAsset, type AssetId } from '../content/assets';
import { Mesh } from '@babylonjs/core/Meshes/mesh';

export interface Model {
  root: TransformNode;
  animations: AnimationGroup[];
  socket: (name: string) => TransformNode;
}
/** One library belongs to one region scene. It never shares disposable Babylon objects. */
export class AssetLibrary {
  private containers = new Map<AssetId, AssetContainer>();
  private disposed = false;
  constructor(
    private scene: Scene,
    private shadow?: ShadowGenerator,
  ) {}
  async load(
    names: readonly AssetId[],
    progress: (loaded: number, total: number) => void,
  ): Promise<void> {
    const queue = [...new Set(names)];
    const total = queue.length;
    let loaded = 0;
    let failure: unknown;
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(4, total) }, async () => {
        while (queue.length && !failure && !this.disposed) {
          const id = queue.shift()!;
          try {
            const container = await LoadAssetContainerAsync(
              import.meta.env.BASE_URL + 'assets/models/' + id + '.glb',
              this.scene,
            );
            if (this.disposed) container.dispose();
            else {
              for (const mesh of container.meshes) {
                mesh.receiveShadows = true;
              }
              this.containers.set(id, container);
              progress(++loaded, total);
            }
          } catch (error) {
            failure = error;
            throw error;
          }
        }
      }),
    );
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected?.status === 'rejected') {
      throw new Error(
        'The region could not load its models. Check your connection, then try again.',
        { cause: rejected.reason },
      );
    }
    if (this.disposed) throw new Error('Region loading was cancelled.');
    this.scene.metadata = { ...this.scene.metadata, assetInventory: [...this.containers.keys()] };
  }
  instantiate(id: AssetId, name = id as string, interactionId?: string): Model {
    const container = this.containers.get(id);
    if (!container || this.disposed) throw new Error('Missing region asset: ' + id);
    const instance = container.instantiateModelsToScene((node) => name + ':' + node, false, {
      // Clones share geometry and materials, but own their render lifecycle.
      // Hardware instances of off-scene container sources can stop submitting
      // after a shadow pass. Every placed model must render without shadows.
      doNotInstantiate: true,
    });
    const root = new TransformNode(name, this.scene);
    const visual = new TransformNode(name + ':visual', this.scene);
    visual.parent = root;
    // Blender faces -Y; after glTF's handedness conversion, turn actors toward +Z.
    if (isActorAsset(id)) visual.rotation.y = Math.PI;
    for (const node of instance.rootNodes) node.parent = visual;
    for (const group of instance.animationGroups) group.stop();
    for (const mesh of root.getChildMeshes()) {
      mesh.isPickable = Boolean(interactionId);
      const metadata = { interactionId, assetId: id, placement: name, renderedFrame: -1 };
      mesh.metadata = metadata;
      if (mesh instanceof Mesh && mesh.getTotalVertices())
        mesh.onAfterRenderObservable.add(() => {
          metadata.renderedFrame = this.scene.getFrameId();
        });
      this.shadow?.addShadowCaster(mesh);
    }
    return {
      root,
      animations: instance.animationGroups,
      socket: (socketName) => {
        const socket = root.getChildTransformNodes(false).find(
          (node) =>
            node.name
              .split(':')
              .at(-1)!
              .replace(/\.\d+$/, '') === socketName,
        );
        if (!socket) throw new Error(id + ' is missing attachment ' + socketName);
        return socket;
      },
    };
  }
  dispose(): void {
    this.disposed = true;
    for (const container of this.containers.values()) container.dispose();
    this.containers.clear();
  }
}

export interface AssetVisibility {
  placed: number;
  enabled: number;
  drawn: number;
}
/** Draw callbacks complement presence checks: an enabled source is not proof of pixels. */
export function sceneAssets(scene: Scene): Record<string, AssetVisibility> {
  const result: Record<string, AssetVisibility> = {};
  for (const mesh of scene.meshes) {
    const id = mesh.metadata?.assetId as string | undefined;
    if (!id || !mesh.getTotalVertices()) continue;
    const value = (result[id] ??= { placed: 0, enabled: 0, drawn: 0 });
    value.placed++;
    if (
      mesh.isEnabled() &&
      mesh.isVisible &&
      mesh.visibility > 0 &&
      mesh.scaling.lengthSquared() > 0
    )
      value.enabled++;
    if (mesh.metadata.renderedFrame >= scene.getFrameId() - 1) value.drawn++;
  }
  return result;
}
