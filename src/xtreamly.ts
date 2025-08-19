class Xtreamly {
    private baseUrl: string;
    constructor() {
        this.baseUrl = process.env.XTREAMLY_API_BASE_URL || '';
        if (!this.baseUrl) {
            throw new Error("XTREAMLY_API_BASE_URL is not set in environment variables.");
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
            throw new Error(`Error fetching signals: ${res.status} ${res.statusText}`);
        }
        const resObj = await res.json()
        const signals = JSON.parse(resObj)
        return signals
    }
}
