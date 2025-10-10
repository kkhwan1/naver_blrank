import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import StatusDot from './StatusDot';
import RankBadge from './RankBadge';
import ChangeIndicator from './ChangeIndicator';
import { MoreVertical, ExternalLink, Info, LineChart, Trash2 } from 'lucide-react';

interface SmartblockCategory {
  categoryName: string;
  rank: number | null;
  totalBlogs: number;
  status: string;
  confidence: string;
  topBlogs: Array<{
    url: string;
    title: string;
  }>;
}

export interface KeywordData {
  id: string;
  keyword: string;
  rank: number | null;
  change: number;
  lastMeasured: string;
  targetUrl: string;
  status: 'rank1' | 'rank2-3' | 'out' | 'error';
  searchVolume?: number | null;
  smartblockCategories?: SmartblockCategory[] | null;
  measurementInterval?: string;
}

interface KeywordTableProps {
  keywords: KeywordData[];
  onRowClick?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  onDelete?: (id: string) => void;
  filterBy?: 'all' | 'up' | 'down' | 'stable';
}

export default function KeywordTable({ keywords, onRowClick, onViewDetails, onDelete, filterBy = 'all' }: KeywordTableProps) {
  const [selectedFilter, setSelectedFilter] = useState(filterBy);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 14;

  const filteredKeywords = keywords.filter((keyword) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'up') return keyword.change > 0;
    if (selectedFilter === 'down') return keyword.change < 0;
    if (selectedFilter === 'stable') return keyword.change === 0;
    return true;
  });

  const totalPages = Math.ceil(filteredKeywords.length / itemsPerPage);
  const safeCurrentPage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedKeywords = filteredKeywords.slice(startIndex, endIndex);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filteredKeywords.length, totalPages, currentPage]);

  const handleFilterChange = (filter: 'all' | 'up' | 'down' | 'stable') => {
    setSelectedFilter(filter);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={selectedFilter === 'all' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => handleFilterChange('all')}
            data-testid="filter-all"
          >
            전체
          </Button>
          <Button
            variant={selectedFilter === 'up' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => handleFilterChange('up')}
            data-testid="filter-up"
          >
            상승
          </Button>
          <Button
            variant={selectedFilter === 'down' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => handleFilterChange('down')}
            data-testid="filter-down"
          >
            하락
          </Button>
          <Button
            variant={selectedFilter === 'stable' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => handleFilterChange('stable')}
            data-testid="filter-stable"
          >
            유지
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          총 {filteredKeywords.length}개 키워드
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">상태</TableHead>
              <TableHead>키워드</TableHead>
              <TableHead className="text-right">현재 순위</TableHead>
              <TableHead className="text-right">변동</TableHead>
              <TableHead className="text-right">월간 검색량</TableHead>
              <TableHead>측정 주기</TableHead>
              <TableHead>마지막 측정</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedKeywords.map((keyword) => (
              <TableRow
                key={keyword.id}
                className="cursor-pointer hover-elevate"
                onClick={() => onRowClick?.(keyword.id)}
                data-testid={`keyword-row-${keyword.id}`}
              >
                <TableCell>
                  <StatusDot status={keyword.status} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{keyword.keyword}</span>
                    <a
                      href={keyword.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground font-mono flex items-center gap-1 hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {keyword.targetUrl.substring(0, 50)}...
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <RankBadge rank={keyword.rank} />
                    {keyword.smartblockCategories && keyword.smartblockCategories.length > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`smartblock-details-${keyword.id}`}>
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96" align="end">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm">스마트블록 상세 정보</h4>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {keyword.smartblockCategories.map((category, idx) => (
                                <div key={idx} className="p-2 border rounded-md space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">{category.categoryName}</span>
                                    {category.rank ? (
                                      <Badge variant={category.rank === 1 ? 'default' : 'secondary'} className="text-xs">
                                        {category.rank}위
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">순위 없음</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    전체 {category.totalBlogs}개 블로그
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <ChangeIndicator change={keyword.change} />
                </TableCell>
                <TableCell className="text-right">
                  {keyword.searchVolume !== null && keyword.searchVolume !== undefined ? (
                    <span className="text-sm font-medium">
                      {keyword.searchVolume.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {keyword.measurementInterval === '1h' && '1시간'}
                    {keyword.measurementInterval === '6h' && '6시간'}
                    {keyword.measurementInterval === '12h' && '12시간'}
                    {keyword.measurementInterval === '24h' && '24시간'}
                    {!keyword.measurementInterval && '24시간'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{keyword.lastMeasured}</span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`keyword-actions-${keyword.id}`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowClick?.(keyword.id);
                        }}
                        data-testid={`action-measure-${keyword.id}`}
                      >
                        <LineChart className="w-4 h-4 mr-2" />
                        순위 측정
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetails?.(keyword.id);
                        }}
                        data-testid={`action-view-details-${keyword.id}`}
                      >
                        <Info className="w-4 h-4 mr-2" />
                        상세 보기
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete?.(keyword.id);
                        }}
                        className="text-destructive"
                        data-testid={`action-delete-${keyword.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {paginatedKeywords.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {filteredKeywords.length === 0 ? '키워드가 없습니다' : '해당 필터에 맞는 키워드가 없습니다'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination data-testid="pagination">
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(safeCurrentPage - 1)}
                disabled={safeCurrentPage === 1}
                data-testid="pagination-previous"
              >
                <PaginationPrevious className="h-auto w-auto p-0" />
              </Button>
            </PaginationItem>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              if (
                page === 1 ||
                page === totalPages ||
                (page >= safeCurrentPage - 1 && page <= safeCurrentPage + 1)
              ) {
                return (
                  <PaginationItem key={page}>
                    <Button
                      variant={safeCurrentPage === page ? 'outline' : 'ghost'}
                      size="icon"
                      onClick={() => handlePageChange(page)}
                      data-testid={`pagination-page-${page}`}
                    >
                      {page}
                    </Button>
                  </PaginationItem>
                );
              } else if (
                page === safeCurrentPage - 2 ||
                page === safeCurrentPage + 2
              ) {
                return (
                  <PaginationItem key={page}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              return null;
            })}

            <PaginationItem>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(safeCurrentPage + 1)}
                disabled={safeCurrentPage >= totalPages}
                data-testid="pagination-next"
              >
                <PaginationNext className="h-auto w-auto p-0" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
