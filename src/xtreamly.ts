require('dotenv').config();

interface Signal {
    symbol: string
    long: boolean
    short: boolean
    horizon: number
    stop_loss: number
    take_profit: number
    prediction_time: string
}

export class Xtreamly {
    private baseUrl: string;
    constructor() {
        this.baseUrl = process.env.XTREAMLY_API_BASE_URL || '';
        if (!this.baseUrl) {
            throw new Error("XTREAMLY_API_BASE_URL is not set in environment variables.");
        }
    }

    async getSignals(token: string) {
        const url = `${this.baseUrl}/api/v1/signals/?skip=0&limit=300&symbol=${token}`;
        console.log(`Fetching signals from URL: ${url}`);
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.XTREAMLY_USER_MANAGEMENT_API_KEY || ''
            },
        })
        if (!res.ok) {
            throw new Error(`Error fetching signals: ${res.status} ${res.statusText}`);
        }
        const resObj = await res.json()
        const signals: Signal[] = resObj.map((s) => {
            return {
                symbol: s.symbol,
                long: s.signal_long,
                short: s.signal_short,
                horizon: s.horizon,
                stop_loss: s.stop_loss,
                take_profit: s.take_profit,
                prediction_time: s.prediction_time,
            }
        })
        return signals
    }
}

