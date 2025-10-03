import { Badge } from '@/components/ui/badge';

interface RankBadgeProps {
  rank: number | null;
  variant?: 'default' | 'compact';
}

export default function RankBadge({ rank, variant = 'default' }: RankBadgeProps) {
  if (rank === null || rank === 0) {
    return (
      <Badge variant="secondary" className="font-medium" data-testid="rank-badge-out">
        이탈
      </Badge>
    );
  }

  if (rank === 1) {
    return (
      <Badge 
        className="bg-rank-gold text-white font-semibold border-0" 
        data-testid="rank-badge-1"
      >
        {variant === 'compact' ? '1' : '1위'}
      </Badge>
    );
  }

  return (
    <Badge 
      className="bg-rank-silver text-white font-semibold border-0"
      data-testid={`rank-badge-${rank}`}
    >
      {variant === 'compact' ? `${rank}` : `${rank}위`}
    </Badge>
  );
}
