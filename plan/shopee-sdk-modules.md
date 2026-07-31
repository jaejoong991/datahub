# Shopee SDK → Subscription Feature Mapping

SDK: `@congminh1254/shopee-sdk` — 29 module.

## Core (bisa langsung dipakai)

| SDK Module | Data | Feature | Plan |
|------------|------|---------|:----:|
| OrderManager | Order, detail, split, cancel | `finance` / `sales` | Finance / Sales |
| PaymentManager | Escrow, payout, fee | `finance` | Finance |
| ProductManager | Produk, varian, harga, stok | `warehouse` / `sales` | Sales / Full |
| LogisticsManager | Tracking, label | `warehouse` | Full |
| ShopManager | Info toko, profil | `reader` | Semua |
| AuthManager | OAuth, token | `reader` | Semua |
| PushManager | Webhook, notif | `reader` | Semua |
| ReturnsManager | Retur, refund, dispute | `finance` | Finance |

## Pelengkap (bisa nanti)

| SDK Module | Guna | Prioritas |
|------------|------|:---------:|
| Voucher, Discount, Bundle, FlashSale | Promosi | Rendah |
| AdsManager, AmsManager | Iklan | Rendah |
| Livestream, VideoManager | Live & Video | Rendah |
| MediaManager | Upload gambar | Rendah |
| AccountHealth | Performa toko | Sedang |
| Merchant, Fbs, Sbs | Multi-warehouse | Nanti |
| GlobalProduct | Cross-border | Khusus |
