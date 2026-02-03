import { headers } from "next/headers";

/**
 * User information extracted from Azure Easy Auth headers.
 */
export interface EasyAuthUser {
  /** User's email address (from X-MS-CLIENT-PRINCIPAL-NAME) */
  email: string;
  /** User's Entra ID object ID (from X-MS-CLIENT-PRINCIPAL-ID) */
  id: string;
  /** User's display name (from decoded principal, falls back to email) */
  name: string;
  /** Raw claims from the decoded principal */
  claims?: EasyAuthClaim[];
}

interface EasyAuthClaim {
  typ: string;
  val: string;
}

interface EasyAuthPrincipal {
  auth_typ: string;
  claims: EasyAuthClaim[];
  name_typ: string;
  role_typ: string;
}

/**
 * Get the current authenticated user from Azure Easy Auth headers.
 *
 * In production (Azure Container Apps with Easy Auth enabled):
 * - Azure handles authentication before requests reach your app
 * - User info is passed via X-MS-CLIENT-PRINCIPAL-* headers
 *
 * In development:
 * - Set EASY_AUTH_DEV_USER in .env.local to simulate a user
 * - Format: "email|name" (e.g., "john@company.com|John Doe")
 *
 * @returns User object if authenticated, null otherwise
 */
export async function getEasyAuthUser(): Promise<EasyAuthUser | null> {
  const headersList = await headers();

  // Check for Azure Easy Auth headers first
  const principalName = headersList.get("x-ms-client-principal-name");
  const principalId = headersList.get("x-ms-client-principal-id");
  const principalEncoded = headersList.get("x-ms-client-principal");

  if (principalName && principalId) {
    // Decode the full principal to get additional claims
    let name = principalName;
    let claims: EasyAuthClaim[] | undefined;

    if (principalEncoded) {
      try {
        const decoded = Buffer.from(principalEncoded, "base64").toString(
          "utf-8",
        );
        const principal: EasyAuthPrincipal = JSON.parse(decoded);
        claims = principal.claims;

        // Try to find a display name claim
        const nameClaim = claims.find(
          (c) =>
            c.typ === "name" ||
            c.typ ===
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name" ||
            c.typ === "preferred_username",
        );
        if (nameClaim) {
          name = nameClaim.val;
        }
      } catch {
        // If decoding fails, fall back to principalName
      }
    }

    return {
      email: principalName,
      id: principalId,
      name,
      claims,
    };
  }

  // Development fallback: check for EASY_AUTH_DEV_USER environment variable
  const devUser = process.env.EASY_AUTH_DEV_USER;
  if (devUser && process.env.NODE_ENV === "development") {
    const [email, name] = devUser.split("|");
    return {
      email: email || "dev@localhost",
      id: "dev-user-id",
      name: name || email || "Developer",
    };
  }

  return null;
}

/**
 * Require authentication - throws/redirects if not authenticated.
 * Use this in server components or API routes that must have a user.
 *
 * @throws Error if not authenticated (in production, Easy Auth handles this)
 */
export async function requireAuth(): Promise<EasyAuthUser> {
  const user = await getEasyAuthUser();

  if (!user) {
    // In production with Easy Auth enabled, this should never happen
    // because Azure intercepts unauthenticated requests.
    // This is a safety net for misconfiguration or local dev without EASY_AUTH_DEV_USER
    throw new Error(
      "Authentication required. Ensure Easy Auth is enabled in Azure Container Apps.",
    );
  }

  return user;
}

/**
 * Get a specific claim value from the user's claims.
 */
export function getClaim(
  user: EasyAuthUser,
  claimType: string,
): string | undefined {
  return user.claims?.find((c) => c.typ === claimType)?.val;
}
