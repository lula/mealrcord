import { useQuery } from "@tanstack/react-query";
import { asc, eq } from "drizzle-orm";
import { db, newId } from "@/db/client";
import { units, type Dimension } from "@/db/schema";
import { useDbMutation } from "@/lib/query";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  mass: "Peso",
  volume: "Volume",
  other: "Altro (non convertibile)",
};

export const useUnits = () =>
  useQuery({
    queryKey: ["units"],
    queryFn: () => db.select().from(units).orderBy(asc(units.dimension), asc(units.factorToBase), asc(units.symbol)),
  });

export type UnitInput = { name: string; symbol: string; dimension: Dimension; factorToBase: number };

export const useCreateUnit = () =>
  useDbMutation((u: UnitInput) => db.insert(units).values({ id: newId(), ...u }).run(), { success: "Unità aggiunta" });

export const useDeleteUnit = () =>
  useDbMutation((id: string) => db.delete(units).where(eq(units.id, id)).run(), { success: "Unità eliminata" });
