import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ProTeaser } from "@/components/landing/ProTeaser";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <ProTeaser />
      <Footer />
    </>
  );
}
