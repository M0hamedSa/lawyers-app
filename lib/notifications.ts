import { formatCurrency } from "@/lib/utils";
import type { AppNotification, CasePriority } from "@/lib/supabase/types";

export function notificationHref(n: AppNotification) {
  if (n.type === "cash_advance_added" || n.type === "cash_advance_deleted") return "/dashboard";
  if (!n.client_id) return null;
  return n.case_id ? `/clients/${n.client_id}/cases/${n.case_id}` : `/clients/${n.client_id}`;
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

export function notificationMessage(
  n: AppNotification,
  locale: string,
  t: Translate,
  tCommon: Translate,
  tPriority: (p: CasePriority) => string,
) {
  if (n.type === "case_assigned") {
    return t("caseAssigned", {
      actor: n.actor_name,
      case: n.case_title ?? "",
      priority: n.priority ? tPriority(n.priority) : "",
    });
  }
  if (n.type === "cash_advance_added") {
    return t("cashAdvanceAdded", {
      actor: n.actor_name,
      amount: n.amount != null ? formatCurrency(n.amount, locale) : "",
    });
  }
  if (n.type === "cash_advance_deleted") {
    return t("cashAdvanceDeleted", {
      actor: n.actor_name,
      amount: n.amount != null ? formatCurrency(n.amount, locale) : "",
    });
  }
  return t("newTransaction", {
    actor: n.actor_name,
    type: n.transaction_type ? tCommon(n.transaction_type) : "",
    amount: n.amount != null ? formatCurrency(n.amount, locale) : "",
    client: n.client_name ?? "",
  });
}

