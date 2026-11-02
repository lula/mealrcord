import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BookOpen, CalendarDays, ChefHat, Moon, Settings, ShoppingCart, Sun, UtensilsCrossed } from "lucide-react";
import { useTheme } from "@/components/theme";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

const NAV = [
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/meals", label: "Pasti", icon: UtensilsCrossed },
  { to: "/recipes", label: "Ricette", icon: BookOpen },
  { to: "/shopping", label: "Lista della spesa", icon: ShoppingCart },
  { to: "/settings", label: "Impostazioni", icon: Settings },
] as const;

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/planner">
                  <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
                    <ChefHat className="size-4" />
                  </div>
                  <span className="font-semibold">mealrcord</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(to)} tooltip={label}>
                      <Link to={to}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setTheme(dark ? "light" : "dark")} tooltip="Cambia tema">
                {dark ? <Sun /> : <Moon />}
                <span>{dark ? "Tema chiaro" : "Tema scuro"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
