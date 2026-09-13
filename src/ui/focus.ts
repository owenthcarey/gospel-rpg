/** Native visibility includes closed disclosures and CSS-hidden ancestors. */
export function focusableElements(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]',
    ),
  ].filter(
    (el) =>
      !el.closest('[inert]') &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== 'hidden',
  );
}
export function trapFocus(event: KeyboardEvent, root: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const nodes = focusableElements(root),
    first = nodes[0],
    last = nodes.at(-1);
  if (!first) return;
  const outside = !root.contains(document.activeElement);
  if (event.shiftKey && (document.activeElement === first || outside)) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && (document.activeElement === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}
export function restoreFocus(
  root: HTMLElement,
  action?: string,
  value?: string,
  workId?: string,
): void {
  const nodes = focusableElements(root);
  const match = nodes.find(
    (node) =>
      (workId && node.dataset.workId === workId) ||
      (action && node.dataset.action === action && node.dataset.value === value),
  );
  (match || nodes[0])?.focus({ preventScroll: true });
}
