import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface ChangeIndicatorProps {
  change: number;
  showArrow?: boolean;
}

export default function ChangeIndicator({ change, showArrow = true }: ChangeIndicatorProps) {
  if (change === 0) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground" data-testid="change-stable">
        {showArrow && <Minus className="w-3 h-3" />}
        <span className="text-sm font-medium">-</span>
      </div>
    );
  }

  if (change > 0) {
    return (
      <div className="flex items-center gap-1 text-success" data-testid="change-up">
        {showArrow && <ArrowUp className="w-3 h-3" />}
        <span className="text-sm font-medium">↑{Math.abs(change)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-destructive" data-testid="change-down">
      {showArrow && <ArrowDown className="w-3 h-3" />}
      <span className="text-sm font-medium">↓{Math.abs(change)}</span>
    </div>
  );
}
