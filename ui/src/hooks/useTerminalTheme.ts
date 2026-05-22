import { useMemo } from 'react';

export interface HighlightRule {
  keyword: string;
  color: string;
  regex: boolean;
}

const defaultRules: HighlightRule[] = [
  { keyword: 'ERROR', color: '#f44747', regex: false },
  { keyword: 'WARN', color: '#cca700', regex: false },
  { keyword: 'DEBUG', color: '#808080', regex: false },
  { keyword: 'INFO', color: '#6a9955', regex: false },
];

export function useHighlightRules(): HighlightRule[] {
  return useMemo(() => defaultRules, []);
}
