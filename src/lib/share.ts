import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";

/** Opens the default mail app with the list (in the selected view) as the body. */
export const sendEmail = async (title: string, text: string) => {
    const params = `subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;
    try {
        await openUrl(`mailto:?${params}`);
    } catch (e) {
        toast.error(`Impossibile aprire l'app di posta: ${e}`);
    }
};