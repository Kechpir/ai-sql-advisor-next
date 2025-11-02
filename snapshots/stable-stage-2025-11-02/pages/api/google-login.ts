import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Значения берутся из ENV на Vercel; строки ниже — безопасные дефолты для STAGE
  const SUPABASE_URL =
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zaheofzxbfqabdxdmjtz.supabase.co").replace(/\s+/g, "");
  const SITE_URL =
    (process.env.NEXT_PUBLIC_SITE_URL || "https://ai-sql-advisor-next-stage.vercel.app").replace(/\s+/g, "");

  const redirect = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
    SITE_URL + "/auth"
  )}`;

  // Чистый 302 без лишних символов в Location
  res.writeHead(302, { Location: redirect });
  res.end();
}
