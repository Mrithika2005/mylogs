/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Terminal, 
  Shield, 
  Database, 
  Globe, 
  Briefcase, 
  AlertCircle, 
  Clock,
  Filter,
  BarChart3,
  Layers,
  Copy,
  ChevronRight,
  Code2,
  Activity,
  XOctagon,
  Search,
  CreditCard,
  Zap,
  Lock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { LogLevel, LogLayer, LogRecord, LogLayer as LogLayerEnum } from './mylogs';
import type { BizRecord, SecRecord, PaymentRecord, HttpRecord } from './mylogs';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LAYER_COLORS: Record<string, string> = {
  DOMAIN: '#3b82f6',
  PRESENTATION: '#10b981',
  SECURITY: '#8b5cf6',
  PAYMENT: '#f59e0b',
  GATEWAY: '#06b6d4',
  PERSISTENCE: '#f97316',
  INFRA: '#64748b',
  APPLICATION: '#ec4899',
  OBSERVABILITY: '#84cc16',
};

const LAYER_ICONS: Record<string, React.ReactNode> = {
  DOMAIN: <Briefcase className="w-3.5 h-3.5" />,
  PRESENTATION: <Globe className="w-3.5 h-3.5" />,
  SECURITY: <Shield className="w-3.5 h-3.5" />,
  PAYMENT: <CreditCard className="w-3.5 h-3.5" />,
  GATEWAY: <Zap className="w-3.5 h-3.5" />,
  PERSISTENCE: <Database className="w-3.5 h-3.5" />,
  INFRA: <Terminal className="w-3.5 h-3.5" />,
  SECURITY_ALT: <Lock className="w-3.5 h-3.5" />,
};

export default function App() {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null);
  const [filterLayer, setFilterLayer] = useState<string>('ALL');
  const [filterLevel, setFilterLevel] = useState<number | 'ALL'>('ALL');
  const [filterService, setFilterService] = useState<string>('ALL');
  const [showSetup, setShowSetup] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error('Failed to fetch logs', e);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    });
  };

  const stats = useMemo(() => {
    const counts = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.FATAL]: 0,
    };
    const layers: Record<string, number> = {};
    const services: Record<string, number> = {};

    logs.forEach(log => {
      counts[log.level as keyof typeof counts]++;
      layers[log.layer] = (layers[log.layer] || 0) + 1;
      if (log.service) services[log.service] = (services[log.service] || 0) + 1;
    });

    const levelData = [
      { name: 'Debug', count: counts[LogLevel.DEBUG], color: '#94a3b8' },
      { name: 'Info', count: counts[LogLevel.INFO], color: '#3b82f6' },
      { name: 'Warn', count: counts[LogLevel.WARN], color: '#f59e0b' },
      { name: 'Error', count: counts[LogLevel.ERROR], color: '#ef4444' },
      { name: 'Fatal', count: counts[LogLevel.FATAL], color: '#7f1d1d' },
    ];

    const layerData = Object.entries(layers).map(([name, value]) => ({
      name,
      value,
      color: LAYER_COLORS[name] || '#64748b'
    }));
    const serviceData = Object.entries(services).map(([name, value]) => ({ name, value }));

    return { levelData, layerData, serviceData, total: logs.length };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const layerMatch = filterLayer === 'ALL' || log.layer === filterLayer;
      const levelMatch = filterLevel === 'ALL' || log.level === filterLevel;
      const serviceMatch = filterService === 'ALL' || log.service === filterService;
      return layerMatch && levelMatch && serviceMatch;
    });
  }, [logs, filterLayer, filterLevel, filterService]);

  // ── Inspector sub-panels ──────────────────────────────────────────────────
  const renderInspectorExtras = (log: LogRecord) => {
    if (log.layer === LogLayerEnum.DOMAIN) {
      const r = log as BizRecord;
      return (
        <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10">
          <h4 className="text-xs font-black text-blue-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
            <Briefcase className="w-3.5 h-3.5" /> Aggregate State Metadata
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <InfoCell label="Entity Pointer" value={`${r.entity_type} / ${r.entity_id}`} color="text-blue-300" />
            <InfoCell label="Domain Event" value={r.event_name} color="text-green-400" />
            {r.prev_state && <InfoCell label="Prev State" value={r.prev_state} color="text-slate-400" />}
            {r.next_state && <InfoCell label="Next State" value={r.next_state} color="text-emerald-400" />}
            {r.saga_id && <InfoCell label="Saga ID" value={r.saga_id} color="text-purple-300" />}
            {r.rule_id && <InfoCell label="Rule ID" value={r.rule_id} color="text-amber-300" />}
          </div>
        </div>
      );
    }

    if (log.layer === LogLayerEnum.SECURITY) {
      const r = log as SecRecord;
      return (
        <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/10">
          <h4 className="text-xs font-black text-purple-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
            <Shield className="w-3.5 h-3.5" /> Security Event Detail
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <InfoCell label="Action" value={r.action} color="text-red-400" />
            {r.actor_id && <InfoCell label="Actor ID" value={r.actor_id} color="text-purple-300" />}
            {r.cve && <InfoCell label="CVE Reference" value={r.cve} color="text-orange-400" />}
          </div>
          {r.action && ['AUTH_FAIL', 'PRIV_ESCALATE', 'WAF_BLOCK'].includes(r.action) && (
            <div className="mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> High-risk security event — immediate review recommended
            </div>
          )}
        </div>
      );
    }

    if (log.layer === LogLayerEnum.PAYMENT) {
      const r = log as PaymentRecord;
      const amountFormatted = (r.amount_minor / 100).toFixed(2);
      return (
        <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10">
          <h4 className="text-xs font-black text-amber-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
            <CreditCard className="w-3.5 h-3.5" /> Payment Event Detail
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <InfoCell label="Payment Event" value={r.payment_event} color="text-amber-300" />
            <InfoCell label="Payment ID" value={r.payment_id} color="text-slate-300" mono />
            <InfoCell label="Amount" value={`${r.currency} ${amountFormatted}`} color="text-green-400" />
            <InfoCell label="Gateway" value={r.gateway.toUpperCase()} color="text-blue-300" />
            {r.card_last4 && <InfoCell label="Card Last 4" value={`•••• ${r.card_last4}`} color="text-slate-400" />}
            {r.gateway_code && <InfoCell label="Gateway Code" value={r.gateway_code} color="text-red-400" />}
            {r.order_id && <InfoCell label="Order ID" value={r.order_id} color="text-purple-300" mono />}
            {r.is_dispute && (
              <div className="col-span-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-black uppercase tracking-wider">
                ⚠ Disputed Charge
              </div>
            )}
          </div>
        </div>
      );
    }

    if (log.layer === LogLayerEnum.GATEWAY) {
      const r = log as HttpRecord;
      const isError = r.status_code >= 400;
      return (
        <div className="p-5 rounded-2xl bg-cyan-500/5 border border-cyan-500/10">
          <h4 className="text-xs font-black text-cyan-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5" /> HTTP Gateway Detail
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <InfoCell label="Method" value={r.method} color="text-cyan-300" />
            <InfoCell label="Status Code" value={String(r.status_code)} color={isError ? 'text-red-400' : 'text-green-400'} />
            <InfoCell label="URL" value={r.url} color="text-slate-300" mono />
            {r.latency_ms !== undefined && <InfoCell label="Latency" value={`${r.latency_ms}ms`} color={r.latency_ms > 1000 ? 'text-red-400' : 'text-green-400'} />}
            <InfoCell label="Rate Limited" value={r.rate_limited ? 'YES' : 'NO'} color={r.rate_limited ? 'text-red-400' : 'text-slate-400'} />
            {r.bot_score !== undefined && <InfoCell label="Bot Score" value={String(r.bot_score)} color={r.bot_score > 70 ? 'text-red-400' : 'text-slate-400'} />}
          </div>
        </div>
      );
    }

    return null;
  };

  const setupSteps = [
    {
      num: '01',
      title: 'Install SDK',
      code: `npm install @enterprise/mylogs-sdk`,
      lang: 'bash',
    },
    {
      num: '02',
      title: 'Configure the Registry',
      code: `import { LoggerRegistry } from '@enterprise/mylogs-sdk';

// Point to your dashboard gateway (only needed for cross-domain)
LoggerRegistry.setCollectorUrl('https://your-dashboard.internal/api/logs');
LoggerRegistry.setBatchCollectorUrl('https://your-dashboard.internal/api/logs/batch');`,
      lang: 'ts',
    },
    {
      num: '03',
      title: 'Log Domain Events',
      code: `const orderLogger = LoggerRegistry.getDomainLogger('checkout-service', 'prod');

orderLogger.info('Order payment confirmed', {
  event_name: 'order_paid',
  entity_type: 'Order',
  entity_id: 'ord_9182',
  prev_state: 'pending_payment',
  next_state: 'paid',
  saga_id: 'checkout-saga-77',
});`,
      lang: 'ts',
    },
    {
      num: '04',
      title: 'Log Payment Events',
      code: `const payLogger = LoggerRegistry.getPaymentLogger('payment-service', 'prod');

// ⚠ PiiScrubEnricher is auto-wired — billing_address & cardholder_name
//   are stripped before any handler sees the record.
payLogger.info('Charge successful', {
  payment_event: 'CHARGE_SUCCESS',
  payment_id: 'ch_stripe_abc123',
  currency: 'INR',
  amount_minor: 49900, // ₹499.00 in paise
  gateway: 'razorpay',
  card_last4: '4242',
  order_id: 'ord_9182',
});`,
      lang: 'ts',
    },
    {
      num: '05',
      title: 'Log Security Events',
      code: `const secLogger = LoggerRegistry.getSecurityLogger('identity-service', 'prod');

// Only WARN and above are forwarded (MinLevelHandler is auto-wired).
secLogger.fatal('Privilege escalation attempt blocked', {
  action: 'PRIV_ESCALATE',
  actor_id: 'user_ext_771',
});`,
      lang: 'ts',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                mylogs{' '}
                <span className="text-blue-500 text-xs font-mono ml-2 uppercase tracking-widest border border-blue-500/20 px-1.5 rounded">
                  SDK GATEWAY
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowSetup(!showSetup)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700"
            >
              <Code2 className="w-4 h-4" />
              SDK Setup Guide
            </button>
            <div className="h-6 w-px bg-slate-800 mx-2" />
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-green-500 bg-green-500/5 px-3 py-1.5 border border-green-500/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              SYSTEM READY
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Service Affinity Chart */}
          <section className="col-span-12 lg:col-span-8 bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-slate-400">
                <BarChart3 className="w-4 h-4" />
                <h2 className="text-sm font-semibold uppercase tracking-wider">Service Affinity (Traffic)</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-mono">POLLING 2s</span>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              </div>
            </div>
            <div className="h-64 w-full">
              {stats.serviceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.serviceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-600 italic text-sm">
                  Awaiting first signal from external application...
                </div>
              )}
            </div>
          </section>

          {/* Layer Health Donut */}
          <section className="col-span-12 lg:col-span-4 bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-6 text-slate-400">
              <Layers className="w-4 h-4" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Layer Health</h2>
            </div>
            <div className="h-48 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.layerData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {stats.layerData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center pointer-events-none">
                <span className="text-3xl font-bold">{stats.total}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-tighter">Records</span>
              </div>
            </div>
            {/* Layer legend */}
            <div className="mt-4 space-y-1.5">
              {stats.layerData.map(l => (
                <div key={l.name} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-slate-400 font-mono">{l.name}</span>
                  </div>
                  <span className="text-slate-500">{l.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Severity stat cards */}
          {stats.levelData.slice(1).map(s => (
            <div key={s.name} className="col-span-6 md:col-span-3 lg:col-span-2 xl:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{s.name}s</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-2xl font-bold">{s.count}</span>
                <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: s.color }} />
              </div>
            </div>
          ))}

          {/* Filters */}
          <div className="col-span-12 bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mr-2">
              <Filter className="w-3 h-3 text-blue-500" /> Filter Context
            </div>

            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
              <select
                value={filterService}
                onChange={e => setFilterService(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-blue-500 transition-all appearance-none min-w-[160px]"
              >
                <option value="ALL">All Applications</option>
                {stats.serviceData.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            <select
              value={filterLayer}
              onChange={e => setFilterLayer(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            >
              <option value="ALL">All Layers</option>
              {Object.values(LogLayerEnum).map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            >
              <option value="ALL">All Severities</option>
              <option value={LogLevel.DEBUG}>Debug</option>
              <option value={LogLevel.INFO}>Info</option>
              <option value={LogLevel.WARN}>Warn</option>
              <option value={LogLevel.ERROR}>Error</option>
              <option value={LogLevel.FATAL}>Fatal</option>
            </select>

            <div className="ml-auto flex items-center gap-4">
              <span className="text-[10px] text-slate-600 font-mono">{filteredLogs.length} records</span>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors uppercase font-bold tracking-tighter"
              >
                Purge Memory Buffer
              </button>
            </div>
          </div>

          {/* Log Stream Table */}
          <section className="col-span-12 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto min-h-[500px]">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 bg-slate-900 z-10 border-b border-slate-800 shadow-sm">
                  <tr className="bg-slate-800/20">
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[9px] w-44">Timestamp (UTC)</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[9px] w-40">Source App</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[9px] w-24">Severity</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[9px] w-32">Layer</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[9px]">Message</th>
                    <th className="px-6 py-4 text-right w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  <AnimatePresence initial={false}>
                    {filteredLogs.length > 0 ? (
                      filteredLogs.map(log => (
                        <motion.tr
                          key={log.record_id}
                          initial={{ opacity: 0, scale: 0.995 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="group hover:bg-white/[0.02] transition-all cursor-default"
                        >
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-500 border-r border-slate-800/10">
                            {new Date(log.timestamp).toISOString().split('T')[1].replace('Z', '')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500/40" />
                              <span className="text-[11px] font-bold text-slate-300 tracking-tight">
                                {log.service || 'UNNAMED_SVC'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              'px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter',
                              log.level === LogLevel.INFO && 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
                              log.level === LogLevel.WARN && 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
                              log.level === LogLevel.ERROR && 'bg-red-500/10 text-red-500 border border-red-500/20',
                              log.level === LogLevel.FATAL && 'bg-red-600 text-white shadow-lg shadow-red-500/20',
                              log.level <= LogLevel.DEBUG && 'bg-slate-800 text-slate-500 border border-slate-700',
                            )}>
                              {LogLevel[log.level]}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <span style={{ color: LAYER_COLORS[log.layer] || '#64748b' }}>
                                {LAYER_ICONS[log.layer] || <Activity className="w-3.5 h-3.5" />}
                              </span>
                              <span className="text-[10px] font-mono font-bold" style={{ color: LAYER_COLORS[log.layer] || '#64748b' }}>
                                {log.layer}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-200 font-medium font-sans max-w-md truncate">
                            {log.message}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="text-[10px] font-bold text-slate-500 hover:text-blue-400 transition-colors uppercase tracking-widest flex items-center justify-end gap-1"
                            >
                              OBJ <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-40">
                          <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-6">
                            <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center animate-pulse">
                              <Database className="w-10 h-10 text-slate-700" />
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-xl font-bold text-slate-200">Awaiting SDK Signal</h3>
                              <p className="text-sm text-slate-500 leading-relaxed">
                                No application has connected to the SDK gateway yet.
                              </p>
                            </div>
                            <button
                              onClick={() => setShowSetup(true)}
                              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-xl shadow-blue-600/10 transition-all active:scale-95"
                            >
                              View Setup Instructions
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* ── SETUP GUIDE MODAL ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSetup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSetup(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-800 bg-slate-800/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center">
                    <Code2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Importing mylogs SDK</h2>
                    <p className="text-sm text-slate-500">v3 — with PaymentLogger, PiiScrubEnricher, BatchLogHandler & MinLevelHandler</p>
                  </div>
                </div>
                <button onClick={() => setShowSetup(false)} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                  <XOctagon className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                {setupSteps.map(step => (
                  <div key={step.num} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-black">
                        {step.num}
                      </span>
                      <h3 className="font-bold text-base">{step.title}</h3>
                    </div>
                    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-800/30">
                        <span className="text-[10px] text-slate-500 font-mono uppercase">{step.lang}</span>
                        <button
                          onClick={() => copyToClipboard(step.code, step.num)}
                          className="text-[10px] text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          {copiedKey === step.num ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="p-5 text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto whitespace-pre">
                        {step.code}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-slate-800/40 border-t border-slate-800 text-center">
                <p className="text-sm text-slate-400 mb-4">
                  SDK auto-wires PiiScrubEnricher, MinLevelHandler & BatchLogHandler per logger type.
                </p>
                <button
                  onClick={() => setShowSetup(false)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/10"
                >
                  Understood, I'm ready to integrate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── LOG INSPECTOR DRAWER ──────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-[60] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-slate-950 border-l border-slate-800 h-full flex flex-col"
            >
              {/* Drawer header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
                    <Terminal className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">High Fidelity Inspector</h3>
                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest truncate max-w-xs">
                      {selectedLog.record_id}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                  <XOctagon className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Message */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <span className="text-[10px] text-slate-500 uppercase font-black mb-3 block tracking-widest">Message</span>
                  <p className="text-lg font-medium text-slate-100 leading-normal">"{selectedLog.message}"</p>
                </div>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Severity', value: LogLevel[selectedLog.level], color: 'text-blue-400' },
                    { label: 'Context Layer', value: selectedLog.layer, color: LAYER_COLORS[selectedLog.layer] ? undefined : 'text-green-400', style: LAYER_COLORS[selectedLog.layer] },
                    { label: 'Origin Service', value: selectedLog.service, color: 'text-amber-400' },
                    { label: 'Environment', value: selectedLog.env?.toUpperCase(), color: 'text-purple-400' },
                    { label: 'Timestamp', value: selectedLog.timestamp, color: 'text-slate-400' },
                    { label: 'Trace ID', value: selectedLog.trace_id || '—', color: 'text-slate-500' },
                  ].map(field => (
                    <div key={field.label} className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800">
                      <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">{field.label}</span>
                      <span
                        className={cn('text-xs font-bold font-mono tracking-tight', field.color)}
                        style={field.style ? { color: field.style } : undefined}
                      >
                        {field.value || 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Layer-specific panel */}
                {renderInspectorExtras(selectedLog)}

                {/* Raw JSON */}
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Raw Ingested Frame</span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(selectedLog, null, 2), 'raw')}
                      className="text-[10px] text-blue-500 border border-blue-500/30 px-2 py-0.5 rounded hover:bg-blue-500/10 transition-colors uppercase font-bold"
                    >
                      {copiedKey === 'raw' ? 'Copied!' : 'Copy JSON'}
                    </button>
                  </div>
                  <div className="bg-black/40 rounded-2xl border border-slate-800 p-5">
                    <pre className="text-[11px] font-mono text-blue-300/80 leading-relaxed overflow-x-auto">
                      {JSON.stringify(selectedLog, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Drawer footer */}
              <div className="p-6 border-t border-slate-800 bg-slate-900/40">
                <button className="w-full h-11 bg-white text-black font-black rounded-xl text-sm transition-all hover:bg-slate-200 active:scale-95 shadow-lg">
                  OPEN IN EXTERNAL TRACE EXPLORER
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shared sub-component ─────────────────────────────────────────────────────
function InfoCell({
  label,
  value,
  color,
  mono,
}: {
  label: string;
  value?: string;
  color?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] text-slate-500 uppercase font-black tracking-wider mb-0.5">{label}</p>
      <p className={cn('text-xs font-bold break-all', color, mono && 'font-mono')}>{value || '—'}</p>
    </div>
  );
}
