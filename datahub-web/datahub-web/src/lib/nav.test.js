import { describe, test, expect } from 'vitest';
import { NAV, navFor, allowedPageIds } from './nav.js';

/* Data nyata dari DB seed — role kustom "penjaga_toko" milik budi@toko.id */
const PENJAGA_TOKO_FEATURES = ['reader', 'order', 'finance'];

/* shop 1, plan "Full" */
const SHOP_FULL_FEATURES = [
  'reader', 'order', 'finance', 'returns', 'product', 'media', 'category',
  'warehouse', 'logistics', 'voucher', 'discount', 'export', 'account_health', 'erp',
];

/* shop 2, plan "Data Viewer" */
const SHOP_VIEWER_FEATURES = ['reader'];

describe('navFor', () => {
  test('returns every menu group when role is admin', () => {
    // Arrange
    const role = 'admin';

    // Act
    const groups = navFor(role, [], SHOP_VIEWER_FEATURES);

    // Assert
    expect(groups).toHaveLength(NAV.length);
  });

  test('returns only menus present in both role features and shop features', () => {
    // Arrange & Act
    const ids = navFor('penjaga_toko', PENJAGA_TOKO_FEATURES, SHOP_FULL_FEATURES)
      .flatMap(g => g.items.map(i => i.id));

    // Assert
    expect(ids).toEqual(['sinkron', 'ringkasan', 'keuangan']);
  });

  test('drops menus the shop subscription does not include', () => {
    // Arrange & Act — role grants finance, shop plan "Data Viewer" does not
    const ids = navFor('penjaga_toko', PENJAGA_TOKO_FEATURES, SHOP_VIEWER_FEATURES)
      .flatMap(g => g.items.map(i => i.id));

    // Assert
    expect(ids).toEqual(['sinkron']);
    expect(ids).not.toContain('keuangan');
  });

  test('hides admin-only system menus from non-admin roles holding reader', () => {
    // Arrange & Act
    const ids = navFor('penjaga_toko', PENJAGA_TOKO_FEATURES, SHOP_FULL_FEATURES)
      .flatMap(g => g.items.map(i => i.id));

    // Assert
    expect(ids).not.toContain('users');
    expect(ids).not.toContain('plans');
    expect(ids).not.toContain('roles');
  });

  test('shows admin-only system menus to admin', () => {
    // Arrange & Act
    const ids = navFor('admin', [], SHOP_VIEWER_FEATURES)
      .flatMap(g => g.items.map(i => i.id));

    // Assert
    expect(ids).toContain('users');
    expect(ids).toContain('plans');
    expect(ids).toContain('roles');
  });
});

describe('allowedPageIds', () => {
  /* Regresi: App.jsx dulu memanggil navFor(role, shopFeatures) — shop features
     masuk ke slot roleFeatures dan shopFeatures jatuh ke default ['reader'],
     sehingga halaman yang menunya tampil justru dilempar balik ke allowed[0]. */
  test('includes every page the sidebar renders for a custom role', () => {
    // Arrange
    const sidebarIds = navFor('penjaga_toko', PENJAGA_TOKO_FEATURES, SHOP_FULL_FEATURES)
      .flatMap(g => g.items.map(i => i.id));

    // Act
    const allowed = allowedPageIds('penjaga_toko', PENJAGA_TOKO_FEATURES, SHOP_FULL_FEATURES);

    // Assert
    expect(allowed).toEqual(sidebarIds);
    expect(allowed).toContain('keuangan');
    expect(allowed).toContain('ringkasan');
  });

  test('excludes pages outside the role features', () => {
    // Arrange & Act
    const allowed = allowedPageIds('penjaga_toko', PENJAGA_TOKO_FEATURES, SHOP_FULL_FEATURES);

    // Assert
    expect(allowed).not.toContain('stok');
    expect(allowed).not.toContain('gudang');
  });

  test('returns a flat list of ids for admin covering all pages', () => {
    // Arrange
    const totalItems = NAV.reduce((sum, g) => sum + g.items.length, 0);

    // Act
    const allowed = allowedPageIds('admin', [], SHOP_VIEWER_FEATURES);

    // Assert
    expect(allowed).toHaveLength(totalItems);
  });

  test('falls back to reader-only shop features when shop features are missing', () => {
    // Arrange & Act
    const allowed = allowedPageIds('penjaga_toko', PENJAGA_TOKO_FEATURES, undefined);

    // Assert
    expect(allowed).toEqual(['sinkron']);
  });
});
