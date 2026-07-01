import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { DISCLAIMER } from "@/lib/legal/content";

export const metadata: Metadata = { title: "Disclaimer — Not financial advice" };

export default function DisclaimerPage() {
  return <LegalDoc content={DISCLAIMER} />;
}
