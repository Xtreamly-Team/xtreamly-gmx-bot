import dotenv from 'dotenv';
import { parseInt } from 'lodash';

dotenv.config();

// Database Configuration
export const DB_HOST = process.env.DB_HOST;
export const DB_USER = process.env.DB_USER;
export const DB_PASSWORD = process.env.DB_PASSWORD;
export const DB_PORT = process.env.DB_PORT || '5432';
export const DB_NAME = process.env.MONITORING_DB_NAME;
export const USER_MANAGEMENT_DB_NAME = process.env.USER_MANAGEMENT_DB_NAME;

// Bot Configuration
export const DEFAULT_LEVERAGE = parseInt(process.env.DEFAULT_LEVERAGE || '10');
export const DEFAULT_POSITION_SIZE = parseFloat(process.env.DEFAULT_POSITION_SIZE || '1000');

// API Configuration
export const XSTREAMLY_API_URL = process.env.XSTREAMLY_API_URL || 'https://api.xtreamly.io';

export const YIELD_GENERATION_URL = process.env.YIELD_GENERATION_URL

export function getYieldGenerationUrl(): string {
    if (!YIELD_GENERATION_URL) {
        throw new Error('YIELD_GENERATION_URL is not set');
    }
    return YIELD_GENERATION_URL;
}

export const ARB_RPC_URL = process.env.ARB_RPC_URL || 'https://arb1.arbitrum.io/rpc';

export const MIN_WALLET_FOR_YIELD = parseInt(process.env.MIN_WALLET_FOR_YIELD || "2000")

export function getDatabaseUrl(): string {
    /**Get the database URL based on environment*/
    // Use direct PostgreSQL connection
    if (!DB_PASSWORD) {
        throw new Error('DB_PASSWORD is not set');
    }
    // URL encode the password to handle special characters like colons
    const encodedPassword = encodeURIComponent(DB_PASSWORD);
    return `postgresql://${DB_USER}:${encodedPassword}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

export function getUserManagementDatabaseUrl(): string {
    /**Get the user management database URL*/
    if (!DB_PASSWORD) {
        throw new Error('DB_PASSWORD is not set');
    }
    const encodedPassword = encodeURIComponent(DB_PASSWORD);
    return `postgresql://${DB_USER}:${encodedPassword}@${DB_HOST}:${DB_PORT}/${USER_MANAGEMENT_DB_NAME}`;
}
