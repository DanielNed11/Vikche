import { AppError } from "@/lib/http-error";

export function normalizeGenericUrl(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new AppError(400, "Постави линк към продукт.");
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

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError(400, "Постави валиден уеб линк към продукт.");
  }

  url.hash = "";

  return url.toString();
}

export function supportsGenericUrl(input: string) {
  try {
    normalizeGenericUrl(input);
    return true;
  } catch {
    return false;
  }
}
