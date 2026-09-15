import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import { auth, getSession } from "../service/auth.service.js";

export async function handleAuthRequest(request: FastifyRequest, reply: FastifyReply) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const body = request.body ? JSON.stringify(request.body) : undefined;
  const response = await auth.handler(
    new Request(requestUrl, {
      method: request.method,
      headers: fromNodeHeaders(request.headers),
      body,
    }),
  );

  reply.status(response.status);
  response.headers.forEach((value, key) => reply.header(key, value));
  return reply.send(response.body ? await response.text() : null);
}

export async function getCurrentUser(request: FastifyRequest, reply: FastifyReply) {
  const session = await getSession(request);
  if (!session) return reply.status(401).send({ error: "UNAUTHORIZED" });
  return { user: session.user };
}
