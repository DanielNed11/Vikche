import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import AppleProvider from "next-auth/providers/apple";
import GoogleProvider from "next-auth/providers/google";

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

export function hasGoogleAuth() {
  return Boolean(getEnv("GOOGLE_CLIENT_ID") && getEnv("GOOGLE_CLIENT_SECRET"));
}

export function hasAppleAuth() {
  return Boolean(getEnv("APPLE_ID") && getEnv("APPLE_SECRET"));
}

function getProviders() {
  const providers = [];

  if (hasGoogleAuth()) {
    providers.push(
      GoogleProvider({
        clientId: getEnv("GOOGLE_CLIENT_ID"),
        clientSecret: getEnv("GOOGLE_CLIENT_SECRET"),
      }),
    );
  }

  if (hasAppleAuth()) {
    providers.push(
      AppleProvider({
        clientId: getEnv("APPLE_ID"),
        clientSecret: getEnv("APPLE_SECRET"),
      }),
    );
  }

  return providers;
}

export function isAuthEnabled() {
  return getProviders().length > 0 && Boolean(getEffectiveAuthSecret());
}

export function getAuthProviderAvailability() {
  return {
    google: hasGoogleAuth(),
    apple: hasAppleAuth(),
  };
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
