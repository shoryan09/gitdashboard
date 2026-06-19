"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

type Lang = { name: string; color: string };
type RepoRef = {
  nameWithOwner: string;
  url: string;
  isPrivate?: boolean;
  stargazerCount?: number;
  primaryLanguage?: Lang | null;
};
type ContribByRepo = { repository: RepoRef; contributions: { totalCount: number } };
type Day = { date: string; contributionCount: number; weekday: number };
type Week = { contributionDays: Day[] };

type Stats = {
  user: {
    name: string | null;
    login: string;
    avatarUrl: string;
    bio: string | null;
    company: string | null;
    location: string | null;
    websiteUrl: string | null;
    createdAt: string;
    followers: { totalCount: number };
    following: { totalCount: number };
    contributionsCollection: {
      totalCommitContributions: number;
      totalPullRequestContributions: number;
      totalIssueContributions: number;
      totalPullRequestReviewContributions: number;
      totalRepositoryContributions: number;
      restrictedContributionsCount: number;
      contributionCalendar: { totalContributions: number; weeks: Week[] };
      commitContributionsByRepository: ContribByRepo[];
      pullRequestContributionsByRepository: ContribByRepo[];
      issueContributionsByRepository: ContribByRepo[];
      pullRequestReviewContributionsByRepository: ContribByRepo[];
    };
    repositories: {
      totalCount: number;
      nodes: {
        name: string;
        nameWithOwner: string;
        url: string;
        description: string | null;
        stargazerCount: number;
        forkCount: number;
        primaryLanguage: Lang | null;
        languages: { totalSize: number; edges: { size: number; node: Lang }[] };
        updatedAt: string;
        createdAt: string;
      }[];
    };
    pinnedItems: {
      nodes: {
        name: string;
        nameWithOwner: string;
        description: string | null;
        url: string;
        stargazerCount: number;
        forkCount: number;
        primaryLanguage: Lang | null;
      }[];
    };
    mergedPRs: { totalCount: number };
    openPRs: { totalCount: number };
    closedPRs: { totalCount: number };
    totalIssues: { totalCount: number };
    repositoriesContributedTo: { totalCount: number };
    allTimeContributions: number;
    yearlyContributions: { year: number; count: number }[];
    firstContributionYear: number | null;
  };
  rateLimit: { limit: number; remaining: number; resetAt: string };
};

// ──────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────

export default function StatsPage() {
  const params = useParams<{ username: string }>();
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/stats/${params.username}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.username]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-500 flex items-center justify-center">
        <div className="text-sm">Loading {params.username}…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-4 p-6">
        <div className="text-zinc-400">{error}</div>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← try another
        </Link>
      </main>
    );
  }

  if (!data) return null;

  const u = data.user;
  const cc = u.contributionsCollection;
  const cal = cc.contributionCalendar;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-10">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 w-fit">
          ← back
        </Link>

        <ProfileHeader u={u} />
        <StatsGrid u={u} />
        <HeatmapSection cal={cal} />

        <div className="grid md:grid-cols-2 gap-6">
          <TopRepos cc={cc} />
          <LanguagesPanel repos={u.repositories.nodes} />
        </div>

        {u.pinnedItems.nodes.length > 0 && <PinnedRepos pins={u.pinnedItems.nodes} />}

        <div className="text-xs text-zinc-600 pt-4 border-t border-zinc-900">
          API rate limit: {data.rateLimit.remaining}/{data.rateLimit.limit} remaining
        </div>
      </div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────
// Components
// ──────────────────────────────────────────────────────────────

function ProfileHeader({ u }: { u: Stats["user"] }) {
  const joined = new Date(u.createdAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return (
    <header className="flex flex-col sm:flex-row gap-6 items-start">
      <img
        src={u.avatarUrl}
        alt={u.login}
        className="w-24 h-24 rounded-full border border-zinc-800"
      />
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-medium">{u.name || u.login}</h1>
          <a
            href={`https://github.com/${u.login}`}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-500 hover:text-zinc-300 text-sm"
          >
            @{u.login}
          </a>
        </div>
        {u.bio && <p className="text-zinc-300 max-w-2xl">{u.bio}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500 mt-1">
          {u.company && <span>{u.company}</span>}
          {u.location && <span>{u.location}</span>}
          {u.websiteUrl && (
            <a href={u.websiteUrl} target="_blank" rel="noreferrer" className="hover:text-zinc-300">
              {u.websiteUrl.replace(/^https?:\/\//, "")}
            </a>
          )}
          <span>Joined {joined}</span>
        </div>
        <div className="flex gap-4 text-sm text-zinc-400 mt-1">
          <span>
            <b className="text-zinc-100">{u.followers.totalCount.toLocaleString()}</b> followers
          </span>
          <span>
            <b className="text-zinc-100">{u.following.totalCount.toLocaleString()}</b> following
          </span>
        </div>
      </div>
    </header>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-medium mt-1">{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatsGrid({ u }: { u: Stats["user"] }) {
  const cc = u.contributionsCollection;
  const since = u.firstContributionYear ?? new Date(u.createdAt).getUTCFullYear();
  return (
    <section className="flex flex-col gap-6">
      <div className="bg-gradient-to-br from-emerald-950/40 to-zinc-900/40 border border-emerald-900/40 rounded-xl p-6">
        <div className="text-xs text-emerald-400/70 uppercase tracking-wide">
          All-time contributions
        </div>
        <div className="text-4xl font-medium mt-1 tabular-nums">
          {u.allTimeContributions.toLocaleString()}
        </div>
        <div className="text-xs text-zinc-500 mt-1">since {since}</div>
      </div>

      <div>
        <h2 className="text-sm uppercase tracking-wide text-zinc-500 mb-3">Last 12 months</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Contributions" value={cc.contributionCalendar.totalContributions.toLocaleString()} />
          <StatCard label="Commits" value={cc.totalCommitContributions.toLocaleString()} />
          <StatCard label="Pull requests" value={cc.totalPullRequestContributions.toLocaleString()} />
          <StatCard label="Issues" value={cc.totalIssueContributions.toLocaleString()} />
          <StatCard label="Reviews" value={cc.totalPullRequestReviewContributions.toLocaleString()} />
          <StatCard label="Repos created" value={cc.totalRepositoryContributions.toLocaleString()} />
          <StatCard label="Private (hidden)" value={cc.restrictedContributionsCount.toLocaleString()} />
          <StatCard label="Repos contributed to" value={u.repositoriesContributedTo.totalCount.toLocaleString()} sub="all time" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="PRs merged" value={u.mergedPRs.totalCount.toLocaleString()} sub="all time" />
        <StatCard label="PRs open" value={u.openPRs.totalCount.toLocaleString()} sub="all time" />
        <StatCard label="PRs closed" value={u.closedPRs.totalCount.toLocaleString()} sub="all time" />
        <StatCard label="Public repos" value={u.repositories.totalCount.toLocaleString()} sub="owned" />
      </div>
    </section>
  );
}

function HeatmapSection({ cal }: { cal: Stats["user"]["contributionsCollection"]["contributionCalendar"] }) {
  const level = (c: number) => {
    if (c === 0) return 0;
    if (c < 3) return 1;
    if (c < 6) return 2;
    if (c < 10) return 3;
    return 4;
  };
  const colors = [
    "bg-zinc-900",
    "bg-emerald-900",
    "bg-emerald-700",
    "bg-emerald-500",
    "bg-emerald-400",
  ];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wide text-zinc-500">Contribution activity</h2>
        <span className="text-xs text-zinc-500">
          {cal.totalContributions.toLocaleString()} in the last year
        </span>
      </div>
      <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
        <div className="flex gap-[3px] min-w-fit">
          {cal.weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {w.contributionDays.map((d) => (
                <div
                  key={d.date}
                  className={`w-[11px] h-[11px] rounded-sm ${colors[level(d.contributionCount)]}`}
                  title={`${d.contributionCount} contribution${d.contributionCount === 1 ? "" : "s"} on ${d.date}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500">
          <span>less</span>
          {colors.map((c, i) => (
            <div key={i} className={`w-[11px] h-[11px] rounded-sm ${c}`} />
          ))}
          <span>more</span>
        </div>
      </div>
    </section>
  );
}

function TopRepos({ cc }: { cc: Stats["user"]["contributionsCollection"] }) {
  // Merge all contribution types per repo
  const map = new Map<
    string,
    { url: string; commits: number; prs: number; issues: number; reviews: number; total: number }
  >();
  const ensure = (key: string, url: string) => {
    if (!map.has(key))
      map.set(key, { url, commits: 0, prs: 0, issues: 0, reviews: 0, total: 0 });
    return map.get(key)!;
  };
  for (const c of cc.commitContributionsByRepository) {
    const e = ensure(c.repository.nameWithOwner, c.repository.url);
    e.commits = c.contributions.totalCount;
    e.total += c.contributions.totalCount;
  }
  for (const c of cc.pullRequestContributionsByRepository) {
    const e = ensure(c.repository.nameWithOwner, c.repository.url);
    e.prs = c.contributions.totalCount;
    e.total += c.contributions.totalCount;
  }
  for (const c of cc.issueContributionsByRepository) {
    const e = ensure(c.repository.nameWithOwner, c.repository.url);
    e.issues = c.contributions.totalCount;
    e.total += c.contributions.totalCount;
  }
  for (const c of cc.pullRequestReviewContributionsByRepository) {
    const e = ensure(c.repository.nameWithOwner, c.repository.url);
    e.reviews = c.contributions.totalCount;
    e.total += c.contributions.totalCount;
  }
  const rows = Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <section className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-sm uppercase tracking-wide text-zinc-500 mb-4">
        Top repos · last 12 months
      </h2>
      <div className="flex flex-col gap-3">
        {rows.length === 0 && <div className="text-zinc-500 text-sm">No contributions found.</div>}
        {rows.map((r) => (
          <a
            key={r.name}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="block group"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-zinc-200 group-hover:text-white truncate">{r.name}</span>
              <span className="text-sm text-zinc-100 tabular-nums">{r.total}</span>
            </div>
            <div className="flex gap-3 text-xs text-zinc-500 mt-0.5">
              {r.commits > 0 && <span>{r.commits} commits</span>}
              {r.prs > 0 && <span>{r.prs} PRs</span>}
              {r.issues > 0 && <span>{r.issues} issues</span>}
              {r.reviews > 0 && <span>{r.reviews} reviews</span>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function LanguagesPanel({ repos }: { repos: Stats["user"]["repositories"]["nodes"] }) {
  const map = new Map<string, { size: number; color: string }>();
  let total = 0;
  for (const r of repos) {
    for (const e of r.languages.edges) {
      const cur = map.get(e.node.name);
      if (cur) cur.size += e.size;
      else map.set(e.node.name, { size: e.size, color: e.node.color || "#888" });
      total += e.size;
    }
  }
  const rows = Array.from(map.entries())
    .map(([name, v]) => ({ name, color: v.color, percent: total ? (v.size / total) * 100 : 0 }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 8);

  return (
    <section className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-sm uppercase tracking-wide text-zinc-500 mb-4">Languages · owned repos</h2>
      {total === 0 ? (
        <div className="text-zinc-500 text-sm">No language data.</div>
      ) : (
        <>
          <div className="flex h-2 rounded-full overflow-hidden mb-4 bg-zinc-800">
            {rows.map((r) => (
              <div
                key={r.name}
                style={{ width: `${r.percent}%`, backgroundColor: r.color }}
                title={`${r.name} ${r.percent.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            {rows.map((r) => (
              <div key={r.name} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: r.color }}
                />
                <span className="text-zinc-300 truncate">{r.name}</span>
                <span className="text-zinc-500 tabular-nums ml-auto">{r.percent.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function PinnedRepos({ pins }: { pins: Stats["user"]["pinnedItems"]["nodes"] }) {
  return (
    <section>
      <h2 className="text-sm uppercase tracking-wide text-zinc-500 mb-3">Pinned</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {pins.map((p) => (
          <a
            key={p.nameWithOwner}
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors flex flex-col gap-2"
          >
            <div className="text-sm text-zinc-200 font-medium truncate">{p.name}</div>
            {p.description && (
              <p className="text-xs text-zinc-500 line-clamp-2">{p.description}</p>
            )}
            <div className="flex gap-3 text-xs text-zinc-500 mt-auto pt-2">
              {p.primaryLanguage && (
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: p.primaryLanguage.color }}
                  />
                  {p.primaryLanguage.name}
                </span>
              )}
              <span>★ {p.stargazerCount}</span>
              <span>⑂ {p.forkCount}</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}