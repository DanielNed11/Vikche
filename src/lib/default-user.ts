import { prisma } from "@/lib/prisma";

const DEFAULT_USER_EMAIL =
  process.env.VIKCHE_DEFAULT_USER_EMAIL?.trim() || "local@vikche.app";
const DEFAULT_USER_NAME =
  process.env.VIKCHE_DEFAULT_USER_NAME?.trim() || "Vikche";

export async function getDefaultUser() {
  return prisma.user.upsert({
    where: {
      email: DEFAULT_USER_EMAIL,
    },
    update: {
      name: DEFAULT_USER_NAME,
    },
    create: {
      email: DEFAULT_USER_EMAIL,
      name: DEFAULT_USER_NAME,
    },
  });
}
