import { Card, Icon } from '../components/primitives.jsx';

export function Vouchers()     { return <PlaceholderPage title="Voucher Diskon"     icon="confirmation_number" />; }
export function Discounts()    { return <PlaceholderPage title="Diskon Produk"      icon="percent" />; }
export function Bundles()      { return <PlaceholderPage title="Bundle Deal"        icon="inventory" />; }
export function AddOns()       { return <PlaceholderPage title="Add-On Deal"        icon="add_shopping_cart" />; }
export function FlashSales()   { return <PlaceholderPage title="Flash Sale"         icon="bolt" />; }
export function TopPicks()     { return <PlaceholderPage title="Top Picks"          icon="stars" />; }
export function LiveStream()   { return <PlaceholderPage title="Live Streaming"     icon="live_tv" />; }
export function Videos()       { return <PlaceholderPage title="Video Produk"       icon="videocam" />; }
export function Ads()          { return <PlaceholderPage title="Iklan Shopee"       icon="campaign" />; }
export function AMS()          { return <PlaceholderPage title="Affiliate AMS"      icon="group" />; }
export function Returns()      { return <PlaceholderPage title="Retur & Refund"     icon="undo" />; }
export function Media()        { return <PlaceholderPage title="Media & Upload"     icon="image" />; }
export function Categories()   { return <PlaceholderPage title="Kategori Toko"      icon="category" />; }
export function AccountHealth(){ return <PlaceholderPage title="Kesehatan Toko"     icon="health_and_safety" />; }
export function GlobalProduct(){ return <PlaceholderPage title="Cross-Border"       icon="public" />; }
export function TieredWH()     { return <PlaceholderPage title="Multi-Warehouse"    icon="warehouse" />; }
export function FBS()          { return <PlaceholderPage title="Fulfillment Shopee" icon="local_shipping" />; }
export function FirstMile()    { return <PlaceholderPage title="First Mile Pickup"  icon="directions_car" />; }

function PlaceholderPage({ title, icon }) {
  return (
    <div className="page">
      <Card>
        <div className="card-head"><h2 style={{ flex: 1 }}>{title}</h2></div>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Icon name={icon} size={48} color="var(--ink-4)" />
          <div style={{ marginTop: 16, fontSize: 14, fontWeight: 700 }}>{title}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-3)' }}>Modul akan dibangun dengan data dari Shopee SDK.</div>
        </div>
      </Card>
    </div>
  );
}
