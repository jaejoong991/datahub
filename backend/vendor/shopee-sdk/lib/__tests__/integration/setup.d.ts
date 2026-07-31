import { ShopeeSDK } from "../../sdk.js";
export declare function setupIntegrationTest(): {
    runTests: boolean;
    initSdk: () => Promise<ShopeeSDK>;
    hasValidToken: () => boolean;
};
