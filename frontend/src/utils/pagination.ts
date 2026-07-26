/**
 * Pagination ทั่วไป ใช้ร่วมกันทุกตารางในระบบ
 */

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function getTotalPages(
  itemCount: number,
  pageSize: number
): number {
  return Math.max(
    1,
    Math.ceil(itemCount / pageSize)
  );
}

export function renderPaginationControls(
  container: HTMLElement,
  currentPage: number,
  totalPages: number,
  onChange: (page: number) => void
): void {
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <button
      class="secondary-button"
      type="button"
      data-page-action="prev"
      ${currentPage <= 1 ? "disabled" : ""}
    >
      ← ก่อนหน้า
    </button>

    <span class="pagination-info">
      หน้า ${currentPage} จาก ${totalPages}
    </span>

    <button
      class="secondary-button"
      type="button"
      data-page-action="next"
      ${currentPage >= totalPages ? "disabled" : ""}
    >
      ถัดไป →
    </button>
  `;

  container
    .querySelector('[data-page-action="prev"]')
    ?.addEventListener("click", () => {
      onChange(currentPage - 1);
    });

  container
    .querySelector('[data-page-action="next"]')
    ?.addEventListener("click", () => {
      onChange(currentPage + 1);
    });
}
