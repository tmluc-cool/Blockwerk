/** Whether an element is laid out on screen (not in a hidden tab or removed from the page). */
export function isOnScreen(element: HTMLElement): boolean {
  return element.isConnected && element.getClientRects().length > 0;
}
