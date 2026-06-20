'use client';

import { useState, useEffect } from 'react';

interface SegmentSize {
  id: string;
  name: string;
  currentSize: number;
  meetsMinimum: boolean;
  minSize: number;
  platforms: string[];
  objective: string;
}

interface ClusterEntry {
  cluster: string;
  count: number;
}

interface SyncEntry {
  segmentId: string;
  platform: string;
  syncedAt: string;
  userCount: number;
  success: boolean;
  errorMessage: string | null;
}

interface AnalyticsData {
  totalUsers: number;
  segmentSizes: SegmentSize[];
  clusterDistribution: ClusterEntry[];
  tierDistribution: ClusterEntry[];
  recentSyncs: SyncEntry[];
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const adminSecret = localStorage.getItem('ADMIN_SECRET');
    if (!adminSecret) {
      setError('ADMIN_SECRET not found in localStorage. Set it first.');
      setLoading(false);
      return;
    }

    fetch('/api/admin/analytics', {
      headers: { Authorization: `Bearer ${adminSecret}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d as AnalyticsData);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white/60">Loading...</div>;
  if (error) return <div className="min-h-screen bg-black flex items-center justify-center text-red-400">{error}</div>;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold text-[#FFDF00] mb-6">Admin Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card title="Total Users" value={data.totalUsers} />
        <Card title="Segments" value={data.segmentSizes.length} />
        <Card title="Recent Syncs" value={data.recentSyncs.length} />
      </div>

      <Section title="Audience Segments">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.segmentSizes.map(s => (
            <div key={s.id} className="bg-[#00381a] rounded p-3 border border-white/10">
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-bold text-[#FFDF00]">{s.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${s.meetsMinimum ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                  {s.currentSize}/{s.minSize}
                </span>
              </div>
              <div className="text-xs text-white/50 mb-1">{s.objective} · {s.platforms.join(', ')}</div>
              <div className="text-lg font-bold">{s.currentSize}</div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Section title="Cluster Distribution">
          {data.clusterDistribution.map(c => (
            <div key={c.cluster} className="flex justify-between py-1 border-b border-white/5">
              <span className="text-sm">{c.cluster}</span>
              <span className="text-sm font-bold text-[#FFDF00]">{c.count}</span>
            </div>
          ))}
          {data.clusterDistribution.length === 0 && <p className="text-white/40 text-sm">No data yet</p>}
        </Section>

        <Section title="Hot Lead Tiers">
          {data.tierDistribution.map(t => (
            <div key={t.cluster} className="flex justify-between py-1 border-b border-white/5">
              <span className="text-sm">Tier {t.cluster}</span>
              <span className="text-sm font-bold text-[#FFDF00]">{t.count}</span>
            </div>
          ))}
          {data.tierDistribution.length === 0 && <p className="text-white/40 text-sm">No data yet</p>}
        </Section>
      </div>

      <Section title="Recent Sync History" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs border-b border-white/10">
                <th className="text-left py-2 px-2">Segment</th>
                <th className="text-left py-2 px-2">Platform</th>
                <th className="text-right py-2 px-2">Users</th>
                <th className="text-center py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.recentSyncs.map((s, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-1.5 px-2 text-xs">{s.segmentId}</td>
                  <td className="py-1.5 px-2 text-xs">{s.platform}</td>
                  <td className="py-1.5 px-2 text-xs text-right">{s.userCount}</td>
                  <td className="py-1.5 px-2 text-xs text-center">
                    {s.success ? '✅' : '❌'}
                  </td>
                  <td className="py-1.5 px-2 text-xs text-white/50">
                    {new Date(s.syncedAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
              {data.recentSyncs.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-white/40">No syncs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-[#00381a] rounded p-4 border border-white/10">
      <div className="text-xs text-white/50 mb-1">{title}</div>
      <div className="text-2xl font-bold text-[#FFDF00]">{value}</div>
    </div>
  );
}

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-lg font-bold text-[#55e0a0] mb-3">{title}</h2>
      <div className="bg-[rgba(0,56,26,0.3)] rounded p-4 border border-white/5">
        {children}
      </div>
    </div>
  );
}
