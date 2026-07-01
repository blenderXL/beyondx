import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { PRIVACY } from "@/lib/legal/content";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return <LegalDoc content={PRIVACY} />;
}
