import { getEasyAuthUser } from "@/lib/auth";
import { UserMenuClient } from "./user-menu-client";

/**
 * Server component that reads Easy Auth headers and passes user to client.
 */
export async function UserMenu() {
  const user = await getEasyAuthUser();

  if (!user) {
    // In production with Easy Auth, this shouldn't happen
    // In dev without EASY_AUTH_DEV_USER, show nothing
    return null;
  }

  return <UserMenuClient user={user} />;
}
