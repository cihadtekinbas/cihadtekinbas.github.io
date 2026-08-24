import { Router } from "express";

const router = Router();

function config() {
  return {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    baseUrl:
      process.env.BASE_URL ||
      `http://localhost:${process.env.PORT || 3000}`,
    allowedUser: process.env.ALLOWED_USERNAME || "cihadtekinbas",
    isProd: process.env.NODE_ENV === "production",
  };
}

// Step 1: send the visitor to GitHub to authorize.
router.get("/github", (req, res) => {
  const { clientId, baseUrl } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl}/auth/callback`,
    scope: "read:user",
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// Step 2: GitHub redirects back here with a temporary code.
router.get("/callback", async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error || !code) {
      return res.redirect("/login?error=denied");
    }

    const { clientId, clientSecret, baseUrl, allowedUser, isProd } = config();

    // Exchange the code for an access token.
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: `${baseUrl}/auth/callback`,
        }),
      },
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.redirect("/login?error=denied");
    }

    // Fetch who just authorized, then check they're allowed.
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cihadtekinbas-site",
      },
    });
    if (!userRes.ok) {
      return res.redirect("/login?error=denied");
    }
    const user = await userRes.json();

    if (user.login !== allowedUser) {
      return res.redirect("/login?error=forbidden");
    }

    req.session.user = { login: user.login };
    res.cookie("user", user.login, {
      httpOnly: false,
      sameSite: "lax",
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.redirect("/");
  } catch (err) {
    console.error("OAuth callback error:", err);
    return res.redirect("/login?error=denied");
  }
});

// End the session.
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("user");
    res.clearCookie("sid");
    res.redirect("/login");
  });
});

// Debug helper: who is signed in?
router.get("/me", (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  return res.status(401).json({ user: null });
});

export default router;
