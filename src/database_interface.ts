/**
 * Database interface with connection pooling for Cloud Run
 * Supports PostgreSQL (production) with proper Cloud Run lifecycle management
 */

import { Pool } from 'pg';
import { getDatabaseUrl, getUserManagementDatabaseUrl } from './config';

export class DatabaseInterface {
    private pool: Pool;
    private databaseUrl: string;

    constructor(databaseUrl: string) {
        this.databaseUrl = databaseUrl;
        this.pool = new Pool({
            connectionString: databaseUrl,
            ssl: {
                rejectUnauthorized: false,
            },
            // Connection pool settings optimized for Cloud Run
            min: 1,  // Minimum connections
            max: 3,  // Maximum connections (Cloud Run friendly)
            idleTimeoutMillis: 300000,  // 5 minutes
            connectionTimeoutMillis: 5000,
            // Keep-alive settings
            keepAlive: true,
            keepAliveInitialDelayMillis: 0,
        });
    }

    async connect(): Promise<void> {
        try {
            // Test the connection
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();
            console.log('Connected to PostgreSQL database and created connection pool');
        } catch (error) {
            console.error('Failed to connect to the database:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        await this.pool.end();
    }

    async reconnect(): Promise<void> {
        console.log('Forcing database reconnection...');
        await this.disconnect();
        // Re-initialize the pool
        this.pool = new Pool({
            connectionString: this.databaseUrl,
            ssl: {
                rejectUnauthorized: false,
            },
            min: 1,
            max: 3,
            idleTimeoutMillis: 300000,
            connectionTimeoutMillis: 5000,
            keepAlive: true,
            keepAliveInitialDelayMillis: 0,
        });
        await this.connect();
    }

    async execute(query: string, params: any[] = []): Promise<any> {
        const client = await this.pool.connect();
        try {
            if (query.trim().toUpperCase().startsWith('SELECT')) {
                const result = await client.query(query, params);
                // Return results and column names for consistency
                const columnNames = result.fields.map(field => field.name);
                const rows = result.rows.map(row => Object.values(row));
                return { rows, columnNames };
            } else {
                // For non-SELECT queries, return the number of affected rows
                const result = await client.query(query, params);
                return result.rowCount || 0;
            }
        } catch (error) {
            console.error('Error executing query:', error);
            console.error('Query:', query);
            console.error('Params:', params);
            throw error;
        } finally {
            client.release();
        }
    }

    async executeOne(query: string, params: any[] = []): Promise<any> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(query, params);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error executing query:', error);
            console.error('Query:', query);
            console.error('Params:', params);
            throw error;
        } finally {
            client.release();
        }
    }

    async isHealthy(): Promise<boolean> {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT 1');
            client.release();
            return result.rows[0][0] === 1;
        } catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }
}

// Global database instances
export const monitoringDb = new DatabaseInterface(getDatabaseUrl());
export const userManagementDb = new DatabaseInterface(getUserManagementDatabaseUrl());
