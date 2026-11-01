"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { gameTypeLabel, money } from "@/lib/format";
import { useAdminQuery } from "@/hooks/use-admin-query";

export default function RoomsPage() {
  const rooms = useAdminQuery(() => api.liveRooms().then((r) => r.data), [], 4000);

  async function closeRoom(roomId: string) {
    if (!window.confirm(`Close room ${roomId} and kick everyone?`)) return;
    try {
      await api.closeRoom(roomId);
      toast.success("Room closed");
      await rooms.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not close room");
    }
  }

  async function kick(roomId: string, userId: number, username: string) {
    if (!window.confirm(`Kick ${username} from ${roomId}?`)) return;
    try {
      await api.kickPlayer(roomId, userId);
      toast.success(`${username} was kicked`);
      await rooms.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not kick player");
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Live rooms</CardTitle>
          <CardDescription>
            In-memory WebSocket rooms. Close a room to finish the game and send players back to lobby.
          </CardDescription>
        </CardHeader>
      </Card>

      {rooms.error && <p className="text-sm text-destructive">{rooms.error}</p>}
      {!rooms.data?.length && !rooms.loading && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No live rooms. They appear here when players join a table.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {(rooms.data || []).map((room) => (
          <Card key={room.roomId}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{room.roomId}</CardTitle>
                <CardDescription>
                  {gameTypeLabel(room.gameType)} · buy-in {money(room.buyIn)} ·{" "}
                  {room.playerCount}/{room.maxPlayers}
                  {room.gameId ? ` · game #${room.gameId}` : ""}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={room.gameStarted && !room.gameFinished ? "default" : "secondary"}>
                  {room.gameFinished ? "Finished" : room.gameStarted ? "Playing" : "Waiting"}
                </Badge>
                <Button size="sm" variant="destructive" onClick={() => closeRoom(room.roomId)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {room.players.map((player) => (
                <div
                  key={`${room.roomId}-${player.userId}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{player.username}</p>
                    <p className="text-xs text-muted-foreground">
                      id {player.userId} · {player.connected ? "connected" : "disconnected"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => kick(room.roomId, player.userId, player.username)}
                  >
                    Kick
                  </Button>
                </div>
              ))}
              {!room.players.length && (
                <p className="text-sm text-muted-foreground">Empty room</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
