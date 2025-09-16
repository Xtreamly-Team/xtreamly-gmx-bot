/**
 * Simple database interface using raw SQL
 * Supports PostgreSQL (production)
 */

import { Client } from 'pg';
import { getDatabaseUrl, getUserManagementDatabaseUrl } from './config';

export class DatabaseInterface {
    private client: Client;
    private databaseUrl: string;

    constructor(databaseUrl: string) {
        this.databaseUrl = databaseUrl;
        this.client = new Client({
            connectionString: databaseUrl,
            ssl: {
                rejectUnauthorized: false,
            },
            connectionTimeoutMillis: 5000,
        });
    }

    async connect(): Promise<void> {
        try {
            await this.client.connect();
            console.log('Connected to PostgreSQL database');
        } catch (error) {
            console.error('Failed to connect to the database:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        await this.client.end();
    }

    async execute(query: string, params: any[] = []): Promise<any> {
        try {
            if (query.trim().toUpperCase().startsWith('SELECT')) {
                const result = await this.client.query(query, params);
                // Return results and column names for consistency
                const columnNames = result.fields.map(field => field.name);
                const rows = result.rows.map(row => Object.values(row));
                return { rows, columnNames };
            } else {
                // For non-SELECT queries, return the number of affected rows
                const result = await this.client.query(query, params);
                return result.rowCount || 0;
            }
        } catch (error) {
            console.error('Error executing query:', error);
            throw error;
        }
    }

    async executeOne(query: string, params: any[] = []): Promise<any> {
        try {
            const result = await this.client.query(query, params);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error executing query:', error);
            throw error;
        }
    }
}

// Global database instances
export const monitoringDb = new DatabaseInterface(getDatabaseUrl());
export const userManagementDb = new DatabaseInterface(getUserManagementDatabaseUrl());
