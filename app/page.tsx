"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState } from "react";
import Dashboard from "@/components/dashboard";
import SignIn from "@/components/sign-in";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [session, setSession] = useState<Session | null>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;

  return (
    <>
      <nav className="dk-menubar">
        <div className="dk-menubar__left">
          <Link className="dk-menubar__brand" href="/">glassing</Link>
        </div>
        {session && (
          <div className="dk-menubar__right">
            <span className="dk-menubar__time">{session.user.email}</span>
            <button className="linklike" onClick={() => supabase.auth.signOut()}>sign out</button>
          </div>
        )}
      </nav>
      {session ? <Dashboard session={session} /> : <SignIn />}
    </>
  );
}
