import { env } from "../../../config.js";

type AuthEmail = {
  to: string;
  subject: string;
  heading: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

function renderEmail(email: AuthEmail) {
  const heading = escapeHtml(email.heading);
  const message = escapeHtml(email.message);
  const actionLabel = escapeHtml(email.actionLabel);
  const actionUrl = escapeHtml(email.actionUrl);

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f7fbfd;color:#0b1116;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:40px 20px">
      <div style="border:1px solid #dce8ee;border-radius:22px;background:#ffffff;padding:32px">
        <p style="margin:0 0 14px;color:#0078aa;font-size:14px;font-weight:700">PetID</p>
        <h1 style="margin:0 0 16px;font-size:28px">${heading}</h1>
        <p style="margin:0 0 26px;color:#34414c;line-height:1.6">${message}</p>
        <a href="${actionUrl}" style="display:inline-block;border-radius:14px;background:#2bb3eb;color:#06131a;padding:14px 22px;font-weight:700;text-decoration:none">${actionLabel}</a>
        <p style="margin:26px 0 0;color:#6d7d89;font-size:12px;line-height:1.5">Si no solicitaste esta acción, podés ignorar este correo.</p>
      </div>
    </div>
  </body>
</html>`;
}

async function sendWithResend(email: AuthEmail) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email.to],
      reply_to: env.EMAIL_REPLY_TO,
      subject: email.subject,
      html: renderEmail(email),
      text: `${email.heading}\n\n${email.message}\n\n${email.actionLabel}: ${email.actionUrl}`,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Resend rejected the email (${response.status}): ${detail}`);
  }
}

async function deliverAuthEmail(email: AuthEmail) {
  if (env.EMAIL_DELIVERY === "console") {
    console.info(`[auth-email] ${email.subject} -> ${maskEmail(email.to)}\n${email.actionUrl}`);
    return;
  }

  await sendWithResend(email);
}

export function queueAuthEmail(email: AuthEmail) {
  void deliverAuthEmail(email).catch((error: unknown) => {
    console.error("[auth-email] Delivery failed", error);
  });
}
