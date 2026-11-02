import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { RecipesPage } from "@/features/recipes/recipes-page";
import { RecipeEditorPage } from "@/features/recipes/recipe-editor-page";
import { MealsPage } from "@/features/meals/meals-page";
import { MealEditorPage } from "@/features/meals/meal-editor-page";
import { PlannerPage, type PlannerSearch } from "@/features/planner/planner-page";
import { ShoppingPage, type ShoppingSearch } from "@/features/shopping/shopping-page";
import { SettingsPage } from "@/features/settings/settings-page";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const asDate = (v: unknown) => (typeof v === "string" && DATE_RE.test(v) ? v : undefined);

const rootRoute = createRootRoute({ component: AppLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/planner" });
  },
});

const recipesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/recipes", component: RecipesPage });
const recipeNewRoute = createRoute({ getParentRoute: () => rootRoute, path: "/recipes/new", component: RecipeEditorPage });
export const recipeEditRoute = createRoute({ getParentRoute: () => rootRoute, path: "/recipes/$recipeId", component: RecipeEditorPage });

const mealsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/meals", component: MealsPage });
const mealNewRoute = createRoute({ getParentRoute: () => rootRoute, path: "/meals/new", component: MealEditorPage });
export const mealEditRoute = createRoute({ getParentRoute: () => rootRoute, path: "/meals/$mealId", component: MealEditorPage });

export const plannerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/planner",
  component: PlannerPage,
  validateSearch: (s: Record<string, unknown>): PlannerSearch => ({
    view: s.view === "month" || s.view === "day" ? s.view : undefined,
    date: asDate(s.date),
  }),
});

export const shoppingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/shopping",
  component: ShoppingPage,
  validateSearch: (s: Record<string, unknown>): ShoppingSearch => ({ from: asDate(s.from), to: asDate(s.to) }),
});

const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });

const routeTree = rootRoute.addChildren([
  indexRoute,
  recipesRoute,
  recipeNewRoute,
  recipeEditRoute,
  mealsRoute,
  mealNewRoute,
  mealEditRoute,
  plannerRoute,
  shoppingRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: false });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
