"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { getToken } from "@/lib/auth";
import { Separator } from "@/components/ui/separator";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/users": "Users",
  "/play": "Live play",
  "/rooms": "Rooms",
  "/games": "Games",
  "/tournaments": "Tournaments",
  "/withdrawals": "Withdrawals",
  "/charges": "Revenue",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setAuthed(false);
      router.replace("/login");
    }
  }, [router]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div>
            <p className="text-sm font-medium">{TITLES[pathname] || "Admin"}</p>
            <p className="text-xs text-muted-foreground">Manage players, rooms, and live tables</p>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6">
          {authed ? children : (
            <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
