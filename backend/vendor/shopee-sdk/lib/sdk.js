import { ProductManager } from "./managers/product.manager.js";
import { OrderManager } from "./managers/order.manager.js";
import { AuthManager } from "./managers/auth.manager.js";
import { ShopeeRegion, SHOPEE_BASE_URLS, SHOPEE_AUTH_URLS } from "./schemas/region.js";
import { CustomTokenStorage } from "./storage/custom-token-storage.js";
import { ShopeeSdkError } from "./errors.js";
import { PublicManager } from "./managers/public.manager.js";
import { PushManager } from "./managers/push.manager.js";
import { PaymentManager } from "./managers/payment.manager.js";
import { LogisticsManager } from "./managers/logistics.manager.js";
import { VoucherManager } from "./managers/voucher.manager.js";
import { AdsManager } from "./managers/ads.manager.js";
import { AccountHealthManager } from "./managers/account-health.manager.js";
import { MerchantManager } from "./managers/merchant.manager.js";
import { ShopManager } from "./managers/shop.manager.js";
import { MediaManager } from "./managers/media.manager.js";
import { MediaSpaceManager } from "./managers/media-space.manager.js";
import { GlobalProductManager } from "./managers/global-product.manager.js";
import { FirstMileManager } from "./managers/first-mile.manager.js";
import { DiscountManager } from "./managers/discount.manager.js";
import { BundleDealManager } from "./managers/bundle-deal.manager.js";
import { AddOnDealManager } from "./managers/add-on-deal.manager.js";
import { ShopFlashSaleManager } from "./managers/shop-flash-sale.manager.js";
import { FollowPrizeManager } from "./managers/follow-prize.manager.js";
import { TopPicksManager } from "./managers/top-picks.manager.js";
import { ShopCategoryManager } from "./managers/shop-category.manager.js";
import { ReturnsManager } from "./managers/returns.manager.js";
import { SbsManager } from "./managers/sbs.manager.js";
import { FbsManager } from "./managers/fbs.manager.js";
import { LiveStreamManager } from "./managers/livestream.manager.js";
import { AmsManager } from "./managers/ams.manager.js";
import { VideoManager } from "./managers/video.manager.js";
export class ShopeeSDK {
    config;
    tokenStorage;
    ads;
    product;
    order;
    auth;
    public;
    push;
    payment;
    logistics;
    voucher;
    accountHealth;
    merchant;
    shop;
    media;
    mediaSpace;
    globalProduct;
    firstMile;
    discount;
    bundleDeal;
    addOnDeal;
    shopFlashSale;
    followPrize;
    topPicks;
    shopCategory;
    returns;
    sbs;
    fbs;
    livestream;
    ams;
    video;
    constructor(config, tokenStorage) {
        this.config = {
            ...config,
            region: config.region || (config.base_url ? undefined : ShopeeRegion.GLOBAL),
            base_url: config.base_url ||
                (config.region ? SHOPEE_BASE_URLS[config.region] : SHOPEE_BASE_URLS[ShopeeRegion.GLOBAL]),
            base_auth_url: config.base_auth_url ||
                (config.region ? SHOPEE_AUTH_URLS[config.region] : SHOPEE_AUTH_URLS[ShopeeRegion.GLOBAL]),
            sdk: this,
        };
        // Initialize token storage
        this.tokenStorage = tokenStorage || new CustomTokenStorage(config.shop_id);
        // Initialize managers
        this.ads = new AdsManager(this.config);
        this.product = new ProductManager(this.config);
        this.order = new OrderManager(this.config);
        this.auth = new AuthManager(this.config);
        this.public = new PublicManager(this.config);
        this.push = new PushManager(this.config);
        this.payment = new PaymentManager(this.config);
        this.logistics = new LogisticsManager(this.config);
        this.voucher = new VoucherManager(this.config);
        this.accountHealth = new AccountHealthManager(this.config);
        this.merchant = new MerchantManager(this.config);
        this.shop = new ShopManager(this.config);
        this.media = new MediaManager(this.config);
        this.mediaSpace = new MediaSpaceManager(this.config);
        this.globalProduct = new GlobalProductManager(this.config);
        this.firstMile = new FirstMileManager(this.config);
        this.discount = new DiscountManager(this.config);
        this.bundleDeal = new BundleDealManager(this.config);
        this.addOnDeal = new AddOnDealManager(this.config);
        this.shopFlashSale = new ShopFlashSaleManager(this.config);
        this.followPrize = new FollowPrizeManager(this.config);
        this.topPicks = new TopPicksManager(this.config);
        this.shopCategory = new ShopCategoryManager(this.config);
        this.returns = new ReturnsManager(this.config);
        this.sbs = new SbsManager(this.config);
        this.fbs = new FbsManager(this.config);
        this.livestream = new LiveStreamManager(this.config);
        this.ams = new AmsManager(this.config);
        this.video = new VideoManager(this.config);
    }
    getConfig() {
        return this.config;
    }
    setRegion(region) {
        this.config.region = region;
        this.config.base_url = SHOPEE_BASE_URLS[region];
        this.config.base_auth_url = SHOPEE_AUTH_URLS[region];
    }
    setBaseUrl(baseUrl) {
        this.config.base_url = baseUrl;
        this.config.region = undefined;
    }
    setBaseAuthUrl(baseAuthUrl) {
        this.config.base_auth_url = baseAuthUrl;
        this.config.region = undefined;
    }
    setFetchAgent(fetchAgent) {
        this.config.agent = fetchAgent;
    }
    getAuthorizationUrl(redirect_uri, options) {
        const authType = options?.auth_type || "seller";
        const state = options?.state;
        const authBaseUrl = this.config.base_auth_url || SHOPEE_AUTH_URLS[this.config.region || ShopeeRegion.GLOBAL];
        const url = new URL(authBaseUrl);
        url.searchParams.append("partner_id", this.config.partner_id.toString());
        url.searchParams.append("auth_type", authType);
        url.searchParams.append("redirect_uri", redirect_uri);
        url.searchParams.append("response_type", "code");
        if (state) {
            url.searchParams.append("state", state);
        }
        return url.toString();
    }
    async authenticateWithCode(code, shopId, mainAccountId) {
        const token = await this.auth.getAccessToken(code, shopId, mainAccountId);
        await this.tokenStorage.store(token);
        return token;
    }
    async getAuthToken() {
        return this.tokenStorage.get();
    }
    async refreshToken(shop_id, merchant_id) {
        const old_token = await this.tokenStorage.get();
        if (!old_token) {
            throw new ShopeeSdkError("No token found to refresh");
        }
        const token = await this.auth.getRefreshToken(old_token.refresh_token, shop_id ?? old_token.shop_id, merchant_id);
        if (!token) {
            return null;
        }
        await this.tokenStorage.store(token);
        return token;
    }
}
export default ShopeeSDK;
//# sourceMappingURL=sdk.js.map