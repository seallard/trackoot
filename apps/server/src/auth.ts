import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { getAuthUrl, exchangeCode } from "./spotify-auth";
import { getMe } from "./spotify-api";
import { storeTokens } from "./token";
import { redis } from "./redis";

const StateSchema = z.object({
  role: z.enum(["host", "player"]),
  nonce: z.string(),
});

const CallbackQuerySchema = z.object({
  code: z.string(),
  state: z.string(),
});

const AuthQuerySchema = z.object({
  role: z.enum(["host", "player"]),
});

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const STATE_TTL = 300; // 5 minutes

const router = Router();

router.get("/spotify", (req, res) => {
  const query = AuthQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "role must be 'host' or 'player'" });
    return;
  }

  const { role } = query.data;
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ role, nonce })).toString("base64url");

  redis
    .set(`oauth:state:${state}`, "1", "EX", STATE_TTL)
    .then(() => res.redirect(getAuthUrl(role, state)))
    .catch(() => res.status(500).json({ error: "Failed to initiate auth" }));
});

router.get("/spotify/callback", async (req, res) => {
  const query = CallbackQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Missing code or state" });
    return;
  }

  const { code, state } = query.data;

  const stored = await redis.getdel(`oauth:state:${state}`);
  if (!stored) {
    res.status(400).json({ error: "Invalid or expired state" });
    return;
  }

  const stateData = StateSchema.safeParse(JSON.parse(Buffer.from(state, "base64url").toString()));
  if (!stateData.success) {
    res.status(400).json({ error: "Malformed state" });
    return;
  }

  const { role } = stateData.data;
  const { accessToken, refreshToken } = await exchangeCode(code);
  const { id: userId, displayName } = await getMe(accessToken);
  await storeTokens(role, userId, accessToken, refreshToken);

  // Pass identity as URL params — avoids cross-origin cookie issues in development
  const params = new URLSearchParams({ userId, displayName, role });
  res.redirect(`${WEB_URL}/${role === "host" ? "host" : "join"}?${params}`);
});

export default router;
