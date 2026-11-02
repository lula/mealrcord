import { useQuery } from "@tanstack/react-query";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { useDbMutation } from "@/lib/query";

/** Every preference with its default. Stored as JSON in the settings table. */
export const SETTING_DEFAULTS = {
  /** Warn when a course's guests exceed the planned guests by more than this percentage. */
  guestsWarningPercent: 20,
  /** Most recipes a "piatto unico" can have. */
  maxDishRecipes: 3,
};

export type Settings = typeof SETTING_DEFAULTS;

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings);
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in SETTING_DEFAULTS) out[r.key] = JSON.parse(r.value);
  return out as Settings;
}

export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: getSettings });

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const json = JSON.stringify(value);
  await db.insert(settings).values({ key, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } }).run();
}

type SettingInput = { [K in keyof Settings]: { key: K; value: Settings[K] } }[keyof Settings];

export const useSaveSetting = () =>
  useDbMutation(({ key, value }: SettingInput) => saveSetting(key, value), { success: "Impostazione salvata" });
