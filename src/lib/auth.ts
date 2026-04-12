import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function getAuthSecret() {
  return getEnv("NEXTAUTH_SECRET") || getEnv("AUTH_SECRET");
}

function getEffectiveAuthSecret() {
  return getAuthSecret() || (process.env.NODE_ENV !== "production" ? "vikche-dev-secret" : "");
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getAllowedEmails() {
  return new Set(
    getEnv("AUTH_ALLOWED_EMAILS")
      .split(",")
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean),
  );
}

function getFixedPassword() {
  return getEnv("AUTH_FIXED_PASSWORD");
}

export function hasCredentialsAuth() {
  return getAllowedEmails().size > 0 && Boolean(getFixedPassword());
}

async function authorizeCredentials(credentials: Record<string, string> | undefined) {
  const email = normalizeEmail(credentials?.email);
  const password = credentials?.password?.trim() ?? "";

  if (!email || !password) {
    return null;
  }

  if (!hasCredentialsAuth()) {
    return null;
  }

  if (!getAllowedEmails().has(email) || password !== getFixedPassword()) {
    return null;
  }

  const user = await prisma.user.upsert({
    where: {
      email,
    },
    update: {},
    create: {
      email,
      name: email.split("@")[0] || email,
    },
  });

  return {
    id: user.id,
    email: user.email ?? email,
    name: user.name ?? null,
  };
}

function getProviders() {
  const providers = [];

  if (hasCredentialsAuth()) {
    providers.push(
      CredentialsProvider({
        name: "Credentials",
        credentials: {
          email: {
            label: "Email",
            type: "email",
          },
          password: {
            label: "Password",
            type: "password",
          },
        },
        async authorize(credentials) {
          return authorizeCredentials(
            credentials
              ? {
                  email: String(credentials.email ?? ""),
                  password: String(credentials.password ?? ""),
                }
              : undefined,
          );
        },
      }),
    );
  }

  return providers;
}

export function isAuthEnabled() {
  return getProviders().length > 0 && Boolean(getEffectiveAuthSecret());
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: getEffectiveAuthSecret() || undefined,
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
  pages: {
    signIn: "/signin",
  },
  providers: getProviders(),
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
      }

      return session;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
