import { BadRequestException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createPublicKey, verify as cryptoVerify, JsonWebKey } from "crypto";

export interface VerifiedGoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

export type CustomGoogleVerifyFn = (idToken: string, clientIds: string[]) => Promise<VerifiedGoogleProfile>;

interface GoogleJwk extends JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const VALID_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class GoogleTokenVerifier {
  private readonly log = new Logger("GoogleAuth");
  private jwksCache: { keys: GoogleJwk[]; expiresAt: number } | null = null;
  private customVerifier: CustomGoogleVerifyFn | null = null;

  /** Allows unit/integration tests to inject a deterministic token verifier. */
  setCustomVerifier(fn: CustomGoogleVerifyFn | null) {
    this.customVerifier = fn;
  }

  getConfiguredClientIds(): string[] {
    const raw = [
      process.env.GOOGLE_CLIENT_ID ?? "",
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    ].join(",");
    return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
  }

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleProfile> {
    const token = idToken?.trim();
    if (!token) {
      throw new BadRequestException("Google ID token is required.");
    }

    const clientIds = this.getConfiguredClientIds();
    if (clientIds.length === 0) {
      this.log.error("Google Sign-In attempted but GOOGLE_CLIENT_ID is not configured.");
      throw new ServiceUnavailableException(
        "Google Sign-In is not configured on the server. Set GOOGLE_CLIENT_ID in the environment.",
      );
    }

    if (this.customVerifier) {
      return this.customVerifier(token, clientIds);
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new UnauthorizedException("Invalid Google ID token format.");
    }

    let header: { kid?: string; alg?: string };
    let payload: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
      payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch {
      throw new UnauthorizedException("Malformed Google ID token.");
    }

    // Verify claims first
    const iss = String(payload.iss ?? "");
    if (!VALID_ISSUERS.has(iss)) {
      throw new UnauthorizedException("Google ID token issuer is invalid.");
    }

    const aud = String(payload.aud ?? "");
    if (!clientIds.includes(aud)) {
      this.log.warn(`Google ID token audience mismatch: got '${aud}'`);
      throw new UnauthorizedException("Google ID token audience does not match GOOGLE_CLIENT_ID.");
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const exp = Number(payload.exp ?? 0);
    if (!Number.isFinite(exp) || exp + 30 < nowSec) {
      throw new UnauthorizedException("Google ID token has expired. Please sign in again.");
    }

    const sub = String(payload.sub ?? "").trim();
    const email = String(payload.email ?? "").trim().toLowerCase();
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";

    if (!sub || !email) {
      throw new UnauthorizedException("Google ID token is missing account identifier or email.");
    }
    if (!emailVerified) {
      throw new UnauthorizedException("Your Google account email address is not verified.");
    }

    // Cryptographic signature verification via Google JWKS, with tokeninfo fallback
    const signatureValid = await this.verifySignatureOrTokenInfo(token, parts, header.kid, clientIds);
    if (!signatureValid) {
      throw new UnauthorizedException("Google ID token signature verification failed.");
    }

    return {
      sub,
      email,
      emailVerified: true,
      name: typeof payload.name === "string" ? payload.name.trim() : undefined,
      givenName: typeof payload.given_name === "string" ? payload.given_name.trim() : undefined,
      familyName: typeof payload.family_name === "string" ? payload.family_name.trim() : undefined,
      picture: typeof payload.picture === "string" ? payload.picture.trim() : undefined,
    };
  }

  private async verifySignatureOrTokenInfo(
    fullToken: string,
    parts: string[],
    kid: string | undefined,
    clientIds: string[],
  ): Promise<boolean> {
    try {
      const keys = await this.getGoogleJwks(false);
      let jwk = kid ? keys.find((k) => k.kid === kid) : keys[0];
      if (!jwk && kid) {
        const refreshed = await this.getGoogleJwks(true);
        jwk = refreshed.find((k) => k.kid === kid);
      }
      if (jwk) {
        const pubKey = createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
        const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, "utf8");
        const signature = Buffer.from(parts[2], "base64url");
        return cryptoVerify("RSA-SHA256", signingInput, pubKey, signature);
      }
    } catch (err) {
      this.log.warn(`JWKS verification fell back to tokeninfo: ${(err as Error)?.message}`);
    }

    // Fallback: verify directly with Google's tokeninfo endpoint
    try {
      const res = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(fullToken)}`);
      if (!res.ok) return false;
      const info = (await res.json()) as Record<string, unknown>;
      const aud = String(info.aud ?? "");
      const iss = String(info.iss ?? "");
      const emailVerified = info.email_verified === true || info.email_verified === "true";
      return VALID_ISSUERS.has(iss) && clientIds.includes(aud) && emailVerified;
    } catch (err) {
      this.log.error(`Failed to reach Google token verification endpoint: ${(err as Error)?.message}`);
      throw new ServiceUnavailableException("Could not reach Google authentication servers. Please try again.");
    }
  }

  private async getGoogleJwks(forceRefresh: boolean): Promise<GoogleJwk[]> {
    if (!forceRefresh && this.jwksCache && this.jwksCache.expiresAt > Date.now()) {
      return this.jwksCache.keys;
    }
    const res = await fetch(GOOGLE_JWKS_URL);
    if (!res.ok) {
      throw new Error(`Google JWKS HTTP ${res.status}`);
    }
    const body = (await res.json()) as { keys?: GoogleJwk[] };
    const keys = Array.isArray(body?.keys) ? body.keys : [];
    this.jwksCache = { keys, expiresAt: Date.now() + JWKS_TTL_MS };
    return keys;
  }
}
