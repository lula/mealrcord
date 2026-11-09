import { describe, expect, it } from "vitest";
import { TextWriter } from "./doc-writer";

describe("TextWriter", () => {
  it("writes the document as a plain text note", () => {
    const w = new TextWriter("Menu del 8/11/2026");
    w.cover("Menu", "domenica 8 novembre 2026", "20 coperti");
    w.heading("Composizione del menu");
    w.heading("Primi", 2);
    w.link("• Lasagne", "a");
    w.link("• Risotto", "b");
    w.pageBreak();
    w.heading("Lista della spesa");
    w.table([
      ["Farina", "1 kg"],
      ["Uova", "6"],
    ]);
    w.pageBreak();
    w.anchor("a");
    w.title("Lasagne");
    w.subtitle("Primi · 20 coperti");
    w.paragraph("");
    w.paragraph("Cuocere in forno.");
    w.pageBreak();
    expect(w.toString()).toBe(
      [
        "mealrcord · Menu del 8/11/2026",
        "MENU\n====\ndomenica 8 novembre 2026\n20 coperti",
        "—".repeat(30),
        "Composizione del menu\n---------------------",
        "» Primi",
        "• Lasagne\n• Risotto",
        "—".repeat(30),
        "Lista della spesa\n-----------------",
        "- Farina: 1 kg\n- Uova: 6",
        "—".repeat(30),
        "LASAGNE\n=======\nPrimi · 20 coperti",
        "Cuocere in forno.",
      ].join("\n\n") + "\n",
    );
  });
});
