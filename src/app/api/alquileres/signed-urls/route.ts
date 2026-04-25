import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "recibos";
const EXPIRY = 3600;

export async function POST(request: NextRequest) {
  try {
    await getAuthContext();
    const { paths } = (await request.json()) as { paths: string[] };
    if (!Array.isArray(paths) || paths.length === 0) return NextResponse.json({ urls: {} });

    const supabase = await createClient();
    const urls: Record<string, string> = {};
    for (const p of paths) {
      if (!p) continue;
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p, EXPIRY);
      if (data?.signedUrl) urls[p] = data.signedUrl;
    }
    return NextResponse.json({ urls });
  } catch {
    return NextResponse.json({ urls: {} });
  }
}
