const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char]);
}

export function escapeAttribute(value) {
  return escapeHTML(value);
}

export function toSafeClassToken(value, fallback = 'unknown') {
  const token = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return token || fallback;
}
