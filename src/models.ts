export class Bot {
    id: number;
    walletAddress: string;
    walletPrivateKey: string;
    exchange: string;
    token: 'ETH' | 'SOL' | 'BTC';
    positionSize: number;
    leverage: number;
    initialized: boolean;
    active: boolean;
    metadata: Record<string, any>;

    constructor(
        id: number,
        walletAddress: string,
        walletPrivateKey: string,
        exchange: string,
        token: 'ETH' | 'SOL' | 'BTC',
        positionSize: number,
        leverage: number,
        initialized: boolean,
        active: boolean,
        metadata: Record<string, any>
    ) {
        this.id = id;
        this.walletAddress = walletAddress;
        this.walletPrivateKey = walletPrivateKey;
        this.exchange = exchange;
        this.token = token;
        this.positionSize = positionSize;
        this.leverage = leverage;
        this.initialized = initialized;
        this.active = active;
        this.metadata = metadata;
    }

    static fromObject(obj: Record<string, any>): Bot {
        return new Bot(
            obj.id,
            obj.wallet_address,
            obj.wallet_privatekey,
            obj.exchange,
            obj.token,
            obj.position_size,
            obj.leverage,
            obj.initialized,
            obj.active,
            obj.metadata
        )
    }
}

export class Policy {
    signalHorizonMin: number;
    keepStrategyHorizonMin: number;

    constructor(signalHorizonMin: number = 240, keepStrategyHorizonMin: number = 240) {
        this.signalHorizonMin = signalHorizonMin;
        this.keepStrategyHorizonMin = keepStrategyHorizonMin;
    }
}
