/** Keep the opening question and first full answer inside the existing short card. */
export function layoutDialogueReading(overlay: HTMLElement): void {
  const box = overlay.querySelector<HTMLElement>('.dialogue-box[data-conversation-person]');
  const text = box?.querySelector<HTMLElement>('.dialogue-text');
  const header = box?.querySelector<HTMLElement>('header');
  const answer = box?.querySelector<HTMLButtonElement>('[data-action="choice"]:not(:disabled)');
  if (!box || !text || !header || !answer) return;
  const readingTop = box.scrollTop;
  const resetReading = (): void => {
    box.classList.remove('dialogue-compact-reading');
    box.style.removeProperty('--dialogue-question-height');
    text.removeAttribute('tabindex');
    text.removeAttribute('role');
    text.removeAttribute('aria-label');
    // A rejected compact probe can clamp the outer reading position. Restore
    // it after returning to the original scrollport, without changing focus.
    if (box.scrollTop !== readingTop) box.scrollTop = readingTop;
  };
  if (!window.matchMedia('(max-width: 699px) and (max-height: 420px)').matches) {
    resetReading();
    return;
  }
  box.classList.add('dialogue-compact-reading');
  const style = getComputedStyle(box);
  const textStyle = getComputedStyle(text);
  const maximum = parseFloat(style.maxHeight);
  const question = text.getBoundingClientRect();
  const response = answer.getBoundingClientRect();
  // Scroll offset cancels the current outer reading position. The answer's
  // actual wrapped height and the gap retain its complete label in Large text.
  const allowance =
    maximum -
    (question.top - box.getBoundingClientRect().top + box.scrollTop) -
    (response.top - question.bottom) -
    response.height -
    parseFloat(style.paddingBottom) -
    parseFloat(style.borderBottomWidth) -
    4;
  const line =
    parseFloat(textStyle.lineHeight) +
    parseFloat(textStyle.paddingTop) +
    parseFloat(textStyle.paddingBottom);
  const readingMinimum = window.matchMedia('(pointer: coarse)').matches ? Math.max(line, 44) : line;
  if (
    !Number.isFinite(allowance) ||
    !Number.isFinite(line) ||
    allowance < readingMinimum ||
    header.scrollWidth > header.clientWidth
  ) {
    // Keep the original single scrollport when this authored content cannot
    // retain a full question line (44px on touch) and answer beside its controls.
    resetReading();
    return;
  }
  box.style.setProperty('--dialogue-question-height', `${Math.floor(allowance * 100) / 100}px`);
  if (text.scrollHeight > text.clientHeight + 1) {
    text.tabIndex = 0;
    text.setAttribute('role', 'region');
    text.setAttribute('aria-label', `Question from ${header.querySelector('h2')?.textContent}`);
  } else {
    text.removeAttribute('tabindex');
    text.removeAttribute('role');
    text.removeAttribute('aria-label');
  }
}
