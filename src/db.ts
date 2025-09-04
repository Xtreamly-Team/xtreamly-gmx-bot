import { Client } from 'pg';
import dotenv from 'dotenv';
import { Bot } from './models';

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
        const { DB_HOST, DB_USER, DB_PASSWORD, USER_MANAGEMENT_DB_NAME } = process.env;

        if (!DB_HOST || !DB_USER || !DB_PASSWORD || !USER_MANAGEMENT_DB_NAME) {
            throw new Error('Missing database environment variables');
        }

        super(DB_HOST, DB_USER, DB_PASSWORD, USER_MANAGEMENT_DB_NAME);

    }

    async readBots(): Promise<Bot[]> {
        const query = `
            SELECT 
                b.bot_id,
                b.exchange,
                b.token,
                b.size,
                b.leverage,
                b.metadata AS bot_metadata,
                b.is_initialized,
                b.is_active,
                w.public_key,
                w.private_key
            FROM bots b
            JOIN wallets w 
                ON b.wallet_key = w.public_key
            WHERE b.is_active = TRUE AND b.exchange = 'gmx';
        `;

        const res = await this.client.query(query);

        const bots: Bot[] = res.rows.map((r: any) => new Bot(
            r.bot_id,
            r.public_key,
            r.private_key,
            r.exchange,
            r.token,
            parseFloat(r.size),
            parseInt(r.leverage),
            r.is_initialized,
            r.is_active,
            r.bot_metadata,
        ));

        return bots;
    }
}
