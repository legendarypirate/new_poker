import { getToken, clearSession } from "./auth";
import type {
  AdminUser,
  ChargeTotals,
  DashboardStats,
  GameRecord,
  LiveRoom,
  PlatformCharge,
  PlayerUser,
  Tournament,
  Withdrawal,
} from "./types";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://152.42.220.141:3060"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }
  if (!res.ok || json.success === false) {
    throw new ApiError(json.message || `Request failed (${res.status})`, res.status);
  }
  return json as T;
}

export const api = {
  login(username: string, password: string) {
    return request<{ success: boolean; token: string; user: AdminUser }>(
      "/api/admin/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }
    );
  },
  dashboard() {
    return request<{ success: boolean; data: DashboardStats }>(
      "/api/admin/dashboard/stats"
    );
  },
  users(search = "", role = "user") {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (role) params.set("role", role);
    return request<{ success: boolean; data: PlayerUser[] }>(
      `/api/admin/users?${params}`
    );
  },
  updateBalance(id: number, amount: number, operation: "add" | "subtract" | "set") {
    return request(`/api/admin/users/${id}/balance`, {
      method: "PUT",
      body: JSON.stringify({
        amount,
        operation: operation === "set" ? undefined : operation,
      }),
    });
  },
  updateUserStatus(id: number, isActive: boolean) {
    return request(`/api/admin/users/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ is_active: isActive ? "1" : "0" }),
    });
  },
  games(status?: string, gameType?: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (gameType) params.set("game_type", gameType);
    return request<{ success: boolean; data: GameRecord[] }>(
      `/api/admin/games?${params}`
    );
  },
  endGame(id: number) {
    return request(`/api/admin/games/${id}/end`, { method: "POST" });
  },
  liveRooms() {
    return request<{ success: boolean; data: LiveRoom[] }>("/api/admin/rooms/live");
  },
  closeRoom(roomId: string) {
    return request(`/api/admin/rooms/${encodeURIComponent(roomId)}/close`, {
      method: "POST",
    });
  },
  kickPlayer(roomId: string, userId: number) {
    return request(`/api/admin/rooms/${encodeURIComponent(roomId)}/kick`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },
  tournaments(status?: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    return request<{ success: boolean; data: Tournament[] }>(
      `/api/admin/tournaments?${params}`
    );
  },
  createTournament(payload: {
    tournament_name: string;
    buy_in: number;
    max_players: number;
    game_type?: string;
  }) {
    return request("/api/admin/tournaments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteTournament(id: number) {
    return request(`/api/admin/tournaments/${id}`, { method: "DELETE" });
  },
  withdrawals(status?: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    return request<{ success: boolean; data: Withdrawal[] }>(
      `/api/admin/withdrawals?${params}`
    );
  },
  approveWithdrawal(id: number, notes?: string) {
    return request(`/api/admin/withdrawals/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ admin_notes: notes }),
    });
  },
  rejectWithdrawal(id: number, notes?: string) {
    return request(`/api/admin/withdrawals/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ admin_notes: notes }),
    });
  },
  charges(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return request<{ success: boolean; data: PlatformCharge[]; totals: ChargeTotals }>(
      `/api/admin/platform-charges?${params}`
    );
  },
};

export { API_BASE };
