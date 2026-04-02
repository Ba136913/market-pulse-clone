import { NextResponse } from 'next/server';

const INDEX_MAP: Record<string, string> = {
  'fno': 'SECURITIES IN F&O',
  'nifty50': 'NIFTY 50',
  'niftynext50': 'NIFTY NEXT 50',
  'banknifty': 'NIFTY BANK',
  'nifty500': 'NIFTY 500',
  'total': 'NIFTY TOTAL MARKET'
};

interface NSEItem {
  symbol: string;
  lastPrice: number;
  previousClose: number;
  change: number;
  pChange: number;
  dayHigh: number;
  dayLow: number;
  totalTradedVolume: number;
  totalTradedValue: number;
  open: number;
  isNewListing?: boolean;
  lastUpdateTime: string;
  identifier: string;
  meta?: {
    companyName?: string;
  };
}

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  value: string;
  high: number;
  low: number;
  open: number;
  isNew: boolean;
  lastUpdate: string;
  trend: 'bullish' | 'bearish';
  momentum: number;
}

const cache: Record<string, { data: { timestamp: string; count: number; marketStatus: string; stocks: Stock[] }; timestamp: number }> = {};
const CACHE_DURATION = 15000; // 15 seconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const indexKey = searchParams.get('index') || 'all';

  if (cache[indexKey] && (Date.now() - cache[indexKey].timestamp) < CACHE_DURATION) {
    return NextResponse.json(cache[indexKey].data);
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.nseindia.com/market-data/live-equity-market',
      'Cookie': 'nsit=...; nse_market_status=open'
    };

    let targetIndices = [indexKey];
    if (indexKey === 'all') {
        targetIndices = ['fno', 'nifty50', 'niftynext50', 'banknifty', 'nifty500', 'total'];
    }

    const stockMap = new Map<string, Stock>();
    let marketStatus = 'Open';

    await Promise.all(targetIndices.map(async (key) => {
        const nseIndex = INDEX_MAP[key] || INDEX_MAP['fno'];
        const url = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(nseIndex)}`;
        
        try {
            const response = await fetch(url, { headers, next: { revalidate: 0 } });
            if (!response.ok) return;
            
            const rawData = await response.json();
            if (!rawData.data) return;

            marketStatus = rawData.marketStatus?.marketStatus || marketStatus;

            rawData.data.forEach((item: NSEItem) => {
                if (stockMap.has(item.symbol)) return;

                const price = item.lastPrice;
                const pChange = item.pChange;
                const range = item.dayHigh - item.dayLow;
                const positionInRange = range > 0 ? ((price - item.dayLow) / range) : 0.5;

                stockMap.set(item.symbol, {
                    symbol: item.symbol,
                    name: item.meta?.companyName || item.identifier,
                    price,
                    change: item.change,
                    changePercent: pChange,
                    momentum: parseFloat(((pChange * 0.6) + (positionInRange * 4)).toFixed(2)),
                    volume: (item.totalTradedVolume / 100000).toFixed(2) + 'L',
                    value: (item.totalTradedValue / 10000000).toFixed(2) + 'Cr',
                    high: item.dayHigh,
                    low: item.dayLow,
                    open: item.open,
                    isNew: !!item.isNewListing,
                    lastUpdate: item.lastUpdateTime,
                    trend: pChange > 0 ? 'bullish' : 'bearish'
                });
            });
        } catch (e) {
            console.error(`Error fetching index ${key}:`, e);
        }
    }));

    const stocks = Array.from(stockMap.values()).sort((a, b) => b.changePercent - a.changePercent);

    if (stocks.length === 0 && cache[indexKey]) {
        return NextResponse.json(cache[indexKey].data);
    }

    const result = {
      timestamp: new Date().toISOString(),
      count: stocks.length,
      marketStatus,
      stocks
    };

    if (stocks.length > 0) {
        cache[indexKey] = { data: result, timestamp: Date.now() };
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Fetch Error:', error);
    return NextResponse.json({ 
        error: 'Data link unstable', 
        stocks: [], 
        fallback: true,
        timestamp: new Date().toISOString() 
    }, { status: 200 });
  }
}

