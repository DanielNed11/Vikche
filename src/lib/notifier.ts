import { Resend } from "resend";

import { AppError } from "@/lib/http-error";
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
}

interface DeliveryConfig {
  resendKey: string;
  alertFrom: string;
  alertTo: string | null;
}

interface PriceDropEmailContent {
  subject: string;
  html: string;
  text: string;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function resolveDeliveryConfig(): DeliveryConfig | null {
  const resendKey = process.env.RESEND_API_KEY?.trim() || "";
  const alertFrom = process.env.VIKCHE_ALERT_FROM?.trim() || "";
  const alertTo = process.env.VIKCHE_ALERT_TO?.trim() || "";

  if (!resendKey || !alertFrom || !alertTo) {
    return null;
  }

  return {
    resendKey,
    alertFrom,
    alertTo,
  };
}

function parseRecipientList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildPriceDropEmailContent(
  notification: NotificationRecord,
  context: DeliveryContext,
): PriceDropEmailContent {
  const title = context.title ?? "Продукт";
  const safeTitle = escapeHtml(title);
  const safeUrl = escapeHtml(context.canonicalUrl);
  const previousPrice = formatPrice(notification.previousPrice);
  const currentPrice = formatPrice(notification.currentPrice);

  return {
    subject: notification.subject,
    html: `
      <div style="margin:0;padding:24px;background:#fcf5f8;font-family:Arial,sans-serif;color:#5d2a40;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid rgba(214,86,136,0.14);border-radius:28px;padding:32px 28px;box-shadow:0 18px 40px rgba(138,45,86,0.08);">
          <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#ad7b91;">Vikche</div>
          <h1 style="margin:14px 0 10px;font-size:28px;line-height:1.2;color:#8a2d56;">${safeTitle} е с по-ниска цена</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#7f6070;">
            Проследяваният от теб продукт вече е по-изгоден.
          </p>

          <div style="border-radius:22px;background:#fff6fa;padding:18px 20px;margin:0 0 22px;">
            <div style="font-size:13px;color:#a46e86;margin-bottom:6px;">Предишна цена</div>
            <div style="font-size:19px;color:#8e7280;text-decoration:line-through;">${previousPrice}</div>
            <div style="font-size:13px;color:#a46e86;margin:14px 0 6px;">Текуща цена</div>
            <div style="font-size:30px;font-weight:700;color:#d65688;">${currentPrice}</div>
          </div>

          <a href="${safeUrl}" style="display:inline-block;border-radius:999px;background:#d65688;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;">
            Отвори продукта
          </a>

          <p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:#9b7b8b;">
            Ако искаш, отвори продукта и провери дали цената още е активна.
          </p>
        </div>
      </div>
    `,
    text: [
      `Vikche`,
      ``,
      `${title} е с по-ниска цена.`,
      `Предишна цена: ${previousPrice}`,
      `Текуща цена: ${currentPrice}`,
      ``,
      `Отвори продукта: ${context.canonicalUrl}`,
    ].join("\n"),
  };
}

async function sendEmail(
  config: DeliveryConfig,
  content: PriceDropEmailContent,
) {
  const resend = new Resend(config.resendKey);
  const response = await resend.emails.send({
    from: config.alertFrom,
    to: parseRecipientList(config.alertTo ?? ""),
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if ("error" in response && response.error) {
    throw new Error(response.error.message || "Изпращането на имейла не успя.");
  }

  return response;
}

export async function deliverNotification(
  notification: NotificationRecord,
  context: DeliveryContext,
): Promise<DeliveryResult> {
  const deliveryConfig = resolveDeliveryConfig();

  if (!deliveryConfig) {
    console.log(
      `${notification.subject} | ${context.title ?? context.canonicalUrl} | ${formatPrice(notification.previousPrice)} -> ${formatPrice(notification.currentPrice)} | email disabled: missing RESEND_API_KEY, VIKCHE_ALERT_FROM or VIKCHE_ALERT_TO`,
    );

    return {
      channel: "log",
      status: "logged",
      deliveryError: null,
      deliveredAt: new Date().toISOString(),
    };
  }

  try {
    await sendEmail(deliveryConfig, buildPriceDropEmailContent(notification, context));

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

export function canSendEmails() {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.VIKCHE_ALERT_FROM?.trim() &&
      process.env.VIKCHE_ALERT_TO?.trim(),
  );
}

export async function sendTestEmail() {
  const deliveryConfig = resolveDeliveryConfig();

  if (!deliveryConfig) {
    throw new AppError(
      400,
      "Липсва RESEND_API_KEY, VIKCHE_ALERT_FROM или VIKCHE_ALERT_TO.",
    );
  }

  const content: PriceDropEmailContent = {
    subject: "Vikche: тестов имейл",
    html: `
      <div style="margin:0;padding:24px;background:#fcf5f8;font-family:Arial,sans-serif;color:#5d2a40;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid rgba(214,86,136,0.14);border-radius:28px;padding:32px 28px;box-shadow:0 18px 40px rgba(138,45,86,0.08);">
          <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#ad7b91;">Vikche</div>
          <h1 style="margin:14px 0 10px;font-size:28px;line-height:1.2;color:#8a2d56;">Тестов имейл</h1>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#7f6070;">
            Ако четеш това, Resend е свързан правилно и Vikche може да изпраща известия.
          </p>
          <div style="border-radius:22px;background:#fff6fa;padding:18px 20px;margin:0 0 22px;">
            <div style="font-size:13px;color:#a46e86;margin-bottom:6px;">Примерно известие</div>
            <div style="font-size:19px;color:#8e7280;text-decoration:line-through;">39,90 €</div>
            <div style="font-size:13px;color:#a46e86;margin:14px 0 6px;">Нова цена</div>
            <div style="font-size:30px;font-weight:700;color:#d65688;">31,90 €</div>
          </div>
          <p style="margin:0;font-size:13px;line-height:1.7;color:#9b7b8b;">
            Това е ръчен тест от админ endpoint-а на Vikche.
          </p>
        </div>
      </div>
    `,
    text: [
      "Vikche",
      "",
      "Тестов имейл",
      "Ако четеш това, Resend е свързан правилно и Vikche може да изпраща известия.",
      "",
      "Примерно известие:",
      "Предишна цена: 39,90 EUR",
      "Нова цена: 31,90 EUR",
    ].join("\n"),
  };

  await sendEmail(deliveryConfig, content);

  return {
    status: "sent" as const,
    recipient: normalizeEmail(deliveryConfig.alertTo),
  };
}
