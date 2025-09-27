import { Bot } from './models';
import { secretManager } from './secret_manager';
import { monitoringDb, userManagementDb } from './database_interface';
import logger from './logger';

export class Monitoring {
    /**Monitoring database operations using the shared database interface*/

    async insertEvent(bot_id: string, event_name: string, event_data: any) {
        // NOTE: Don't know why the query is changed and returns 
        const query = `
        INSERT INTO bot_events (bot_id, event_name, event_data)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;

        const values = [bot_id, event_name, event_data];

        try {
            const result = await monitoringDb.execute(query, values);
            // return result.rows[0];
        } catch (err) {
            logger.error(err, 'Error inserting event');
            throw err;
        }
    }
}

export async function getActiveBots(): Promise<Bot[]> {
    const botRegistry = new BotRegistry();
    return await botRegistry.readBots();
}

export class BotRegistry {
    /**Bot registry operations using the shared database interface*/

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

        const result = await userManagementDb.execute(botQuery);
        const bots: Bot[] = [];

        for (const row of result.rows) {
            const privateKey = await secretManager.retrievePrivateKey(row[1]); // wallet_id is at index 1
            if (!privateKey) {
                logger.error(`Failed to retrieve private key for wallet ${row[1]}`);
                throw new Error(`Failed to retrieve private key for wallet ${row[1]}`);
            }
            const newBot = new Bot(
                row[0], // bot_id
                row[9], // public_key
                privateKey,
                row[2], // exchange
                row[3], // token
                parseFloat(row[4]), // size
                parseInt(row[5]), // leverage
                row[6], // is_initialized
                row[7], // is_active
                row[8], // meta_data
            )
            bots.push(newBot)
        }

        return bots;
    }
}

// async function main() {
//     // Initialize database connections
//     await userManagementDb.connect();
//     await monitoringDb.connect();
//     
//     try {
//         const botRegistry = new BotRegistry();
//         const activeBots = await botRegistry.readBots();
//         console.log(activeBots);
//     } finally {
//         // Clean up connections
//         await userManagementDb.disconnect();
//         await monitoringDb.disconnect();
//     }
// }
//
// // main().catch(console.error);
//
