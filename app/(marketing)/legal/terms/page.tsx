import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";
import { TERMS } from "@/lib/legal/content";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return <LegalDoc content={TERMS} />;
}
