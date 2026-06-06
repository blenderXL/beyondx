import { Suspense } from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { PostHogProvider } from "@/components/telemetry/PostHogProvider";
import { PageviewTracker } from "@/components/telemetry/PageviewTracker";

// Obsidian Terminal design system fonts — scoped to the signed-in (app) shell
// via the `.app-shell` --font-* indirection in globals.css. Marketing/auth keep Geist.
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NZX — plan your way out, month by month",
    template: "%s · NZX",
  },
  description:
    "NZX is a personal debt-payoff and budgeting planner. Enter what you owe, pick snowball or avalanche, get a month-by-month plan.",
  applicationName: "NZX",
  openGraph: {
    title: "NZX — plan your way out, month by month",
    description:
      "A clean, dark-first debt-payoff planner. Snowball or avalanche, deterministic math, optional AI assistant.",
    url: SITE_URL,
    siteName: "NZX",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "NZX", description: "Plan your way out, month by month." },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <PostHogProvider>
            <Suspense fallback={null}>
              <PageviewTracker />
            </Suspense>
            {children}
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
