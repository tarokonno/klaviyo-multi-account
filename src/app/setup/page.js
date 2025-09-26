"use client";

import { useEffect, useState } from "react";

async function fetchConnected() {
  const res = await fetch("/api/connected-accounts", { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}

async function disconnectAccount(accountId) {
  await fetch(`/api/connected-accounts/${accountId}`, { method: "DELETE" });
}

async function syncNow(accountId) {
  const params = accountId ? `?accountId=${accountId}` : "";
  const res = await fetch(`/api/klaviyo/sync${params}`, { method: "POST" });
  return res.json();
}

export default function SetupPage() {
  const [accounts, setAccounts] = useState([]);
  const [confirm, setConfirm] = useState({ open: false, type: null, account: null });
  const refresh = async () => setAccounts(await fetchConnected());
  useEffect(() => { refresh(); }, []);

  // Auto-poll while any account is syncing
  useEffect(() => {
    const anyRunning = accounts.some((a) => a.sync?.state === 'running');
    if (!anyRunning) return;
    const id = setInterval(() => { refresh(); }, 1500);
    return () => clearInterval(id);
  }, [accounts]);

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg shadow p-5">
        <h2 className="text-lg font-semibold mb-4">Tenant</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tenant Name</label>
            <input type="text" defaultValue="Acme Holdings" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tenant ID</label>
            <input type="text" defaultValue="tnt_123" disabled className="w-full border rounded px-3 py-2 bg-gray-100" />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Connected Klaviyo Accounts</h2>
          <div className="flex gap-2">
              <a href="/api/auth/klaviyo/authorize" className="px-3 py-2 rounded-md bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700">Connect another account</a>
              <button
                onClick={() => setConfirm({ open: true, type: 'syncAll', account: null })}
                className="px-3 py-2 rounded-md bg-gray-900 text-white cursor-pointer hover:bg-gray-800"
              >
                Sync all
              </button>
          </div>
        </div>
        <div className="divide-y border rounded-md">
          {accounts.length === 0 && (
            <div className="p-4 text-sm text-gray-600">No accounts connected yet.</div>
          )}
          {accounts.map((a) => (
            <div key={a.accountId} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{a.accountName}</div>
                <div className="text-xs text-gray-500">ID: {a.accountId}</div>
                <div className="mt-2">
                  {a.sync?.state === 'running' ? (
                    <>
                      <div className="h-2 w-64 bg-gray-200 rounded overflow-hidden">
                        {a.sync?.total ? (
                          <div
                            className="h-full bg-emerald-600 transition-all"
                            style={{ width: `${Math.min(100, Math.round(((a.sync?.processed || 0) / Math.max(a.sync?.total || 1, 1)) * 100))}%` }}
                          />
                        ) : (
                          <div className="h-full w-1/3 bg-gradient-to-r from-emerald-500 to-emerald-300 animate-pulse" />
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Syncing… {a.sync?.processed ?? 0}{a.sync?.total ? ` / ${a.sync.total}` : ''}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-64 bg-gray-200 rounded overflow-hidden">
                        <div className="h-full w-full bg-gray-300" />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Synced {a.sync?.processed ?? 0} profiles</div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  className="px-3 py-2 rounded-md bg-gray-200 cursor-pointer hover:bg-gray-300"
                  onClick={() => setConfirm({ open: true, type: 'syncOne', account: a })}
                >
                  Sync now
                </button>
                <button
                  className="px-3 py-2 rounded-md bg-red-100 text-red-700 cursor-pointer hover:bg-red-200"
                  onClick={() => setConfirm({ open: true, type: 'disconnect', account: a })}
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      {confirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white shadow p-5">
            <div className="text-lg font-semibold mb-2">
              {confirm.type === 'disconnect' && 'Disconnect account'}
              {confirm.type === 'syncAll' && 'Sync all accounts'}
              {confirm.type === 'syncOne' && `Sync ${confirm.account?.accountName}`}
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {confirm.type === 'disconnect' && 'Are you sure you want to disconnect this account? This will remove its cached profiles.'}
              {confirm.type === 'syncAll' && 'Start a full backfill for all connected accounts now? This may take a few minutes.'}
              {confirm.type === 'syncOne' && 'Start a full backfill for this account now? This may take a few minutes.'}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-2 rounded border cursor-pointer hover:bg-gray-50" onClick={() => setConfirm({ open: false, type: null, account: null })}>Cancel</button>
              <button
                className="px-3 py-2 rounded bg-gray-900 text-white cursor-pointer hover:bg-gray-800"
                onClick={async () => {
                  if (confirm.type === 'disconnect' && confirm.account) {
                    await disconnectAccount(confirm.account.accountId);
                    await refresh();
                  } else if (confirm.type === 'syncAll') {
                    // Close modal immediately, then kick off
                    setConfirm({ open: false, type: null, account: null });
                    await syncNow();
                    return;
                  } else if (confirm.type === 'syncOne' && confirm.account) {
                    setConfirm({ open: false, type: null, account: null });
                    await syncNow(confirm.account.accountId);
                    return;
                  }
                  setConfirm({ open: false, type: null, account: null });
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


