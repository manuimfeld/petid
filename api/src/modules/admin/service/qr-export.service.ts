import JSZip from "jszip";
import QRCode from "qrcode";
import { asc, eq } from "drizzle-orm";
import { petProfileBaseUrl } from "../../../config.js";
import { db } from "../../../db/index.js";
import { availableQrs } from "../../../db/schema.js";

export async function createQrSvgArchive(batch: string) {
  const qrs = await db
    .select({ id: availableQrs.id, status: availableQrs.status })
    .from(availableQrs)
    .where(eq(availableQrs.batch, batch))
    .orderBy(asc(availableQrs.id));

  if (!qrs.length) return null;

  const archive = new JSZip();
  const folder = archive.folder("svg")!;
  const manifest = ["id,url,status"];

  await Promise.all(
    qrs.map(async (qr) => {
      const url = `${petProfileBaseUrl}/pet/${qr.id}`;
      const svg = await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: "H",
        margin: 4,
        width: 1024,
        color: { dark: "#000000", light: "#ffffff" },
      });
      folder.file(`${qr.id}.svg`, svg);
      manifest.push(`${qr.id},${url},${qr.status}`);
    }),
  );

  archive.file("manifest.csv", `${manifest.join("\n")}\n`);
  archive.file(
    "README.txt",
    `PetID - lote ${batch}\nCantidad: ${qrs.length}\nURL base: ${petProfileBaseUrl}\nCorrección QR: H\n`,
  );

  return {
    buffer: await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
    quantity: qrs.length,
  };
}
