/**
 * Strips HTML tags and decodes common entities into plain text for word counting and AI context.
 */
export function stripHtml(input: string): string {
  if (!input) return '';
  if (!/<[a-z][\s\S]*>/i.test(input)) {
    return input;
  }
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Converts plain text (without HTML tags) into simple HTML paragraphs for contentEditable.
 */
export function ensureEditorHtml(input: string): string {
  if (!input) return '';
  if (/<[a-z][\s\S]*>/i.test(input)) {
    return input;
  }
  return input
    .split('\n')
    .map((line) => (line.trim() === '' ? '<p><br></p>' : `<p>${escapeHtml(line)}</p>`))
    .join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
