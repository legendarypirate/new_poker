"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function GamesPage() {
  const [status, setStatus] = useState("all");
  const games = useAdminQuery(
    () => api.games(status === "all" ? undefined : status).then((r) => r.data),
    [status]
  );

  async function endGame(id: number) {
    if (!window.confirm(`Force-end game #${id}?`)) return;
    try {
      await api.endGame(id);
      toast.success(`Game #${id} ended`);
      await games.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not end game");
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>All games</CardTitle>
          <Select value={status} onValueChange={(value) => setStatus(String(value ?? "all"))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="0">Waiting</SelectItem>
              <SelectItem value="1">Playing</SelectItem>
              <SelectItem value="2">Finished</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {games.error && <p className="mb-3 text-sm text-destructive">{games.error}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Buy-in</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Winner</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(games.data || []).map((game) => {
                const statusMeta = gameStatus(game.status);
                return (
                  <TableRow key={game.game_id}>
                    <TableCell>#{game.game_id}</TableCell>
                    <TableCell>{gameTypeLabel(game.game_type)}</TableCell>
                    <TableCell>{money(game.buy_in)}</TableCell>
                    <TableCell>{game.room_key || game.room_id}</TableCell>
                    <TableCell>{game.winner_username || "—"}</TableCell>
                    <TableCell>{when(game.start_time || game.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={statusMeta.tone}>{statusMeta.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {game.status !== 2 && (
                        <Button size="sm" variant="destructive" onClick={() => endGame(game.game_id)}>
                          End
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!games.data?.length && !games.loading && (
            <p className="py-6 text-center text-sm text-muted-foreground">No games match this filter.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
