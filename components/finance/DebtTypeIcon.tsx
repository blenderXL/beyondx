import {
  Briefcase,
  Car,
  Gift,
  CreditCard,
  Building2,
  Stethoscope,
  Home,
  HandCoins,
  GraduationCap,
  Landmark,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";
import type { DebtType } from "@/lib/finance/types";

/**
 * One vector icon per debt type, reused everywhere a debt is shown (cards, payoff
 * order, the form's type picker) so a debt is recognizable at a glance. Add a new
 * debt type → add its icon here (the unit test enforces full coverage).
 */
export const DEBT_TYPE_ICONS: Record<DebtType, LucideIcon> = {
  loan_401k: Briefcase,
  auto: Car,
  savings_club: Gift,
  credit_card: CreditCard,
  home_equity: Building2,
  medical: Stethoscope,
  mortgage: Home,
  personal_loan: HandCoins,
  student: GraduationCap,
  loan: Landmark,
  other: CircleDollarSign,
};

export function DebtTypeIcon({
  type,
  className = "size-4",
}: {
  type: DebtType;
  className?: string;
}) {
  const Icon = DEBT_TYPE_ICONS[type];
  return <Icon className={className} aria-hidden />;
}
