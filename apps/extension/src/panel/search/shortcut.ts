function isMac(): boolean {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData?.platform ??
    navigator.platform;
  return /mac/i.test(platform);
}

export function searchShortcut(): string {
  return isMac() ? '⌘K' : 'Ctrl+K';
}

export function matchCaseShortcut(): string {
  return isMac() ? '⌥C' : 'Alt+C';
}
