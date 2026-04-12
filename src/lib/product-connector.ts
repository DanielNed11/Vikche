import {
  douglasConnector,
  resolveDouglasProduct,
  scrapeDouglasProduct,
} from "@/lib/douglas/connector";
import {
  genericConnector,
  resolveGenericProduct,
  scrapeGenericProduct,
} from "@/lib/generic/connector";
import type { ResolveProductResult } from "@/lib/types";

export function supportsUrl(url: string) {
  return douglasConnector.supports(url) || genericConnector.supports(url);
}

export async function resolveProduct(url: string): Promise<ResolveProductResult> {
  if (douglasConnector.supports(url)) {
    return resolveDouglasProduct(url);
  }

  return resolveGenericProduct(url);
}

export async function scrapeProduct(url: string, variantCode?: string) {
  if (douglasConnector.supports(url)) {
    return scrapeDouglasProduct(url, variantCode);
  }

  return scrapeGenericProduct(url);
}
