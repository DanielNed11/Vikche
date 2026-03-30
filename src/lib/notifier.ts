import { Resend } from "resend";

import type { NotificationRecord } from "@/lib/types";

interface DeliveryResult {
  channel: "email" | "log";
  status: "sent" | "logged" | "failed";
  deliveryError: string | null;
  deliveredAt: string | null;
}

interface DeliveryContext {
  title: string | null;
  canonicalUrl: string;
  recipientEmail: string | null;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export async function deliverNotification(
  notification: NotificationRecord,
  context: DeliveryContext,
): Promise<DeliveryResult> {
  const resendKey = process.env.RESEND_API_KEY;
  const alertFrom = process.env.VIKCHE_ALERT_FROM;
  const fallbackAlertTo = process.env.VIKCHE_ALERT_TO;
  const alertTo = context.recipientEmail ?? fallbackAlertTo ?? null;

  if (!resendKey || !alertFrom || !alertTo) {
    console.log(
      `${notification.subject} | ${context.title ?? context.canonicalUrl} | ${formatPrice(notification.previousPrice)} -> ${formatPrice(notification.currentPrice)}`,
    );

    return {
      channel: "log",
      status: "logged",
      deliveryError: null,
      deliveredAt: new Date().toISOString(),
    };
  }

  try {
    const resend = new Resend(resendKey);

    await resend.emails.send({
      from: alertFrom,
      to: alertTo
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
      subject: notification.subject,
      html: `
        <h1>${context.title ?? "Продукт"} е с по-ниска цена</h1>
        <p>Предишна цена: <strong>${formatPrice(notification.previousPrice)}</strong></p>
        <p>Текуща цена: <strong>${formatPrice(notification.currentPrice)}</strong></p>
        <p><a href="${context.canonicalUrl}">Отвори продукта</a></p>
      `,
      text: `${context.title ?? "Продукт"} е с по-ниска цена: от ${formatPrice(notification.previousPrice)} на ${formatPrice(notification.currentPrice)}. ${context.canonicalUrl}`,
    });

    return {
      channel: "email",
      status: "sent",
      deliveryError: null,
      deliveredAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      channel: "email",
      status: "failed",
      deliveryError:
        error instanceof Error ? error.message : "Изпращането на известието не успя.",
      deliveredAt: null,
    };
  }
}
