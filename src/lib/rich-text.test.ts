import { describe, expect, it } from "vitest";
import { toHtml } from "./rich-text";

describe("toHtml", () => {
  it("turns older plain text into paragraphs, escaping HTML", () => {
    expect(toHtml("Riga 1\nRiga 2\n\nSecondo <paragrafo>")).toBe("<p>Riga 1<br>Riga 2</p><p>Secondo &lt;paragrafo&gt;</p>");
  });
  it("keeps editor HTML and empty values as they are", () => {
    expect(toHtml("<p>Ciao <strong>mondo</strong></p>")).toBe("<p>Ciao <strong>mondo</strong></p>");
    expect(toHtml("<ul><li><p>uno</p></li></ul>")).toBe("<ul><li><p>uno</p></li></ul>");
    expect(toHtml("")).toBe("");
  });
});
