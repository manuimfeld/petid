import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";
import { env, googleAuthEnabled, trustedOrigins } from "../../../config.js";
import { db } from "../../../db/index.js";
import { authSchema } from "../../../db/schema.js";
import { queueAuthEmail } from "./email.service.js";

const socialProviders = googleAuthEnabled
  ? {
      google: {
        clientId: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        requireEmailVerification: true,
      },
    }
  : undefined;

export const auth = betterAuth({
  appName: "PetID",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins,
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    crossSubDomainCookies: env.COOKIE_DOMAIN
      ? {
          enabled: true,
          domain: env.COOKIE_DOMAIN,
        }
      : undefined,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      queueAuthEmail({
        to: user.email,
        subject: "Restablecé tu contraseña de PetID",
        heading: "Recuperá el acceso",
        message: "Usá este enlace para elegir una contraseña nueva. El enlace vence en una hora.",
        actionLabel: "Crear nueva contraseña",
        actionUrl: url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      queueAuthEmail({
        to: user.email,
        subject: "Verificá tu email de PetID",
        heading: "Confirmá tu email",
        message: "Confirmá que esta dirección te pertenece para proteger tus mascotas y habilitar el acceso a tu cuenta.",
        actionLabel: "Verificar mi email",
        actionUrl: url,
      });
    },
  },
  socialProviders,
  user: {
    additionalFields: {
      role: {
        type: ["user", "admin"],
        required: false,
        defaultValue: "user",
        input: false,
      },
      phone: {
        type: "string",
        required: false,
      },
    },
  },
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      allowDifferentEmails: false,
      requireLocalEmailVerified: true,
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;

export async function getSession(request: FastifyRequest): Promise<AuthSession | null> {
  return auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
}
