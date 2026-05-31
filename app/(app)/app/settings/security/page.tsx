import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MfaManager } from "@/components/auth/MfaManager";

export const dynamic = "force-dynamic";

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.22em] text-[var(--color-text-muted)] uppercase hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="size-3" aria-hidden /> Settings
        </Link>
        <h1 className="mt-3 font-sans text-3xl leading-tight font-medium text-[var(--color-text-primary)]">
          Security
        </h1>
      </div>
      <MfaManager />
    </div>
  );
}
