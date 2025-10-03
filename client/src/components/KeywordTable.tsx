import { useState } from 'react';
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
import StatusDot from './StatusDot';
import RankBadge from './RankBadge';
import ChangeIndicator from './ChangeIndicator';
import { MoreVertical, ExternalLink } from 'lucide-react';

export interface KeywordData {
  id: string;
  keyword: string;
  rank: number | null;
  change: number;
  lastMeasured: string;
  targetUrl: string;
  status: 'rank1' | 'rank2-3' | 'out' | 'error';
}

interface KeywordTableProps {
  keywords: KeywordData[];
  onRowClick?: (id: string) => void;
  filterBy?: 'all' | 'up' | 'down' | 'stable';
}

export default function KeywordTable({ keywords, onRowClick, filterBy = 'all' }: KeywordTableProps) {
  const [selectedFilter, setSelectedFilter] = useState(filterBy);

  const filteredKeywords = keywords.filter((keyword) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'up') return keyword.change > 0;
    if (selectedFilter === 'down') return keyword.change < 0;
    if (selectedFilter === 'stable') return keyword.change === 0;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={selectedFilter === 'all' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setSelectedFilter('all')}
          data-testid="filter-all"
        >
          전체
        </Button>
        <Button
          variant={selectedFilter === 'up' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setSelectedFilter('up')}
          data-testid="filter-up"
        >
          상승
        </Button>
        <Button
          variant={selectedFilter === 'down' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setSelectedFilter('down')}
          data-testid="filter-down"
        >
          하락
        </Button>
        <Button
          variant={selectedFilter === 'stable' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setSelectedFilter('stable')}
          data-testid="filter-stable"
        >
          유지
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">상태</TableHead>
              <TableHead>키워드</TableHead>
              <TableHead className="text-right">현재 순위</TableHead>
              <TableHead className="text-right">변동</TableHead>
              <TableHead>마지막 측정</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredKeywords.map((keyword) => (
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
                  <RankBadge rank={keyword.rank} />
                </TableCell>
                <TableCell className="text-right">
                  <ChangeIndicator change={keyword.change} />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{keyword.lastMeasured}</span>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('More actions for', keyword.id);
                    }}
                    data-testid={`keyword-actions-${keyword.id}`}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredKeywords.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  키워드가 없습니다
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
