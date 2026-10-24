export function formatTime(timestamp) {
  if (!timestamp) return "Not checked yet";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

export function formatUptime(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) return "—";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatMinorUnits(value, currency) {
  if (value === null || value === undefined) return "—";
  const raw = String(value);
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  const padded = digits.padStart(3, "0");
  const whole = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = padded.slice(-2);
  const symbol =
    currency === "INR" ? "₹" : currency === "USD" ? "$" : `${currency} `;
  return `${negative ? "−" : ""}${symbol}${whole}.${fraction}`;
}
