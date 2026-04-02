"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, ArrowUp, ArrowDown, TrendingUp, TrendingDown, RefreshCcw, AlertCircle, Layers, ExternalLink, MessageCircle, Send, X, Bot, Sparkles, Zap, Activity, BarChart3, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Live Stock interface
interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  momentum: number;
  trend: 'bullish' | 'bearish';
  high?: number;
  low?: number;
  open?: number;
  value?: string;
}

const INDICES = [
  { id: 'all', label: 'All Indices' },
  { id: 'fno', label: 'F&O Stocks' },
  { id: 'nifty50', label: 'Nifty 50' },
  { id: 'banknifty', label: 'Bank Nifty' },
  { id: 'nifty500', label: 'Nifty 500' },
  { id: 'total', label: 'Total Market' }
];

const Sparkline = ({ trend, color }: { trend: number[], color: string }) => {
    const min = Math.min(...trend);
    const max = Math.max(...trend);
    const range = max - min || 1;
    const points = trend.map((v, i) => `${(i / (trend.length - 1)) * 60},${20 - ((v - min) / range) * 15}`).join(' ');
    return (
        <svg width="60" height="20" className="opacity-80">
            <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
        </svg>
    );
};

export default function MarketPulse() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'gainers' | 'losers' | 'breakout' | 'reversal' | 'volume'>('all');
  const [lastSyncTime, setLastSyncTime] = useState<string>('--:--:--');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    {role: 'assistant', content: "Namaste! I am your Market Pulse Pro AI. I've analyzed the current institutional flows. Type 'show me breakouts' to see my new reporting capabilities."}
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleIndexChange = (indexId: string) => {
    setCurrentIndex(indexId);
    setLoading(true);
    fetchLiveMarketData(false, indexId);
  };

  const fetchLiveMarketData = useCallback(async (isManual = false, indexId = currentIndex) => {
    if (isManual) setIsRefreshing(true);
    else if (stocks.length === 0) setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/market-data?index=${indexId}`);
      if (!response.ok) throw new Error('Market data feed interrupted');
      const data = await response.json();
      if (Array.isArray(data.stocks)) {
        setStocks(data.stocks);
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Live data feed unstable. Check connection.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [stocks.length, currentIndex]);

  useEffect(() => {
    fetchLiveMarketData();
    const interval = setInterval(() => fetchLiveMarketData(true), 15000);
    return () => clearInterval(interval);
  }, [fetchLiveMarketData]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  const stats = useMemo(() => {
    const gainers = stocks.filter(s => s.changePercent > 0);
    const losers = stocks.filter(s => s.changePercent < 0);
    const breakouts = stocks.filter(s => s.changePercent >= 1.5 && (s.high ? s.price >= s.high * 0.99 : true));
    const reversals = stocks.filter(s => {
        if (s.changePercent <= 0 || !s.low || !s.high || !s.open) return false;
        const range = s.high - s.low;
        return range > 0 && (s.open <= s.low + range * 0.25) && (s.price >= s.high - range * 0.4);
    });
    return { 
        gainers, losers, total: stocks.length, breakouts, reversals, 
        volumeShockers: stocks.filter(s => parseFloat(s.volume) > 5) 
    };
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    let result = stocks.filter(s =>
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filter === 'gainers') return stats.gainers;
    if (filter === 'losers') return stats.losers;
    if (filter === 'breakout') return stats.breakouts;
    if (filter === 'reversal') return stats.reversals;
    if (filter === 'volume') return stats.volumeShockers;
    return result;
  }, [stocks, searchQuery, filter, stats]);

  const tickerMovers = useMemo(() => [...stocks].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 15), [stocks]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user' as const, content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    try {
        const marketContext = {
            totalStocks: stats.total,
            currentIndex: INDICES.find(i => i.id === currentIndex)?.label,
            topGainers: stats.gainers.slice(0, 15).map(s => `${s.symbol} (+${s.changePercent.toFixed(2)}%)`),
            topLosers: stats.losers.slice(0, 15).map(s => `${s.symbol} (${s.changePercent.toFixed(2)}%)`),
            breakoutStocks: stats.breakouts.slice(0, 30).map(s => `${s.symbol} (+${s.changePercent.toFixed(2)}%)`),
            reversalStocks: stats.reversals.slice(0, 30).map(s => `${s.symbol} (+${s.changePercent.toFixed(2)}%)`),
            breakoutCount: stats.breakouts.length,
            reversalCount: stats.reversals.length
        };

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMsg.content, context: marketContext })
        });
        const data = await response.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: "**System Error**: Unable to reach intelligence node. Market scanning continues..." }]);
    } finally {
        setIsTyping(false);
    }
  };

  if (loading && stocks.length === 0) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center">
        <Activity className="animate-pulse text-blue-500 mb-6" size={80} strokeWidth={0.5} />
        <p className="text-white font-black tracking-[0.5em] uppercase text-xs">Market Pulse Pro</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      <div className="bg-blue-600/10 border-b border-blue-500/10 py-2 overflow-hidden whitespace-nowrap relative">
        <div className="flex animate-marquee gap-12 items-center">
            {tickerMovers.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-black tracking-widest text-white uppercase">{s.symbol}</span>
                    <span className="text-[10px] font-mono font-black text-gray-300">â‚¹{s.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
                    <span className={cn("text-[10px] font-mono font-black", s.changePercent > 0 ? "text-emerald-400" : "text-rose-400")}>({s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(2)}%)</span>
                </div>
            ))}
            {tickerMovers.map((s, i) => (
                <div key={`dup-${i}`} className="flex items-center gap-2">
                    <span className="text-[10px] font-black tracking-widest text-white uppercase">{s.symbol}</span>
                    <span className="text-[10px] font-mono font-black text-gray-300">â‚¹{s.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
                    <span className={cn("text-[10px] font-mono font-black", s.changePercent > 0 ? "text-emerald-400" : "text-rose-400")}>({s.changePercent > 0 ? '+' : ''}{s.changePercent.toFixed(2)}%)</span>
                </div>
            ))}
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
                <div className="flex items-center gap-3">
                    <Globe className="text-white animate-spin-slow" size={24} />
                    <h1 className="text-4xl font-black bg-gradient-to-r from-white via-blue-400 to-indigo-400 bg-clip-text text-transparent tracking-tighter">Command Center</h1>
                </div>
                <div className="mt-3 flex items-center gap-3 bg-white/5 border border-white/5 rounded-full px-4 py-1.5 w-fit">
                    <Bot size={14} className="text-blue-400" />
                    <p className="text-[11px] font-bold text-gray-400">
                        <span className="text-white uppercase tracking-tighter">Live Intel:</span> {stats.gainers.length > stats.losers.length ? 'Bulls dominating.' : 'Bears pushing.'} {stats.breakouts.length} breakouts detected.
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex bg-[#111] border border-gray-800 p-1 rounded-xl shadow-2xl overflow-x-auto no-scrollbar">
                    {INDICES.map((idx) => (
                        <button key={idx.id} onClick={() => handleIndexChange(idx.id)} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase whitespace-nowrap", currentIndex === idx.id ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-300")}>{idx.label}</button>
                    ))}
                </div>
                <button onClick={() => fetchLiveMarketData(true)} disabled={isRefreshing} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"><RefreshCcw size={18} className={cn(isRefreshing && "animate-spin")} /></button>
            </div>
            </div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-3xl group shadow-2xl relative overflow-hidden">
                <Zap className="absolute -right-4 -top-4 text-blue-500/10 group-hover:scale-110 transition-transform" size={120} />
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Advance / Decline</p>
                <div className="flex justify-between items-end mb-2">
                    <span className="text-3xl font-black text-emerald-500">{stats.gainers.length}</span>
                    <span className="text-3xl font-black text-rose-500">{stats.losers.length}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden flex">  
                    <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(stats.gainers.length / stats.total) * 100}%` }} />
                    <div className="bg-rose-500 h-full transition-all duration-1000" style={{ width: `${(stats.losers.length / stats.total) * 100}%` }} />
                </div>
            </div>
            <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-3xl shadow-2xl group">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Breakout Radar</p>
                <div className="flex items-center justify-between mt-2">
                    <p className="text-4xl font-black text-white">{stats.breakouts.length}</p>
                    <div className="bg-blue-500/10 p-4 rounded-2xl group-hover:bg-blue-500/20"><Sparkles className="text-blue-500" size={28} /></div>
                </div>
            </div>
            <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-3xl shadow-2xl group">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Reversal Radar</p>
                <div className="flex items-center justify-between mt-2">
                    <p className="text-4xl font-black text-white">{stats.reversals.length}</p>
                    <div className="bg-emerald-500/10 p-4 rounded-2xl group-hover:bg-emerald-500/20"><TrendingUp className="text-emerald-500" size={28} /></div>
                </div>
            </div>
            <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-3xl shadow-2xl group">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Active Universe</p>
                <div className="flex items-center justify-between mt-2">
                    <p className="text-4xl font-black text-white">{stats.total}</p>
                    <div className="bg-indigo-500/10 p-4 rounded-2xl group-hover:bg-indigo-500/20"><Activity className="text-indigo-400" size={28} /></div>
                </div>
            </div>
        </div>

        <div className="max-w-7xl mx-auto mb-6 flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400" size={20} />
                <input type="text" placeholder={`Search ${stats.total} symbols...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[#0f0f0f] border border-white/5 rounded-2xl py-5 pl-14 pr-6 focus:outline-none focus:ring-1 focus:ring-blue-500/40 font-bold text-sm shadow-2xl" />
            </div>
            <div className="flex bg-[#0f0f0f] border border-white/5 p-1 rounded-2xl shadow-2xl overflow-x-auto no-scrollbar">
                {['all', 'gainers', 'losers', 'breakout', 'reversal', 'volume'].map((f) => (
                    <button key={f} onClick={() => setFilter(f as any)} className={cn("px-5 py-2 rounded-xl text-[10px] font-black transition-all uppercase whitespace-nowrap", filter === f ? "bg-white text-black shadow-lg" : "text-gray-500 hover:text-gray-300")}>{f}</button>
                ))}
            </div>
        </div>

        <div className="max-w-7xl mx-auto bg-[#0f0f0f] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl relative">
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="px-10 py-7 text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">Institutional Symbol</th>
                    <th className="px-10 py-7 text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] text-right">Last Traded</th>
                    <th className="px-10 py-7 text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] text-right">Pro Change</th>
                    <th className="px-10 py-7 text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] text-center">Trend Pulse</th>
                    <th className="px-10 py-7 text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] text-right">Radar</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                {filteredStocks.map((stock) => {
                    const isBreakout = stats.breakouts.includes(stock);
                    const isReversal = stats.reversals.includes(stock);
                    const isVolume = stats.volumeShockers.includes(stock);
                    const trendColor = stock.changePercent > 0 ? '#10b981' : '#f43f5e';
                    const mockTrend = [stock.price * 0.98, stock.price * 1.01, stock.price * 0.99, stock.price * 1.02, stock.price];
                    return (
                    <tr key={stock.symbol} onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')} className="hover:bg-white/[0.02] transition-all group cursor-pointer origin-center">
                        <td className="px-10 py-6">
                            <div className="flex items-center gap-4">
                                <div className={cn("w-1 h-10 rounded-full", stock.changePercent > 0 ? "bg-emerald-500" : "bg-rose-500")} />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-xl text-white group-hover:text-blue-400 transition-colors">{stock.symbol}</span>
                                        {isBreakout && <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />}
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-black uppercase mt-0.5">{stock.name.split(' ')[0]} â€¢ NSE</span>
                                </div>
                            </div>
                        </td>
                        <td className="px-10 py-6 text-right font-mono font-black text-white text-lg">{stock.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-10 py-6 text-right">
                            <div className={cn("inline-flex flex-col items-end px-3 py-1 rounded-xl", stock.changePercent > 0 ? "text-emerald-500" : "text-rose-500")}>
                                <span className="text-sm font-black font-mono">{stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}</span>
                                <span className="text-[11px] font-black opacity-80 font-mono">{stock.changePercent.toFixed(2)}%</span>
                            </div>
                        </td>
                        <td className="px-10 py-6 text-center"><div className="flex justify-center"><Sparkline trend={mockTrend} color={trendColor} /></div></td>
                        <td className="px-10 py-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                                {isBreakout && <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-black">BREAKOUT</span>}
                                {isReversal && <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-black">REVERSAL</span>}
                                {isVolume && !isBreakout && !isReversal && <span className="text-[9px] bg-white text-black px-2 py-0.5 rounded-full font-black">VOL+</span>}
                                {!isBreakout && !isVolume && !isReversal && <span className="text-[9px] border border-white/10 text-gray-600 px-2 py-0.5 rounded-full font-black">STABLE</span>}
                            </div>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>
        </div>
      </div>

      <div className={cn("fixed bottom-8 right-8 z-[100] transition-all duration-500", isChatOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100")}>
        <button onClick={() => setIsChatOpen(true)} className="p-5 bg-white text-black rounded-3xl shadow-2xl hover:scale-110 active:scale-90 transition-all group border border-white/20"><Bot size={32} /></button>
      </div>

      {isChatOpen && (
        <div className="fixed inset-0 md:inset-auto md:bottom-8 md:right-8 md:w-[450px] md:h-[650px] bg-[#0a0a0a] border border-white/10 md:rounded-[2.5rem] shadow-2xl z-[100] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-white/5 bg-[#0f0f0f] flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.5)]"><Bot className="text-white" size={24} /></div>
                    <div><h3 className="font-black text-white text-lg tracking-tight">Market Intel AI</h3><p className="text-emerald-500 text-[10px] font-black tracking-widest uppercase">Institutional Access</p></div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/5 rounded-xl text-gray-500"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                {chatMessages.map((msg, i) => (
                    <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                        <div className={cn(
                            "max-w-[90%] p-6 rounded-[2rem] text-[14px] shadow-2xl",
                            msg.role === 'user' 
                                ? "bg-white text-black font-bold rounded-tr-none" 
                                : "bg-[#111] text-gray-200 border border-white/10 rounded-tl-none markdown-body"
                        )}>
                            {msg.role === 'user' ? msg.content : (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.content}
                                </ReactMarkdown>
                            )}
                        </div>
                    </div>
                ))}
                {isTyping && <div className="flex gap-2 p-4"><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" /><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" /><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" /></div>}
                <div ref={chatEndRef} />
            </div>
            <div className="p-8 bg-[#0f0f0f] border-t border-white/5">
                <div className="flex gap-3">
                    <input type="text" placeholder="Command Intel..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} className="flex-1 bg-black border border-white/10 rounded-2xl py-4 px-6 focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-sm font-bold placeholder:text-gray-700 text-white" />
                    <button onClick={handleSendMessage} className="p-4 bg-white text-black rounded-2xl hover:bg-gray-200 transition-all shadow-xl shadow-white/5"><Send size={20} /></button>
                </div>
            </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { display: flex; width: fit-content; animation: marquee 30s linear infinite; }
        .animate-spin-slow { animation: spin 10s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

