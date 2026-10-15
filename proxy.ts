import { type NextRequest, NextResponse } from "next/server";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

// Every page and API route needs the site password first. Delete this file to open the app to everyone.
export async function proxy(req: NextRequest) {
  const unlocked = process.env.SITE_PASSWORD && req.cookies.get(GATE_COOKIE)?.value === (await gateToken());
  return unlocked ? NextResponse.next() : NextResponse.redirect(new URL("/gate", req.url));
}

export const config = {
  // Skips the gate page itself, the cron endpoint (it checks CRON_SECRET) and static assets.
  matcher: ["/((?!gate|api/scan|_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
