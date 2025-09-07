require('dotenv').config();

export class Xtreamly {
    private baseUrl: string;
    
    constructor() {
        this.baseUrl = process.env.SIGNAL_API_BASE_URL || '';
        
        if (!this.baseUrl) {
            throw new Error("SIGNAL_API_BASE_URL is not set in environment variables.");
        }
    }

    async getSignals() {
        const res = await fetch(`${this.baseUrl}/signal?pwd=xxx`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        if (!res.ok) {
            if (res.status === 404) {
                throw new Error(`Signal endpoint not found. Status: ${res.status}`);
            } else {
                throw new Error(`Error fetching signals: ${res.status} ${res.statusText}`);
            }
        }
        const signals = await res.json()
        return signals.map((signal: any) => ({
            symbol: signal.symbol,
            long: signal.signal_long,
            short: signal.signal_short,
            horizon: signal.horizon,
        }));
    }
}

interface Signal {
    symbol: string
    long: boolean
    short: boolean
    horizon: number
}
