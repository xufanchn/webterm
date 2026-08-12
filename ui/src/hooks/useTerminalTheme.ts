import { usePreferencesStore, type HighlightRule } from '../store/preferences';

export type { HighlightRule };

export function useHighlightRules(): HighlightRule[] {
  return usePreferencesStore((s) => s.highlightRules);
}
