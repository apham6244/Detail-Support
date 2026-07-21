import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { JobPhoto } from "@/lib/models";

const BUCKET = "job-photos";

/**
 * Photos for one customer. The bucket is private, so we resolve short-lived
 * signed URLs for display — Storage RLS still decides what can be read.
 */
export function useJobPhotos(customerId: string | null) {
  const { org, user } = useAuth();
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !org || !customerId) {
      setPhotos([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("job_photos")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as JobPhoto[];
    if (rows.length) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(rows.map((p) => p.storage_path), 3600);
      rows.forEach((p, i) => {
        p.url = signed?.[i]?.signedUrl ?? undefined;
      });
    }
    setPhotos(rows);
    setLoading(false);
  }, [org, customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (
    file: File,
    opts: { vehicleId?: string | null; appointmentId?: string | null; caption?: string | null } = {}
  ) => {
    if (!supabase || !org || !customerId) throw new Error("Sign in first.");
    if (!file.type.startsWith("image/")) throw new Error("Only image files can be uploaded.");
    if (file.size > 10 * 1024 * 1024) throw new Error("That image is over the 10 MB limit.");

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    // Path drives the Storage policies: {org_id}/{customer_id}/{uuid}.{ext}
    const path = `${org.id}/${customerId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);

    const { error } = await supabase.from("job_photos").insert({
      org_id: org.id,
      customer_id: customerId,
      vehicle_id: opts.vehicleId ?? null,
      appointment_id: opts.appointmentId ?? null,
      storage_path: path,
      caption: opts.caption ?? null,
      uploaded_by: user?.id ?? null,
    });
    if (error) {
      // don't leave an orphaned object behind if the metadata insert is denied
      await supabase.storage.from(BUCKET).remove([path]);
      throw new Error(error.message);
    }
    await load();
  };

  const remove = async (photo: JobPhoto) => {
    if (!supabase) throw new Error("Not available.");
    const { error } = await supabase.from("job_photos").delete().eq("id", photo.id);
    if (error) throw new Error(error.message);
    await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    setPhotos((p) => p.filter((x) => x.id !== photo.id));
  };

  return { photos, loading, reload: load, upload, remove };
}
