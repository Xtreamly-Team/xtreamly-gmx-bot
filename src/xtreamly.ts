require('dotenv').config();

interface Signal {
    symbol: string
    long: boolean
    short: boolean
    horizon: number
    stop_loss: number
    take_profit: number
}

export class Xtreamly {
    private baseUrl: string;
    constructor() {
        this.baseUrl = process.env.XTREAMLY_API_BASE_URL || '';
        if (!this.baseUrl) {
            throw new Error("XTREAMLY_API_BASE_URL is not set in environment variables.");
        }
    }

    async getSignals() {
        const res = await fetch(`${this.baseUrl}/api/v1/signals/latest?limit=3`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        if (!res.ok) {
            throw new Error(`Error fetching signals: ${res.status} ${res.statusText}`);
        }
        const resObj = await res.json()
        console.log(`Raw signal res obj: ${resObj}`)
        console.log(`Raw single signal: ${resObj[0]}`)
        const signals: Signal[] = resObj.map((s) => {
            return {
                symbol: s.symbol,
                long: s.signal_long,
                short: s.signal_short,
                horizon: s.horizon,
                stop_loss: s.stop_loss,
                take_profit: s.take_profit,
            }
        })
        // const signals: Signal[] = JSON.parse(resObj).map((signal: any) => ({
        //     symbol: signal.symbol,
        //     long: signal.signal_long,
        //     short: signal.signal_short,
        //     horizon: signal.horizon,
        // }));
        return signals
    }
}

