import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { fileName, type PdfWriter } from "@/lib/pdf";

/**
 * Saves the PDF where the user chooses and shows it in Finder/Explorer, ready
 * to be attached to an email or a chat (a mailto: link cannot carry files).
 */
export const sharePdf = async (title: string, pdf: PdfWriter) => {
  try {
    const path = await saveDialog({ defaultPath: fileName(title), filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (!path) return;
    await invoke("save_binary_file", { path, contents: Array.from(pdf.bytes()) });
    await revealItemInDir(path);
    toast.success("PDF salvato");
  } catch (e) {
    toast.error(`Impossibile creare il PDF: ${e}`);
  }
};
