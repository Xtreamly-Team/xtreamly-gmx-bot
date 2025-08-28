import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export class Monitoring {
    private client: Client;

    constructor() {
        const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

        if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
            throw new Error('Missing database environment variables');
        }

        this.client = new Client({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
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

    async insertBot(bot_id: string, exchange: string, token: string, metadata: any) {
        const query = `
        INSERT INTO bots (bot_id, exchange, token, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;

        const values = [bot_id, exchange, token, metadata];

        try {
            const result = await this.client.query(query, values);
            return result.rows[0];
        } catch (err) {
            console.error('Error inserting bot:', err);
            throw err;
        }
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
