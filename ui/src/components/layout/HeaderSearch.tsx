import { useState, useRef, useEffect } from 'react';
import Icon from '../common/Icon';
import { useLayoutStore } from '../../store/layout';
import { useConnectionStore } from '../../store/connections';

export default function HeaderSearch() {
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestTab = useLayoutStore((s) => s.requestTab);
  const setActiveModule = useLayoutStore((s) => s.setActiveModule);
  const sshConns = useConnectionStore((s) => s.connections);
  const dbConns = useConnectionStore((s) => s.dbConnections);

  useEffect(() => {
    if (!focus) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setFocus(false);
        setActiveIdx(0);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [focus]);

  const results = (() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const items: { label: string; sub: string; type: string; connId: number; icon: string }[] = [];
    sshConns.forEach((c) => {
      if (c.name.toLowerCase().includes(q) || c.host.toLowerCase().includes(q) || ((c as any).tag || '').toLowerCase().includes(q)) {
        items.push({ label: c.name, sub: `${c.host}:${c.port}`, type: 'ssh', connId: c.id, icon: 'terminal' });
      }
    });
    dbConns.forEach((c) => {
      if (c.name.toLowerCase().includes(q) || c.host.toLowerCase().includes(q)) {
        items.push({ label: c.name, sub: `${c.host}:${c.port}`, type: 'database', connId: c.id, icon: 'database' });
      }
    });
    return items.slice(0, 8);
  })();

  const open = (item: { type: string; connId: number; label: string }) => {
    setActiveModule(item.type === 'database' ? 'database' : 'ssh');
    requestTab({ id: `${item.type}-${item.connId}-${Date.now()}`, title: item.label, type: item.type === 'database' ? 'database' : 'ssh', connId: item.connId });
    setQuery('');
    setFocus(false);
    setActiveIdx(0);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!focus || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => (i + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => (i - 1 + results.length) % results.length); }
    else if (e.key === 'Enter') { e.preventDefault(); open(results[activeIdx]); }
    else if (e.key === 'Escape') { setFocus(false); inputRef.current?.blur(); }
  };

  return (
    <div ref={ref} style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', borderRadius: 6, padding: '0 8px', height: 26, width: 360, background: '#1f2335',
        border: focus ? '1px solid #7aa2f7' : '1px solid #3b4261',
        boxShadow: focus ? '0 0 0 2px rgba(122,162,247,0.25)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        <Icon name="search" size={13} color="#565f89" />
        <input ref={inputRef} className="header-search" value={query} onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
          onFocus={() => setFocus(true)} onKeyDown={onKey}
          placeholder="Search..."
          style={{ flex: 1, background: 'none', border: 'none', color: '#c0caf5', fontSize: 14, outline: 'none', marginLeft: 6 }} />
        {query && (
          <span onClick={() => { setQuery(''); setFocus(false); }}
            style={{ cursor: 'pointer', color: '#565f89', display: 'flex' }}><Icon name="x" size={12} /></span>
        )}
      </div>
      {focus && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', width: 360, zIndex: 5000,
          background: '#1f2335', border: '1px solid #3b4261', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}>
          {results.map((r, i) => (
            <div key={i} onMouseDown={(e) => { e.preventDefault(); open(r); }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: i === activeIdx ? '#2a2e42' : 'transparent',
                borderBottom: i < results.length - 1 ? '1px solid #3b4261' : 'none',
              }}>
              <Icon name={r.icon} size={14} color="#7aa2f7" />
              <span style={{ color: '#c0caf5', fontSize: 14, flex: 1 }}>{r.label}</span>
              <span style={{ color: '#565f89', fontSize: 12 }}>{r.sub}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
