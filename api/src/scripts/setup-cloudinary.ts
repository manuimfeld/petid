import { v2 as cloudinary } from "cloudinary";
import { cloudinaryEnabled, env } from "../config.js";

if (!cloudinaryEnabled) {
  throw new Error("Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET first");
}

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
  signature_algorithm: "sha256",
});

const presetOptions = {
  unsigned: false,
  allowed_formats: ["jpg", "jpeg", "png", "webp"],
  max_file_size: env.MAX_IMAGE_BYTES,
  overwrite: false,
  use_filename: false,
  unique_filename: false,
  transformation: "c_limit,h_1600,w_1600/q_auto:good",
};

try {
  await cloudinary.api.update_upload_preset(env.CLOUDINARY_UPLOAD_PRESET, presetOptions);
  console.log(`Updated Cloudinary upload preset: ${env.CLOUDINARY_UPLOAD_PRESET}`);
} catch (error) {
  const status = (error as { http_code?: number }).http_code;
  if (status !== 404) throw error;
  await cloudinary.api.create_upload_preset({
    name: env.CLOUDINARY_UPLOAD_PRESET,
    ...presetOptions,
  });
  console.log(`Created Cloudinary upload preset: ${env.CLOUDINARY_UPLOAD_PRESET}`);
}
