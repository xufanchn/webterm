import zh from './zh';
import en from './en';

const locales: Record<string, Record<string, string>> = { zh, en };

let currentLocale = localStorage.getItem('webterm-lang') || 'zh';

export function t(key: string): string {
  return locales[currentLocale]?.[key] || locales.zh[key] || key;
}

export function setLang(lang: string) {
  currentLocale = lang;
  localStorage.setItem('webterm-lang', lang);
}

export function getLang(): string {
  return currentLocale;
}
