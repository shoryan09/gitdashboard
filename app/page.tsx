"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ACCENT = "#d4ff00";

export default function Home() {
  const [username, setUsername] = useState("");
  const router = useRouter();

  function go(name: string) {
    const v = name.trim();
    if (v) router.push(`/u/${v}`);
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex items-center justify-center px-8">
      <div className="w-full max-w-md flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#555555]">gh stats</div>

        <h1
          className="text-6xl italic leading-tight mt-6"
          style={{ fontFamily: "var(--font-serif)", color: ACCENT }}
        >
          See yourself, deeper.
        </h1>

        <p className="text-[#8a8a8a] text-sm leading-relaxed mt-5">
          Streaks, rhythm, languages, and your busiest repos — pulled straight from the GitHub API
          and laid out properly.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(username);
          }}
          className="mt-8 flex flex-col gap-3"
        >
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="github username"
            autoFocus
            className="bg-[#111111] border border-[#1c1c1c] focus:border-[#2a2a2a] rounded-md px-4 py-3.5 outline-none text-sm text-[#ededed] placeholder:text-[#555555] transition-colors"
          />
          <button
            type="submit"
            className="bg-[#d4ff00] text-black font-medium rounded-md py-3.5 hover:opacity-90 transition-opacity text-sm"
          >
            Analyze
          </button>
        </form>

        <p className="text-[10px] uppercase tracking-[0.18em] text-[#555555] mt-5">
          Free · no login · public data only
        </p>
      </div>
    </main>
  );
}
