import { messages } from './messages';

export type I18nKey = keyof typeof messages;

export function t(key: I18nKey, values: Record<string, string | number> = {}): string {
  return messages[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}
