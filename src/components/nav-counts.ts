import { useQuery } from "@tanstack/react-query";
import { count } from "drizzle-orm";
import { db } from "@/db/client";
import { dishes, meals, recipes } from "@/db/schema";

/** Number of recipes and menus, for the sidebar. Refreshed after every change (see useDbMutation). */
export const useNavCounts = () =>
  useQuery({
    queryKey: ["nav-counts"],
    queryFn: async () => {
      const [[r], [m], [d]] = await Promise.all([
        db.select({ n: count() }).from(recipes),
        db.select({ n: count() }).from(meals),
        db.select({ n: count() }).from(dishes),
      ]);
      return { "/recipes": r?.n ?? 0, "/meals": m?.n ?? 0, "/dishes": d?.n ?? 0 } as Record<string, number>;
    },
  });
