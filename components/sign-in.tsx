"use client";

import { type FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SignIn() {
  const [mode, setMode] = useState<"up" | "in">("up");
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const creds = { email: String(form.get("email")), password: String(form.get("password")) };
    const { data, error } =
      mode === "up" ? await supabase.auth.signUp(creds) : await supabase.auth.signInWithPassword(creds);
    if (error) setMessage(error.message.toLowerCase());
    else if (!data.session) setMessage("check your email to confirm your account, then sign in.");
  }

  return (
    <main className="hero dk-dotgrid">
      <div className="dk-section__head">
        <span className="dk-label">hourly job scan</span>
        <h1 className="dk-title">
          jobs that fit you, <span className="dk-serif">every hour</span>
        </h1>
        <p className="dk-lead">
          upload your resume once. we check linkedin, indeed and more every hour and email you only the new
          listings worth opening.
        </p>
      </div>

      <div className="dk-window">
        <div className="dk-window__bar">
          <span className="dk-lights"><i /><i /><i /></span>
          <span className="dk-window__title">{mode === "up" ? "sign up" : "sign in"}</span>
        </div>
        <form className="dk-window__body stack" onSubmit={submit}>
          <div className="dk-segmented">
            <button type="button" className="dk-seg" aria-pressed={mode === "up"} onClick={() => setMode("up")}>
              sign up
            </button>
            <button type="button" className="dk-seg" aria-pressed={mode === "in"} onClick={() => setMode("in")}>
              sign in
            </button>
          </div>
          <label>
            email
            <input className="dk-input" type="email" name="email" required autoComplete="email" />
          </label>
          <label>
            password
            <input
              className="dk-input"
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
            />
          </label>
          <button className="dk-btn dk-blue">{mode === "up" ? "create account" : "sign in"}</button>
          {message && <p className="dk-small dk-muted" role="status">{message}</p>}
        </form>
      </div>
    </main>
  );
}
