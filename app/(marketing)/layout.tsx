import { TopNav } from "@/components/landing/TopNav";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main>{children}</main>
    </div>
  );
}
