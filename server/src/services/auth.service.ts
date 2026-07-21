import { supabaseAnon, userClient } from "../config/supabase";
import { ApiError } from "../utils/ApiError";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema";

export const authService = {
  async register({ email, password, fullName, businessName }: RegisterInput) {
    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, business_name: businessName, role: "owner" } },
    });

    if (error) {
      // Supabase returns 400 for duplicate email / weak password, etc.
      throw new ApiError(400, error.message);
    }

    return {
      user: data.user,
      session: data.session, // null if email confirmation is required
      needsEmailConfirmation: data.session === null,
    };
  },

  async login({ email, password }: LoginInput) {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) {
      throw ApiError.unauthorized("Invalid email or password");
    }
    return { user: data.user, session: data.session };
  },

  async logout(accessToken: string) {
    // Scope the sign-out to this token so we only revoke the caller's session.
    const { error } = await userClient(accessToken).auth.signOut();
    if (error) throw new ApiError(400, error.message);
    return { success: true };
  },

  async refresh(refreshToken: string) {
    const { data, error } = await supabaseAnon.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      throw ApiError.unauthorized("Could not refresh session");
    }
    return { session: data.session };
  },
};
