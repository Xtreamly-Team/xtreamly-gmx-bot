export class Bot {
    id: number;
    walletAddress: string;
    walletPrivateKey: string;
    exchange: string;
    token: string;
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
        token: string,
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
}

export class Policy {
    signalHorizonMin: number;
    keepStrategyHorizonMin: number;

    constructor(signalHorizonMin: number = 240, keepStrategyHorizonMin: number = 60) {
        this.signalHorizonMin = signalHorizonMin;
        this.keepStrategyHorizonMin = keepStrategyHorizonMin;
    }
}
