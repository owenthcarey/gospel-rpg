/**
 * How often a paused scene redraws. A paused view still repaints for framing and resize, but
 * never continuously: after each paused render it waits at least 100 ms, or twice as long as
 * that render took to reach the screen, so a slow renderer keeps most of its time for the
 * interface. Render time is measured to the next frame callback, which includes GPU work.
 */
export class PausedCadence {
  private started = 0;
  private finished = 0;
  private awaitingFrame = false;

  /** Call once per frame while paused; true when this frame should render. */
  due(now: number): boolean {
    if (this.awaitingFrame) {
      this.awaitingFrame = false;
      this.finished = now;
    }
    const cost = Math.max(0, this.finished - this.started);
    return now - this.finished >= Math.max(100, cost * 2);
  }
  /** Call whenever the scene renders, paused or not. */
  rendered(now: number): void {
    this.started = now;
    this.awaitingFrame = true;
  }
}
