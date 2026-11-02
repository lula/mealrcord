import { useQuery } from "@tanstack/react-query";
import { asc, desc, eq } from "drizzle-orm";
import { db, newId } from "@/db/client";
import { tags, type Course } from "@/db/schema";
import { useDbMutation } from "@/lib/query";

/** System tags first (in course order), then custom tags alphabetically. */
export const useTags = () =>
  useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const rows = await db.select().from(tags).orderBy(desc(tags.isSystem), asc(tags.name));
      const order: Course[] = ["starter", "first", "main", "dessert"];
      return rows.sort((a, b) =>
        a.isSystem && b.isSystem ? order.indexOf(a.course!) - order.indexOf(b.course!) : 0,
      );
    },
  });

export async function createTag(name: string) {
  const id = newId();
  await db.insert(tags).values({ id, name: name.trim() }).run();
  return id;
}

export const useCreateTag = () => useDbMutation(createTag);

export const useDeleteTag = () =>
  useDbMutation((id: string) => db.delete(tags).where(eq(tags.id, id)).run(), { success: "Tag eliminato" });
