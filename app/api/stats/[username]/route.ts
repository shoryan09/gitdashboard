import { NextResponse } from "next/server";

const GITHUB_API = "https://api.github.com/graphql";

const QUERY = /* GraphQL */ `
  query UserStats($login: String!) {
    rateLimit {
      limit
      remaining
      resetAt
    }
    user(login: $login) {
      name
      login
      avatarUrl
      bio
      company
      location
      websiteUrl
      createdAt
      followers {
        totalCount
      }
      following {
        totalCount
      }

      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        totalPullRequestReviewContributions
        totalRepositoryContributions
        restrictedContributionsCount

        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              weekday
            }
          }
        }

        commitContributionsByRepository(maxRepositories: 25) {
          repository {
            nameWithOwner
            url
            isPrivate
            stargazerCount
            primaryLanguage {
              name
              color
            }
          }
          contributions {
            totalCount
          }
        }

        pullRequestContributionsByRepository(maxRepositories: 25) {
          repository {
            nameWithOwner
            url
          }
          contributions {
            totalCount
          }
        }

        issueContributionsByRepository(maxRepositories: 25) {
          repository {
            nameWithOwner
            url
          }
          contributions {
            totalCount
          }
        }

        pullRequestReviewContributionsByRepository(maxRepositories: 25) {
          repository {
            nameWithOwner
            url
          }
          contributions {
            totalCount
          }
        }
      }

      repositories(
        first: 100
        ownerAffiliations: OWNER
        orderBy: { field: STARGAZERS, direction: DESC }
        isFork: false
      ) {
        totalCount
        nodes {
          name
          nameWithOwner
          url
          description
          stargazerCount
          forkCount
          primaryLanguage {
            name
            color
          }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            totalSize
            edges {
              size
              node {
                name
                color
              }
            }
          }
          updatedAt
          createdAt
        }
      }

      pinnedItems(first: 6, types: REPOSITORY) {
        nodes {
          ... on Repository {
            name
            nameWithOwner
            description
            url
            stargazerCount
            forkCount
            primaryLanguage {
              name
              color
            }
          }
        }
      }

      mergedPRs: pullRequests(states: MERGED) {
        totalCount
      }
      openPRs: pullRequests(states: OPEN) {
        totalCount
      }
      closedPRs: pullRequests(states: CLOSED) {
        totalCount
      }
      totalIssues: issues {
        totalCount
      }
      repositoriesContributedTo(
        first: 1
        contributionTypes: [COMMIT, PULL_REQUEST, ISSUE, PULL_REQUEST_REVIEW]
      ) {
        totalCount
      }
    }
  }
`;

function buildAllTimeQuery(startYear: number, currentYear: number) {
  const nowIso = new Date().toISOString();
  const fields: string[] = [];
  for (let y = startYear; y <= currentYear; y++) {
    const from = `${y}-01-01T00:00:00Z`;
    const to = y === currentYear ? nowIso : `${y}-12-31T23:59:59Z`;
    fields.push(
      `y${y}: contributionsCollection(from: "${from}", to: "${to}") {
        contributionCalendar { totalContributions }
        restrictedContributionsCount
      }`
    );
  }
  return `
    query AllTime($login: String!) {
      user(login: $login) {
        ${fields.join("\n")}
      }
    }
  `;
}

async function githubFetch(token: string, query: string, variables: Record<string, unknown>) {
  return fetch(GITHUB_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "gh-stats-app",
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 43200 },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "Server misconfigured: GITHUB_TOKEN missing" },
      { status: 500 }
    );
  }

  if (!/^[a-zA-Z0-9-]{1,39}$/.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    const res = await githubFetch(token, QUERY, { login: username });

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${res.status}` },
        { status: res.status }
      );
    }

    const json = await res.json();

    if (json.errors) {
      const notFound = json.errors.some(
        (e: { type?: string }) => e.type === "NOT_FOUND"
      );
      if (notFound) {
        return NextResponse.json(
          { error: `User '${username}' not found` },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: json.errors[0].message }, { status: 400 });
    }

    // All-time contributions: query each year individually (GitHub caps contributionsCollection
    // at 1 year per call), aliased into a single request.
    const GITHUB_FOUNDED = 2008;
    const startYear = GITHUB_FOUNDED;
    const currentYear = new Date().getUTCFullYear();

    let allTimeContributions = 0;
    let firstContributionYear: number | null = null;
    const yearlyContributions: { year: number; count: number }[] = [];

    try {
      const allTimeQuery = buildAllTimeQuery(startYear, currentYear);
      const allTimeRes = await githubFetch(token, allTimeQuery, { login: username });
      if (allTimeRes.ok) {
        const allTimeJson = await allTimeRes.json();
        if (allTimeJson.data?.user) {
          for (let y = startYear; y <= currentYear; y++) {
            const node = allTimeJson.data.user[`y${y}`];
            const publicCount = node?.contributionCalendar?.totalContributions ?? 0;
            const privateCount = node?.restrictedContributionsCount ?? 0;
            const yearTotal = publicCount + privateCount;
            allTimeContributions += yearTotal;
            yearlyContributions.push({ year: y, count: yearTotal });
            if (yearTotal > 0 && firstContributionYear === null) {
              firstContributionYear = y;
            }
          }
        }
      }
    } catch (e) {
      console.error("[gh-stats] all-time fetch failed:", e);
      // Soft-fail: return base data with zeros if the second call breaks
    }

    json.data.user.allTimeContributions = allTimeContributions;
    json.data.user.yearlyContributions = yearlyContributions;
    json.data.user.firstContributionYear = firstContributionYear;

    return NextResponse.json(json.data);
  } catch (err) {
    console.error("[gh-stats] fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}