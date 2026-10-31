const DAY_MS = 86_400_000;
const CAPTURED_STATUSES = new Set([
  "CAPTURED",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
]);

export const OUTCOMES = [
  { name: "Captured", color: "#10b981" },
  { name: "In progress", color: "#3b82f6" },
  { name: "Failed", color: "#ef4444" },
  { name: "Cancelled", color: "#94a3b8" },
  { name: "Unknown", color: "#f59e0b" },
];

export function paymentWindow(days, end) {
  const start = new Date(end);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function minor(value) {
  return /^\d+$/.test(String(value ?? "")) ? BigInt(value) : 0n;
}

export function analyzePayments(payments, currency, window) {
  const start = new Date(window.from).getTime();
  const end = new Date(window.to).getTime();
  const selected = payments.filter((payment) => {
    const created = new Date(payment.createdAt).getTime();
    return payment.currency === currency && created >= start && created <= end;
  });
  const buckets = new Map();
  for (let time = start; time <= end; time += DAY_MS) {
    const date = new Date(time).toISOString().slice(0, 10);
    buckets.set(date, { date, total: 0, captured: 0 });
  }
  const outcomes = OUTCOMES.map((outcome) => ({ ...outcome, count: 0 }));
  let volume = 0n;
  let captured = 0n;
  let refunded = 0n;
  let capturedCount = 0;
  let failed = 0;
  for (const payment of selected) {
    const wasCaptured = CAPTURED_STATUSES.has(payment.status);
    volume += minor(payment.amountMinor);
    captured += minor(payment.capturedMinor);
    refunded += minor(payment.refundedMinor);
    capturedCount += Number(wasCaptured);
    failed += Number(payment.status === "FAILED");
    const bucket = buckets.get(
      new Date(payment.createdAt).toISOString().slice(0, 10),
    );
    bucket.total += 1;
    bucket.captured += Number(wasCaptured);
    const outcome = wasCaptured
      ? "Captured"
      : payment.status === "FAILED"
        ? "Failed"
        : payment.status === "CANCELLED"
          ? "Cancelled"
          : [
                "CREATED",
                "QUEUED",
                "AUTHORIZING",
                "AUTHORIZED",
                "CAPTURING",
              ].includes(payment.status)
            ? "In progress"
            : "Unknown";
    outcomes.find((item) => item.name === outcome).count += 1;
  }
  return {
    payments: [...selected].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    ),
    total: selected.length,
    volume: volume.toString(),
    captured: captured.toString(),
    refunded: refunded.toString(),
    net: (captured - refunded).toString(),
    capturedCount,
    captureRate: selected.length
      ? `${((capturedCount / selected.length) * 100).toFixed(1)}%`
      : "—",
    failed,
    outcomes,
    trend: [...buckets.values()],
  };
}
