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
import { money, when } from "@/lib/format";
import { useAdminQuery } from "@/hooks/use-admin-query";

function statusVariant(status: string) {
  if (status === "pending") return "secondary" as const;
  if (status === "completed" || status === "approved") return "default" as const;
  return "destructive" as const;
}

export default function WithdrawalsPage() {
  const [status, setStatus] = useState("pending");
  const withdrawals = useAdminQuery(
    () => api.withdrawals(status === "all" ? undefined : status).then((r) => r.data),
    [status]
  );

  async function approve(id: number) {
    try {
      await api.approveWithdrawal(id);
      toast.success("Withdrawal approved");
      await withdrawals.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    }
  }

  async function reject(id: number) {
    if (!window.confirm("Reject and refund this withdrawal?")) return;
    try {
      await api.rejectWithdrawal(id);
      toast.success("Withdrawal rejected and refunded");
      await withdrawals.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject failed");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Withdrawals</CardTitle>
        <Select value={status} onValueChange={(value) => setStatus(String(value ?? "pending"))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {withdrawals.error && <p className="mb-3 text-sm text-destructive">{withdrawals.error}</p>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(withdrawals.data || []).map((item) => (
              <TableRow key={item.withdrawal_id}>
                <TableCell>#{item.withdrawal_id}</TableCell>
                <TableCell>
                  {item.user?.username || item.user_id}
                  <div className="text-xs text-muted-foreground">{item.phone || item.user?.phone}</div>
                </TableCell>
                <TableCell>{money(item.amount)}</TableCell>
                <TableCell>
                  {item.bank_name || "—"}
                  <div className="text-xs text-muted-foreground">{item.bank_account}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </TableCell>
                <TableCell>{when(item.createdAt)}</TableCell>
                <TableCell className="text-right">
                  {item.status === "pending" && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => approve(item.withdrawal_id)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => reject(item.withdrawal_id)}>
                        Reject
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!withdrawals.data?.length && !withdrawals.loading && (
          <p className="py-6 text-center text-sm text-muted-foreground">No withdrawals in this filter.</p>
        )}
      </CardContent>
    </Card>
  );
}
