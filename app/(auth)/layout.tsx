import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr]">
      <header className="px-6 pt-6 sm:px-10 sm:pt-8">
        <Link href="/" aria-label="NZX home">
          <Wordmark size="md" />
        </Link>
      </header>
      <main className="grid place-items-center px-6 pb-16 sm:px-10">{children}</main>
    </div>
  );
}
