import { formatCurrency } from "@/lib/utils";
import type { AppNotification, CasePriority } from "@/lib/supabase/types";

export function notificationHref(n: AppNotification) {
  if (n.type === "cash_advance_added" || n.type === "cash_advance_deleted") {
    return n.target_name || (n.actor_id && n.actor_id === n.user_id) ? "/admin/cash-advance" : "/dashboard";
  }
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
  const isOther = Boolean(n.target_name) || Boolean(n.actor_id && n.actor_id === n.user_id);
  const target = n.target_name || tCommon("user");

  if (n.type === "case_assigned") {
    if (isOther) {
      return t("caseAssignedOther", {
        actor: n.actor_name,
        target,
        case: n.case_title ?? "",
        priority: n.priority ? tPriority(n.priority) : "",
      });
    }
    return t("caseAssigned", {
      actor: n.actor_name,
      case: n.case_title ?? "",
      priority: n.priority ? tPriority(n.priority) : "",
    });
  }
  if (n.type === "cash_advance_added") {
    if (isOther) {
      return t("cashAdvanceAddedOther", {
        actor: n.actor_name,
        target,
        amount: n.amount != null ? formatCurrency(n.amount, locale) : "",
      });
    }
    return t("cashAdvanceAdded", {
      actor: n.actor_name,
      amount: n.amount != null ? formatCurrency(n.amount, locale) : "",
    });
  }
  if (n.type === "cash_advance_deleted") {
    if (isOther) {
      return t("cashAdvanceDeletedOther", {
        actor: n.actor_name,
        target,
        amount: n.amount != null ? formatCurrency(n.amount, locale) : "",
      });
    }
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

