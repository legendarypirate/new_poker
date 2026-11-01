"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { isActive, money, when } from "@/lib/format";
import { useAdminQuery } from "@/hooks/use-admin-query";
import type { PlayerUser } from "@/lib/types";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const users = useAdminQuery(() => api.users(query).then((r) => r.data), [query]);
  const [selected, setSelected] = useState<PlayerUser | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = users.data || [];
  const playing = useMemo(() => rows.filter((u) => u.current_game_id).length, [rows]);

  async function changeBalance(operation: "add" | "subtract" | "set") {
    if (!selected) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      await api.updateBalance(selected.id, value, operation);
      toast.success("Balance updated");
      setSelected(null);
      setAmount("");
      await users.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(user: PlayerUser) {
    try {
      await api.updateUserStatus(user.id, !isActive(user.is_active));
      toast.success(isActive(user.is_active) ? "User deactivated" : "User activated");
      await users.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status update failed");
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Players</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <form
            className="flex flex-1 flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
            }}
          >
            <Input
              placeholder="Search username, phone, or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button type="submit">Search</Button>
          </form>
          <p className="text-sm text-muted-foreground">
            {rows.length} users · {playing} in a game
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {users.error && <p className="mb-3 text-sm text-destructive">{users.error}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Playing</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.display_name || user.username}</div>
                    <div className="text-xs text-muted-foreground">
                      @{user.username} · {user.phone || user.email || `id ${user.id}`}
                    </div>
                  </TableCell>
                  <TableCell>{money(user.account_balance)}</TableCell>
                  <TableCell>
                    <Badge variant={isActive(user.is_active) ? "default" : "destructive"}>
                      {isActive(user.is_active) ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.current_game_id ? (
                      <Badge>Game #{user.current_game_id}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Idle</span>
                    )}
                  </TableCell>
                  <TableCell>{when(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelected(user)}>
                        Balance
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(user)}>
                        {isActive(user.is_active) ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && !users.loading && (
            <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust balance</DialogTitle>
            <DialogDescription>
              {selected?.username} currently has {money(selected?.account_balance)}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => changeBalance("subtract")}>
              Subtract
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => changeBalance("set")}>
              Set
            </Button>
            <Button disabled={busy} onClick={() => changeBalance("add")}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
