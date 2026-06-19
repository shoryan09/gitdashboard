"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const [username, setUsername] = useState("");
  const router = useRouter();
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (username.trim()) router.push(`/u/${username.trim()}`);
        }}
        className="w-full max-w-md flex flex-col gap-4"
      >
        <h1 className="text-3xl font-medium tracking-tight">gh stats</h1>
        <p className="text-zinc-400 text-sm">Enter a GitHub username.</p>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="shoryan09"
          autoFocus
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 outline-none focus:border-zinc-500 transition-colors"
        />
        <button
          type="submit"
          className="bg-zinc-100 text-zinc-950 rounded-lg py-3 font-medium hover:bg-white transition-colors"
        >
          View stats
        </button>
      </form>
    </main>
  );
}