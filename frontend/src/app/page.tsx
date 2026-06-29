import { SiteHeader } from "@/components/marketing/site-header";
import { Hero } from "@/components/marketing/hero";
import { ProofStrip } from "@/components/marketing/proof-strip";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { AgentsSection } from "@/components/marketing/agents-section";
import { ControlSection } from "@/components/marketing/control-section";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <ProofStrip />
        <HowItWorks />
        <AgentsSection />
        <ControlSection />
      </main>
      <SiteFooter />
    </>
  );
}
