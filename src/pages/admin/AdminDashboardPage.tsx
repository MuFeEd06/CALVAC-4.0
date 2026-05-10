import { useEffect, useMemo, useState } from 'react';
import { fetchAdminOrders, updateOrderNotes, updateOrderStatus } from '@/api/admin';
import type { AdminOrder } from '@/types/admin';

const STATUSES: AdminOrder['status'][] = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

const STATUS_COLORS: Record<AdminOrder['status'], string> = {
  Pending:   '#f59e0b',
  Confirmed: '#3b82f6',
  Shipped:   '#8b5cf6',
  Delivered: '#10b981',
  Cancelled: '#ef4444',
};

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export default function AdminDashboardPage() {
  const [orders, setOrders]   = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState<'all' | AdminOrder['status']>('all');

  const load = () => {
    setLoading(true);
    setError('');
    fetchAdminOrders()
      .then(data => { setOrders(data); setError(''); })
      .catch(() => setError(
        isLocal
          ? 'Could not reach the orders API. This usually happens in local dev because the Flask admin session cookie belongs to calvac.in — deploy to Vercel or open calvac.in/admin to manage orders.'
          : 'Failed to load orders. Please refresh or check your connection.'
      ))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => filter === 'all' ? orders : orders.filter(o => o.status === filter),
    [orders, filter],
  );

  const saveStatus = async (id: number, status: AdminOrder['status']) => {
    const res = await updateOrderStatus(id, status);
    if (res.success) setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  const saveNotes = async (id: number, notes: string) => {
    const res = await updateOrderNotes(id, notes);
    if (res.success) setOrders(prev => prev.map(o => o.id === id ? { ...o, notes } : o));
  };

  return (
    <section className="admin-panel">
      <div className="admin-section-head">
        <h2>Orders {orders.length > 0 && <span style={{ fontSize: '0.8rem', color: '#5a6a7a', fontWeight: 400 }}>({orders.length} total)</span>}</h2>
        <div className="admin-filters">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          {STATUSES.map(s => (
            <button key={s} type="button" className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Local dev notice */}
      {isLocal && !loading && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.82rem', color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
          <span>
            <strong>Local development:</strong> The orders API requires a Flask admin session from{' '}
            <a href="https://calvac.in" target="_blank" rel="noopener" style={{ color: '#2B9FD8', fontWeight: 600 }}>calvac.in</a>.
            Products and Settings work fine here. Deploy to Vercel to manage orders.
          </span>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: '#5a6a7a' }}>
          <div style={{ width: 18, height: 18, border: '2px solid #d0e6f5', borderTopColor: '#2B9FD8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading orders…
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {error && !loading && (
        <div className="admin-error" style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ flexShrink: 0 }}>⚠️</span>
          <div>
            <div>{error}</div>
            {!isLocal && (
              <button onClick={load} style={{ marginTop: 6, background: 'none', border: '1px solid #fecdd3', borderRadius: 6, padding: '4px 10px', color: '#b91c1c', cursor: 'pointer', fontSize: '0.8rem' }}>
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9badb8' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>📦</div>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>No {filter === 'all' ? '' : filter.toLowerCase()} orders yet</p>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} style={{ marginTop: 8, background: 'none', border: '1px solid #d0e6f5', borderRadius: 6, padding: '5px 14px', color: '#2B9FD8', cursor: 'pointer', fontSize: '0.82rem' }}>
              Show all orders
            </button>
          )}
        </div>
      )}

      <div className="admin-orders">
        {filtered.map(order => (
          <article key={order.id} className="admin-order-card">
            <div className="admin-order-top">
              <div>
                <p className="order-id">#{String(order.id).padStart(4, '0')}</p>
                <h3>{order.name}</h3>
                <p>{order.phone}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: '1.05rem' }}>₹{order.total.toLocaleString('en-IN')}</strong>
                <div style={{ marginTop: 4 }}>
                  <span style={{
                    display: 'inline-block', fontSize: '0.7rem', fontWeight: 700,
                    padding: '2px 8px', borderRadius: 20,
                    background: `${STATUS_COLORS[order.status]}18`,
                    color: STATUS_COLORS[order.status],
                    border: `1px solid ${STATUS_COLORS[order.status]}44`,
                  }}>
                    {order.status}
                  </span>
                </div>
              </div>
            </div>

            <p className="order-address">
              📍 {order.line1}, {order.city}, {order.state} — {order.pin}
            </p>

            {/* Items */}
            {order.items?.length > 0 && (
              <div style={{ margin: '8px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {order.items.map((item, i) => (
                  <span key={i} style={{ fontSize: '0.75rem', background: '#eaf3fa', border: '1px solid #d0e6f5', borderRadius: 6, padding: '2px 8px', color: '#5a6a7a' }}>
                    {item.name} × {item.qty} {item.size ? `(${item.size})` : ''}
                  </span>
                ))}
              </div>
            )}

            <div className="admin-order-controls">
              <select value={order.status} onChange={e => saveStatus(order.id, e.target.value as AdminOrder['status'])}
                style={{ borderLeft: `3px solid ${STATUS_COLORS[order.status]}` }}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                defaultValue={order.notes || ''}
                placeholder="Add order notes…"
                onBlur={e => saveNotes(order.id, e.target.value)}
              />
            </div>

            {order.created_at && (
              <p style={{ fontSize: '0.72rem', color: '#9badb8', marginTop: 6 }}>
                🕐 {new Date(order.created_at).toLocaleString('en-IN')}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
