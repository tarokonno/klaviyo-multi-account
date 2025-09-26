"use client";

import { useEffect, useMemo, useRef, useState, memo } from "react";

async function fetchAccounts() {
  const res = await fetch("/api/connected-accounts", { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

async function fetchProfiles({ accounts, overlapsExt, overlapsEmail, overlapsPhone, externalOnly, emailOnly, phoneOnly, hasExt, hasEmail, hasPhone, email_marketing, sms_marketing, sms_transactional, q, all } = {}) {
  const params = new URLSearchParams();
  if (accounts?.length) params.set("accounts", accounts.join(","));
  if (all) params.set("all", "1");
  if (overlapsExt) params.set("overlaps_ext", "1");
  if (overlapsEmail) params.set("overlaps_email", "1");
  if (overlapsPhone) params.set("overlaps_phone", "1");
  if (externalOnly) params.set("external_only", "1");
  if (emailOnly) params.set("email_only", "1");
  if (phoneOnly) params.set("phone_only", "1");
  if (hasExt) params.set("has_ext", "1");
  if (hasEmail) params.set("has_email", "1");
  if (hasPhone) params.set("has_phone", "1");
  if (email_marketing) params.set("email_marketing", email_marketing);
  if (sms_marketing) params.set("sms_marketing", sms_marketing);
  if (sms_transactional) params.set("sms_transactional", sms_transactional);
  if (q) params.set("q", q);
  const res = await fetch(`/api/profiles?${params}`, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  return json;
}

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [activeAccounts, setActiveAccounts] = useState(new Set());
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [overlapsExt, setOverlapsExt] = useState(false);
  const [overlapsEmail, setOverlapsEmail] = useState(false);
  const [overlapsPhone, setOverlapsPhone] = useState(false);
  const [externalOnly, setExternalOnly] = useState(false);
  const [emailOnly, setEmailOnly] = useState(false);
  const [phoneOnly, setPhoneOnly] = useState(false);
  const [hasExt, setHasExt] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [identifiersOpen, setIdentifiersOpen] = useState(false);
  const [overlapsOpen, setOverlapsOpen] = useState(false);
  const [emailMarketingSel, setEmailMarketingSel] = useState([]);
  const [smsMarketingSel, setSmsMarketingSel] = useState([]);
  const [smsTransactionalSel, setSmsTransactionalSel] = useState([]);
  const [emailMarketingOpen, setEmailMarketingOpen] = useState(false);
  const [smsMarketingOpen, setSmsMarketingOpen] = useState(false);
  const [smsTransactionalOpen, setSmsTransactionalOpen] = useState(false);

  const accountsRef = useRef(null);
  const identifiersRef = useRef(null);
  const overlapsRef = useRef(null);
  const emailMarketingRef = useRef(null);
  const smsMarketingRef = useRef(null);
  const smsTransactionalRef = useRef(null);

  const toggleAccount = (id) => {
    const next = new Set(activeAccounts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setActiveAccounts(next);
  };

  const selectAllAccounts = () => setActiveAccounts(new Set(accounts.map((a) => a.accountId)));
  const clearAllAccounts = () => setActiveAccounts(new Set());

  const refreshAccounts = async () => {
    const list = await fetchAccounts();
    setAccounts(list);
    setActiveAccounts(new Set(list.map((a) => a.accountId)));
  };

  const refreshProfiles = async () => {
    setLoading(true);
    try {
      const resp = await fetchProfiles({
        accounts: Array.from(activeAccounts),
        overlapsExt,
        overlapsEmail,
        overlapsPhone,
        externalOnly,
        emailOnly,
        phoneOnly,
        hasExt,
        hasEmail,
        hasPhone,
        email_marketing: emailMarketingSel.join(','),
        sms_marketing: smsMarketingSel.join(','),
        sms_transactional: smsTransactionalSel.join(','),
        q: query,
        all: true,
      });
      setProfiles(resp.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAccounts();
    refreshProfiles();
  }, []);

  // When page size or active account set changes, reset cursor and reload
  useEffect(() => {
    const id = setTimeout(() => {
      refreshProfiles();
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeAccounts,
    overlapsExt,
    overlapsEmail,
    overlapsPhone,
    externalOnly,
    emailOnly,
    phoneOnly,
    hasExt,
    hasEmail,
    hasPhone,
    emailMarketingSel,
    smsMarketingSel,
    smsTransactionalSel,
    query,
  ]);

  // Close dropdowns on outside click
  useEffect(() => {
    function onDocMouseDown(e) {
      const t = e.target;
      if (accountsOpen && accountsRef.current && !accountsRef.current.contains(t)) {
        setAccountsOpen(false);
      }
      if (identifiersOpen && identifiersRef.current && !identifiersRef.current.contains(t)) {
        setIdentifiersOpen(false);
      }
      if (overlapsOpen && overlapsRef.current && !overlapsRef.current.contains(t)) {
        setOverlapsOpen(false);
      }
      if (emailMarketingOpen && emailMarketingRef.current && !emailMarketingRef.current.contains(t)) {
        setEmailMarketingOpen(false);
      }
      if (smsMarketingOpen && smsMarketingRef.current && !smsMarketingRef.current.contains(t)) {
        setSmsMarketingOpen(false);
      }
      if (smsTransactionalOpen && smsTransactionalRef.current && !smsTransactionalRef.current.contains(t)) {
        setSmsTransactionalOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [accountsOpen, identifiersOpen, overlapsOpen, emailMarketingOpen, smsMarketingOpen, smsTransactionalOpen]);

  const visibleProfiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles
      .filter((p) => activeAccounts.has(p.accountId))
      .filter((p) => {
        if (!q) return true;
        const email = (p.email || "").toLowerCase();
        const phone = (p.phone || "").toLowerCase();
        const ext = (p.externalId || "").toLowerCase();
        return email.includes(q) || phone.includes(q) || ext.includes(q);
      });
  }, [query, activeAccounts, profiles]);

  function renderStatusBadge(status) {
    const s = (status || 'n/a').toLowerCase();
    let cls = 'bg-gray-100 text-gray-800';
    let label = 'N/A';
    if (s === 'never_subscribed') { cls = 'bg-blue-100 text-blue-800'; label = 'Never subscribed'; }
    else if (s === 'subscribed') { cls = 'bg-emerald-100 text-emerald-800'; label = 'Subscribed'; }
    else if (s === 'unsubscribed' || s === 'suppressed' || s === 'bounced') { cls = 'bg-red-100 text-red-800'; label = s.charAt(0).toUpperCase() + s.slice(1); }
    return <span className={`text-xs inline-flex items-center rounded-full px-2 py-0.5 ${cls}`}>{label}</span>;
  }

  const TableView = useMemo(() => memo(function TableViewInner({ loading, rows }) {
    return (
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="h-6 w-6 animate-spin text-gray-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
            <span className="ml-2 text-sm text-gray-600">Loading…</span>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Account</th>
                <th className="px-3 py-2 text-left">External ID</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Email marketing</th>
                <th className="px-3 py-2 text-left">SMS marketing</th>
                <th className="px-3 py-2 text-left">SMS transactional</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((p) => (
                <tr key={`${p.accountId}-${p.klaviyoId}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{p.accountName}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{p.externalId || '-'}</span>
                      {p.counts?.externalId > 1 && (
                        <span className="text-xs inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
                          {p.counts.externalId}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{p.email || '-'}</span>
                      {p.counts?.email > 1 && (
                        <span className="text-xs inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">
                          {p.counts.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span>{p.phone || '-'}</span>
                      {p.counts?.phone > 1 && (
                        <span className="text-xs inline-flex items-center rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5">
                          {p.counts.phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">{renderStatusBadge(p.subscriptionStatuses?.emailMarketing)}</td>
                  <td className="px-3 py-2">{renderStatusBadge(p.subscriptionStatuses?.smsMarketing)}</td>
                  <td className="px-3 py-2">{renderStatusBadge(p.subscriptionStatuses?.smsTransactional)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }), []);

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-lg shadow p-5">
        <div className="flex flex-col gap-4">
          {/* Prominent count + search aligned right */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-xl text-gray-800">
                Profiles
                <span className="ml-3 inline-flex items-center justify-center rounded-full bg-gray-900 text-white px-4 py-1.5 text-base">
                  {loading ? "…" : visibleProfiles.length}
                </span>
              </div>
              <button
                title="Refresh"
                onClick={() => { setAccountsOpen(false); refreshAccounts(); refreshProfiles(); }}
                className="inline-flex items-center justify-center h-9 w-9 rounded-full border bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-3-6.7"/>
                  <polyline points="21 3 21 9 15 9"/>
                </svg>
              </button>
            </div>
            <div className="w-1/3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder="Search external id, email or phone"
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {/* Accounts */}
            <div ref={accountsRef} className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase text-gray-500 mb-1">Accounts</div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setAccountsOpen((o) => !o); setIdentifiersOpen(false); setOverlapsOpen(false); }}
                  className="w-full inline-flex items-center justify-between border rounded px-3 py-2 bg-white hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer"
                >
                  <span className="text-sm text-gray-700">{activeAccounts.size} of {accounts.length} selected</span>
                  <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                </button>
                <div className={`absolute z-10 mt-2 w-full rounded-md border bg-white shadow transform will-change-transform will-change-opacity transition duration-100 ease-out origin-top ${accountsOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}>
                  <div className="p-2 border-b flex items-center justify-between">
                    <button onClick={selectAllAccounts} className="text-xs text-emerald-700 hover:underline cursor-pointer">Select all</button>
                    <button onClick={clearAllAccounts} className="text-xs text-gray-600 hover:underline cursor-pointer">Clear</button>
                  </div>
                  <div className="max-h-64 overflow-auto p-2">
                    {accounts.map((a) => (
                      <label key={a.accountId} className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeAccounts.has(a.accountId)}
                          onChange={() => toggleAccount(a.accountId)}
                        />
                        <span className="text-sm text-gray-800">{a.accountName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Identifiers */}
            <div ref={identifiersRef} className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase text-gray-500 mb-1">Identifier filters</div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setIdentifiersOpen((o) => !o); setAccountsOpen(false); setOverlapsOpen(false); }}
                  className="w-full inline-flex items-center justify-between border rounded px-3 py-2 bg-white hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer"
                >
                  <span className="text-sm text-gray-700">Select identifier filters</span>
                  <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                </button>
                <div className={`absolute z-10 mt-2 w-full rounded-md border bg-white shadow p-2 transform will-change-transform will-change-opacity transition duration-100 ease-out origin-top ${identifiersOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}>
                    <div className="text-xs font-semibold uppercase text-gray-500 mb-1">Only</div>
                    <label className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={externalOnly}
                        onChange={() => {
                          const next = !externalOnly;
                          setExternalOnly(next);
                          if (next) {
                            setEmailOnly(false);
                            setPhoneOnly(false);
                            setHasExt(false);
                            setHasEmail(false);
                            setHasPhone(false);
                          }
                        }}
                      />
                      <span className="text-sm text-gray-800">External ID only</span>
                    </label>
                    <label className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailOnly}
                        onChange={() => {
                          const next = !emailOnly;
                          setEmailOnly(next);
                          if (next) {
                            setExternalOnly(false);
                            setPhoneOnly(false);
                            setHasExt(false);
                            setHasEmail(false);
                            setHasPhone(false);
                          }
                        }}
                      />
                      <span className="text-sm text-gray-800">Email only</span>
                    </label>
                    <label className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={phoneOnly}
                        onChange={() => {
                          const next = !phoneOnly;
                          setPhoneOnly(next);
                          if (next) {
                            setExternalOnly(false);
                            setEmailOnly(false);
                            setHasExt(false);
                            setHasEmail(false);
                            setHasPhone(false);
                          }
                        }}
                      />
                      <span className="text-sm text-gray-800">Phone only</span>
                    </label>
                    <div className="text-xs font-semibold uppercase text-gray-500 mt-2 mb-1">Has</div>
                    <label className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasExt}
                        onChange={() => {
                          const next = !hasExt;
                          setHasExt(next);
                          if (next) {
                            setExternalOnly(false);
                            setEmailOnly(false);
                            setPhoneOnly(false);
                          }
                        }}
                      />
                      <span className="text-sm text-gray-800">Has External ID</span>
                    </label>
                    <label className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasEmail}
                        onChange={() => {
                          const next = !hasEmail;
                          setHasEmail(next);
                          if (next) {
                            setExternalOnly(false);
                            setEmailOnly(false);
                            setPhoneOnly(false);
                          }
                        }}
                      />
                      <span className="text-sm text-gray-800">Has Email</span>
                    </label>
                    <label className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasPhone}
                        onChange={() => {
                          const next = !hasPhone;
                          setHasPhone(next);
                          if (next) {
                            setExternalOnly(false);
                            setEmailOnly(false);
                            setPhoneOnly(false);
                          }
                        }}
                      />
                      <span className="text-sm text-gray-800">Has Phone</span>
                    </label>
                </div>
              </div>
            </div>

            {/* Account overlaps */}
            <div ref={overlapsRef} className="min-w-0">
              <div className="text-xs font-semibold uppercase text-gray-500 mb-1">Account overlaps</div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setOverlapsOpen((o) => !o); setAccountsOpen(false); setIdentifiersOpen(false); }}
                  className="w-full inline-flex items-center justify-between border rounded px-3 py-2 bg-white hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer"
                >
                  <span className="text-sm text-gray-700">Select overlaps</span>
                  <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                </button>
                <div className={`absolute z-10 mt-2 w-full rounded-md border bg-white shadow p-2 transform will-change-transform will-change-opacity transition duration-100 ease-out origin-top ${overlapsOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}`}>
                    <label className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={overlapsExt} onChange={() => setOverlapsExt(!overlapsExt)} />
                      <span className="text-sm text-gray-800">External ID</span>
                    </label>
                    <label className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={overlapsEmail} onChange={() => setOverlapsEmail(!overlapsEmail)} />
                      <span className="text-sm text-gray-800">Email</span>
                    </label>
                    <label className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={overlapsPhone} onChange={() => setOverlapsPhone(!overlapsPhone)} />
                      <span className="text-sm text-gray-800">Phone</span>
                    </label>
                </div>
              </div>
            </div>

          </div>

          {/* Subscription filters row as dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div ref={emailMarketingRef} className="relative">
              <div className="text-xs font-semibold uppercase text-gray-500 mb-1">Email marketing status</div>
              <button
                type="button"
                onClick={() => { setEmailMarketingOpen((o)=>!o); setSmsMarketingOpen(false); setSmsTransactionalOpen(false);} }
                className="w-full inline-flex items-center justify-between border rounded px-3 py-2 bg-white hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer"
              >
                <span className="text-sm text-gray-700">{emailMarketingSel.length ? emailMarketingSel.join(', ') : 'Select statuses'}</span>
                <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
              </button>
              <div className={`absolute z-10 mt-2 w-full rounded-md border bg-white shadow p-2 transform will-change-transform will-change-opacity transition duration-100 ease-out origin-top ${emailMarketingOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
                {['never_subscribed','subscribed','unsubscribed','suppressed','bounced'].map((s) => (
                  <label key={s} className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={emailMarketingSel.includes(s)} onChange={() => setEmailMarketingSel((prev)=> prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s])} />
                    <span className="text-sm text-gray-800">{s.replace('_',' ')}</span>
                  </label>
                ))}
              </div>
            </div>
            <div ref={smsMarketingRef} className="relative">
              <div className="text-xs font-semibold uppercase text-gray-500 mb-1">SMS marketing status</div>
              <button
                type="button"
                onClick={() => { setSmsMarketingOpen((o)=>!o); setEmailMarketingOpen(false); setSmsTransactionalOpen(false);} }
                className="w-full inline-flex items-center justify-between border rounded px-3 py-2 bg-white hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer"
              >
                <span className="text-sm text-gray-700">{smsMarketingSel.length ? smsMarketingSel.join(', ') : 'Select statuses'}</span>
                <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
              </button>
              <div className={`absolute z-10 mt-2 w-full rounded-md border bg-white shadow p-2 transform will-change-transform will-change-opacity transition duration-100 ease-out origin-top ${smsMarketingOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
                {['never_subscribed','subscribed','unsubscribed','suppressed','bounced'].map((s) => (
                  <label key={s} className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={smsMarketingSel.includes(s)} onChange={() => setSmsMarketingSel((prev)=> prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s])} />
                    <span className="text-sm text-gray-800">{s.replace('_',' ')}</span>
                  </label>
                ))}
              </div>
            </div>
            <div ref={smsTransactionalRef} className="relative">
              <div className="text-xs font-semibold uppercase text-gray-500 mb-1">SMS transactional status</div>
              <button
                type="button"
                onClick={() => { setSmsTransactionalOpen((o)=>!o); setEmailMarketingOpen(false); setSmsMarketingOpen(false);} }
                className="w-full inline-flex items-center justify-between border rounded px-3 py-2 bg-white hover:bg-gray-50 hover:border-gray-400 transition cursor-pointer"
              >
                <span className="text-sm text-gray-700">{smsTransactionalSel.length ? smsTransactionalSel.join(', ') : 'Select statuses'}</span>
                <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
              </button>
              <div className={`absolute z-10 mt-2 w-full rounded-md border bg-white shadow p-2 transform will-change-transform will-change-opacity transition duration-100 ease-out origin-top ${smsTransactionalOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
                {['never_subscribed','subscribed','unsubscribed','suppressed','bounced'].map((s) => (
                  <label key={s} className="flex items-center gap-2 py-1 rounded px-2 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={smsTransactionalSel.includes(s)} onChange={() => setSmsTransactionalSel((prev)=> prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s])} />
                    <span className="text-sm text-gray-800">{s.replace('_',' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Clear row */}
          <div className="flex justify-end mt-4">
            <button
              title="Clear filters"
              onClick={() => {
                setAccountsOpen(false);
                setIdentifiersOpen(false);
                setOverlapsOpen(false);
                setEmailMarketingOpen(false);
                setSmsMarketingOpen(false);
                setSmsTransactionalOpen(false);
                setExternalOnly(false);
                setEmailOnly(false);
                setPhoneOnly(false);
                setHasExt(false);
                setHasEmail(false);
                setHasPhone(false);
                setOverlapsExt(false);
                setOverlapsEmail(false);
                setOverlapsPhone(false);
                setEmailMarketingSel([]);
                setSmsMarketingSel([]);
                setSmsTransactionalSel([]);
                setQuery("");
                setActiveAccounts(new Set(accounts.map((a) => a.accountId)));
                refreshProfiles();
              }}
              className="inline-flex items-center gap-2 px-3 h-10 text-sm rounded border bg-white hover:bg-gray-50 hover:border-gray-400 cursor-pointer"
            >
              <svg className="h-4 w-4 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              <span>Clear</span>
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow overflow-hidden">
        <TableView loading={loading} rows={visibleProfiles} />
      </section>
    </div>
  );
}


