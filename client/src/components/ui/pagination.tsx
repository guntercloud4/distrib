import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  className,
  currentPage,
  totalPages,
  onPageChange,
  ...props
}: PaginationProps) {
  // Create array of page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    
    // Always show first page
    pages.push(1);
    
    // Show current page and adjacent pages
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }
    
    // Add last page if there are more than one page
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    // Add ellipsis where needed
    const result = [];
    let prev = 0;
    
    for (let i = 0; i < pages.length; i++) {
      if (pages[i] - prev > 1) {
        result.push(-1); // -1 represents ellipsis
      }
      result.push(pages[i]);
      prev = pages[i];
    }
    
    return result;
  };

  return (
    <div className={cn("flex items-center justify-center space-x-2", className)} {...props}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="h-8 w-8 p-0"
        aria-label="Go to previous page"
      >
        <FontAwesomeIcon icon="chevron-left" className="h-4 w-4" />
      </Button>
      
      {getPageNumbers().map((page, i) => 
        page === -1 ? (
          <span key={`ellipsis-${i}`} className="px-2">
            …
          </span>
        ) : (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(page)}
            className="h-8 w-8 p-0"
            aria-label={`Go to page ${page}`}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {page}
          </Button>
        )
      )}
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="h-8 w-8 p-0"
        aria-label="Go to next page"
      >
        <FontAwesomeIcon icon="chevron-right" className="h-4 w-4" />
      </Button>
    </div>
  );
}