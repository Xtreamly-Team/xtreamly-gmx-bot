import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const SECRET_MANAGER_AVAILABLE = true; // toggle based on runtime checks
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export class SecretManagerClient {
    private client: SecretManagerServiceClient | null;
    private projectId: string | null;

    constructor(projectId?: string) {
        if (!SECRET_MANAGER_AVAILABLE) {
            console.warn(
                "Google Cloud Secret Manager not available. Private key storage will be disabled."
            );
            this.client = null;
            this.projectId = null;
            return;
        }

        try {
            console.log("Initializing Secret Manager Client...")
            if (IS_PRODUCTION) {
                this.client = new SecretManagerServiceClient({
                    keyFilename: "xtreamly-ai-21e3d3e65c99.json"
                });
            } else {
                this.client = new SecretManagerServiceClient();
            }
            this.projectId = projectId || this.getDefaultProjectIdSync();
            console.info(
                `SecretManagerClient initialized for project: ${this.projectId}`
            );
        } catch (e) {
            console.warn(
                `Failed to initialize Secret Manager: ${e}. Private key storage will be disabled.`
            );
            this.client = null;
            this.projectId = null;
        }
    }

    /** Synchronous project id resolver for constructor */
    private getDefaultProjectIdSync(): string {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT;
        if (projectId) return projectId;

        if (IS_PRODUCTION) {
            throw new Error(
                "Project ID must be provided or set in GOOGLE_CLOUD_PROJECT environment variable"
            );
        } else {
            console.info("Using default project ID for development");
            return "development-project";
        }
    }

    private getSecretName(walletId: string): string {
        return `wallet-private-key-${walletId}`;
    }

    async storePrivateKey(walletId: string, privateKey: string): Promise<boolean> {
        if (!SECRET_MANAGER_AVAILABLE || !this.client || !this.projectId) {
            console.warn("Secret Manager not available. Cannot store private key.");
            return false;
        }

        try {
            const secretName = this.getSecretName(walletId);
            const parent = `projects/${this.projectId}`;

            const fullName = `${parent}/secrets/${secretName}`;

            // Check if secret exists
            try {
                await this.client.getSecret({ name: fullName });
                console.info(`Secret ${secretName} already exists, updating...`);
            } catch {
                console.info(`Creating new secret: ${secretName}`);
                await this.client.createSecret({
                    parent,
                    secretId: secretName,
                    secret: { replication: { automatic: {} } },
                });
            }

            // Add version
            const [version] = await this.client.addSecretVersion({
                parent: fullName,
                payload: { data: Buffer.from(privateKey, "utf8") },
            });

            console.info(
                `Successfully stored private key for wallet ${walletId} in version ${version.name}`
            );
            return true;
        } catch (e) {
            console.error(
                `Failed to store private key for wallet ${walletId}: ${e}`
            );
            return false;
        }
    }

    async retrievePrivateKey(walletId: string): Promise<string | null> {
        if (!SECRET_MANAGER_AVAILABLE || !this.client || !this.projectId) {
            console.warn("Secret Manager not available. Cannot retrieve private key.");
            return null;
        }

        try {
            const secretName = this.getSecretName(walletId);
            const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;

            const [response] = await this.client.accessSecretVersion({ name });
            const privateKey = response.payload?.data?.toString("utf8") || null;

            if (privateKey) {
                console.info(
                    `Successfully retrieved private key for wallet ${walletId}`
                );
            }
            return privateKey;
        } catch (e: any) {
            if (e.code === 5) {
                // NotFound
                console.warn(`Private key not found for wallet ${walletId}`);
                return null;
            }
            console.error(
                `Failed to retrieve private key for wallet ${walletId}: ${e}`
            );
            return null;
        }
    }

    async deletePrivateKey(walletId: string): Promise<boolean> {
        if (!SECRET_MANAGER_AVAILABLE || !this.client || !this.projectId) {
            console.warn("Secret Manager not available. Cannot delete private key.");
            return false;
        }

        try {
            const secretName = this.getSecretName(walletId);
            const name = `projects/${this.projectId}/secrets/${secretName}`;

            await this.client.deleteSecret({ name });
            console.info(`Successfully deleted private key for wallet ${walletId}`);
            return true;
        } catch (e: any) {
            if (e.code === 5) {
                console.warn(
                    `Private key not found for wallet ${walletId} (already deleted)`
                );
                return true;
            }
            console.error(
                `Failed to delete private key for wallet ${walletId}: ${e}`
            );
            return false;
        }
    }

    async privateKeyExists(walletId: string): Promise<boolean> {
        if (!SECRET_MANAGER_AVAILABLE || !this.client || !this.projectId) {
            console.warn(
                "Secret Manager not available. Cannot check if private key exists."
            );
            return false;
        }

        try {
            const secretName = this.getSecretName(walletId);
            const name = `projects/${this.projectId}/secrets/${secretName}`;

            await this.client.getSecret({ name });
            return true;
        } catch (e: any) {
            if (e.code === 5) {
                return false;
            }
            console.error(
                `Error checking if private key exists for wallet ${walletId}: ${e}`
            );
            return false;
        }
    }
}

export const secretManager = new SecretManagerClient('xtreamly-ai')
