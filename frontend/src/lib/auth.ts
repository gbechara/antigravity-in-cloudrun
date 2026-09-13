/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

/**
 * Resolves the JWT signing secret.
 *
 * There is deliberately no hardcoded fallback. A committed secret is a public
 * secret: anyone could mint a valid admin session token for any deployment
 * that kept the default, without ever needing the password. In production the
 * process refuses to start; for local development a random secret is generated
 * per process (which simply invalidates sessions across restarts).
 */
function resolveAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXTAUTH_SECRET must be set to at least 32 characters in production. " +
        "Generate one with: openssl rand -base64 32"
    );
  }
  console.warn(
    "[auth] NEXTAUTH_SECRET is unset; generating an ephemeral development secret."
  );
  return randomBytes(32).toString("base64");
}

/**
 * Resolves the built-in administrator credentials.
 *
 * As with the signing secret, there is no hardcoded fallback. A default
 * password published in a public repository is not a credential, it is a
 * documented way in, and this console is deployed on a `--public` endpoint.
 *
 * When ADMIN_PASSWORD is unset in production the credentials provider is
 * disabled rather than defaulted: an operator who forgets the variable gets a
 * console that can only be entered through Google OAuth, never one guarded by
 * a password everyone already knows. Locally, an ephemeral password is
 * generated and printed so development stays frictionless.
 */
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";

function resolveAdminPassword(): string | null {
  const configured = process.env.ADMIN_PASSWORD;
  if (configured && configured.length > 0) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[auth] ADMIN_PASSWORD is not set; the username/password sign-in is " +
        "disabled. Set ADMIN_PASSWORD to enable it, or sign in with Google."
    );
    return null;
  }
  const generated = randomBytes(9).toString("base64url");
  console.warn(
    `[auth] ADMIN_PASSWORD is unset; using an ephemeral development password ` +
      `for this process: ${generated}`
  );
  return generated;
}

const ADMIN_PASSWORD = resolveAdminPassword();

/**
 * Compares two strings in constant time.
 *
 * The values are hashed first so that the comparison is independent of their
 * length, which timingSafeEqual would otherwise reveal by throwing on a
 * length mismatch.
 */
function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

export const authOptions: NextAuthOptions = {
  providers: [
    // 1. Google Cloud OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),

    // 2. Default Administrator Credentials Provider
    CredentialsProvider({
      name: "Default Admin",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // A null password means the provider is disabled (see above).
        if (!ADMIN_PASSWORD) {
          return null;
        }
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Both comparisons are evaluated before branching so that the outcome
        // does not disclose which of the two fields was wrong.
        const usernameOk = safeEqual(credentials.username, ADMIN_USERNAME);
        const passwordOk = safeEqual(credentials.password, ADMIN_PASSWORD);

        if (usernameOk && passwordOk) {
          return {
            id: "1",
            name: ADMIN_USERNAME,
            email: "admin@antigravity.cloud",
            role: "admin-role",
          };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role || "admin-role";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role || "admin-role";
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return url;
      try {
        const targetUrl = new URL(url);
        const base = new URL(baseUrl);
        if (targetUrl.origin === base.origin) return url;
      } catch {}
      return "/terminal";
    },
  },
  secret: resolveAuthSecret(),
};
