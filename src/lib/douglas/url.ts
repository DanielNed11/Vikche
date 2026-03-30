import { AppError } from "@/lib/http-error";

const SUPPORTED_HOSTS = new Set(["douglas.bg", "www.douglas.bg"]);

export function supportsDouglasUrl(input: string) {
  try {
    normalizeDouglasUrl(input);
    return true;
  } catch {
    return false;
  }
}

export function normalizeDouglasUrl(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new AppError(400, "Постави линк към продукт от Douglas.");
  }

  const normalizedInput = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url: URL;

  try {
    url = new URL(normalizedInput);
  } catch {
    throw new AppError(400, "Това не е валиден линк.");
  }

  if (!SUPPORTED_HOSTS.has(url.hostname)) {
    throw new AppError(400, "Засега се поддържат само линкове от douglas.bg.");
  }

  const pathname = url.pathname
    .replace(/^\/products?(?=\/)/i, "")
    .replace(/\/+$/, "");

  if (!/^\/[^/?#]+-\d+$/.test(pathname)) {
    throw new AppError(
      400,
      "Постави директен линк към продукт, а не към категория или търсене.",
    );
  }

  return `https://douglas.bg${pathname}`;
}
