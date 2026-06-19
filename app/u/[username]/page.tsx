"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ──────────────────────────────────────────────────────────────
// Types (unchanged)
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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ──────────────────────────────────────────────────────────────
// Monochrome theme tokens
// ──────────────────────────────────────────────────────────────

const ACCENT = "#d4ff00";
const SERIF = { fontFamily: "var(--font-serif)" } as const;
// zero → faint → mid → near-accent → accent
const HEAT = ["#161616", "#2a2a2a", "#4a4a4a", "#a8d000", "#d4ff00"];
// monochrome-friendly mix palette (lime → grey ramp)
const MIX_COLORS = ["#d4ff00", "#8a8a8a", "#555555", "#2a2a2a"];

// ──────────────────────────────────────────────────────────────
// Derived insight helpers (unchanged logic)
// ──────────────────────────────────────────────────────────────

function computeStreaks(weeks: Week[]) {
  const days = weeks.flatMap((w) => w.contributionDays);
  let longest = 0;
  let run = 0;
  for (const d of days) {
    if (d.contributionCount > 0) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  let current = 0;
  let started = false;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) {
      current++;
      started = true;
    } else {
      if (!started && i === days.length - 1) continue;
      break;
    }
  }
  return { current, longest };
}

function computeWeekdayPattern(weeks: Week[]) {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const w of weeks) for (const d of w.contributionDays) totals[d.weekday] += d.contributionCount;
  return WEEKDAY_LABELS.map((day, i) => ({ day, count: totals[i] }));
}

function computeConsistency(weeks: Week[]) {
  let active = 0;
  let total = 0;
  for (const w of weeks)
    for (const d of w.contributionDays) {
      total++;
      if (d.contributionCount > 0) active++;
    }
  return total ? (active / total) * 100 : 0;
}

function computeMostActiveMonth(weeks: Week[]) {
  const monthTotals = new Map<string, number>();
  for (const w of weeks)
    for (const d of w.contributionDays) {
      const m = d.date.slice(0, 7);
      monthTotals.set(m, (monthTotals.get(m) ?? 0) + d.contributionCount);
    }
  let best: [string, number] = ["", 0];
  for (const entry of monthTotals.entries()) if (entry[1] > best[1]) best = entry;
  if (!best[0]) return null;
  const [y, m] = best[0].split("-");
  const dt = new Date(Number(y), Number(m) - 1, 1);
  return { label: dt.toLocaleString("en-US", { month: "short", year: "numeric" }), count: best[1] };
}

function computeMix(cc: Stats["user"]["contributionsCollection"]) {
  const rows = [
    { name: "Commits", count: cc.totalCommitContributions },
    { name: "Pull requests", count: cc.totalPullRequestContributions },
    { name: "Issues", count: cc.totalIssueContributions },
    { name: "Reviews", count: cc.totalPullRequestReviewContributions },
  ];
  const total = rows.reduce((s, r) => s + r.count, 0);
  return {
    total,
    rows: rows.map((r, i) => ({
      ...r,
      color: MIX_COLORS[i % MIX_COLORS.length],
      percent: total ? (r.count / total) * 100 : 0,
    })),
  };
}

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
      <Shell>
        <div className="min-h-[60vh] flex items-center justify-center gap-2 text-[#8a8a8a] text-sm">
          <Spinner />
          Loading {params.username}…
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <div className="text-[#ededed] text-sm">{error}</div>
          <Link href="/" className="text-sm text-[#8a8a8a] hover:text-[#ededed] transition-colors">
            ← try another
          </Link>
        </div>
      </Shell>
    );
  }

  if (!data) return null;

  return (
    <Shell>
      <Dashboard data={data} />
    </Shell>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#1c1c1c" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────
// Shell — flat #0a0a0a canvas, no aurora/blur
// ──────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
      <div className="max-w-7xl mx-auto px-8 py-12">{children}</div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────
// Primitives
// ──────────────────────────────────────────────────────────────

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-[10px] uppercase tracking-[0.18em] text-[#555555] ${className}`}>
      {children}
    </div>
  );
}

function Section({
  label,
  children,
  className = "",
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`py-12 border-t border-[#1c1c1c] ${className}`}>
      {label && <SectionLabel className="mb-6">{label}</SectionLabel>}
      {children}
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Dashboard
// ──────────────────────────────────────────────────────────────

function Dashboard({ data }: { data: Stats }) {
  const u = data.user;
  const cc = u.contributionsCollection;
  const cal = cc.contributionCalendar;

  const { current: currentStreak, longest: longestStreak } = useMemo(
    () => computeStreaks(cal.weeks),
    [cal.weeks]
  );
  const consistency = useMemo(() => computeConsistency(cal.weeks), [cal.weeks]);
  const weekdayPattern = useMemo(() => computeWeekdayPattern(cal.weeks), [cal.weeks]);
  const mostActiveMonth = useMemo(() => computeMostActiveMonth(cal.weeks), [cal.weeks]);
  const mostActiveWeekday = useMemo(() => {
    let best = weekdayPattern[0];
    for (const w of weekdayPattern) if (w.count > best.count) best = w;
    return best;
  }, [weekdayPattern]);
  const mix = useMemo(() => computeMix(cc), [cc]);

  return (
    <div>
      <TopBar login={u.login} />

      <Hero u={u} />

      <VitalsRow
        currentStreak={currentStreak}
        longestStreak={longestStreak}
        consistency={consistency}
        mostActiveWeekday={mostActiveWeekday}
        mostActiveMonth={mostActiveMonth}
      />

      {u.yearlyContributions.length > 0 && (
        <YearlyTimeline yearly={u.yearlyContributions} firstYear={u.firstContributionYear} />
      )}

      <HeatmapPanel cal={cal} />

      <div className="grid md:grid-cols-2 border-t border-[#1c1c1c]">
        <div className="py-12 md:pr-10">
          <SectionLabel className="mb-6">Weekday rhythm · last 12 months</SectionLabel>
          <WeekdayPanel data={weekdayPattern} />
        </div>
        <div className="py-12 md:pl-10 md:border-l md:border-[#1c1c1c] border-t border-[#1c1c1c] md:border-t-0">
          <SectionLabel className="mb-6">Contribution mix · last 12 months</SectionLabel>
          <ContributionMix mix={mix} />
        </div>
      </div>

      <Section label="Top repos · last 12 months">
        <TopRepos cc={cc} />
      </Section>

      <Section label="Languages · across owned repos">
        <LanguagesPanel repos={u.repositories.nodes} />
      </Section>

      {u.pinnedItems.nodes.length > 0 && (
        <Section label="Pinned">
          <PinnedRepos pins={u.pinnedItems.nodes} />
        </Section>
      )}

      <div className="mt-12 pt-6 text-[10px] text-[#555555] font-mono">
        rate limit: {data.rateLimit.remaining}/{data.rateLimit.limit} · resets{" "}
        {new Date(data.rateLimit.resetAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Top bar
// ──────────────────────────────────────────────────────────────

function TopBar({ login }: { login: string }) {
  return (
    <div className="flex items-center justify-between py-5 border-b border-[#1c1c1c]">
      <Link
        href="/"
        className="text-sm text-[#8a8a8a] hover:text-[#ededed] transition-colors flex items-center gap-1.5"
      >
        ← back
      </Link>
      <span
        className="text-sm text-[#8a8a8a]"
        style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}
      >
        @{login}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Hero — full-bleed, 12-col split 7/5, serif statement number
// ──────────────────────────────────────────────────────────────

function Hero({ u }: { u: Stats["user"] }) {
  const joined = new Date(u.createdAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  const since = u.firstContributionYear ?? new Date(u.createdAt).getUTCFullYear();

  return (
    <section className="grid grid-cols-1 md:grid-cols-12 gap-10 py-16">
      <div className="md:col-span-7 flex flex-col gap-5">
        <img
          src={u.avatarUrl}
          alt={u.login}
          className="w-24 h-24 rounded-md border border-[#1c1c1c]"
        />
        <div>
          <h1 className="text-3xl tracking-tight text-[#ededed]">{u.name || u.login}</h1>
          <a
            href={`https://github.com/${u.login}`}
            target="_blank"
            rel="noreferrer"
            className="text-[#8a8a8a] hover:text-[#ededed] text-sm transition-colors"
          >
            @{u.login}
          </a>
        </div>
        {u.bio && <p className="text-[#8a8a8a] text-sm max-w-xl leading-relaxed">{u.bio}</p>}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#555555]">
          {u.company && <span>{u.company}</span>}
          {u.location && <span>{u.location}</span>}
          {u.websiteUrl && (
            <a
              href={u.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#ededed] transition-colors"
            >
              {u.websiteUrl.replace(/^https?:\/\//, "")}
            </a>
          )}
          <span>Joined {joined}</span>
        </div>
        <div className="flex gap-8 mt-2">
          <Stat value={u.followers.totalCount} label="followers" />
          <Stat value={u.following.totalCount} label="following" />
          <Stat value={u.repositories.totalCount} label="repos" />
        </div>
      </div>

      <div className="md:col-span-5 flex flex-col justify-center md:items-end md:text-right">
        <div
          className="text-7xl md:text-8xl italic leading-none tabular-nums"
          style={{ ...SERIF, color: ACCENT }}
        >
          {u.allTimeContributions.toLocaleString()}
        </div>
        <SectionLabel className="mt-4">contributions since {since}</SectionLabel>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg tabular-nums text-[#ededed]">{value.toLocaleString()}</span>
      <span className="text-[10px] uppercase tracking-[0.18em] text-[#555555] mt-0.5">{label}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Vitals strip — 5 equal cells split by vertical hairlines, no cards
// ──────────────────────────────────────────────────────────────

function VitalsRow({
  currentStreak,
  longestStreak,
  consistency,
  mostActiveWeekday,
  mostActiveMonth,
}: {
  currentStreak: number;
  longestStreak: number;
  consistency: number;
  mostActiveWeekday: { day: string; count: number };
  mostActiveMonth: { label: string; count: number } | null;
}) {
  const cells = [
    { label: "Current streak", value: `${currentStreak}`, sub: "days" },
    { label: "Longest streak", value: `${longestStreak}`, sub: "days" },
    { label: "Consistency", value: `${consistency.toFixed(0)}%`, sub: "active days · last yr" },
    { label: "Peak weekday", value: mostActiveWeekday.day, sub: `${mostActiveWeekday.count} contribs` },
    {
      label: "Peak month",
      value: mostActiveMonth?.label.split(" ")[0] ?? "—",
      sub: mostActiveMonth ? `${mostActiveMonth.count} contribs` : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 border-t border-[#1c1c1c]">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={`py-8 px-6 ${i % 5 === 0 ? "" : "border-l border-[#1c1c1c]"} md:[&:nth-child(1)]:pl-0`}
        >
          <SectionLabel>{c.label}</SectionLabel>
          <div
            className="text-4xl mt-3 tabular-nums text-[#ededed]"
            style={SERIF}
          >
            {c.value}
          </div>
          {c.sub && <div className="text-[11px] text-[#555555] mt-1.5">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Yearly timeline — area chart, lime stroke + fade fill
// ──────────────────────────────────────────────────────────────

function YearlyTimeline({
  yearly,
  firstYear,
}: {
  yearly: { year: number; count: number }[];
  firstYear: number | null;
}) {
  const startIdx = firstYear ? Math.max(0, yearly.findIndex((y) => y.year === firstYear)) : 0;
  const trimmed = yearly.slice(startIdx);

  return (
    <Section label="Contributions by year">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trimmed} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="yearGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1c1c1c" vertical={false} />
            <XAxis
              dataKey="year"
              stroke="#2a2a2a"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#555555" }}
            />
            <YAxis
              stroke="#2a2a2a"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{ fill: "#555555" }}
            />
            <Tooltip
              cursor={{ stroke: "#2a2a2a" }}
              contentStyle={{
                background: "#0a0a0a",
                border: "1px solid #1c1c1c",
                borderRadius: 0,
                fontSize: 11,
                color: "#ededed",
              }}
              labelStyle={{ color: "#8a8a8a" }}
              itemStyle={{ color: ACCENT }}
            />
            <Area type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2} fill="url(#yearGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────
// Heatmap — flat squares, monochrome→lime scale, user-max calibration
// ──────────────────────────────────────────────────────────────

function HeatmapPanel({
  cal,
}: {
  cal: Stats["user"]["contributionsCollection"]["contributionCalendar"];
}) {
  const max = useMemo(() => {
    let m = 0;
    for (const w of cal.weeks)
      for (const d of w.contributionDays) if (d.contributionCount > m) m = d.contributionCount;
    return m;
  }, [cal.weeks]);

  const level = (c: number) => {
    if (c === 0) return 0;
    const r = c / max;
    if (r < 0.15) return 1;
    if (r < 0.4) return 2;
    if (r < 0.7) return 3;
    return 4;
  };

  const monthLabels: { idx: number; label: string }[] = [];
  let lastMonth = -1;
  cal.weeks.forEach((w, i) => {
    const first = w.contributionDays[0];
    if (!first) return;
    const m = new Date(first.date).getUTCMonth();
    if (m !== lastMonth) {
      monthLabels.push({
        idx: i,
        label: new Date(first.date).toLocaleString("en-US", { month: "short" }),
      });
      lastMonth = m;
    }
  });

  return (
    <Section
      label={
        <div className="flex items-baseline justify-between">
          <span>Activity · last 12 months</span>
          <span className="text-[#555555] tabular-nums">
            {cal.totalContributions.toLocaleString()} contributions
          </span>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <div className="inline-block min-w-fit">
          <div className="flex gap-[2px] mb-1.5 pl-[28px] text-[10px] uppercase tracking-[0.18em] text-[#555555]">
            {cal.weeks.map((_, i) => {
              const label = monthLabels.find((m) => m.idx === i);
              return (
                <div key={i} className="w-[12px] text-left">
                  {label?.label}
                </div>
              );
            })}
          </div>
          <div className="flex gap-[2px]">
            <div className="flex flex-col gap-[2px] text-[10px] uppercase tracking-[0.18em] text-[#555555] pr-2">
              <div className="h-[12px]" />
              <div className="h-[12px] leading-[12px]">Mon</div>
              <div className="h-[12px]" />
              <div className="h-[12px] leading-[12px]">Wed</div>
              <div className="h-[12px]" />
              <div className="h-[12px] leading-[12px]">Fri</div>
              <div className="h-[12px]" />
            </div>
            <div className="flex gap-[2px]">
              {cal.weeks.map((w, i) => (
                <div key={i} className="flex flex-col gap-[2px]">
                  {w.contributionDays.map((d) => (
                    <div
                      key={d.date}
                      className="w-[12px] h-[12px] rounded-none hover:ring-1 hover:ring-[#8a8a8a] transition-all"
                      style={{ backgroundColor: HEAT[level(d.contributionCount)] }}
                      title={`${d.contributionCount} on ${d.date}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-5 text-[10px] uppercase tracking-[0.18em] text-[#555555]">
        <span>Less</span>
        {HEAT.map((c, l) => (
          <div key={l} className="w-[12px] h-[12px] rounded-none" style={{ backgroundColor: c }} />
        ))}
        <span>More</span>
        <span className="ml-auto normal-case tracking-normal">
          calibrated to your peak day ({max})
        </span>
      </div>
    </Section>
  );
}

// ──────────────────────────────────────────────────────────────
// Weekday pattern — solid lime bars, faint grid
// ──────────────────────────────────────────────────────────────

function WeekdayPanel({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#1c1c1c" vertical={false} />
          <XAxis
            dataKey="day"
            stroke="#2a2a2a"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#555555" }}
          />
          <YAxis stroke="#2a2a2a" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#555555" }} />
          <Tooltip
            cursor={{ fill: "#111111" }}
            contentStyle={{
              background: "#0a0a0a",
              border: "1px solid #1c1c1c",
              borderRadius: 0,
              fontSize: 11,
              color: "#ededed",
            }}
            labelStyle={{ color: "#8a8a8a" }}
            itemStyle={{ color: ACCENT }}
          />
          <Bar dataKey="count">
            {data.map((d, i) => (
              <Cell key={i} fill={ACCENT} fillOpacity={0.35 + 0.65 * (d.count / max)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Contribution mix — serif total + segmented bar + stacked legend
// ──────────────────────────────────────────────────────────────

function ContributionMix({ mix }: { mix: ReturnType<typeof computeMix> }) {
  if (mix.total === 0) {
    return <div className="text-[#555555] text-sm">No contributions found.</div>;
  }
  return (
    <div>
      <div className="text-4xl tabular-nums text-[#ededed]" style={SERIF}>
        {mix.total.toLocaleString()}
      </div>
      <div className="flex h-2 rounded-sm overflow-hidden mt-5 mb-6 bg-[#161616]">
        {mix.rows.map((r) =>
          r.percent > 0 ? (
            <div
              key={r.name}
              style={{ width: `${r.percent}%`, backgroundColor: r.color }}
              title={`${r.name} ${r.percent.toFixed(1)}%`}
            />
          ) : null
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        {mix.rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2.5 text-sm">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
            <span className="text-[#ededed]">{r.name}</span>
            <span className="text-[#555555] tabular-nums">{r.count.toLocaleString()}</span>
            <span className="text-[#8a8a8a] tabular-nums ml-auto">{r.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Top repos — numbered leaderboard, serif ranks, progress bars
// ──────────────────────────────────────────────────────────────

function TopRepos({ cc }: { cc: Stats["user"]["contributionsCollection"] }) {
  const map = new Map<
    string,
    { url: string; commits: number; prs: number; issues: number; reviews: number; total: number }
  >();
  const ensure = (key: string, url: string) => {
    if (!map.has(key)) map.set(key, { url, commits: 0, prs: 0, issues: 0, reviews: 0, total: 0 });
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
  const max = rows[0]?.total ?? 1;

  if (rows.length === 0) {
    return <div className="text-[#555555] text-sm">No contributions found.</div>;
  }

  return (
    <div>
      {rows.map((r, i) => {
        const breakdown = [
          r.commits > 0 ? `${r.commits} commits` : null,
          r.prs > 0 ? `${r.prs} PRs` : null,
          r.issues > 0 ? `${r.issues} issues` : null,
          r.reviews > 0 ? `${r.reviews} reviews` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <a
            key={r.name}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="block group border-t border-[#1c1c1c] py-3 first:border-t-0"
          >
            <div className="flex items-baseline gap-4">
              <span
                className="text-2xl tabular-nums w-10 shrink-0"
                style={{ ...SERIF, color: i < 3 ? ACCENT : "#555555" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-[#ededed] group-hover:text-white truncate transition-colors">
                  {r.name}
                </div>
                <div className="text-[11px] text-[#555555] mt-0.5">{breakdown}</div>
              </div>
              <span className="text-2xl tabular-nums text-[#ededed] shrink-0" style={SERIF}>
                {r.total}
              </span>
            </div>
            <div className="mt-2 h-px bg-[#1c1c1c] overflow-hidden">
              <div className="h-full" style={{ width: `${(r.total / max) * 100}%`, backgroundColor: ACCENT }} />
            </div>
          </a>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Languages — segmented bar (real colors) + inline wrap legend
// ──────────────────────────────────────────────────────────────

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

  if (total === 0) {
    return <div className="text-[#555555] text-sm">No language data.</div>;
  }

  return (
    <div>
      <div className="flex h-2 rounded-sm overflow-hidden mb-5 bg-[#161616]">
        {rows.map((r) => (
          <div
            key={r.name}
            style={{ width: `${r.percent}%`, backgroundColor: r.color }}
            title={`${r.name} ${r.percent.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {rows.map((r) => (
          <span key={r.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
            <span className="text-[#8a8a8a]">{r.name}</span>
            <span className="text-[#555555] tabular-nums">{r.percent.toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Pinned — flat bordered tiles
// ──────────────────────────────────────────────────────────────

function PinnedRepos({ pins }: { pins: Stats["user"]["pinnedItems"]["nodes"] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {pins.map((p) => (
        <a key={p.nameWithOwner} href={p.url} target="_blank" rel="noreferrer" className="block">
          <div className="border border-[#1c1c1c] rounded-md p-5 h-full flex flex-col gap-2 hover:border-[#2a2a2a] transition-colors">
            <div className="text-sm text-zinc-100 font-medium truncate">{p.name}</div>
            {p.description && (
              <p className="text-xs text-[#8a8a8a] line-clamp-2 leading-relaxed">{p.description}</p>
            )}
            <div className="flex gap-3 text-[10px] text-[#555555] mt-auto pt-2">
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
          </div>
        </a>
      ))}
    </div>
  );
}
