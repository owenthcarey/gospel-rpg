import { escapeHtml, icon } from './icons';
import { TOAST_ICONS, type ToastKind } from './hud';

interface GameMessage {
  text: string;
  kind: ToastKind;
  count: number;
}

/** Session feedback stays available after its toast fades, without changing a saved journey. */
export class MessageHistory {
  private entries: GameMessage[] = [];
  add(text: string, kind: ToastKind): void {
    const previous = this.entries.at(-1);
    if (previous?.text === text && previous.kind === kind) previous.count++;
    else this.entries.push({ text, kind, count: 1 });
    if (this.entries.length > 40) this.entries.shift();
  }
  view(): string {
    return `<section class="message-history" aria-label="Recent game messages"><p class="message-history-note">Messages from this play session. Newest first.</p>${
      this.entries.length
        ? `<ol class="message-list">${[...this.entries]
            .reverse()
            .map(
              (entry) =>
                `<li data-kind="${entry.kind}"><span class="message-icon" aria-hidden="true">${icon(TOAST_ICONS[entry.kind])}</span><span>${escapeHtml(entry.text)}</span>${entry.count > 1 ? `<span class="message-repeat" aria-label="Repeated ${entry.count} times">×${entry.count}</span>` : ''}</li>`,
            )
            .join('')}</ol>`
        : '<p class="message-history-empty">Game messages will appear here as you explore.</p>'
    }</section>`;
  }
}
