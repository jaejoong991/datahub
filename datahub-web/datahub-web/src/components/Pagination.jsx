import { Icon } from './primitives.jsx';
import { formatCount } from '../lib/format.js';

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Pagination — navigasi halaman server-side.
 *
 * Props:
 *   page: number (1-indexed)
 *   pageSize: number
 *   total: number (total baris)
 *   onPageChange: (page) => void
 *   onPageSizeChange: (pageSize) => void
 */
export default function Pagination({ page = 1, pageSize = 50, total = 0, onPageChange, onPageSizeChange }) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showPrev = page > 1;
  const showNext = page < totalPages;

  return (
    <div className="pagination">
      <span className="pagination-total">
        Total: <span className="mono">{formatCount(total)}</span>
      </span>

      <div className="pagination-controls">
        <button className="pagination-btn" disabled={!showPrev} onClick={() => onPageChange?.(1)} aria-label="Halaman pertama">
          <Icon name="first_page" size={17} />
        </button>
        <button className="pagination-btn" disabled={!showPrev} onClick={() => onPageChange?.(page - 1)} aria-label="Halaman sebelumnya">
          <Icon name="chevron_left" size={17} />
        </button>

        <span className="pagination-info">
          Halaman <span className="mono">{page}</span> dari <span className="mono">{totalPages}</span>
        </span>

        <button className="pagination-btn" disabled={!showNext} onClick={() => onPageChange?.(page + 1)} aria-label="Halaman berikutnya">
          <Icon name="chevron_right" size={17} />
        </button>
        <button className="pagination-btn" disabled={!showNext} onClick={() => onPageChange?.(totalPages)} aria-label="Halaman terakhir">
          <Icon name="last_page" size={17} />
        </button>
      </div>

      <label className="pagination-size">
        <span>Baris/halaman</span>
        <select
          className="input"
          style={{ width: 68 }}
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
