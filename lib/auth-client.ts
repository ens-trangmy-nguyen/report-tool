import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { WhitelistUser } from "@/lib/types";

export async function getCurrentProfile(): Promise<{
  error: string | null;
  profile: WhitelistUser | null;
  session: Session | null;
}> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    return { error: sessionError.message, profile: null, session: null };
  }

  const session = sessionData.session;
  const email = session?.user.email;

  if (!email) {
    return { error: "Not signed in.", profile: null, session };
  }

  const { data, error } = await supabase
    .from("whitelist_users")
    .select("id,email,name,role,status,created_at,updated_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return { error: error.message, profile: null, session };
  }

  if (!data || data.status !== "Active") {
    return {
      error: "This account is not active in the whitelist.",
      profile: null,
      session,
    };
  }

  return { error: null, profile: data as WhitelistUser, session };
}

export function canViewTeam(role?: string) {
  return role === "Leader" || role === "Admin";
}
