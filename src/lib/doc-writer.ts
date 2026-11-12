/**
 * The building blocks shared by every export format (PDF, plain text note), so
 * one builder function produces the same content in each.
 */
export interface DocWriter {
  title(value: string): void;
  /** Grey line under the title or a heading (date, guests…). */
  subtitle(value: string): void;
  pageBreak(): void;
  /** Title page: the title and grey lines under it. */
  cover(title: string, ...subtitles: string[]): void;
  /** Page with just a centered title, opening a part of the document. */
  divider(title: string): void;
  heading(value: string, level?: 1 | 2 | 3): void;
  /** One line pointing to `anchor(to)`. */
  link(value: string, to: string): void;
  anchor(key: string): void;
  paragraph(value: string, opts?: { muted?: boolean }): void;
  table(rows: [string, string][], head?: [string, string]): void;
}

const underline = (value: string, char: string) => `${value}\n${char.repeat(Math.max(value.length, 3))}`;

/** Plain text version of a document, readable in any notes or chat app. */
export class TextWriter implements DocWriter {
  private blocks: string[] = [];

  /** `context` is the first line of the note (e.g. "Menu del 8/11/2026"). */
  constructor(private readonly context?: string) {}

  private push(value: string) {
    this.blocks.push(value);
  }

  title(value: string) {
    this.push(underline(value.toUpperCase(), "="));
  }

  subtitle(value: string) {
    // Stays attached to the block above it.
    const last = this.blocks.pop();
    this.push(last === undefined ? value : `${last}\n${value}`);
  }

  pageBreak() {
    if (this.blocks.length && this.blocks[this.blocks.length - 1] !== SEPARATOR) this.push(SEPARATOR);
  }

  cover(title: string, ...subtitles: string[]) {
    this.title(title);
    for (const s of subtitles) this.subtitle(s);
    this.pageBreak();
  }

  divider(title: string) {
    this.pageBreak();
    const bar = "=".repeat(SEPARATOR.length);
    const pad = " ".repeat(Math.max(0, Math.floor((SEPARATOR.length - title.length) / 2)));
    this.push(`${bar}\n${pad}${title.toUpperCase()}\n${bar}`);
  }

  heading(value: string, level: 1 | 2 | 3 = 1) {
    if (level === 1) this.push(underline(value, "-"));
    else if (level === 2) this.push(`» ${value}`);
    else this.push(value);
  }

  link(value: string) {
    // Consecutive links read as one list.
    const last = this.blocks[this.blocks.length - 1];
    if (last?.startsWith("• ")) this.blocks[this.blocks.length - 1] = `${last}\n${value}`;
    else this.push(value);
  }

  anchor() {}

  paragraph(value: string) {
    if (value.trim()) this.push(value.trim());
  }

  table(rows: [string, string][]) {
    this.push(rows.map(([name, quantity]) => `- ${name}: ${quantity}`).join("\n"));
  }

  toString() {
    const blocks = this.blocks[this.blocks.length - 1] === SEPARATOR ? this.blocks.slice(0, -1) : this.blocks;
    return [`mealrcord${this.context ? ` · ${this.context}` : ""}`, ...blocks].join("\n\n") + "\n";
  }
}

const SEPARATOR = "—".repeat(30);
