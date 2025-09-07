import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { PerpStrategy } from '../src/strategy';
import { Bot } from '../src/models';

// Configure logging
const logger = console;

// Initialize Secret Manager client
const secretClient = new SecretManagerServiceClient();

class SecretManagerClient {
    /**Client to fetch private keys from Google Secret Manager*/
    
    constructor(private projectId: string) {
        this.client = secretClient;
    }
    
    private client: SecretManagerServiceClient;
    
    async getPrivateKey(botId: string): Promise<string> {
        /**Fetch private key for a bot from Secret Manager*/
        try {
            // Validate bot_id to prevent injection attacks
            if (!botId || typeof botId !== 'string' || botId.length > 100) {
                throw new Error(`Invalid bot_id: ${botId}`);
            }
            
            const secretName = `bot-${botId}-private-key`;
            const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
            
            const [response] = await this.client.accessSecretVersion({ name });
            const privateKey = response.payload?.data?.toString();
            
            // Validate private key format (basic check)
            if (!privateKey || privateKey.length < 32) {
                throw new Error(`Invalid private key format for bot ${botId}`);
            }
            
            logger.info(`Successfully fetched private key for bot ${botId}`);
            return privateKey;
            
        } catch (error) {
            logger.error(`Failed to fetch private key for bot ${botId}:`, error);
            throw error;
        }
    }
}

class BotServiceClient {
    /**Client to fetch active bots from external service*/
    
    private baseUrl: string;
    private apiKey: string;
    
    constructor() {
        this.baseUrl = process.env.BOT_SERVICE_BASE_URL || 'https://your-bot-service.com';
        this.apiKey = process.env.BOT_SERVICE_API_KEY || 'your-api-key';
    }
    
    async fetchActiveBots(): Promise<Bot[]> {
        /**Fetch all active GMX bots from the external service*/
        try {
            const headers = {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            };
            
            const response = await fetch(
                `${this.baseUrl}/api/bots/active?exchange=gmx`,
                {
                    method: 'GET',
                    headers,
                    signal: AbortSignal.timeout(30000)
                }
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const botsData = await response.json();
            const bots: Bot[] = [];
            
            for (const botData of botsData) {
                // Validate required fields
                const requiredFields = ['id', 'wallet_address', 'token', 'position_size', 'leverage'];
                let isValid = true;
                
                for (const field of requiredFields) {
                    if (!(field in botData)) {
                        logger.warn(`Bot missing required field '${field}':`, botData);
                        isValid = false;
                        break;
                    }
                }
                
                if (!isValid) continue;
                
                // Validate data types and ranges
                if (typeof botData.position_size !== 'number' || botData.position_size <= 0) {
                    logger.warn(`Invalid position_size for bot ${botData.id}: ${botData.position_size}`);
                    continue;
                }
                
                if (typeof botData.leverage !== 'number' || botData.leverage < 1 || botData.leverage > 100) {
                    logger.warn(`Invalid leverage for bot ${botData.id}: ${botData.leverage}`);
                    continue;
                }
                
                const bot = new Bot(
                    botData.id,
                    botData.wallet_address,
                    botData.wallet_private_key, // This will be replaced by Secret Manager
                    botData.exchange || 'gmx',
                    botData.token,
                    botData.position_size,
                    botData.leverage,
                    botData.initialized || false,
                    botData.active !== false,
                    botData.metadata || {}
                );
                bots.push(bot);
            }
            
            logger.info(`Fetched ${bots.length} active GMX bots from service`);
            return bots;
            
        } catch (error) {
            logger.error('Failed to fetch active bots:', error);
            return [];
        }
    }
}

async function processTradingSignal(signalData: any): Promise<any> {
    /**
     * Process a single trading signal for all relevant GMX bots
     * 
     * Args:
     *   signalData: The trading signal data from pub/sub
     */
    logger.info('Processing trading signal:', signalData);
    
    try {
        // Initialize services
        const projectId = process.env.GCP_PROJECT_ID;
        if (!projectId) {
            throw new Error('GCP_PROJECT_ID environment variable is required');
        }
        
        const secretManager = new SecretManagerClient(projectId);
        const botService = new BotServiceClient();
        
        // Step 1: Fetch active GMX bots
        const activeBots = await botService.fetchActiveBots();
        if (activeBots.length === 0) {
            logger.warn('No active GMX bots found');
            return {
                status: 'success',
                message: 'No active GMX bots to process',
                bots_processed: 0
            };
        }
        
        // Step 2: Process each bot
        const results = [];
        for (const bot of activeBots) {
            try {
                // Fetch private key from Secret Manager
                const privateKey = await secretManager.getPrivateKey(bot.id.toString());
                
                // Create strategy instance with fetched private key
                const strategy = new PerpStrategy({
                    bot_id: bot.id.toString(),
                    walletPrivkey: privateKey, // Use fetched private key
                    token: bot.token as 'ETH' | 'SOL' | 'BTC',
                    basePositionSize: bot.positionSize,
                    leverage: bot.leverage,
                    signalHorizonMin: 240,
                    keepStrategyHorizonMin: 60,
                    baseAsset: 'USDC',
                });
                
                // Initialize bot if needed
                if (!bot.initialized) {
                    logger.info(`Initializing GMX bot ${bot.id}`);
                    // Note: GMX bot doesn't have initialize method yet, but we can add it
                    // await strategy.initialize();
                    // Update bot initialization status in external service
                    await updateBotInitialization(bot.id.toString(), true);
                }
                
                // Execute strategy with signal data from pub/sub message
                await strategy.execute(signalData);
                
                results.push({
                    bot_id: bot.id,
                    status: 'success',
                    message: `Successfully executed strategy for GMX bot ${bot.id}`
                });
                
            } catch (error) {
                logger.error(`Failed to process GMX bot ${bot.id}:`, error);
                results.push({
                    bot_id: bot.id,
                    status: 'error',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        
        const successfulBots = results.filter(r => r.status === 'success').length;
        
        logger.info(`GMX signal processing completed. ${successfulBots}/${activeBots.length} bots processed successfully`);
        
        return {
            status: 'success',
            message: `Processed ${successfulBots}/${activeBots.length} GMX bots successfully`,
            bots_processed: activeBots.length,
            successful_bots: successfulBots,
            results: results
        };
        
    } catch (error) {
        logger.error('GMX signal processing failed:', error);
        return {
            status: 'error',
            message: `GMX signal processing failed: ${error instanceof Error ? error.message : String(error)}`,
            bots_processed: 0
        };
    }
}

async function updateBotInitialization(botId: string, initialized: boolean): Promise<void> {
    /**Update bot initialization status in external service*/
    try {
        const baseUrl = process.env.BOT_SERVICE_BASE_URL || 'https://your-bot-service.com';
        const apiKey = process.env.BOT_SERVICE_API_KEY || 'your-api-key';
        
        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };
        
        const data = { initialized };
        
        const response = await fetch(
            `${baseUrl}/api/bots/${botId}`,
            {
                method: 'PATCH',
                headers,
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(30000)
            }
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        logger.info(`Updated GMX bot ${botId} initialization status to ${initialized}`);
        
    } catch (error) {
        logger.error(`Failed to update GMX bot ${botId} initialization status:`, error);
    }
}

export async function processPubsubMessage(event: any, context: any): Promise<any> {
    /**
     * Cloud Function entry point for pub/sub messages
     * 
     * Args:
     *   event: Pub/Sub message event
     *   context: Cloud Function context
     */
    logger.info('Received pub/sub message:', event);
    
    try {
        // Decode the pub/sub message
        let message;
        if (event.data) {
            const messageData = Buffer.from(event.data, 'base64').toString('utf-8');
            message = JSON.parse(messageData);
        } else {
            message = event;
        }
        
        logger.info('Processing GMX message:', message);
        
        // Process the trading signal
        const result = await processTradingSignal(message);
        
        logger.info('GMX signal processing completed:', result);
        
        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };
        
    } catch (error) {
        logger.error('Error processing GMX pub/sub message:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                status: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
        };
    }
}

// For local testing
if (require.main === module) {
    // Test with a sample message
    const testEvent = {
        data: Buffer.from(JSON.stringify({
            type: 'trading_signal',
            timestamp: '2024-01-15T10:00:00Z',
            signals: [
                {
                    symbol: 'ETH',
                    signal_long: true,
                    signal_short: false,
                    horizon: 240
                }
            ]
        })).toString('base64')
    };
    
    const testContext = {};
    
    processPubsubMessage(testEvent, testContext)
        .then(result => console.log('Test result:', result))
        .catch(error => console.error('Test error:', error));
}
