import { ShopeeConfig } from "../sdk.js";
import { AccessToken } from "../schemas/access-token.js";
import { GetTokenByResendCodeParams } from "../schemas/public.js";
import { BaseManager } from "./base.manager.js";
export declare class AuthManager extends BaseManager {
    constructor(config: ShopeeConfig);
    getAccessToken(code: string, shopId?: number, mainAccountId?: number): Promise<AccessToken>;
    getAccessTokenByResendCode(params: GetTokenByResendCodeParams): Promise<AccessToken>;
    getRefreshToken(refreshToken: string, shopId?: number, merchantId?: number): Promise<AccessToken>;
}
