export class YieldGenerator {
    private yieldGenerationUrl: string;

    constructor(yieldGenerationUrl: string) {
        this.yieldGenerationUrl = yieldGenerationUrl;
    }

    async deposit(privateKey: string, amount: number): Promise<any> {
        const url = new URL(`${this.yieldGenerationUrl}/deposit`);
        url.searchParams.append("wallet", privateKey);
        url.searchParams.append("amount", amount.toString());

        const res = await fetch(url.toString(), { method: "POST" });
        const data = await res.json();

        console.log(data);
        return data;
    }

    async withdraw(privateKey: string): Promise<any> {
        const url = new URL(`${this.yieldGenerationUrl}/withdraw`);
        url.searchParams.append("wallet", privateKey);

        const res = await fetch(url.toString(), { method: "POST" });
        const data = await res.json();

        console.log(data);
        return data;
    }
}

