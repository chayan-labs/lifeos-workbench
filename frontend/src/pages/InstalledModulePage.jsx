import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { apiCall } from '../lib/api';
import { getModule } from '../lib/moduleRegistry';
import GenericList from '../core/renderers/GenericList';

// Landing page for a module that hot-installed via the self-extension
// stream (issue #29) - there is no full manifest-driven module yet (that's
// a later epic), so this honestly renders a generic list of the module's
// entities rather than pretending to have bespoke views.
export default function InstalledModulePage() {
  const { id } = useParams();
  const manifest = getModule(id);
  const [entities, setEntities] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    apiCall('GET', `/api/entity?module=${encodeURIComponent(id)}`).then(({ ok, data, offline }) => {
      if (offline) { setState('offline'); return; }
      setEntities(ok ? data || [] : []);
      setState('ready');
    });
  }, [id]);

  return (
    <div className="flex flex-col gap-6">
      <div className="neo-surface neo-border-thick neo-shadow p-6 bg-neo-surface">
        <h2 className="neo-title-md mb-2 flex items-center gap-2">
          <Sparkles size={22} /> {manifest?.name || id}
        </h2>
        <p className="neo-body-md text-neo-text-muted">
          Hot-installed via self-extension - this generic list renders its entities directly
          ({'module: ' + id}) until a full manifest (views/board/calendar/...) ships for it.
        </p>
      </div>
      <div className="neo-surface neo-border-thick neo-shadow p-5 bg-neo-surface">
        {state === 'offline' && <p className="text-xs text-neo-red font-bold">Backend unreachable.</p>}
        {state === 'ready' && <GenericList entities={entities} display={{ title: 'title', badge: 'type' }} />}
      </div>
    </div>
  );
}
