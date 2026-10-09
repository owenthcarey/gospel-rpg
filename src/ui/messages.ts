import { escapeHtml, icon } from './icons';
import { TOAST_ICONS, type ToastKind } from './hud';

interface GameMessage {
  text: string;
  kind: ToastKind;
  count: number;
  /** Chatbox-only lines, such as celebrations, that repeat feedback already given. */
  chatOnly?: boolean;
}

/** Session feedback stays available after its toast fades, without changing a saved journey. */
export class MessageHistory {
  private entries: GameMessage[] = [];
  add(text: string, kind: ToastKind, chatOnly = false): void {
    const previous = this.entries.at(-1);
    if (previous?.text === text && previous.kind === kind) previous.count++;
    else this.entries.push({ text, kind, count: 1, chatOnly });
    if (this.entries.length > 40) this.entries.shift();
  }
  /** The chatbox's newest lines, oldest first, as the classic game log reads. */
  chat(limit: number): string {
    return this.entries
      .slice(-limit)
      .map(
        (entry) =>
          `<li data-kind="${entry.kind}"${entry.chatOnly ? ' data-chat="celebration"' : ''}>${escapeHtml(entry.text)}${entry.count > 1 ? ` <span class="chat-repeat">(×${entry.count})</span>` : ''}</li>`,
      )
      .join('');
  }
  view(): string {
    const entries = this.entries.filter((entry) => !entry.chatOnly);
    return `<section class="message-history" aria-label="Recent game messages"><p class="message-history-note">Messages from this play session. Newest first.</p>${
      entries.length
        ? `<ol class="message-list">${entries
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
