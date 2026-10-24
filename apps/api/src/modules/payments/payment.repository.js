import { PaymentEvent } from "./payment-event.model.js";

export async function recordPaymentEvent(
  {
    paymentId,
    merchantId,
    eventType,
    fromStatus,
    toStatus,
    actorUserId,
    actorRole,
    summary,
    metadata,
    isDemo = false,
  },
  session,
) {
  const [event] = await PaymentEvent.create(
    [
      {
        paymentId,
        merchantId,
        eventType,
        fromStatus,
        toStatus,
        actorUserId,
        actorRole,
        summary,
        metadata,
        isDemo,
        createdAt: new Date(),
      },
    ],
    { session },
  );
  return event;
}

export function toPaymentDto(payment) {
  return {
    id: String(payment._id),
    merchantId: String(payment.merchantId),
    reference: payment.reference,
    customerReference: payment.customerReference ?? null,
    customerLabel: payment.customerLabel ?? payment.customerReference ?? null,
    amountMinor:
      payment.amountMinor?.toString?.() ?? String(payment.amountMinor),
    capturedMinor:
      payment.capturedMinor?.toString?.() ?? String(payment.capturedMinor ?? 0),
    refundedMinor:
      payment.refundedMinor?.toString?.() ?? String(payment.refundedMinor ?? 0),
    currency: payment.currency,
    status: payment.status,
    statusReason: payment.statusReason ?? null,
    riskScore: payment.riskScore ?? 0,
    description: payment.description ?? null,
    metadata: payment.metadata ?? null,
    createdByUserId: payment.createdByUserId
      ? String(payment.createdByUserId)
      : null,
    cancelledAt: payment.cancelledAt ?? null,
    isDemo: Boolean(payment.isDemo),
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}
