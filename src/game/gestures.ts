interface Contact {
  x: number;
  y: number;
}
/** Pointer ownership outlives the first finger's release; a pinch can never turn into a tap. */
export class TapGesture {
  private contacts = new Map<number, Contact>();
  private rejected = false;
  private candidate: number | undefined;
  down(id: number, x: number, y: number, button: number): void {
    if (!this.contacts.size) {
      this.rejected = button !== 0;
      this.candidate = undefined;
    }
    this.contacts.set(id, { x, y });
    if (this.contacts.size > 1) this.rejected = true;
  }
  move(id: number, x: number, y: number): void {
    const origin = this.contacts.get(id);
    if (origin && Math.hypot(x - origin.x, y - origin.y) > 8) this.rejected = true;
  }
  up(id: number, x: number, y: number): void {
    this.move(id, x, y);
    if (this.contacts.has(id) && !this.rejected && this.contacts.size === 1) this.candidate = id;
    this.contacts.delete(id);
  }
  consume(id: number): boolean {
    const allowed = this.candidate === id && !this.rejected;
    this.candidate = undefined;
    return allowed;
  }
  clear(): void {
    this.contacts.clear();
    this.rejected = true;
    this.candidate = undefined;
  }
}
