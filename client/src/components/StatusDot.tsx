import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StatusDotProps {
  status: 'rank1' | 'rank2-3' | 'out' | 'error' | 'hidden';
  size?: 'sm' | 'md' | 'lg';
}

export default function StatusDot({ status, size = 'md' }: StatusDotProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  const colorClasses = {
    'rank1': 'bg-success',
    'rank2-3': 'bg-warning',
    'out': 'bg-muted-foreground/40',
    'error': 'bg-destructive',
    'hidden': 'bg-destructive animate-pulse', // Phase 1: 통합검색 이탈 - 빨간색 + 애니메이션
  };

  const statusLabels = {
    'rank1': '1위',
    'rank2-3': '2-3위',
    'out': '순위 없음',
    'error': '오류',
    'hidden': '통합검색 이탈', // 통합검색에서 숨김
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`rounded-full ${sizeClasses[size]} ${colorClasses[status]}`}
          data-testid={`status-dot-${status}`}
        />
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{statusLabels[status]}</p>
      </TooltipContent>
    </Tooltip>
  );
}
