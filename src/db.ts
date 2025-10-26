import { monitoringDb } from './database_interface';

export class Monitoring {
    async insertEvent(bot_id: string, event_name: string, event_data: any) {
        // NOTE: Don't know why the query is changed and returns 
        const query = `
        INSERT INTO bot_events (bot_id, event_name, event_data)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;

        const values = [bot_id, event_name, event_data];

        try {
            await monitoringDb.execute(query, values);
        } catch (err) {
            console.error('Error inserting event:', err);
            throw err;
        }
    }
}
