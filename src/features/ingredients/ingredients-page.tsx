import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Carrot, Pencil, Search, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageBody, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUnits } from "@/features/units/api";
import { UnitSelect } from "@/features/units/unit-select";
import { DEFAULT_UNIT_ID } from "@/lib/units";
import { useDeleteIngredient, useIngredientCategories, useIngredients, useUpdateIngredient } from "./api";

type IngredientDraft = { id: string; name: string; defaultUnitId: string | null; categoryId: string | null };

// Radix Select does not accept an empty value. Also used as the "no category" filter.
const NO_CATEGORY = "__none";
const ALL_CATEGORIES = "__all";

/** Ingredients list. At /ingredients/$ingredientId the edit dialog of that ingredient is open. */
export function IngredientsPage() {
  const { ingredientId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { data: ingredients = [], isLoading } = useIngredients();
  const { data: units = [] } = useUnits();
  const { data: categories = [] } = useIngredientCategories();
  const del = useDeleteIngredient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);

  const unitSymbol = new Map(units.map((u) => [u.id, u.symbol]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const editing = ingredients.find((i) => i.id === ingredientId) ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ingredients.filter(
      (i) =>
        (!q || i.name.toLowerCase().includes(q)) &&
        (category === ALL_CATEGORIES || (category === NO_CATEGORY ? !i.categoryId : i.categoryId === category)),
    );
  }, [ingredients, search, category]);

  return (
    <>
      <PageHeader title="Ingredienti" description={`${ingredients.length} ingredienti`} />
      <PageBody className="space-y-4">
        {!isLoading && ingredients.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Carrot />
              </EmptyMedia>
              <EmptyTitle>Nessun ingrediente</EmptyTitle>
              <EmptyDescription>Gli ingredienti si creano dall'editor ricetta.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <InputGroup className="max-w-sm">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput placeholder="Cerca per nome…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </InputGroup>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CATEGORIES}>Tutte le categorie</SelectItem>
                  <SelectItem value={NO_CATEGORY}>Senza categoria</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(search || category !== ALL_CATEGORIES) && (
                <Button variant="outline" onClick={() => (setSearch(""), setCategory(ALL_CATEGORIES))}>
                  <X />
                  Rimuovi filtri
                </Button>
              )}
            </div>
            <div className="max-w-4xl rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Unità predefinita</TableHead>
                    <TableHead className="text-right">Ricette</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground h-20 text-center">
                        Nessun ingrediente trovato.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell>{i.categoryId ? categoryName.get(i.categoryId) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{unitSymbol.get(i.defaultUnitId ?? DEFAULT_UNIT_ID)}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.usage}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" aria-label="Modifica" asChild>
                          <Link to="/ingredients/$ingredientId" params={{ ingredientId: i.id }}>
                            <Pencil />
                          </Link>
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Elimina" disabled={i.usage > 0} title={i.usage > 0 ? "Usato in ricette" : undefined}>
                              <Trash2 />
                            </Button>
                          }
                          title={`Eliminare «${i.name}»?`}
                          onConfirm={() => del.mutate(i.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </PageBody>
      <IngredientDialog value={editing} onClose={() => navigate({ to: "/ingredients" })} />
    </>
  );
}

export function IngredientDialog({ value, onClose }: { value: IngredientDraft | null; onClose: () => void }) {
  const update = useUpdateIngredient();
  const { data: categories = [] } = useIngredientCategories();
  const [draft, setDraft] = useState(value);
  if (value && draft?.id !== value.id) setDraft(value);

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Modifica ingrediente</DialogTitle>
          </DialogHeader>
          {draft && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ing-name">Nome</FieldLabel>
                <Input id="ing-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel>Unità predefinita</FieldLabel>
                <UnitSelect value={draft.defaultUnitId ?? DEFAULT_UNIT_ID} onChange={(id) => setDraft({ ...draft, defaultUnitId: id })} className="w-40" />
              </Field>
              <Field>
                <FieldLabel>Categoria</FieldLabel>
                <Select value={draft.categoryId ?? NO_CATEGORY} onValueChange={(id) => setDraft({ ...draft, categoryId: id === NO_CATEGORY ? null : id })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Nessuna</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categories.length === 0 && <FieldDescription>Crea le categorie in Impostazioni → Categorie.</FieldDescription>}
              </Field>
            </FieldGroup>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button
              type="button"
              disabled={update.isPending}
              onClick={async () => {
                if (!draft?.name.trim()) return;
                await update.mutateAsync(draft);
                onClose();
              }}
            >
              Salva
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
