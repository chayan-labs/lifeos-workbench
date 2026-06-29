import React, { useState } from 'react';
import { Boxes, Zap, History } from 'lucide-react';
import Tabs from '../components/ui/Tabs';
import AgentHarness from './AgentHarness';
import SelfExtension from './SelfExtension';
import HarnessLoop from './HarnessLoop';

// Merges the three harness surfaces (previously separate nav items) into one
// page with tabs: Compose (agent layering), Build (self-extension), Loop
// (observe/eval/release runs).
const TABS = [
  { id: 'compose', label: 'Compose', icon: Boxes },
  { id: 'build', label: 'Build', icon: Zap },
  { id: 'loop', label: 'Loop', icon: History },
];

export default function Harness() {
  const [tab, setTab] = useState('compose');
  return (
    <div className="flex flex-col gap-6">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'compose' && <AgentHarness />}
      {tab === 'build' && <SelfExtension />}
      {tab === 'loop' && <HarnessLoop />}
    </div>
  );
}
