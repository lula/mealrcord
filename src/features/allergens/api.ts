import { useQuery } from "@tanstack/react-query";
import { asc, eq } from "drizzle-orm";
import { db, newId } from "@/db/client";
import { allergens } from "@/db/schema";
import { useDbMutation } from "@/lib/query";

export const useAllergens = () =>
  useQuery({
    queryKey: ["allergens"],
    queryFn: () => db.select().from(allergens).orderBy(asc(allergens.name)),
  });

export async function createAllergen(name: string) {
  const id = newId();
  await db.insert(allergens).values({ id, name: name.trim() }).run();
  return id;
}

export const useCreateAllergen = () => useDbMutation(createAllergen);

export const useDeleteAllergen = () =>
  useDbMutation((id: string) => db.delete(allergens).where(eq(allergens.id, id)).run(), { success: "Allergene eliminato" });
