import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zpppzzwaoplfeoiynkam.supabase.co";
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ai-sql-advisor-next.vercel.app";

  const redirect = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(SITE_URL + "/auth")}`;

  res.writeHead(302, { Location: redirect });
  res.end();
}
