/**
 * Minimal HTML sanitizer — strips all tags except a known safe allowlist.
 * Used before dangerouslySetInnerHTML to prevent XSS from admin-entered content.
 */

const ALLOWED_TAGS = new Set([
  'h1','h2','h3','h4','p','strong','em','ul','ol','li',
  'br','hr','blockquote','code','pre','span',
]);

const ALLOWED_ATTRS = new Set(['class','style']);

/** Strip every tag not in the allowlist and every attribute not in the allowlist. */
export function sanitizeHtml(html: string): string {
  // Use a DOMParser so we're working with a real DOM tree, not regex
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    sanitizeNode(doc.body);
    return doc.body.innerHTML;
  } catch {
    // SSR or parse failure — strip all tags as fallback
    return html.replace(/<[^>]*>/g, '');
  }
}

function sanitizeNode(node: Element) {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        // Replace disallowed element with its text content
        const text = document.createTextNode(el.textContent || '');
        node.replaceChild(text, el);
        continue;
      }

      // Strip disallowed attributes
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name);
        }
      }

      // Strip inline event handlers that sneak through (belt-and-suspenders)
      const style = el.getAttribute('style');
      if (style && /expression|javascript|vbscript|url\s*\(/i.test(style)) {
        el.removeAttribute('style');
      }

      sanitizeNode(el);
    }
  }
}

/** Sanitize a markdown-converted string before injecting into the DOM. */
export function safeMd(html: string): string {
  return sanitizeHtml(html);
}
