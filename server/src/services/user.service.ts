import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "../utils/ApiError";

interface ProfileUpdate {
  fullName?: string;
  businessName?: string;
  avatarUrl?: string;
}

export const userService = {
  async getProfile(db: SupabaseClient, userId: string) {
    const { data, error } = await db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new ApiError(500, error.message);
    if (!data) throw ApiError.notFound("Profile not found");
    return data;
  },

  async updateProfile(db: SupabaseClient, userId: string, input: ProfileUpdate) {
    const patch: Record<string, unknown> = {};
    if (input.fullName !== undefined) patch.full_name = input.fullName;
    if (input.businessName !== undefined) patch.business_name = input.businessName;
    if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;

    const { data, error } = await db
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("*")
      .single();

    if (error) throw new ApiError(500, error.message);
    return data;
  },
};
