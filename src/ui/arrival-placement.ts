export interface ArrivalRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Find a clear vertical slot for the centered place plaque, or yield when the HUD fills it. */
export function arrivalTop(
  width: number,
  height: number,
  plaqueWidth: number,
  plaqueHeight: number,
  reservations: readonly ArrivalRect[],
): number | undefined {
  const margin = 12;
  const left = (width - plaqueWidth) / 2;
  const right = left + plaqueWidth;
  if (left < margin || plaqueHeight > height - margin * 2) return;
  const obstacles = reservations
    .filter((rect) => rect.left < right + margin && rect.right > left - margin)
    .map(
      (rect) =>
        [
          Math.max(margin, rect.top - margin),
          Math.min(height - margin, rect.bottom + margin),
        ] as const,
    )
    .sort((a, b) => a[0] - b[0]);
  const preferred = height * 0.17 + 16;
  const slots: number[] = [];
  let start = margin;
  for (const [top, bottom] of [...obstacles, [height - margin, height - margin] as const]) {
    if (top - start >= plaqueHeight)
      slots.push(Math.max(start, Math.min(preferred, top - plaqueHeight)));
    start = Math.max(start, bottom);
  }
  return slots.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))[0];
}
