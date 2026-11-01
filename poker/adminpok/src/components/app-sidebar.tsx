"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Coins,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Spade,
  Trophy,
  Users,
  Wallet,
  DoorOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { clearSession, getUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/play", label: "Live play", icon: Gamepad2 },
  { href: "/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/games", label: "Games", icon: Spade },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/withdrawals", label: "Withdrawals", icon: Wallet },
  { href: "/charges", label: "Revenue", icon: Coins },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2 px-1">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Spade className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">AdminPok</p>
            <p className="text-xs text-muted-foreground">Poker control desk</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Control</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-sidebar-accent px-2 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.username || "Admin"}</p>
            <p className="text-xs text-muted-foreground">{user?.role || "admin"}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              clearSession();
              router.replace("/login");
            }}
          >
            <LogOut />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
