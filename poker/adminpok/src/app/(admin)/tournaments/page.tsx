"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { gameTypeLabel, money, tournamentStatus, when } from "@/lib/format";
import { useAdminQuery } from "@/hooks/use-admin-query";

export default function TournamentsPage() {
  const tournaments = useAdminQuery(() => api.tournaments().then((r) => r.data));
  const [name, setName] = useState("");
  const [buyIn, setBuyIn] = useState("20000");
  const [maxPlayers, setMaxPlayers] = useState("8");
  const [gameType, setGameType] = useState("mongol_13");
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createTournament({
        tournament_name: name.trim(),
        buy_in: Number(buyIn),
        max_players: Number(maxPlayers),
        game_type: gameType,
      });
      toast.success("Tournament created");
      setName("");
      await tournaments.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this tournament?")) return;
    try {
      await api.deleteTournament(id);
      toast.success("Tournament deleted");
      await tournaments.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Create tournament</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5" onSubmit={create}>
            <div className="grid gap-1 md:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="buyIn">Buy-in</Label>
              <Input id="buyIn" type="number" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="max">Max players</Label>
              <Input id="max" type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="type">Game</Label>
              <Input id="type" value={gameType} onChange={(e) => setGameType(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="md:col-span-5">
              Create tournament
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tournaments</CardTitle>
        </CardHeader>
        <CardContent>
          {tournaments.error && <p className="mb-3 text-sm text-destructive">{tournaments.error}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Buy-in</TableHead>
                <TableHead>Players</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tournaments.data || []).map((item) => (
                <TableRow key={item.tournament_id}>
                  <TableCell className="font-medium">{item.tournament_name}</TableCell>
                  <TableCell>{gameTypeLabel(item.game_type)}</TableCell>
                  <TableCell>{money(item.buy_in)}</TableCell>
                  <TableCell>{item.max_players}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 2 ? "default" : "secondary"}>
                      {tournamentStatus(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{when(item.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="destructive" onClick={() => remove(item.tournament_id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
