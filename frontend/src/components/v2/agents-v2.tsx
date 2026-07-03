"use client";

import { AGENTS, SPECIALISTS } from "@/lib/agents";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/v2/spotlight-card";
import { cn } from "@/lib/utils";

const SPAN: Record<string, string> = {
  forecasting: "lg:col-span-2",
  reorder: "lg:col-span-2",
  warehouse: "lg:col-span-2",
  markdown: "lg:col-span-3",
  anomaly: "lg:col-span-3",
};

export function AgentsV2() {
  const orch = AGENTS.orchestrator;
  const OrchIcon = orch.icon;

  return (
    <section id="agents" className="relative scroll-mt-20 overflow-hidden">
      {/* teal brand field so the frosted agent cards read as glass */}
      <div aria-hidden className="landing-ambient pointer-events-none absolute inset-0 z-0" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
            A team of agents, not a black box.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Six specialists, each owning one job, each explaining its calls.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {/* Orchestrator hub */}
          <Reveal className="lg:col-span-6">
            <SpotlightCard glow={orch.cssVar} className="p-6 lg:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", orch.bg)}>
                    <OrchIcon className={cn("size-6", orch.text)} />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{orch.name}</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      {orch.blurb}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                  <span className="text-xs text-muted-foreground">coordinates</span>
                  <div className="flex -space-x-1.5">
                    {SPECIALISTS.map((a) => {
                      const Icon = a.icon;
                      return (
                        <span key={a.key} className={cn("flex size-8 items-center justify-center rounded-full border-2 border-card", a.bg)} title={a.name}>
                          <Icon className={cn("size-4", a.text)} />
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </SpotlightCard>
          </Reveal>

          {/* Specialists */}
          {SPECIALISTS.map((agent, i) => {
            const Icon = agent.icon;
            return (
              <Reveal key={agent.key} delay={i * 0.07} className={SPAN[agent.key]}>
                <SpotlightCard glow={agent.cssVar} className="h-full p-6">
                  <span className={cn("flex size-11 items-center justify-center rounded-xl", agent.bg)}>
                    <Icon className={cn("size-[1.4rem]", agent.text)} />
                  </span>
                  <div className="mt-4 flex items-baseline gap-2">
                    <h3 className={cn("text-lg font-semibold", agent.text)}>{agent.name}</h3>
                    <span className="text-xs text-muted-foreground">{agent.tagline}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {agent.blurb}
                  </p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
