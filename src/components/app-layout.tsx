import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { BookOpen, CalendarDays, Carrot, CookingPot, Moon, PanelLeftIcon, Settings, ShoppingCart, Sun, UtensilsCrossed } from "lucide-react";
import appIcon from "@/assets/app-icon.svg";
import { useNavCounts } from "@/components/nav-counts";
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider, useSidebar
} from "@/components/ui/sidebar";

const NAV = [
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/meals", label: "Menu", icon: UtensilsCrossed },
  { to: "/dishes", label: "Piatti unici", icon: CookingPot },
  { to: "/recipes", label: "Ricette", icon: BookOpen },
  { to: "/ingredients", label: "Ingredienti", icon: Carrot },
  { to: "/shopping", label: "Lista della spesa", icon: ShoppingCart },
  { to: "/settings", label: "Impostazioni", icon: Settings },
] as const;

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const { data: counts } = useNavCounts();

  return (
    <SidebarProvider>
      <Sidebar variant="floating" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/planner">
                  <img src={appIcon} alt="" className="size-8 shrink-0 rounded-[7px] ring-1 ring-white/30" />
                  <span className="font-semibold group-data-[collapsible=icon]:hidden">mealrcord</span>
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
                  <SidebarMenuItem key={to} className="my-1">
                    <SidebarMenuButton asChild isActive={pathname.startsWith(to)} tooltip={label}>
                      <Link to={to}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {counts?.[to] != null && <SidebarMenuBadge>{counts[to]}</SidebarMenuBadge>}
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
            <SidebarMenuItem>
              <ToggleSidebarButton />
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

function ToggleSidebarButton() {
  const { toggleSidebar } = useSidebar()
  return <SidebarMenuButton className="text-nowrap" onClick={() => toggleSidebar()} tooltip="Mostra menu">
    <PanelLeftIcon />
    Nascondi menu
  </SidebarMenuButton>
}
