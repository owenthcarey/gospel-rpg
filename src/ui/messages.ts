import { escapeHtml, icon } from './icons';
import { TOAST_ICONS, type ToastKind } from './hud';

interface GameMessage {
  text: string;
  kind: ToastKind;
  count: number;
  /** Chatbox-only lines, such as celebrations, that repeat feedback already given. */
  chatOnly?: boolean;
}

export type ChatFilter = 'all' | 'game' | 'public';
export const CHAT_FILTERS: readonly { id: ChatFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'game', label: 'Game' },
  { id: 'public', label: 'Public' },
];
const SPOKEN = /^(Traveler): (.*)$/;
const isSpeech = (text: string): boolean => SPOKEN.test(text);

/** Spoken lines show the speaker's name in black before their words, as in the classic chat. */
function speech(text: string): string {
  const match = SPOKEN.exec(text);
  return match
    ? `<span class="chat-name">${match[1]}:</span> <span class="chat-said">${escapeHtml(match[2]!)}</span>`
    : escapeHtml(text);
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
  /**
   * The chatbox's newest lines, oldest first, as the classic game log reads. The Game and
   * Public filters split the game's own feedback from what people say aloud.
   */
  chat(limit: number, filter: ChatFilter = 'all'): string {
    return this.entries
      .filter((entry) => filter === 'all' || (filter === 'public') === isSpeech(entry.text))
      .slice(-limit)
      .map(
        (entry) =>
          `<li data-kind="${entry.kind}"${entry.chatOnly ? ' data-chat="celebration"' : ''}>${speech(entry.text)}${entry.count > 1 ? ` <span class="chat-repeat">(×${entry.count})</span>` : ''}</li>`,
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
