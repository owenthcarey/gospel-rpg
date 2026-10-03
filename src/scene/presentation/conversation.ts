import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Actor } from '../actors/actor';
import { PresentationClock, turnToward, type ScreenRect } from '../../game/presence';
import { applyCameraPose, cameraPose, frameSubject, type CameraPose } from './framing';

interface Participant {
  actor: Actor;
  heading: number;
  clip: ReturnType<Actor['snapshotPose']>;
  supportedHold?: boolean;
  settling?: ReturnType<Actor['footSupportContinuation']>;
  locomotion?: ReturnType<Actor['bookmarkLocomotionPresentation']>;
}

/** Read a live participant's genuine current root, including changes within the same render. */
export function conversationAnchor(actor: Actor): Readonly<Vector3> | undefined {
  const root = actor.root;
  if (root.isDisposed() || !root.isEnabled()) return;
  // Babylon can reuse a same-render matrix before checking dirty local/parent transforms.
  if (!root.isSynchronized()) root.computeWorldMatrix(true);
  const at = root.getAbsolutePosition();
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y) || !Number.isFinite(at.z)) return;
  return at;
}

/** Moves only the camera and rig poses; participant navigation roots never change position. */
export class ConversationPresentation {
  private bookmark?: CameraPose & {
    min: number | null;
    max: number | null;
    betaMin: number | null;
    betaMax: number | null;
  };
  private speaker?: Participant;
  private listener?: Participant;
  private targetId?: string;
  private panel?: ScreenRect;
  private clock = new PresentationClock();
  private paused = false;
  private layoutChanged = true;
  constructor(
    private camera: ArcRotateCamera,
    private canvas: HTMLCanvasElement,
  ) {}
  get active(): boolean {
    return !!this.speaker;
  }
  get animated(): boolean {
    return this.active && !this.paused;
  }
  get id(): string | undefined {
    return this.targetId;
  }
  /** Current navigation anchors for the people framed together, including paused dialogue. */
  get occlusionAnchors(): readonly [Readonly<Vector3>, Readonly<Vector3>] | undefined {
    if (!this.speaker || !this.listener) return;
    const a = conversationAnchor(this.speaker.actor),
      b = conversationAnchor(this.listener.actor);
    if (!a || !b) return;
    return [a, b];
  }
  select(id: string, speaker: Actor, listener: Actor, rect?: ScreenRect): void {
    if (JSON.stringify(this.panel) !== JSON.stringify(rect)) this.layoutChanged = true;
    this.panel = rect;
    if (this.targetId === id && this.speaker?.actor === speaker) return;
    this.clear();
    this.panel = rect;
    this.targetId = id;
    const speakerLocomotion = speaker.bookmarkLocomotionPresentation(),
      listenerLocomotion = listener.bookmarkLocomotionPresentation();
    speaker.suppressLocomotionPresentation(true);
    listener.suppressLocomotionPresentation(true);
    this.bookmark = {
      ...cameraPose(this.camera),
      min: this.camera.lowerRadiusLimit,
      max: this.camera.upperRadiusLimit,
      betaMin: this.camera.lowerBetaLimit,
      betaMax: this.camera.upperBetaLimit,
    };
    this.speaker = {
      actor: speaker,
      heading: speaker.root.rotation.y,
      clip: speaker.snapshotPose(),
      locomotion: speakerLocomotion,
    };
    this.listener = {
      actor: listener,
      heading: listener.root.rotation.y,
      clip: listener.snapshotPose(),
      locomotion: listenerLocomotion,
      supportedHold:
        ['Carry', 'MatCarry'].includes(listener.playback.clip) &&
        listener.hasFootSupport &&
        !listener.performing,
    };
    if (this.listener.supportedHold) this.listener.settling = listener.footSupportContinuation();
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 100;
    this.camera.lowerBetaLimit = 0.3;
    this.camera.upperBetaLimit = 1.45;
    this.paused = false;
    this.layoutChanged = true;
  }
  setPaused(value: boolean): void {
    this.paused = value;
  }
  tick(dt: number, reduced: boolean): void {
    if (
      !this.speaker ||
      !this.listener ||
      !this.bookmark ||
      document.hidden ||
      (this.paused && !this.layoutChanged)
    )
      return;
    const anchors = this.occlusionAnchors;
    if (!anchors) return;
    const time = this.clock.advance(dt, !this.paused, reduced);
    const [a, b] = anchors;
    // Keep the existing camera side to avoid a disorienting reverse shot on approach.
    const center = a
      .add(b)
      .scale(0.5)
      .add(new Vector3(0, 0.95, 0));
    const pose = frameSubject(
      this.camera,
      Math.max(1, this.canvas.clientWidth),
      Math.max(1, this.canvas.clientHeight),
      center,
      Math.max(1.4, Vector3.Distance(a, b) * 0.5 + 0.8),
      this.bookmark.alpha,
      1.12,
      this.panel,
    );
    const amount =
      reduced || this.paused || this.layoutChanged ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 6);
    this.camera.alpha = turnToward(this.camera.alpha, pose.alpha, reduced ? 10 : dt, 6);
    this.camera.beta += (pose.beta - this.camera.beta) * amount;
    this.camera.radius += (pose.radius - this.camera.radius) * amount;
    Vector3.LerpToRef(this.camera.target, pose.target, amount, this.camera.target);
    this.layoutChanged = false;
    for (const [person, other, speaking] of [
      [this.speaker, b, true],
      [this.listener, a, false],
    ] as const) {
      if (this.paused) break;
      const actor = person.actor;
      // Keep the paused world's upper/held pose while its supported legs finish settling.
      if (this.keepsSupportedHold(person)) {
        person.settling?.step(dt, reduced);
        continue;
      }
      // Seated/working characters retain their supported base pose while acknowledging a visitor.
      if (['Sit', 'Row', 'Recline', 'Kneel', 'Carry', 'MatCarry'].includes(person.clip.clip)) {
        actor.sample(person.clip.clip, dt, reduced || person.clip.clip === 'Carry');
        continue;
      }
      actor.turnTo(other, reduced ? 10 : dt, 8);
      actor.lookAt(other.add(new Vector3(0, 1.6, 0)));
      actor.sample(
        speaking && !reduced
          ? time < 1.4
            ? 'Greet'
            : Math.floor(time / 4) % 3 === 1
              ? 'Respond'
              : 'Listen'
          : 'Listen',
        dt,
        reduced,
      );
    }
    this.canvas.dataset.conversation = this.targetId;
    this.canvas.dataset.conversationTime = time.toFixed(2);
  }
  private keepsSupportedHold(person: Participant): boolean {
    return (
      person === this.listener &&
      Boolean(person.supportedHold) &&
      person.actor.hasFootSupport &&
      person.actor.playback.clip === person.clip.clip &&
      !person.actor.performing
    );
  }
  clear(): void {
    for (const person of [this.speaker, this.listener]) {
      if (!person) continue;
      if (person.actor.root.isDisposed()) {
        person.locomotion?.release();
        person.settling?.release();
        continue;
      }
      person.actor.lookAt(null);
      person.actor.root.rotation.y = person.heading;
      // Arrival or a settings update may settle the same held pose after select.
      // Keep that current support instead of restoring a stale animation frame.
      if (!this.keepsSupportedHold(person))
        person.actor.restorePose(person.clip, person.locomotion);
      person.locomotion?.release();
      person.settling?.release();
      person.actor.suppressLocomotionPresentation(false);
    }
    if (this.bookmark) {
      applyCameraPose(this.camera, this.bookmark);
      this.camera.lowerRadiusLimit = this.bookmark.min;
      this.camera.upperRadiusLimit = this.bookmark.max;
      this.camera.lowerBetaLimit = this.bookmark.betaMin;
      this.camera.upperBetaLimit = this.bookmark.betaMax;
      this.camera.inertialAlphaOffset =
        this.camera.inertialBetaOffset =
        this.camera.inertialRadiusOffset =
          0;
    }
    this.targetId = undefined;
    this.speaker = this.listener = undefined;
    this.bookmark = undefined;
    this.panel = undefined;
    this.clock.reset();
    delete this.canvas.dataset.conversation;
    delete this.canvas.dataset.conversationTime;
  }
  dispose(): void {
    this.clear();
  }
}
