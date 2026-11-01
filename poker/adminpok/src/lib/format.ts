export function money(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-US").format(Number.isFinite(n) ? n : 0);
}

export function when(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function gameTypeLabel(type?: string | null) {
  switch (type) {
    case "mongol_13":
    case "13":
      return "13";
    case "muushig":
      return "Muushig";
    case "texas":
    case "texas_holdem":
      return "Texas";
    default:
      return type || "Unknown";
  }
}

export function gameStatus(status?: number) {
  if (status === 0) return { label: "Waiting", tone: "secondary" as const };
  if (status === 1) return { label: "Playing", tone: "default" as const };
  if (status === 2) return { label: "Finished", tone: "outline" as const };
  return { label: "Unknown", tone: "outline" as const };
}

export function tournamentStatus(status?: number) {
  if (status === 0) return "Waiting";
  if (status === 1) return "Starting";
  if (status === 2) return "Active";
  if (status === 3) return "Finished";
  return "Unknown";
}

export function isActive(value: string | number | boolean | null | undefined) {
  return value === "1" || value === 1 || value === true;
}
