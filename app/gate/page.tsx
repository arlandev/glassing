import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

// Reads searchParams for the wrong-password message; a tiny page, so blocking render is fine.
export const instant = false;

async function unlock(form: FormData) {
  "use server";
  // With no SITE_PASSWORD set, nobody gets in: the gate fails closed.
  if (!process.env.SITE_PASSWORD || form.get("password") !== process.env.SITE_PASSWORD) redirect("/gate?wrong=1");
  (await cookies()).set(GATE_COOKIE, await gateToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export default async function Gate({ searchParams }: PageProps<"/gate">) {
  const { wrong } = await searchParams;

  return (
    <>
      <nav className="dk-menubar">
        <div className="dk-menubar__left">
          <Link className="dk-menubar__brand" href="/">glassing</Link>
        </div>
      </nav>
      <main className="hero dk-dotgrid">
        <div className="dk-section__head">
          <span className="dk-label">private beta</span>
          <h1 className="dk-title">
            glassing is <span className="dk-serif">invite only</span> for now
          </h1>
          <p className="dk-lead">enter the password you were sent to continue.</p>
        </div>

        <div className="dk-window">
          <div className="dk-window__bar">
            <span className="dk-lights"><i /><i /><i /></span>
            <span className="dk-window__title">password</span>
          </div>
          <form className="dk-window__body stack" action={unlock}>
            <label>
              password
              <input className="dk-input" type="password" name="password" required autoComplete="current-password" />
            </label>
            <button className="dk-btn dk-blue">enter</button>
            {wrong && <p className="dk-small dk-muted" role="alert">wrong password, try again.</p>}
          </form>
        </div>
      </main>
    </>
  );
}
