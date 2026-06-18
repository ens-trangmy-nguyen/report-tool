"use client";

import { useEffect, useState } from "react";
import { Result, Spin } from "antd";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function finishLogin() {
      const { error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      window.location.replace("/");
    }

    void finishLogin();
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Result status="error" title="Login failed" subTitle={error} />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <Spin size="large" description="Finishing login..." />
    </main>
  );
}
