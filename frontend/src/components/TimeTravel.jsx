import React, { useState, useEffect } from 'react';
import {
  GitCommit, History, RotateCcw, FileClock, Lock, Check, ShieldCheck, ChevronDown, ChevronRight, Anchor
} from 'lucide-react';
import {
  listCommits, commit, restoreSnapshot, restoreFile, dirtyKeys, ensureBaseline, TRACKED_KEYS
} from '../lib/vcs';

// VCS + time-travel surface. The history is append-only and human-driven; AI is
// gated from it entirely. Restore is full-snapshot by default with a per-file
// option (the user chose "both").

const fileLabel = (k) =>
  k.replace(/^life_os_/, '').replace(/^KA_/, 'atlas:').replace(/_V1$/, '').replace(/_/g, ' ');

export default function TimeTravel() {
  const [commits, setCommits] = useState([]);
  const [dirty, setDirty] = useState([]);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [flash, setFlash] = useState('');

  const refresh = () => {
    ensureBaseline();
    setCommits([...listCommits()].reverse()); // newest first
    setDirty(dirtyKeys());
  };

  useEffect(() => { refresh(); }, []);

  const doCommit = () => {
    commit(message || 'Manual checkpoint', 'user');
    setMessage('');
    setFlash('Committed');
    refresh();
    setTimeout(() => setFlash(''), 1500);
  };

  const doRestore = (id) => {
    if (!window.confirm('Jump the whole app back to this point? A new restore commit will be appended (history is never erased).')) return;
    restoreSnapshot(id);
    setFlash('Restored snapshot');
    refresh();
    setTimeout(() => setFlash(''), 1500);
  };

  const doRestoreFile = (id, key) => {
    restoreFile(id, key);
    setFlash(`Restored ${fileLabel(key)}`);
    refresh();
    setTimeout(() => setFlash(''), 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* AI-gated banner */}
      <div className="neo-surface neo-border-thick neo-shadow p-4 flex items-start gap-3 bg-neo-surface">
        <ShieldCheck size={22} className="text-neo-mint shrink-0 mt-0.5" />
        <div>
          <h3 className="neo-label-md text-neo-text flex items-center gap-2">Version Control <span className="neo-tag bg-neo-red text-white"><Lock size={10} /> AI-GATED</span></h3>
          <p className="text-xs text-neo-text-muted mt-1">
            Every change you or the AI make can be committed here. History is append-only - restoring a past point appends a new commit, so you can always move forward again. <strong>AI can never commit, rewrite, or delete history.</strong> Only you drive time-travel.
          </p>
        </div>
      </div>

      {/* Working tree + commit */}
      <div className="neo-surface neo-border-thick neo-shadow p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="neo-title-md flex items-center gap-2"><GitCommit size={18} /> Commit current state</h3>
          {flash && <span className="neo-tag bg-neo-mint text-neo-text"><Check size={11} /> {flash}</span>}
        </div>
        <p className="text-xs text-neo-text-muted">
          {dirty.length === 0
            ? 'Working tree clean - nothing changed since the last commit.'
            : `${dirty.length} change${dirty.length > 1 ? 's' : ''} since last commit: ${dirty.map(fileLabel).join(', ')}`}
        </p>
        <div className="flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message (e.g. 'added Spanish domain')"
            className="neo-input text-sm flex-1"
          />
          <button onClick={doCommit} className="neo-btn bg-neo-mint text-neo-text py-2 px-4 text-xs flex items-center gap-2">
            <GitCommit size={14} /> Commit
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="neo-surface neo-border-thick neo-shadow p-5 flex flex-col gap-3">
        <h3 className="neo-title-md flex items-center gap-2"><History size={18} /> Timeline ({commits.length})</h3>
        <div className="flex flex-col gap-2">
          {commits.map((c) => {
            const isOpen = expanded === c.id;
            const keys = Object.keys(c.snapshot || {});
            return (
              <div key={c.id} className={`neo-border ${c.baseline ? 'bg-neo-yellow/15 border-neo-blue' : 'bg-neo-surface'}`}>
                <div className="flex items-center gap-2 p-3">
                  <button onClick={() => setExpanded(isOpen ? null : c.id)} className="text-neo-text-muted shrink-0">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {c.baseline ? <Anchor size={14} className="text-neo-blue shrink-0" /> : <GitCommit size={14} className="text-neo-text-muted shrink-0" />}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-bold text-neo-text truncate">{c.message}</span>
                    <span className="text-[10px] font-mono text-neo-text-muted">
                      {c.hash} · {c.author}{c.baseline ? ' · protected baseline' : ''} · {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => doRestore(c.id)}
                    className="neo-btn bg-neo-surface-high text-neo-text py-1 px-2 text-[10px] flex items-center gap-1 shrink-0"
                    title="Jump the whole app to this point"
                  >
                    <RotateCcw size={11} /> Jump here
                  </button>
                </div>
                {isOpen && (
                  <div className="px-3 pb-3 pt-0 border-t border-neo-border flex flex-col gap-1">
                    <span className="neo-label-sm text-neo-text-muted text-[10px] mt-2 flex items-center gap-1"><FileClock size={11} /> Files in this commit</span>
                    {keys.length === 0 && <span className="text-[11px] text-neo-text-muted">empty</span>}
                    {keys.map((k) => (
                      <div key={k} className="flex items-center justify-between text-[11px] py-0.5">
                        <span className="font-mono text-neo-text truncate">{fileLabel(k)}</span>
                        <button onClick={() => doRestoreFile(c.id, k)} className="text-neo-blue hover:underline shrink-0 ml-2">restore this file</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
