export const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const EXTERNAL_SCHEME_RE = /^(?:https?:|mailto:|tel:|data:)/i;

export function localLinkTarget(url: string): string | undefined {
  const target = url.trim().replace(/^<|>$/g, '');
  if (target.startsWith('#') || EXTERNAL_SCHEME_RE.test(target)) {
    return;
  }
  return target.split(/[?#]/, 1)[0] || undefined;
}
