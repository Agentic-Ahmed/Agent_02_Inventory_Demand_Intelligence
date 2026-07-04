import { SiteHeader } from "@/components/marketing/site-header";
import { HeroV2 } from "@/components/v2/hero-v2";
import { ProofStripV2 } from "@/components/v2/proof-strip-v2";
import { HowItWorksV2 } from "@/components/v2/how-it-works-v2";
import { AgentsV2 } from "@/components/v2/agents-v2";
import { ControlV2 } from "@/components/v2/control-v2";
import { PricingV2 } from "@/components/v2/pricing-v2";
import { FaqV2 } from "@/components/v2/faq-v2";
import { CtaV2 } from "@/components/v2/cta-v2";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <HeroV2 />
        <ProofStripV2 />
        <HowItWorksV2 />
        <AgentsV2 />
        <ControlV2 />
        <PricingV2 />
        <FaqV2 />
      </main>
      <CtaV2 />
    </>
  );
}
