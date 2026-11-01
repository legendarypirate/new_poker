"use client";

import Link from "next/link";
import { Coins, DoorOpen, Gamepad2, Trophy, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { gameTypeLabel, money } from "@/lib/format";
import { useAdminQuery } from "@/hooks/use-admin-query";

export default function DashboardPage() {
  const stats = useAdminQuery(() => api.dashboard().then((r) => r.data), [], 15000);
  const rooms = useAdminQuery(() => api.liveRooms().then((r) => r.data), [], 8000);
  const data = stats.data;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          icon={Users}
          label="Users"
          value={data?.users.total ?? "—"}
          hint={`${data?.users.active ?? 0} active · ${data?.users.playing ?? 0} playing`}
        />
        <Stat
          icon={Gamepad2}
          label="Games"
          value={data?.games.active ?? "—"}
          hint={`${data?.games.total ?? 0} total recorded`}
        />
        <Stat
          icon={DoorOpen}
          label="Live rooms"
          value={data?.rooms?.live ?? rooms.data?.length ?? "—"}
          hint={`${data?.rooms?.playing ?? rooms.data?.filter((r) => r.gameStarted && !r.gameFinished).length ?? 0} currently dealing`}
        />
        <Stat
          icon={Trophy}
          label="Tournaments"
          value={data?.tournaments.active ?? "—"}
          hint={`${data?.tournaments.total ?? 0} created`}
        />
        <Stat
          icon={Wallet}
          label="Pending withdrawals"
          value={data?.withdrawals.pending ?? "—"}
          hint={`${money(data?.withdrawals.totalAmount)} paid out`}
        />
        <Stat icon={Coins} label="Control" value="Ready" hint="Force-end games, kick players, adjust balances" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Currently playing</CardTitle>
            <CardDescription>Live rooms from the game server, refreshing every few seconds.</CardDescription>
          </div>
          <Link href="/play" className={buttonVariants({ variant: "outline" })}>
            Open live play
          </Link>
        </CardHeader>
        <CardContent>
          {rooms.error && <p className="text-sm text-destructive">{rooms.error}</p>}
          {!rooms.data?.length && !rooms.loading ? (
            <p className="text-sm text-muted-foreground">No rooms are live right now.</p>
          ) : (
            <div className="grid gap-3">
              {(rooms.data || []).slice(0, 6).map((room) => (
                <div
                  key={room.roomId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{room.roomId}</p>
                    <p className="text-xs text-muted-foreground">
                      {gameTypeLabel(room.gameType)} · buy-in {money(room.buyIn)} · {room.playerCount}/{room.maxPlayers} players
                    </p>
                  </div>
                  <Badge variant={room.gameStarted && !room.gameFinished ? "default" : "secondary"}>
                    {room.gameFinished ? "Finished" : room.gameStarted ? "Playing" : "Waiting"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-2xl">{value}</CardTitle>
        </div>
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
