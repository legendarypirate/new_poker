"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { gameStatus, gameTypeLabel, money, when } from "@/lib/format";
import { useAdminQuery } from "@/hooks/use-admin-query";

export default function PlayPage() {
  const games = useAdminQuery(() => api.games("1").then((r) => r.data), [], 7000);
  const rooms = useAdminQuery(() => api.liveRooms().then((r) => r.data), [], 5000);

  async function endGame(id: number) {
    if (!window.confirm(`Force-end game #${id}?`)) return;
    try {
      await api.endGame(id);
      toast.success(`Game #${id} ended`);
      await Promise.all([games.reload(), rooms.reload()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not end game");
    }
  }

  const live = rooms.data?.filter((r) => r.gameStarted && !r.gameFinished) || [];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Active games</CardDescription>
            <CardTitle>{games.data?.length ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Live tables</CardDescription>
            <CardTitle>{live.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Players at tables</CardDescription>
            <CardTitle>{live.reduce((sum, room) => sum + room.playerCount, 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Currently playing</CardTitle>
          <CardDescription>Games marked active in the database. Force-end clears seats and current_game_id.</CardDescription>
        </CardHeader>
        <CardContent>
          {games.error && <p className="mb-3 text-sm text-destructive">{games.error}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Game</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Buy-in</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(games.data || []).map((game) => {
                const status = gameStatus(game.status);
                return (
                  <TableRow key={game.game_id}>
                    <TableCell className="font-medium">#{game.game_id}</TableCell>
                    <TableCell>{gameTypeLabel(game.game_type)}</TableCell>
                    <TableCell>{money(game.buy_in)}</TableCell>
                    <TableCell>{game.room_key || game.room_id}</TableCell>
                    <TableCell>{when(game.start_time || game.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={status.tone}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="destructive" onClick={() => endGame(game.game_id)}>
                        End game
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!games.data?.length && !games.loading && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nobody is playing right now.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
