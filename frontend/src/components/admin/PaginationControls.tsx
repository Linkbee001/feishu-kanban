/**
 * PaginationControls component
 * Renders pagination buttons for TanStack Table pagination
 */

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  onGoToPage?: (page: number) => void;
}

/**
 * PaginationControls renders pagination UI controls
 * - Shows current page and total pages (e.g., "第 1 页，共 5 页")
 * - Previous button: "上一页" (disabled if currentPage === 0)
 * - Next button: "下一页" (disabled if currentPage >= totalPages - 1)
 * - Uses TailwindCSS for styling
 */
export function PaginationControls({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
}: PaginationControlsProps) {
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage >= totalPages - 1;

  return (
    <div className="flex gap-4 items-center justify-center mt-4">
      <button
        onClick={onPrevious}
        disabled={isFirstPage}
        className="px-4 py-2 rounded border border-gray-200 bg-white hover:bg-primary/10 hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        上一页
      </button>
      <span className="text-ink text-sm">
        第 {currentPage + 1} 页，共 {totalPages} 页
      </span>
      <button
        onClick={onNext}
        disabled={isLastPage}
        className="px-4 py-2 rounded border border-gray-200 bg-white hover:bg-primary/10 hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        下一页
      </button>
    </div>
  );
}