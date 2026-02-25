/**
 * OAuth 2.0 PKCE flow for X API user-context authentication.
 *
 * - Generates PKCE verifier/challenge
 * - Starts local callback server on port 3456
 * - Opens browser to X authorize URL
 * - Exchanges auth code for access_token + refresh_token
 * - Stores tokens in data/tokens.json
 * - Auto-refreshes before expiry
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { randomBytes, createHash } from "crypto";

const SKILL_DIR = join(import.meta.dir, "..");
const TOKEN_PATH = join(SKILL_DIR, "data", "tokens.json");
const CALLBACK_PORT = 3456;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;
const SCOPES = "tweet.read users.read list.read offline.access";

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  user_id: string;
  username: string;
}

function getClientId(): string {
  if (process.env.X_CLIENT_ID) return process.env.X_CLIENT_ID;

  // Try global.env
  try {
    const envFile = readFileSync(
      `${process.env.HOME}/.config/env/global.env`,
      "utf-8"
    );
    const match = envFile.match(/X_CLIENT_ID=["']?([^"'\n]+)/);
    if (match) return match[1];
  } catch {}

  throw new Error(
    "X_CLIENT_ID not found. Set it in env or ~/.config/env/global.env\n" +
    "Get it from https://developer.x.com/en/portal/dashboard"
  );
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9\-._~]/g, "")
    .slice(0, 128);
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

function loadTokens(): StoredTokens | null {
  if (!existsSync(TOKEN_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function saveTokens(tokens: StoredTokens): void {
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

/**
 * Run the full OAuth 2.0 PKCE authorization flow.
 */
export async function authorize(): Promise<void> {
  const clientId = getClientId();
  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(16).toString("hex");

  const authUrl = new URL("https://x.com/i/oauth2/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  console.log("Opening browser for X authorization...\n");
  console.log(`If the browser doesn't open, visit:\n${authUrl.toString()}\n`);

  // Open browser
  const proc = Bun.spawn(["open", authUrl.toString()], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await proc.exited;

  // Start callback server and wait for the redirect
  const code = await waitForCallback(state);

  // Exchange code for tokens
  console.log("Exchanging authorization code for tokens...");

  const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`);
  }

  const tokenData = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // Fetch user info
  const meRes = await fetch("https://api.x.com/2/users/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!meRes.ok) {
    throw new Error(`Failed to fetch user info: ${meRes.status}`);
  }

  const meData = await meRes.json() as { data: { id: string; username: string } };

  const tokens: StoredTokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: Date.now() + tokenData.expires_in * 1000,
    user_id: meData.data.id,
    username: meData.data.username,
  };

  saveTokens(tokens);
  console.log(`\nAuthenticated as @${tokens.username} (${tokens.user_id})`);
  console.log(`Tokens saved to ${TOKEN_PATH}`);
}

function waitForCallback(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.stop();
      reject(new Error("Authorization timed out after 2 minutes"));
    }, 120_000);

    const server = Bun.serve({
      port: CALLBACK_PORT,
      fetch(req) {
        const url = new URL(req.url);

        if (url.pathname !== "/callback") {
          return new Response("Not found", { status: 404 });
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          clearTimeout(timeout);
          server.stop();
          reject(new Error(`Authorization denied: ${error}`));
          return new Response(
            "<html><body><h1>Authorization denied</h1><p>You can close this tab.</p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        }

        if (state !== expectedState) {
          clearTimeout(timeout);
          server.stop();
          reject(new Error("State mismatch — possible CSRF"));
          return new Response("State mismatch", { status: 400 });
        }

        if (!code) {
          clearTimeout(timeout);
          server.stop();
          reject(new Error("No authorization code received"));
          return new Response("Missing code", { status: 400 });
        }

        clearTimeout(timeout);
        // Delay stop to allow response to be sent
        setTimeout(() => server.stop(), 500);
        resolve(code);

        return new Response(
          "<html><body><h1>Authorization successful!</h1><p>You can close this tab and return to the terminal.</p></body></html>",
          { headers: { "Content-Type": "text/html" } }
        );
      },
    });

    console.log(`Waiting for callback on http://localhost:${CALLBACK_PORT}/callback ...`);
  });
}

/**
 * Refresh the access token using the refresh token.
 */
async function refreshAccessToken(tokens: StoredTokens): Promise<StoredTokens> {
  const clientId = getClientId();

  const res = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: clientId,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Token refresh failed (${res.status}): ${body}\nRun 'xpull auth' to re-authenticate.`
    );
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const updated: StoredTokens = {
    ...tokens,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  saveTokens(updated);
  return updated;
}

/**
 * Get a valid access token, refreshing if needed.
 * Returns { accessToken, userId }.
 */
export async function getAuth(): Promise<{ accessToken: string; userId: string; username: string }> {
  let tokens = loadTokens();

  if (!tokens) {
    throw new Error("Not authenticated. Run 'xpull auth' first.");
  }

  // Refresh if within 2 minutes of expiry
  const BUFFER_MS = 2 * 60 * 1000;
  if (Date.now() >= tokens.expires_at - BUFFER_MS) {
    console.error("Refreshing access token...");
    tokens = await refreshAccessToken(tokens);
  }

  return {
    accessToken: tokens.access_token,
    userId: tokens.user_id,
    username: tokens.username,
  };
}
