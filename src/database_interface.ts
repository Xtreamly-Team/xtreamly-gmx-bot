/**
 * Database interface with connection pooling for Cloud Run
 * Supports PostgreSQL (production) with proper Cloud Run lifecycle management
 */

import { Pool } from 'pg';
import { getDatabaseUrl, getUserManagementDatabaseUrl } from './config';
import logger from './logger';

export class DatabaseInterface {
    private pool: Pool;
    private databaseUrl: string;
    private ended = false;

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
            logger.info('Connected to PostgreSQL database and created connection pool');
        } catch (error) {
            logger.info(error, 'Failed to connect to the database');
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.ended) {
            return;
        }
        this.ended = true;
        await this.pool.end();
    }

    async reconnect(): Promise<void> {
        logger.info('Forcing database reconnection...');
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
        this.ended = false;
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
            logger.info(error, 'Error executing query', { query, params });
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
            logger.info(error, 'Error executing query', { query, params });
            throw error;
        } finally {
            client.release();
        }
    }

    async isHealthy(): Promise<boolean> {
        if (!this.pool) {
            return false;
        }
        try {
            const result = await this.pool.query('SELECT 1');
            return result !== null;
        } catch (error) {
            logger.error(error, `Health check failed for ${this.databaseUrl}`);
            return false;
        }
    }
}

// Global database instances
export const monitoringDb = new DatabaseInterface(getDatabaseUrl());
export const userManagementDb = new DatabaseInterface(getUserManagementDatabaseUrl());
