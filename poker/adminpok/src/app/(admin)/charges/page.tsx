"use client";

import { FormEvent, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { gameTypeLabel, money, when } from "@/lib/format";
import { useAdminQuery } from "@/hooks/use-admin-query";

export default function ChargesPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState({ startDate: "", endDate: "" });
  const charges = useAdminQuery(
    () => api.charges(applied.startDate || undefined, applied.endDate || undefined),
    [applied.startDate, applied.endDate]
  );

  function apply(event: FormEvent) {
    event.preventDefault();
    setApplied({ startDate, endDate });
  }

  const totals = charges.data?.totals;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Games</p>
            <CardTitle>{totals?.count ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Platform fee</p>
            <CardTitle>{money(totals?.totalPlatformFee)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Winner payouts</p>
            <CardTitle>{money(totals?.totalWinnerPayout)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date range</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={apply}>
            <div className="grid gap-1">
              <Label htmlFor="start">Start</Label>
              <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="end">End</Label>
              <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button type="submit">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform charges</CardTitle>
        </CardHeader>
        <CardContent>
          {charges.error && <p className="mb-3 text-sm text-destructive">{charges.error}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Charge</TableHead>
                <TableHead>Game</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pot</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Winner</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(charges.data?.data || []).map((item) => (
                <TableRow key={item.charge_id}>
                  <TableCell>#{item.charge_id}</TableCell>
                  <TableCell>#{item.game_id}</TableCell>
                  <TableCell>{gameTypeLabel(item.game?.game_type)}</TableCell>
                  <TableCell>{money(item.total_pot)}</TableCell>
                  <TableCell>{money(item.platform_fee)}</TableCell>
                  <TableCell>
                    {item.game?.winnerUser?.username || money(item.winner_payout)}
                  </TableCell>
                  <TableCell>{when(item.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
