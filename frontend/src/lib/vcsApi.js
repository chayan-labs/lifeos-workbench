// Thin wrapper over the real lifeos-vcs HTTP surface (issues #86/#87).
// TimeTravel.jsx is the only caller; kept separate from lib/vcs.js, which
// versions browser-only app settings via localStorage - a different concern
// from committed file content living in lifeos-vcs's CAS.

import { apiCall } from './api';

export async function listFileEntities() {
  const { ok, data, error } = await apiCall('GET', '/api/entity?module=files&type=file');
  if (!ok) throw new Error(error || 'failed to list files');
  return data || [];
}

export async function commitFile({ entityId, name, contentBase64, message }) {
  const { ok, data, error } = await apiCall('POST', '/api/vcs/commit', {
    entity_id: entityId || undefined,
    name,
    content_base64: contentBase64,
    message,
  });
  if (!ok) throw new Error(error || 'commit failed');
  return data;
}

export async function getHistory(entityId) {
  const { ok, data, error } = await apiCall('GET', `/api/vcs/history?entity_id=${encodeURIComponent(entityId)}`);
  if (!ok) throw new Error(error || 'history failed');
  return data || [];
}

export async function getDiff({ entityId, oldRef, newRef }) {
  const q = new URLSearchParams({ entity_id: entityId, old: oldRef, ...(newRef ? { new: newRef } : {}) });
  const { ok, data, error } = await apiCall('GET', `/api/vcs/diff?${q.toString()}`);
  if (!ok) throw new Error(error || 'diff failed');
  return data;
}

export async function listRefs(kind) {
  const { ok, data, error } = await apiCall('GET', `/api/vcs/refs?kind=${kind}`);
  if (!ok) throw new Error(error || 'refs failed');
  return data || [];
}

export async function createBranch(name) {
  const { ok, data, error } = await apiCall('POST', '/api/vcs/branch', { name });
  if (!ok) throw new Error(error || 'branch failed');
  return data;
}

export async function createTag(name) {
  const { ok, data, error } = await apiCall('POST', '/api/vcs/tag', { name });
  if (!ok) throw new Error(error || 'tag failed');
  return data;
}

export async function readSnapshot(snapshotRef) {
  const { ok, data, error } = await apiCall('GET', `/api/vcs/snapshot?snapshot_ref=${encodeURIComponent(snapshotRef)}`);
  if (!ok) throw new Error(error || 'snapshot failed');
  return data;
}

// UTF-8 safe base64 encode for small text commits made from the browser.
export function textToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
