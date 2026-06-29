import React, { useState } from 'react';
import { Settings, ShieldCheck, Key, RefreshCw, Layers, ArrowRight, Plus, X, Globe, User, Check } from 'lucide-react';
import APIExplorer from '../components/APIExplorer';

export default function Integrations() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshingProvider, setRefreshingProvider] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('google');
  const [handleInput, setHandleInput] = useState('');
  const [providers, setProviders] = useState([
    { name: 'X / Twitter', handle: '@life_os_app', scopes: ['tweet.read', 'tweet.write', 'offline.access'], sync: '2 hours ago', status: 'ACTIVE' },
    { name: 'Instagram Creator', handle: 'life_os_studio', scopes: ['instagram_basic', 'instagram_content_publish'], sync: '1 hour ago', status: 'ACTIVE' },
    { name: 'Figma Developer', handle: 'Chayan Studio', scopes: ['files:read', 'widgets:write'], sync: 'Just now', status: 'ACTIVE' },
    { name: 'Notion Workspace', handle: 'Personal Brain', scopes: ['pages:read', 'blocks:write'], sync: '1 day ago', status: 'ACTIVE' },
    { name: 'Slack Integration', handle: 'Life OS Channel', scopes: ['chat:write', 'channels:read'], sync: '12m ago', status: 'ACTIVE' },
  ]);

  const handleAddConnection = () => {
    if (!handleInput) return;
    const newProv = {
      name: selectedProvider.toUpperCase(),
      handle: handleInput.startsWith('@') ? handleInput : `@${handleInput}`,
      scopes: ['read_profile', 'offline_access'],
      sync: 'Just now',
      status: 'ACTIVE'
    };
    setProviders([...providers, newProv]);
    setHandleInput('');
    setShowAddModal(false);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Introduction Card */}
      <div className="neo-surface neo-border-thick neo-shadow p-6 bg-neo-surface">
        <h2 className="neo-title-md mb-2 flex items-center gap-2">
          <ShieldCheck size={24} className="text-neo-mint" />
          Secure Integration Architecture: Nango Proxy Vault
        </h2>
        <p className="neo-body-md text-neo-text-muted">
          <strong>Hard Rule: No OAuth tokens are ever injected into the agent context.</strong> Integrations are handled by a self-hosted <strong>Nango</strong> vault. The agent only reads and writes a public <code className="bg-neo-surface-high px-1 py-0.5 neo-border text-neo-blue font-mono">connectionId</code>, while the local API server proxies network requests, injecting OAuth keys automatically at call-time.
        </p>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Connection List */}
        <div className="lg:col-span-7 neo-surface neo-border-thick neo-shadow p-5 bg-neo-surface">
          <div className="flex justify-between items-center border-b-2 border-neo-border pb-3 mb-4">
            <h3 className="neo-title-md flex items-center gap-2">
              <Key size={18} />
              OAuth Credentials Vault
            </h3>
            <button 
              onClick={() => setShowAddModal(true)} 
              className="neo-btn py-1 px-2.5 bg-neo-yellow text-xs font-bold flex items-center gap-1"
            >
              <Plus size={12} /> Add Connection
            </button>
          </div>
          
          <div className="flex flex-col gap-4">
            {providers.map((prov, idx) => (
              <div key={idx} className="p-4 bg-neo-bg neo-border flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="neo-title-md text-sm">{prov.name}</span>
                    <span className="text-xs font-mono text-neo-text-muted block mt-1">{prov.handle}</span>
                  </div>
                  <span className="neo-chip neo-chip--completed py-0.5 text-[9px]">{prov.status}</span>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {prov.scopes.map((scope, sIdx) => (
                    <span key={sIdx} className="neo-tag text-[9px] font-mono">{scope}</span>
                  ))}
                </div>

                <div className="pt-2 border-t border-neo-border border-dashed text-xs flex justify-between items-center text-neo-text-muted font-mono">
                  <span>Token Refreshed: {prov.sync}</span>
                  {refreshingProvider === prov.name ? (
                    <span className="text-[10px] text-neo-mint font-bold flex items-center gap-1"><Check size={10} /> Refreshed</span>
                  ) : (
                    <button
                      onClick={() => { setRefreshingProvider(prov.name); setTimeout(() => setRefreshingProvider(null), 2000); }}
                      className="neo-btn py-1 px-2.5 bg-neo-surface text-[10px] font-bold text-neo-text flex items-center gap-1"
                    >
                      <RefreshCw size={10} /> Force Refresh
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nango Security Flow Diagram */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="neo-surface neo-border-thick neo-shadow p-5 bg-neo-surface flex-1 flex flex-col gap-4">
            <h3 className="neo-title-md border-b-2 border-neo-border pb-3 flex items-center gap-2">
              <Layers size={18} className="text-neo-blue" />
              API Proxy Flow
            </h3>
            
            <div className="flex flex-col gap-4 text-xs font-mono">
              <div className="p-3 bg-neo-surface-muted neo-border">
                <span className="font-bold text-neo-blue">Step 1: Agent Action</span>
                <p className="mt-1 font-sans text-xs">Agent wants to read Twitter feed. Calls local curl tool with connectionId only.</p>
                <code className="text-[10px] text-neo-text-muted block mt-2">curl "http://localhost/twitter/feed?con=con_x_091"</code>
              </div>

              <div className="flex justify-center text-[var(--neo-border)]">
                <ArrowRight className="rotate-90" size={18} />
              </div>

              <div className="p-3 bg-neo-surface-muted neo-border">
                <span className="font-bold text-neo-red">Step 2: Nango Proxy Decryption</span>
                <p className="mt-1 font-sans text-xs">The API interceptor queries Nango database, decrypts the token, and attaches it as a header.</p>
                <code className="text-[10px] text-neo-text-muted block mt-2">Headers: {`{ Authorization: "Bearer xyz_oauth_token" }`}</code>
              </div>

              <div className="flex justify-center text-[var(--neo-border)]">
                <ArrowRight className="rotate-90" size={18} />
              </div>

              <div className="p-3 bg-neo-surface-muted neo-border">
                <span className="font-bold text-neo-mint">Step 3: Provider Response</span>
                <p className="mt-1 font-sans text-xs">Twitter API receives valid request and sends back data payload. Token is stripped from output logs.</p>
              </div>
            </div>

            <div className="mt-auto p-3 bg-neo-surface-high border border-[var(--neo-yellow)] neo-radius text-xs">
              <span className="font-bold block mb-1">Custom API Connectors:</span>
              <p className="text-[11px] text-neo-text-muted">
                Kite Trading API (Zerodha) and WhatsApp Business Cloud use standard envelope-encrypted DB tables instead of Nango OAuth vaults.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Full system API surface */}
      <APIExplorer />

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="neo-surface neo-border-thick shadow-[8px_8px_0_0_#1c1c0f] p-6 bg-neo-surface max-w-md w-full relative">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 neo-icon-btn p-1.5"
            >
              <X size={16} />
            </button>
            <h4 className="neo-title-md mb-4 uppercase">Authorize Nango Stream</h4>
            <div className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <label className="neo-label-sm">INTEGRATION PROVIDER</label>
                <select 
                  value={selectedProvider} 
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="neo-input w-full bg-neo-surface cursor-pointer"
                >
                  <option value="google">Google Workspace (Gmail/Calendar)</option>
                  <option value="notion">Notion Developer Portal</option>
                  <option value="slack">Slack Workspace API</option>
                  <option value="reddit">Reddit OAuth OAuth2</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-1">
                <label className="neo-label-sm">ACCOUNT HANDLE / IDENTIFIER</label>
                <input 
                  type="text" 
                  value={handleInput} 
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder="e.g. personal_workspace" 
                  className="neo-input w-full"
                />
              </div>

              <div className="p-3 bg-neo-surface-high border border-[var(--neo-yellow)] text-[11px]">
                <strong>Nango callback URL:</strong> Ready. Click AUTHORIZE to boot the local electron OAuth flow wrapper.
              </div>

              <button 
                onClick={handleAddConnection}
                className="neo-btn bg-neo-yellow py-3 px-4 neo-label-md mt-2"
              >
                AUTHORIZE SECURE CONNECTION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
