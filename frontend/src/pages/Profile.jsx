import React, { useState } from 'react';
import {
  User, Building2, KeyRound, Save, Check, CreditCard, Gauge,
  ShieldCheck, Database, Boxes, FolderGit2, Crown, ShieldAlert, Lock, Wand2
} from 'lucide-react';
import { LAYERS } from '../lib/capabilities';
import { WORKSPACE_ID_KEY } from '../lib/api';

const read = (k, fallback = '') => localStorage.getItem(k) || fallback;

const PLANS = [
  { id: 'personal', name: 'Personal', price: 'Free', features: ['1 workspace', 'Local Mac harness', 'Unlimited modules'] },
  { id: 'pro', name: 'Pro', price: '$19/mo', features: ['5 workspaces', 'Cloud bot lane', 'Priority codegen'] },
  { id: 'team', name: 'Team', price: '$49/seat', features: ['Unlimited workspaces', 'Shared modules', 'SSO + audit log'] },
];

export default function Profile() {
  const [name, setName] = useState(read('life_os_user_name', 'Chayan Aggarwal'));
  const [email] = useState(read('life_os_user_email', 'chayan@life-os.dev'));
  const [workspaceName, setWorkspaceName] = useState(read('life_os_workspace_name', 'Personal Brain'));
  const workspaceId = read(WORKSPACE_ID_KEY, 'default-personal-workspace');
  const plan = read('life_os_plan', 'personal');
  const [activePlan, setActivePlan] = useState(plan);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('life_os_user_name', name.trim());
    localStorage.setItem('life_os_workspace_name', workspaceName.trim());
    localStorage.setItem('life_os_plan', activePlan);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'LO';

  const usage = [
    { label: 'Entities stored', value: '2,481', max: '10,000', icon: Database, pct: 25 },
    { label: 'Modules installed', value: '7', max: '∞', icon: Boxes, pct: 14 },
    { label: 'Versioned files', value: '342', max: '5,000', icon: FolderGit2, pct: 7 },
    { label: 'Harness runs (mo)', value: '128', max: '1,000', icon: Gauge, pct: 13 },
  ];

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      {/* Identity header */}
      <div className="neo-surface neo-border-thick neo-shadow p-6 flex flex-col sm:flex-row items-center gap-5">
        <div className="w-20 h-20 neo-border neo-shadow bg-neo-yellow flex items-center justify-center text-2xl font-extrabold text-neo-text shrink-0">
          {initials}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="neo-title-md text-neo-text">{name}</h2>
          <p className="neo-body-md text-neo-text-muted">{email}</p>
          <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
            <span className="neo-tag bg-neo-mint text-neo-text"><ShieldCheck size={12} /> Verified owner</span>
            <span className="neo-tag bg-neo-yellow text-neo-text"><Crown size={12} /> {PLANS.find((p) => p.id === activePlan)?.name} plan</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Account settings */}
        <div className="lg:col-span-7 neo-surface neo-border-thick neo-shadow p-5 flex flex-col gap-4">
          <h3 className="neo-title-md flex items-center gap-2"><User size={18} /> Account Settings</h3>

          <label className="flex flex-col gap-1">
            <span className="neo-label-sm text-neo-text-muted">Display Name</span>
            <input className="neo-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="neo-label-sm text-neo-text-muted">Email</span>
            <input className="neo-input opacity-60 cursor-not-allowed" value={email} disabled />
          </label>

          <label className="flex flex-col gap-1">
            <span className="neo-label-sm text-neo-text-muted flex items-center gap-1"><Building2 size={12} /> Workspace Name</span>
            <input className="neo-input" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="neo-label-sm text-neo-text-muted flex items-center gap-1"><KeyRound size={12} /> Tenant ID</span>
            <code className="neo-input font-mono text-xs flex items-center text-neo-text-muted">{workspaceId}</code>
          </label>

          <button onClick={handleSave} className="neo-btn bg-neo-mint text-neo-text py-2 px-4 flex items-center justify-center gap-2 self-start">
            {saved ? <><Check size={16} /> Saved</> : <><Save size={16} /> Save Changes</>}
          </button>
        </div>

        {/* Usage */}
        <div className="lg:col-span-5 neo-surface neo-border-thick neo-shadow p-5 flex flex-col gap-4">
          <h3 className="neo-title-md flex items-center gap-2"><Gauge size={18} /> Usage</h3>
          {usage.map((u) => (
            <div key={u.label} className="flex flex-col gap-1">
              <div className="flex justify-between items-center neo-label-sm">
                <span className="flex items-center gap-1.5 text-neo-text-muted"><u.icon size={13} /> {u.label}</span>
                <span className="text-neo-text">{u.value} <span className="text-neo-text-muted">/ {u.max}</span></span>
              </div>
              <div className="h-2.5 neo-border bg-neo-surface-high">
                <div className="h-full bg-neo-blue" style={{ width: `${u.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div className="neo-surface neo-border-thick neo-shadow p-5 flex flex-col gap-4">
        <h3 className="neo-title-md flex items-center gap-2"><CreditCard size={18} /> Subscription Plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => {
            const isActive = activePlan === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePlan(p.id)}
                className={`text-left p-4 neo-border-thick transition-all flex flex-col gap-2 ${
                  isActive ? 'bg-neo-yellow text-neo-text neo-shadow' : 'bg-neo-surface hover:bg-neo-surface-high'
                }`}
              >
                <div className="flex justify-between items-baseline">
                  <span className="neo-title-md text-base">{p.name}</span>
                  <span className="neo-label-sm">{p.price}</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {p.features.map((f) => (
                    <li key={f} className="text-xs flex items-center gap-1.5 text-neo-text-muted">
                      <Check size={12} className="text-neo-blue shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                {isActive && <span className="neo-tag bg-neo-surface text-neo-text mt-1 self-start">Current</span>}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-neo-text-muted">Personal use runs entirely on your trusted Mac. Upgrading is a deployment swap, not a rewrite - multi-tenant from day one.</p>
      </div>

      {/* AI Guardrails - what AI can and cannot touch */}
      <div className="neo-surface neo-border-thick neo-shadow p-5 flex flex-col gap-3">
        <h3 className="neo-title-md flex items-center gap-2"><ShieldAlert size={18} /> AI Guardrails</h3>
        <p className="text-xs text-neo-text-muted">
          Life OS is self-evolving: AI can reshape any non-gated layer. <strong>Gated</strong> layers are human-only (no AI read/write); <strong>core</strong> layers AI can modify but never delete. Every change is reversible via VCS time-travel.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {LAYERS.map((l) => (
            <div key={l.id} className="p-3 neo-border bg-neo-surface flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-neo-text truncate">{l.label}</div>
                <div className="text-[10px] text-neo-text-muted font-mono">{l.group}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {l.gated ? (
                  <span className="neo-tag bg-neo-red text-white text-[9px]"><Lock size={9} /> gated</span>
                ) : (
                  <>
                    {l.aiCanModify && <span className="neo-tag bg-neo-mint text-neo-text text-[9px]"><Wand2 size={9} /> modify</span>}
                    {l.core
                      ? <span className="neo-tag bg-neo-yellow text-neo-text text-[9px]">core</span>
                      : l.aiCanDelete && <span className="neo-tag text-[9px]">delete</span>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
