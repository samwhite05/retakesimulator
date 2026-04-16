import Link from "next/link";
import Image from "next/image";
import { getScenarioForDate } from "@/lib/scenarios";
import { getUserHash } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isDailyPlayLimitDisabled } from "@/lib/playLimits";
import DailyStats from "@/components/landing/DailyStats";
import CountdownBadge from "@/components/landing/CountdownBadge";
import { getAgentIconUrl } from "@/lib/assets";

export const dynamic = "force-dynamic";

function rolePill(role: string) {
  const toneMap: Record<string, string> = {
    duelist: "text-valorant-red border-valorant-red/30",
    initiator: "text-amber border-amber/30",
    controller: "text-violet border-violet/30",
    sentinel: "text-teal border-teal/30",
  };
  return toneMap[role] || "text-ink-mute border-border-08";
}

export default async function HomePage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const scenario = getScenarioForDate(today);
  const userHash = await getUserHash();

  const limitOff = isDailyPlayLimitDisabled();
  const playsToday = limitOff
    ? 0
    : await prisma.plan.count({
        where: {
          userHash,
          createdAt: { gte: today, lt: tomorrow },
        },
      });
  const canPlay = limitOff || playsToday < 1;

  let totalPlaysToday = 0;
  let topPlays: { score: number; tier: string; createdAt: Date }[] = [];
  try {
    if (scenario) {
      totalPlaysToday = await prisma.plan.count({
        where: { scenarioId: scenario.id, createdAt: { gte: today, lt: tomorrow } },
      });
      topPlays = await prisma.plan.findMany({
        where: {
          scenarioId: scenario.id,
          createdAt: {
            gte: new Date(today.getTime() - 24 * 60 * 60 * 1000),
            lt: today,
          },
        },
        orderBy: { score: "desc" },
        take: 3,
        select: { score: true, tier: true, createdAt: true },
      });
    }
  } catch {
    /* db might not exist yet in dev */
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,177,60,0.07),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber/25 to-transparent" />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-valorant-red/15 text-valorant-red">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 22h20L12 2z" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink">
            Retake<span className="text-valorant-red">.</span>
          </span>
          <span className="ml-3 hidden rounded-full border border-border-08 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-ink-mute sm:inline">
            Daily Valorant puzzle
          </span>
        </div>
        <CountdownBadge />
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-6 pt-4 pb-16 md:px-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-ink-mute">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-valorant-red" />
            Today&apos;s retake · {today.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </div>

          <h1 className="mt-3 max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight text-ink md:text-6xl">
            You&apos;re the IGL.
            <br />
            <span className="text-amber">Call the retake.</span>
          </h1>

          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-dim">
            One scenario a day. Two teammates already down, spike planted, defenders holding angles.
            Plan every agent&apos;s entry, utility, and re-site — then watch it play out and see how you
            stack up against the world.
          </p>

          {scenario ? (
            <div className="mt-8 overflow-hidden rounded-2xl border border-border-10 bg-surface/70 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
              <div className="relative h-48 overflow-hidden border-b border-border-08">
                <Image
                  src={scenario.minimapImage}
                  alt={scenario.map}
                  fill
                  className="object-cover opacity-75 grayscale-[0.2]"
                  sizes="800px"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-ink-mute">Scenario</div>
                    <div className="text-lg font-semibold text-ink">{scenario.name}</div>
                  </div>
                  <div className="rounded-full border border-border-08 bg-pure-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-ink-dim backdrop-blur">
                    {scenario.map}
                  </div>
                </div>
                <div
                  className="absolute h-3 w-3 rounded-full bg-valorant-red ring-4 ring-valorant-red/25"
                  style={{
                    left: `${scenario.spikeSite.x * 100}%`,
                    top: `${scenario.spikeSite.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  aria-hidden
                />
              </div>

              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-1.5">
                  {scenario.availableAgents.slice(0, 5).map((id) => {
                    const icon = getAgentIconUrl(id);
                    return (
                      <div
                        key={id}
                        className="h-7 w-7 overflow-hidden rounded-md border border-border-10 bg-elevated"
                      >
                        {icon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                    );
                  })}
                  <div className="ml-1.5 text-[11px] text-ink-mute">
                    {scenario.availableAgents.length} alive ·{" "}
                    {scenario.enemyAgents.length + scenario.hiddenEnemies.length} defenders
                  </div>
                </div>

                {canPlay ? (
                  <Link
                    href="/planning"
                    className="group flex items-center gap-2 rounded-md bg-valorant-red px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-white transition-all hover:brightness-110"
                  >
                    Play today
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </Link>
                ) : (
                  <Link
                    href="/planning"
                    className="flex items-center gap-2 rounded-md border border-amber/30 bg-amber/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-amber hover:bg-amber/15"
                  >
                    Scrim mode →
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-border-10 bg-surface/70 p-6 text-sm text-ink-dim">
              No scenario loaded yet for today.
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 text-[12px] text-ink-dim">
            {!canPlay ? (
              <>
                <span className="rounded-full border border-teal/25 bg-teal/10 px-3 py-1 text-teal">
                  ✓ Submitted today
                </span>
                <span>Come back tomorrow for a fresh puzzle.</span>
              </>
            ) : (
              <span>
                You get <span className="font-semibold text-ink">one official run</span> per day.
                After that, scrim mode lets you experiment freely.
              </span>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <DailyStats totalPlaysToday={totalPlaysToday} />

          <div className="rounded-2xl border border-border-10 bg-surface/70 p-5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-ink-mute">
              <span className="h-1 w-1 rounded-full bg-amber" /> Squad on-site
            </div>
            {scenario ? (
              <ul className="mt-3 space-y-1.5">
                {scenario.availableAgents.slice(0, 5).map((id) => {
                  const role = getAgentRole(id);
                  const icon = getAgentIconUrl(id);
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-3 rounded-lg border border-border-08 bg-pure-black/30 px-2.5 py-1.5"
                    >
                      <div className="h-7 w-7 overflow-hidden rounded-md bg-elevated">
                        {icon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 text-[12px] font-medium capitalize text-ink">{id}</div>
                      <div className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${rolePill(role)}`}>
                        {role}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {topPlays.length > 0 && (
            <div className="rounded-2xl border border-border-10 bg-surface/70 p-5">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-ink-mute">
                <span className="h-1 w-1 rounded-full bg-teal" /> Yesterday&apos;s top runs
              </div>
              <ol className="mt-3 space-y-1.5">
                {topPlays.map((run, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-border-08 bg-pure-black/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-ink-mute">#{idx + 1}</span>
                      <span className="text-[12px] text-ink">Anonymous IGL</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] text-ink">{run.score}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${
                          run.tier === "clean"
                            ? "border-teal/30 text-teal"
                            : run.tier === "messy"
                              ? "border-amber/30 text-amber"
                              : "border-valorant-red/30 text-valorant-red"
                        }`}
                      >
                        {run.tier}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function getAgentRole(agentId: string): string {
  const roles: Record<string, string> = {
    jett: "duelist",
    raze: "duelist",
    phoenix: "duelist",
    reyna: "duelist",
    yoru: "duelist",
    neon: "duelist",
    iso: "duelist",
    sova: "initiator",
    breach: "initiator",
    skye: "initiator",
    kayo: "initiator",
    fade: "initiator",
    gekko: "initiator",
    tejo: "initiator",
    omen: "controller",
    brimstone: "controller",
    viper: "controller",
    astra: "controller",
    harbor: "controller",
    clove: "controller",
    sage: "sentinel",
    cypher: "sentinel",
    killjoy: "sentinel",
    chamber: "sentinel",
    deadlock: "sentinel",
    vyse: "sentinel",
  };
  return roles[agentId] || "duelist";
}
