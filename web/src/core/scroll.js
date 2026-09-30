/** Keep scroll for an in-place state update, but reset when navigating to another page. */
export function scrollPositionForRender(previousPath, nextPath, currentY) {
  return previousPath !== null && previousPath === nextPath && Number.isFinite(currentY)
    ? Math.max(0, currentY)
    : 0;
}
