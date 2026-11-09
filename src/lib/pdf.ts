import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import appIcon from "@/assets/app-icon.png?inline";

const APP_NAME = "mealrcord";
const MARGIN = 15;
/** Content starts below the header and ends above the footer. */
const TOP = 30;
const BOTTOM = 28;
const MUTED: [number, number, number] = [110, 110, 110];
/** The app's --primary and --primary-foreground (light theme), in RGB. */
const PRIMARY: [number, number, number] = [77, 116, 85];
const PRIMARY_FOREGROUND: [number, number, number] = [248, 251, 248];
const BORDER: [number, number, number] = [220, 220, 220];

/**
 * Small top-to-bottom writer over jsPDF: headings, paragraphs and two-column
 * tables, with page breaks handled for us.
 */
export class PdfWriter {
  readonly doc = new jsPDF({ unit: "mm", format: "a4" });
  private y = TOP;
  /** Page of each anchor, and the clickable areas pointing to them (resolved in `bytes`). */
  private anchors = new Map<string, number>();
  private links: { page: number; x: number; y: number; w: number; h: number; to: string }[] = [];

  /** `context` follows the app name in header and footer (e.g. "Menu · 8/11/2026"). */
  constructor(private readonly context?: string) {}

  private get width() {
    return this.doc.internal.pageSize.getWidth() - MARGIN * 2;
  }

  private ensure(height: number) {
    if (this.y + height > this.doc.internal.pageSize.getHeight() - BOTTOM) {
      this.doc.addPage();
      this.y = TOP;
    }
  }

  private text(value: string, size: number, opts: { bold?: boolean; muted?: boolean; underline?: boolean; link?: string; gapAfter?: number } = {}) {
    const { doc } = this;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const [r, g, b] = opts.muted ? MUTED : [0, 0, 0];
    doc.setTextColor(r, g, b);
    const lineHeight = (size * 0.3528) * 1.3;
    for (const line of doc.splitTextToSize(value, this.width) as string[]) {
      this.ensure(lineHeight);
      const baseline = this.y + lineHeight * 0.75;
      doc.text(line, MARGIN, baseline);
      if (opts.link) {
        const page = doc.getCurrentPageInfo().pageNumber;
        this.links.push({ page, x: MARGIN, y: this.y, w: doc.getTextWidth(line), h: lineHeight, to: opts.link });
      }
      this.y += lineHeight;
    }
    if (opts.underline) {
      // Full-width rule under the title.
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, this.y, MARGIN + this.width, this.y);
      this.y += 1.5;
    }
    this.y += opts.gapAfter ?? 0;
  }

  title(value: string) {
    this.text(value, 18, { bold: true, underline: true, gapAfter: 1 });
  }

  /** Grey line under the title or a heading (date, guests…). */
  subtitle(value: string) {
    this.text(value, 10, { muted: true, gapAfter: 3 });
  }

  /** Starts a new page unless we are already at its top. */
  pageBreak() {
    if (this.y > TOP) {
      this.doc.addPage();
      this.y = TOP;
    }
  }

  /** A page with just the title (and grey lines under it), centered; what follows starts on a new page. */
  cover(title: string, ...subtitles: string[]) {
    const { doc } = this;
    const center = doc.internal.pageSize.getWidth() / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(title, this.width) as string[];
    const lineHeight = 28 * 0.3528 * 1.25;
    let y = doc.internal.pageSize.getHeight() / 2 - ((lines.length - 1) * lineHeight) / 2;

    // First row: app icon and name, centered above the title.
    doc.setFontSize(16);
    const iconSize = 10;
    const rowWidth = iconSize + 3 + doc.getTextWidth(APP_NAME);
    const rowX = center - rowWidth / 2;
    doc.addImage(appIcon, "PNG", rowX, y - 30, iconSize, iconSize);
    doc.setTextColor(...PRIMARY);
    doc.text(APP_NAME, rowX + iconSize + 3, y - 30 + iconSize / 2 + 2);
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(28);
    for (const line of lines) {
      doc.text(line, center, y, { align: "center" });
      y += lineHeight;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(...MUTED);
    for (const line of subtitles) {
      doc.text(line, center, y + 2, { align: "center" });
      y += 12 * 0.3528 * 1.4;
    }
    doc.addPage();
    this.y = TOP;
  }

  heading(value: string, level: 1 | 2 | 3 = 1) {
    const size = { 1: 15, 2: 12, 3: 11 }[level];
    this.ensure(18); // keep the heading with at least a line of what follows
    this.y += { 1: 4, 2: 5, 3: 1 }[level];
    this.text(value, size, { bold: true, underline: level === 1, gapAfter: 1.5 });
  }

  /** One line that jumps to `anchor(to)` when clicked. */
  link(value: string, to: string) {
    this.text(value, 10, { link: to });
  }

  /** Marks the current position as the target of `link(…, key)`. */
  anchor(key: string) {
    this.anchors.set(key, this.doc.getCurrentPageInfo().pageNumber);
  }

  paragraph(value: string, opts: { muted?: boolean } = {}) {
    if (!value.trim()) return;
    this.text(value, 10, { muted: opts.muted, gapAfter: 2 });
  }

  /** Ingredient / quantity table. */
  /**
   * Ingredient / quantity table, drawn like the app's tables: rounded border,
   * header in the primary color, a thin line between rows.
   */
  table(rows: [string, string][], head: [string, string] = ["Ingrediente", "Quantità"]) {
    const { doc } = this;
    const radius = 2;
    // Top and bottom of the table on each page it spans, to draw its border afterwards.
    const parts = new Map<number, { top: number; bottom: number }>();
    autoTable(doc, {
      startY: this.y,
      margin: { left: MARGIN, right: MARGIN, top: TOP, bottom: BOTTOM },
      tableWidth: this.width,
      head: [head],
      showHead: "everyPage",
      body: rows,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 1.8, textColor: [0, 0, 0] },
      headStyles: { textColor: PRIMARY_FOREGROUND, fontStyle: "bold" },
      bodyStyles: { lineColor: BORDER, lineWidth: { bottom: 0.2 } },
      columnStyles: { 1: { halign: "right", cellWidth: 45 } },
      didParseCell: (d) => {
        if (d.section === "head" && d.column.index === 1) d.cell.styles.halign = "right";
        // The last row has the border under it already.
        if (d.section === "body" && d.row.index === rows.length - 1) d.cell.styles.lineWidth = 0;
      },
      willDrawCell: (d) => {
        // Header background once per row, with rounded top corners.
        if (d.section === "head" && d.column.index === 0) {
          doc.setFillColor(...PRIMARY);
          doc.roundedRect(MARGIN, d.cell.y, this.width, d.cell.height, radius, radius, "F");
          doc.rect(MARGIN, d.cell.y + d.cell.height - radius, this.width, radius, "F");
        }
      },
      didDrawCell: (d) => {
        const page = doc.getCurrentPageInfo().pageNumber;
        const part = parts.get(page) ?? { top: d.cell.y, bottom: d.cell.y };
        part.top = Math.min(part.top, d.cell.y);
        part.bottom = Math.max(part.bottom, d.cell.y + d.cell.height);
        parts.set(page, part);
      },
    });
    const last = doc.getCurrentPageInfo().pageNumber;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    for (const [page, { top, bottom }] of parts) {
      doc.setPage(page);
      doc.roundedRect(MARGIN, top, this.width, bottom - top, radius, radius, "S");
    }
    doc.setPage(last);
    this.y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  /**
   * On every page: header with app icon and name, the description (`context`)
   * under it; footer the same, with the page number on the right.
   */
  private decorate() {
    const { doc } = this;
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const pages = doc.getNumberOfPages();
    // Cut text that would run into the page number on the right.
    const fit = (text: string, max: number) => {
      if (doc.getTextWidth(text) <= max) return text;
      let t = text;
      while (t.length > 1 && doc.getTextWidth(`${t}…`) > max) t = t.slice(0, -1);
      return `${t.trimEnd()}…`;
    };
    /** Icon + app name on one row, description below; `top` is the top of the icon. */
    const block = (top: number, icon: number, nameSize: number, contextSize: number, maxWidth: number) => {
      doc.addImage(appIcon, "PNG", MARGIN, top, icon, icon);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(nameSize);
      doc.setTextColor(...PRIMARY);
      doc.text(APP_NAME, MARGIN + icon + 2, top + icon / 2 + nameSize * 0.3528 * 0.35);
      doc.setTextColor(...MUTED);
      if (this.context) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(contextSize);
        doc.text(fit(this.context, maxWidth), MARGIN, top + icon + contextSize * 0.3528 + 1.5);
      }
    };
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.2);
      doc.setTextColor(...MUTED);

      block(7, 5, 9, 8, width - MARGIN * 2);
      doc.line(MARGIN, 22, width - MARGIN, 22);

      doc.line(MARGIN, height - 20, width - MARGIN, height - 20);
      block(height - 17, 5, 9, 8, width - MARGIN * 2 - 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Pagina ${i} di ${pages}`, width - MARGIN, height - 12, { align: "right" });
    }
  }

  bytes(): Uint8Array {
    for (const l of this.links) {
      const pageNumber = this.anchors.get(l.to);
      if (!pageNumber) continue;
      this.doc.setPage(l.page);
      this.doc.link(l.x, l.y, l.w, l.h, { pageNumber });
    }
    this.links = [];
    this.decorate();
    return new Uint8Array(this.doc.output("arraybuffer"));
  }
}

/** A name safe for every file system: "Lista della spesa 3/11" -> "Lista della spesa 3-11". */
export const fileName = (title: string) => `${title.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim()}.pdf`;
