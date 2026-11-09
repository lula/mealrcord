import DOMPurify from "dompurify";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** True when the stored value is already HTML (from the editor) rather than plain text written before it. */
const isHtml = (value: string) => /^\s*<(p|ul|ol|h\d|blockquote)[\s>]/i.test(value);

/** HTML for the editor or for display. Plain text from older data becomes paragraphs. */
export function toHtml(value: string): string {
  if (!value) return "";
  if (isHtml(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Safe HTML to render (the database can come from a restored backup). */
export function sanitizedHtml(value: string): string {
  return DOMPurify.sanitize(toHtml(value), { USE_PROFILES: { html: true } });
}

/** One-line plain text, for previews in cards and lists. */
export function toPlainText(value: string): string {
  if (!value || !isHtml(value)) return value;
  const doc = new DOMParser().parseFromString(DOMPurify.sanitize(value), "text/html");
  doc.querySelectorAll("p, li, br, h1, h2, h3").forEach((el) => el.append(" "));
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Plain text keeping paragraphs and list items on their own lines, for PDFs. */
export function toPlainParagraphs(value: string): string {
  if (!value || !isHtml(value)) return value;
  const doc = new DOMParser().parseFromString(DOMPurify.sanitize(value), "text/html");
  doc.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  doc.querySelectorAll("li").forEach((el) => el.prepend("• "));
  doc.querySelectorAll("p, li, h1, h2, h3, h4, blockquote").forEach((el) => el.append("\n"));
  return (doc.body.textContent ?? "").replace(/[ \t]+/g, " ").replace(/\n /g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
