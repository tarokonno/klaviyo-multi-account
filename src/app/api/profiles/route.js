import { NextResponse } from "next/server";
import { getCachedProfiles } from "@/lib/store";
import { getConnections } from "@/lib/store";
import { backfillAll } from "@/lib/sync";

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}
function normalizePhone(phone) {
  if (!phone) return "";
  const trimmed = String(phone).trim();
  // Simple normalization: keep leading + and digits
  const kept = trimmed.replace(/[^+\d]/g, "");
  return kept.startsWith("+") ? kept : kept.replace(/^0+/, "");
}

function parseList(param) {
  if (!param) return [];
  return param.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function normalizeConsent(value) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  if (v === "subscribed" || v.includes("opt_in") || v === "true") return "subscribed";
  if (v === "unsubscribed" || v.includes("opt_out") || v === "false") return "unsubscribed";
  return v; // fallback
}

function classifyEmailSuppression(reasonRaw) {
  const r = String(reasonRaw || "").toLowerCase();
  // Treat common bounce indicators as bounced
  const bounceKeywords = [
    "bounce",
    "hard_bounce",
    "soft_bounce",
    "mailbox_full",
    "invalid",
    "undeliverable",
    "rejected",
    "policy",
    "blocked",
    "spam_block",
  ];
  if (bounceKeywords.some((k) => r.includes(k))) return "bounced";
  return "suppressed";
}

export async function GET(request) {
  const { nextUrl } = request;
  const q = (nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const accounts = (nextUrl.searchParams.get("accounts") || "").split(",").filter(Boolean);
  const overlapsExt = nextUrl.searchParams.get("overlaps_ext") === "1";
  const overlapsEmail = nextUrl.searchParams.get("overlaps_email") === "1";
  const overlapsPhone = nextUrl.searchParams.get("overlaps_phone") === "1";
  const externalOnly = nextUrl.searchParams.get("external_only") === "1";
  const emailOnly = nextUrl.searchParams.get("email_only") === "1";
  const phoneOnly = nextUrl.searchParams.get("phone_only") === "1";
  const hasExt = nextUrl.searchParams.get("has_ext") === "1";
  const hasEmail = nextUrl.searchParams.get("has_email") === "1";
  const hasPhone = nextUrl.searchParams.get("has_phone") === "1";
  const allFlag = nextUrl.searchParams.get("all") === "1";
  const emailMarketingFilters = parseList(nextUrl.searchParams.get("email_marketing"));
  const smsMarketingFilters = parseList(nextUrl.searchParams.get("sms_marketing"));
  const smsTransactionalFilters = parseList(nextUrl.searchParams.get("sms_transactional"));
  const sizeParam = nextUrl.searchParams.get("size");
  const size = allFlag ? Infinity : Math.max(1, Math.min(Number(sizeParam || 100000), 100000));
  const cursor = nextUrl.searchParams.get("cursor") || undefined;

  let all = getCachedProfiles();
  // Debug header to see cache size at a glance
  // If cache is empty but connections exist, trigger a background backfill to warm cache
  if (all.length === 0) {
    const conns = getConnections();
    if (conns.length > 0) {
      // Fire and forget
      backfillAll(conns, 100).catch(() => {});
    }
  }
  all = getCachedProfiles();
  let rows = all;
  if (accounts.length > 0) {
    const set = new Set(accounts);
    rows = rows.filter((r) => set.has(r.accountId));
  }
  if (q) {
    const qDigits = q.replace(/\D+/g, "");
    rows = rows.filter((r) => {
      const ext = (r.externalId || "").trim().toLowerCase();
      const em = normalizeEmail(r.email);
      const phDigits = normalizePhone(r.phone).replace(/\D+/g, "");
      return (
        (!!ext && ext.includes(q)) ||
        (!!em && em.includes(q)) ||
        (!!phDigits && !!qDigits && phDigits.includes(qDigits))
      );
    });
  }

  // Identifier-only filters (exclusive)
  if (externalOnly) {
    rows = rows.filter((r) => r.externalId && !r.email && !r.phone);
  }
  if (emailOnly) {
    rows = rows.filter((r) => r.email && !r.phone && !r.externalId);
  }
  if (phoneOnly) {
    rows = rows.filter((r) => r.phone && !r.email && !r.externalId);
  }

  // Has-identifier filters (non-exclusive, intersect if multiple)
  if (hasExt) rows = rows.filter((r) => !!r.externalId);
  if (hasEmail) rows = rows.filter((r) => !!normalizeEmail(r.email));
  if (hasPhone) rows = rows.filter((r) => !!normalizePhone(r.phone));

  // Compute overlaps by externalId, email, phone (across different accounts)
  const overlapExt = new Set();
  const overlapEmail = new Set();
  const overlapPhone = new Set();

  const byExt = new Map();
  const byEmail = new Map();
  const byPhone = new Map();
  for (const r of rows) {
    if (r.externalId) {
      const k = `ext:${r.externalId.toLowerCase()}`;
      const list = byExt.get(k) || [];
      list.push(r);
      byExt.set(k, list);
    }
    const em = normalizeEmail(r.email);
    if (em) {
      const k = `em:${em}`;
      const list = byEmail.get(k) || [];
      list.push(r);
      byEmail.set(k, list);
    }
    const ph = normalizePhone(r.phone);
    if (ph) {
      const k = `ph:${ph}`;
      const list = byPhone.get(k) || [];
      list.push(r);
      byPhone.set(k, list);
    }
  }
  const markOverlaps = (map, set) => {
    for (const [, list] of map) {
      const accountsSet = new Set(list.map((r) => r.accountId));
      if (accountsSet.size > 1) {
        for (const r of list) set.add(`${r.accountId}:${r.klaviyoId}`);
      }
    }
  };
  markOverlaps(byExt, overlapExt);
  markOverlaps(byEmail, overlapEmail);
  markOverlaps(byPhone, overlapPhone);

  if (overlapsExt || overlapsEmail || overlapsPhone) {
    rows = rows.filter((r) => {
      const key = `${r.accountId}:${r.klaviyoId}`;
      return (
        (overlapsExt && overlapExt.has(key)) ||
        (overlapsEmail && overlapEmail.has(key)) ||
        (overlapsPhone && overlapPhone.has(key))
      );
    });
  }

  // Stable sort by email then account for predictability
  rows.sort((a, b) => (normalizeEmail(a.email) || "").localeCompare(normalizeEmail(b.email) || "") || a.accountId.localeCompare(b.accountId));

  // Enrich with overlap counts per identifier
  const emailCounts = new Map();
  const extCounts = new Map();
  const phoneCounts = new Map();
  for (const r of rows) {
    const em = normalizeEmail(r.email);
    if (em) emailCounts.set(em, (emailCounts.get(em) || 0) + 1);
    if (r.externalId) {
      const k = r.externalId.toLowerCase();
      extCounts.set(k, (extCounts.get(k) || 0) + 1);
    }
    const ph = normalizePhone(r.phone);
    if (ph) phoneCounts.set(ph, (phoneCounts.get(ph) || 0) + 1);
  }
  const dataRaw = rows.map((r) => {
    const em = normalizeEmail(r.email);
    const ph = normalizePhone(r.phone);
    // derive display-friendly subscription statuses
    const subs = r.subscriptions || {};
    const emailMarketing = subs?.email?.marketing || {};
    const emailSupp = Array.isArray(emailMarketing?.suppression) ? emailMarketing.suppression : [];
    // Default statuses
    let emailMarketingStatus = "n/a";
    let smsMarketingStatus = "n/a";
    let smsTransactionalStatus = "n/a";

    // Email marketing status: suppression overrides consent when email exists
    if (em) {
      if (emailSupp.length > 0) {
        // Reasons like USER_SUPPRESSED, INVALID_EMAIL, HARD_BOUNCE
        emailMarketingStatus = classifyEmailSuppression(emailSupp[0]?.reason);
      } else {
        emailMarketingStatus = normalizeConsent(emailMarketing?.consent) || "never_subscribed";
      }
    }
    const smsMarketing = subs?.sms?.marketing || {};
    const smsTransactional = subs?.sms?.transactional || {};
    if (ph) {
      smsMarketingStatus = normalizeConsent(smsMarketing?.consent) || "never_subscribed";
      smsTransactionalStatus = normalizeConsent(smsTransactional?.consent) || "never_subscribed";
    }
    return {
      ...r,
      counts: {
        email: em ? emailCounts.get(em) || 0 : 0,
        externalId: r.externalId ? extCounts.get(r.externalId.toLowerCase()) || 0 : 0,
        phone: ph ? phoneCounts.get(ph) || 0 : 0,
      },
      subscriptionStatuses: {
        emailMarketing: emailMarketingStatus,
        smsMarketing: smsMarketingStatus,
        smsTransactional: smsTransactionalStatus,
      },
    };
  });

  // Apply subscription filters if provided
  let data = dataRaw;
  const norm = (s) => String(s || "").toLowerCase();
  if (emailMarketingFilters.length > 0) {
    const set = new Set(emailMarketingFilters.map(norm));
    data = data.filter((r) => set.has(norm(r.subscriptionStatuses?.emailMarketing)));
  }
  if (smsMarketingFilters.length > 0) {
    const set = new Set(smsMarketingFilters.map(norm));
    data = data.filter((r) => set.has(norm(r.subscriptionStatuses?.smsMarketing)));
  }
  if (smsTransactionalFilters.length > 0) {
    const set = new Set(smsTransactionalFilters.map(norm));
    data = data.filter((r) => set.has(norm(r.subscriptionStatuses?.smsTransactional)));
  }

  // Cursor pagination over the sorted cached list
  const startIndex = cursor ? Number(cursor) : 0;
  const page = data.slice(startIndex, startIndex + size);
  const nextIndex = startIndex + page.length;
  const links = Number.isFinite(size) && page.length === size && nextIndex < rows.length ? { next: String(nextIndex) } : {};

  return NextResponse.json({ data: page, links, total: rows.length });
}


