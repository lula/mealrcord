import { useState } from "react";
import { format } from "date-fns";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Database, Download, FileJson, Lock, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/page";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { backupDb, dbErrorMessage, restoreDb } from "@/db/client";
import { DIMENSIONS, type Dimension } from "@/db/schema";
import {
  useCreateIngredientCategory,
  useDeleteIngredient,
  useDeleteIngredientCategory,
  useIngredientCategories,
  useIngredients,
  useUpdateIngredient,
} from "@/features/ingredients/api";
import { useCreateTag, useDeleteTag, useTags } from "@/features/tags/api";
import { DIMENSION_LABELS, useCreateUnit, useDeleteUnit, useUnits } from "@/features/units/api";
import { UnitSelect } from "@/features/units/unit-select";
import { DEFAULT_UNIT_ID, formatNumber } from "@/lib/units";
import { useSaveSetting, useSettings } from "./api";
import { exportJson } from "./backup";

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Impostazioni" />
      <PageBody>
        <Tabs defaultValue="ingredients">
          <TabsList>
            <TabsTrigger value="ingredients">Ingredienti</TabsTrigger>
            <TabsTrigger value="categories">Categorie</TabsTrigger>
            <TabsTrigger value="tags">Tag</TabsTrigger>
            <TabsTrigger value="units">Simbolo</TabsTrigger>
            <TabsTrigger value="preferences">Preferenze</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>
          <TabsContent value="ingredients">
            <IngredientsTab />
          </TabsContent>
          <TabsContent value="categories">
            <CategoriesTab />
          </TabsContent>
          <TabsContent value="tags">
            <TagsTab />
          </TabsContent>
          <TabsContent value="units">
            <UnitsTab />
          </TabsContent>
          <TabsContent value="preferences">
            <PreferencesTab />
          </TabsContent>
          <TabsContent value="backup">
            <BackupTab />
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

type IngredientDraft = { id: string; name: string; defaultUnitId: string | null; categoryId: string | null };

function IngredientsTab() {
  const { data: ingredients = [] } = useIngredients();
  const { data: units = [] } = useUnits();
  const { data: categories = [] } = useIngredientCategories();
  const del = useDeleteIngredient();
  const [editing, setEditing] = useState<IngredientDraft | null>(null);
  const unitSymbol = new Map(units.map((u) => [u.id, u.symbol]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingredienti</CardTitle>
        <CardDescription>Condivisi tra le ricette. Si creano dall'editor ricetta; qui puoi rinominarli e impostare unità predefinita e categoria.</CardDescription>
      </CardHeader>
      <CardContent>
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
            {ingredients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-20 text-center">
                  Nessun ingrediente.
                </TableCell>
              </TableRow>
            )}
            {ingredients.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.name}</TableCell>
                <TableCell>{i.categoryId ? categoryName.get(i.categoryId) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{unitSymbol.get(i.defaultUnitId ?? DEFAULT_UNIT_ID)}</TableCell>
                <TableCell className="text-right tabular-nums">{i.usage}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" aria-label="Modifica" onClick={() => setEditing(i)}>
                    <Pencil />
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
      </CardContent>
      <IngredientDialog value={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

// Radix Select does not accept an empty value.
const NO_CATEGORY = "__none";

function IngredientDialog({ value, onClose }: { value: IngredientDraft | null; onClose: () => void }) {
  const update = useUpdateIngredient();
  const { data: categories = [] } = useIngredientCategories();
  const [draft, setDraft] = useState(value);
  if (value && draft?.id !== value.id) setDraft(value);

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="space-y-6"
          onSubmit={(e) => e.preventDefault()}
        >
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
                <Select
                  value={draft.categoryId ?? NO_CATEGORY}
                  onValueChange={(id) => setDraft({ ...draft, categoryId: id === NO_CATEGORY ? null : id })}
                >
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
                {categories.length === 0 && <FieldDescription>Crea le categorie nella scheda «Categorie».</FieldDescription>}
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

function CategoriesTab() {
  const { data: categories = [] } = useIngredientCategories();
  const create = useCreateIngredientCategory();
  const del = useDeleteIngredientCategory();
  const [name, setName] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorie ingredienti</CardTitle>
        <CardDescription>Ogni ingrediente può avere una categoria. Eliminando una categoria, gli ingredienti restano senza.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex max-w-sm gap-2" onSubmit={(e) => e.preventDefault()}>
          <Input placeholder="Nuova categoria (es. Verdura)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            type="button"
            disabled={!name.trim()}
            onClick={async () => {
              if (!name.trim()) return;
              await create.mutateAsync(name);
              setName("");
            }}
          >
            <Plus /> Aggiungi
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && <p className="text-muted-foreground text-sm">Nessuna categoria.</p>}
          {categories.map((c) => (
            <Badge key={c.id} variant="secondary" className="h-7 gap-1 pr-0.5 pl-2.5">
              {c.name}
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-xs" aria-label={`Elimina ${c.name}`}>
                    <Trash2 />
                  </Button>
                }
                title={`Eliminare la categoria «${c.name}»?`}
                description="Gli ingredienti di questa categoria resteranno senza categoria."
                onConfirm={() => del.mutate(c.id)}
              />
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TagsTab() {
  const { data: tags = [] } = useTags();
  const create = useCreateTag();
  const del = useDeleteTag();
  const [name, setName] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag</CardTitle>
        <CardDescription>I tag di portata sono di sistema e non si possono eliminare.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex max-w-sm gap-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <Input placeholder="Nuovo tag (es. Vegetariano)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            type="button"
            disabled={!name.trim()}
            onClick={async () => {
              if (!name.trim()) return;
              await create.mutateAsync(name);
              setName("");
            }}
          >
            <Plus /> Aggiungi
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) =>
            t.isSystem ? (
              <Badge key={t.id} className="h-7 gap-1 px-2.5">
                <Lock /> {t.name}
              </Badge>
            ) : (
              <Badge key={t.id} variant="secondary" className="h-7 gap-1 pr-0.5 pl-2.5">
                {t.name}
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon-xs" aria-label={`Elimina ${t.name}`}>
                      <Trash2 />
                    </Button>
                  }
                  title={`Eliminare il tag «${t.name}»?`}
                  description="Verrà rimosso da tutte le ricette."
                  onConfirm={() => del.mutate(t.id)}
                />
              </Badge>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UnitsTab() {
  const { data: units = [] } = useUnits();
  const create = useCreateUnit();
  const del = useDeleteUnit();
  const [draft, setDraft] = useState({ name: "", symbol: "", dimension: "other" as Dimension, factorToBase: 1 });
  const base = { mass: "g", volume: "ml", other: "" }[draft.dimension];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unità di misura</CardTitle>
        <CardDescription>
          Peso e volume vengono convertiti e sommati nella lista della spesa (base: g e ml). Le unità «Altro» si sommano solo tra loro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Simbolo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valore in base</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.symbol}</TableCell>
                <TableCell>{u.name}</TableCell>
                <TableCell>{DIMENSION_LABELS[u.dimension]}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {u.dimension === "other" ? "—" : `${formatNumber(u.factorToBase)} ${u.dimension === "mass" ? "g" : "ml"}`}
                </TableCell>
                <TableCell>
                  {u.isSystem ? (
                    <Lock className="text-muted-foreground mx-auto size-4" />
                  ) : (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Elimina">
                          <Trash2 />
                        </Button>
                      }
                      title={`Eliminare «${u.symbol}»?`}
                      onConfirm={() => del.mutate(u.id)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <Field className="w-28">
            <FieldLabel htmlFor="u-symbol">Simbolo</FieldLabel>
            <Input id="u-symbol" placeholder="vasetto" value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} />
          </Field>
          <Field className="w-36">
            <FieldLabel htmlFor="u-name">Nome</FieldLabel>
            <Input id="u-name" placeholder="vasetti" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field className="w-48">
            <FieldLabel>Tipo</FieldLabel>
            <Select value={draft.dimension} onValueChange={(d) => setDraft({ ...draft, dimension: d as Dimension, factorToBase: 1 })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIMENSIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DIMENSION_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {draft.dimension !== "other" && (
            <Field className="w-32">
              <FieldLabel htmlFor="u-factor">1 unità = ? {base}</FieldLabel>
              <Input
                id="u-factor"
                type="number"
                step="any"
                min={0}
                value={draft.factorToBase}
                onChange={(e) => setDraft({ ...draft, factorToBase: e.target.valueAsNumber })}
              />
            </Field>
          )}
          <Button
            type="button"
            disabled={!draft.symbol.trim() || !draft.name.trim()}
            onClick={async () => {
              if (!draft.symbol.trim() || !draft.name.trim() || !(draft.factorToBase > 0)) return;
              await create.mutateAsync({ ...draft, symbol: draft.symbol.trim(), name: draft.name.trim() });
              setDraft({ name: "", symbol: "", dimension: "other", factorToBase: 1 });
            }}
          >
            <Plus /> Aggiungi unità
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

const stamp = () => format(new Date(), "yyyy-MM-dd_HHmm");

function PreferencesTab() {
  return (
    <div className="grid max-w-4xl gap-4 md:grid-cols-2">
      <NumberSettingCard
        settingKey="guestsWarningPercent"
        title="Planner"
        description="Controlli quando pianifichi un menu."
        label="Soglia avviso coperti (%)"
        help="Avvisa quando la somma dei coperti delle ricette di una portata supera i coperti della pianificazione di più di questa percentuale. 0 = avvisa appena li supera."
        min={0}
        step={5}
      />
      <NumberSettingCard
        settingKey="maxDishRecipes"
        title="Piatti unici"
        description="Regole per i piatti unici."
        label="Ricette massime per piatto"
        help="Quante ricette al massimo può contenere un piatto unico. Non cambia i piatti unici già salvati."
        min={1}
        step={1}
        integer
      />
    </div>
  );
}

/** A card that edits one numeric preference. */
function NumberSettingCard({
  settingKey,
  title,
  description,
  label,
  help,
  min,
  step,
  integer = false,
}: {
  settingKey: "guestsWarningPercent" | "maxDishRecipes";
  title: string;
  description: string;
  label: string;
  help: string;
  min: number;
  step: number;
  integer?: boolean;
}) {
  const { data: settings } = useSettings();
  const save = useSaveSetting();
  const [draft, setDraft] = useState<string | null>(null);
  const current = settings?.[settingKey];
  const value = draft ?? (current != null ? String(current) : "");
  const parsed = Number(value);
  const valid = value !== "" && Number.isFinite(parsed) && parsed >= min && (!integer || Number.isInteger(parsed));
  const id = `setting-${settingKey}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <Field>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input id={id} type="number" min={min} step={step} className="w-32" value={value} onChange={(e) => setDraft(e.target.value)} />
            <FieldDescription>{help}</FieldDescription>
          </Field>
          <Button
            type="button"
            disabled={!valid || parsed === current || save.isPending}
            onClick={async () => {
              if (!valid) return;
              await save.mutateAsync({ key: settingKey, value: parsed });
              setDraft(null);
            }}
          >
            Salva
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BackupTab() {
  const qc = useQueryClient();
  const [restorePath, setRestorePath] = useState<string | null>(null);

  async function run(fn: () => Promise<void>, ok: string) {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(dbErrorMessage(e));
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4" /> Backup completo
          </CardTitle>
          <CardDescription>Una copia del database (.db) da conservare o da spostare su un altro computer.</CardDescription>
        </CardHeader>
        <CardFooter className="gap-2">
          <Button
            onClick={async () => {
              const path = await saveDialog({ defaultPath: `mealrcord_${stamp()}.db`, filters: [{ name: "Database", extensions: ["db"] }] });
              if (path) await run(() => backupDb(path), "Backup salvato");
            }}
          >
            <Download /> Salva backup
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const path = await openDialog({ multiple: false, directory: false, filters: [{ name: "Database", extensions: ["db"] }] });
              if (typeof path === "string") setRestorePath(path);
            }}
          >
            <Upload /> Ripristina…
          </Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="size-4" /> Esporta JSON
          </CardTitle>
          <CardDescription>Tutti i dati in formato leggibile, utile per analisi o altri programmi. Non si può reimportare.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            variant="outline"
            onClick={async () => {
              const path = await saveDialog({ defaultPath: `mealrcord_${stamp()}.json`, filters: [{ name: "JSON", extensions: ["json"] }] });
              if (path) await run(() => exportJson(path), "Export completato");
            }}
          >
            <Download /> Esporta
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={!!restorePath} onOpenChange={(o) => !o && setRestorePath(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ripristinare il backup?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Tutti i dati attuali verranno sostituiti con quelli del file <span className="text-foreground font-medium break-all">{restorePath}</span>. Conviene
            salvare prima un backup dei dati attuali.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestorePath(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const path = restorePath!;
                setRestorePath(null);
                await run(async () => {
                  await restoreDb(path);
                  qc.clear();
                  await qc.invalidateQueries();
                }, "Backup ripristinato");
              }}
            >
              Ripristina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
