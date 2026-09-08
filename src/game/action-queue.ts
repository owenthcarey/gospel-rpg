/** Keep rapid user actions in order; one rejected action must not discard the next. */
export class ActionQueue {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  constructor(private onPending: (pending: boolean) => void) {}
  run(action: () => Promise<void>): Promise<void> {
    this.pending++;
    this.onPending(true);
    const result = this.tail.then(action);
    this.tail = result.catch(() => {});
    return result.finally(() => {
      if (--this.pending === 0) this.onPending(false);
    });
  }
}
