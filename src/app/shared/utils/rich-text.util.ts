/**
 * Rich text saved from the admin's editor can contain non-breaking spaces
 * instead of regular ones - typically from pasted content (e.g. Word/Google
 * Docs). In the *stored* HTML string that's literally the 6-character entity
 * "&nbsp;" (not the raw U+00A0 glyph - that only appears after a browser
 * parses the HTML), confirmed against real saved content:
 * "<p>Promovemos&nbsp;el&nbsp;desarrollo&nbsp;integral</p>". Also handling
 * the numeric entity forms and the raw character itself in case content
 * ever arrives already-parsed (e.g. copy-pasted directly as text).
 *
 * A run of words joined by nbsp is one unbreakable token to the browser's
 * line-breaking algorithm, so with only `break-words` (overflow-wrap:
 * break-word) as a safety net, long headings ended up breaking mid-word
 * ("desarroll" / "o integral") instead of wrapping at a normal space.
 * Swapping nbsp back to a regular space lets the browser wrap at word
 * boundaries first, the same as it would for hand-typed content.
 */
export function normalizeRichText(html: string | null | undefined): string | null {
  if (!html) return null;
  const rawNbsp = String.fromCharCode(160);
  return html
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&#xa0;/gi, ' ')
    .split(rawNbsp).join(' ');
}
