import { logger } from "./logging";
export class YieldGenerator {
    private yieldGenerationUrl: string;

    constructor(yieldGenerationUrl: string) {
        this.yieldGenerationUrl = yieldGenerationUrl;
    }

    async deposit(privateKey: string): Promise<any> {
        const url = new URL(`${this.yieldGenerationUrl}/collect_and_deposit`);
        url.searchParams.append("wallet", privateKey);

        const res = await fetch(url.toString(), { method: "POST" });
        const data = await res.json();

        logger.info(data);
        return data;
    }

    async withdraw(privateKey: string): Promise<any> {
        const url = new URL(`${this.yieldGenerationUrl}/withdraw`);
        url.searchParams.append("wallet", privateKey);

        const res = await fetch(url.toString(), { method: "POST" });
        const data = await res.json();

        logger.info(data);
        return data;
    }
}

