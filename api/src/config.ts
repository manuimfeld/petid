import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().url(),
    CLIENT_ORIGIN: z.string().url().default("http://localhost:4321"),
    ADDITIONAL_TRUSTED_ORIGINS: z.string().default(""),
    BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
    PET_PROFILE_BASE_URL: z.string().url().optional(),
    COOKIE_DOMAIN: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    SCAN_HASH_SALT: z.string().min(16),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    EMAIL_DELIVERY: z.enum(["console", "resend"]).default("console"),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().min(3).default("PetID <onboarding@resend.dev>"),
    EMAIL_REPLY_TO: z.string().email().optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_UPLOAD_PRESET: z.string().default("petid-pet-images"),
    CLOUDINARY_FOLDER: z.string().default("petid/pets"),
    MAX_IMAGE_BYTES: z.coerce.number().int().min(100_000).max(10_000_000).default(5_242_880),
  })
  .superRefine((values, context) => {
    const hasGoogleId = Boolean(values.GOOGLE_CLIENT_ID);
    const hasGoogleSecret = Boolean(values.GOOGLE_CLIENT_SECRET);
    const cloudinaryValues = [
      values.CLOUDINARY_CLOUD_NAME,
      values.CLOUDINARY_API_KEY,
      values.CLOUDINARY_API_SECRET,
    ];
    const configuredCloudinaryValues = cloudinaryValues.filter(Boolean).length;

    if (hasGoogleId !== hasGoogleSecret) {
      context.addIssue({
        code: "custom",
        path: [hasGoogleId ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID"],
        message: "Google OAuth requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
      });
    }
    if (configuredCloudinaryValues !== 0 && configuredCloudinaryValues !== cloudinaryValues.length) {
      context.addIssue({
        code: "custom",
        path: ["CLOUDINARY_CLOUD_NAME"],
        message: "Cloudinary requires cloud name, API key and API secret",
      });
    }

    if (values.NODE_ENV !== "production") return;

    if (!values.CLIENT_ORIGIN.startsWith("https://")) {
      context.addIssue({
        code: "custom",
        path: ["CLIENT_ORIGIN"],
        message: "CLIENT_ORIGIN must use HTTPS in production",
      });
    }
    if (!values.BETTER_AUTH_URL.startsWith("https://")) {
      context.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "BETTER_AUTH_URL must use HTTPS in production",
      });
    }
    if (
      new URL(values.CLIENT_ORIGIN).hostname !== new URL(values.BETTER_AUTH_URL).hostname &&
      !values.COOKIE_DOMAIN
    ) {
      context.addIssue({
        code: "custom",
        path: ["COOKIE_DOMAIN"],
        message: "COOKIE_DOMAIN is required when the frontend and API use different hosts",
      });
    }
    if (values.COOKIE_DOMAIN) {
      const cookieDomain = values.COOKIE_DOMAIN.replace(/^\./, "");
      const belongsToCookieDomain = (url: string) => {
        const hostname = new URL(url).hostname;
        return hostname === cookieDomain || hostname.endsWith(`.${cookieDomain}`);
      };

      if (
        !belongsToCookieDomain(values.CLIENT_ORIGIN) ||
        !belongsToCookieDomain(values.BETTER_AUTH_URL)
      ) {
        context.addIssue({
          code: "custom",
          path: ["COOKIE_DOMAIN"],
          message: "COOKIE_DOMAIN must be a shared parent domain of the frontend and API",
        });
      }
    }
    if (!hasGoogleId || !hasGoogleSecret) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message: "Google OAuth credentials are required in production",
      });
    }
    if (values.EMAIL_DELIVERY !== "resend" || !values.RESEND_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "Resend email delivery is required in production",
      });
    }
    if (configuredCloudinaryValues !== cloudinaryValues.length) {
      context.addIssue({
        code: "custom",
        path: ["CLOUDINARY_CLOUD_NAME"],
        message: "Cloudinary image storage is required in production",
      });
    }
    if (values.BETTER_AUTH_SECRET.startsWith("replace-with")) {
      context.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_SECRET"],
        message: "BETTER_AUTH_SECRET must be replaced in production",
      });
    }
    if (values.SCAN_HASH_SALT.startsWith("replace-with")) {
      context.addIssue({
        code: "custom",
        path: ["SCAN_HASH_SALT"],
        message: "SCAN_HASH_SALT must be replaced in production",
      });
    }
  });

export const env = envSchema.parse(process.env);

export const googleAuthEnabled = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);

export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

export const trustedOrigins = [
  env.CLIENT_ORIGIN,
  ...env.ADDITIONAL_TRUSTED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

export const petProfileBaseUrl = (env.PET_PROFILE_BASE_URL ?? env.CLIENT_ORIGIN).replace(/\/$/, "");
