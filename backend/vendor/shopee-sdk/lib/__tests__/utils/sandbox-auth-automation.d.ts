import { AccessToken } from "../../schemas/access-token.js";
/**
 * Automates the Sandbox OAuth login and authorization flow using Playwright.
 * It navigates to the official authorization page, switch regions, fills in standard
 * seller credentials (account/password), clicks "Log In", confirms consent,
 * intercepts the authorization callback code, and exchanges it for an access token.
 */
export declare function automateSandboxAuth(): Promise<AccessToken>;
