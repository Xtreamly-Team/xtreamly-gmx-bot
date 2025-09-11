import { Client } from 'pg';
import dotenv from 'dotenv';
import { Bot } from './models';
import { secretManager, SecretManagerClient } from './secret_manager';

dotenv.config();

export class DB {
    protected client: Client;

    constructor(
        host: string,
        user: string,
        password: string,
        name: string,
    ) {
        this.client = new Client({
            host: host,
            user: user,
            password: password,
            database: name,
            ssl: {
                rejectUnauthorized: false,
            },
            connectionTimeoutMillis: 5000,
        });
    }

    async connect() {
        try {
            await this.client.connect();
        } catch (e) {
            console.error("Failed to connect to the database:", e);
        }
    }

    async disconnect() {
        await this.client.end();
    }

}

export class Monitoring extends DB {

    constructor() {
        const { DB_HOST, DB_USER, DB_PASSWORD, MONITORING_DB_NAME } = process.env;

        if (!DB_HOST || !DB_USER || !DB_PASSWORD || !MONITORING_DB_NAME) {
            throw new Error('Missing database environment variables');
        }

        super(DB_HOST, DB_USER, DB_PASSWORD, MONITORING_DB_NAME);

    }

    async insertEvent(bot_id: string, event_name: string, event_data: any) {
        const query = `
        INSERT INTO bot_events (bot_id, event_name, event_data)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;

        const values = [bot_id, event_name, event_data];

        try {
            const result = await this.client.query(query, values);
            return result.rows[0];
        } catch (err) {
            console.error('Error inserting event:', err);
            throw err;
        }
    }

}

export class BotRegistry extends DB {

    constructor() {
        const { DB_HOST, DB_USER, DB_PASSWORD, TEST_USER_MANAGEMENT_DB_NAME } = process.env;

        if (!DB_HOST || !DB_USER || !DB_PASSWORD || !TEST_USER_MANAGEMENT_DB_NAME) {
            throw new Error('Missing database environment variables');
        }

        super(DB_HOST, DB_USER, DB_PASSWORD, TEST_USER_MANAGEMENT_DB_NAME);

    }

    async readBots(): Promise<Bot[]> {
        const botQuery = `
            SELECT 
                b.bot_id,
                b.wallet_id,
                b.exchange,
                b.token,
                b.size,
                b.leverage,
                b.meta_data,
                b.is_initialized,
                b.is_active,
                w.public_key
            FROM bots b
            JOIN wallets w 
                ON b.wallet_id = w.wallet_id
            WHERE b.is_initialized = TRUE AND b.is_active = TRUE AND b.exchange = 'gmx';
        `;

        const botRes = await this.client.query(botQuery);
        const bots: Bot[] = [];

        for (const row of botRes.rows) {
            const privateKey = await secretManager.retrievePrivateKey(row.wallet_id);
            const newBot = new Bot(
                row.bot_id,
                row.public_key,
                privateKey,
                row.exchange,
                row.token,
                parseFloat(row.size),
                parseInt(row.leverage),
                row.is_initialized,
                row.is_active,
                row.bot_metadata,
            )
            bots.push(newBot)
        }

        return bots;
    }
}

async function main() {
    const botRegistery = new BotRegistry()
    await botRegistery.connect()
    const activeBots = await botRegistery.readBots()
    console.log(activeBots)
}

// main().catch(console.error);

