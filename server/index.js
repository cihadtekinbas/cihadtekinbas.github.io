import "dotenv/config";
import express from "express";
import session from "express-session";
import path from "node:path";
import { fileURLToPath } from "node:url";

import authRouter from "./auth.js";
import { requireAuth } from "./middleware.js";
import { handler as ssrHandler } from "../dist/server/entry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";
const port = process.env.PORT || 3000;

const app = express();

// Render/Railway terminate TLS and forward requests; needed for secure cookies.
app.set("trust proxy", 1);

app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "dev-only-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Public health check (used by hosts for liveness).
app.get("/healthz", (_req, res) => res.send("ok"));

// Public OAuth routes: /auth/github, /auth/callback, /auth/logout, /auth/me.
app.use("/auth", authRouter);

// Serve built client assets (JS/CSS/images) without auth so the login
// page and its background can load. These are assets only — all content
// HTML is rendered server-side by the Astro handler below, behind auth.
app.use(express.static(path.join(__dirname, "../dist/client")));

// Auth gate: everything after this point requires a session, except the
// login page itself (which is rendered by the Astro handler further down).
app.use((req, res, next) => {
  if (req.path === "/login" || req.path.startsWith("/login")) {
    return next();
  }
  return requireAuth(req, res, next);
});

// Mount Astro's SSR handler, passing the signed-in user into Astro.locals.
app.use((req, res, next) => {
  ssrHandler(req, res, next, { user: req.session?.user ?? null });
});

app.listen(port, () => {
  console.log(`Auth site running at http://localhost:${port}`);
});
