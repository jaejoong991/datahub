export interface SandboxConfig {
    partner_id?: number;
    partner_key?: string;
    shop_id?: number;
    account?: string;
    password?: string;
    access_token?: string;
    refresh_token?: string;
}
/**
 * Retrieves the Sandbox configuration from environment variables.
 */
export declare function getSandboxConfig(): SandboxConfig;
/**
 * Checks if the minimal required sandbox partner credentials are present.
 */
export declare function hasSandboxPartnerCredentials(): boolean;
/**
 * Unifies and validates that all required sandbox environment variables are configured.
 * If any required variables are missing, it prints a clear error message and exits the process.
 */
export declare function validateSandboxEnv(): void;
