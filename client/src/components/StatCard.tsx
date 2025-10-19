import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
}

export default function StatCard({ title, value, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="p-4 md:p-5 hover-elevate" data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      {/* Mobile: Compact centered layout */}
      <div className="flex md:hidden flex-col items-center justify-center text-center gap-1">
        <Icon className="w-5 h-5 text-primary mb-1" />
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{title}</p>
      </div>
      
      {/* Desktop: Original layout */}
      <div className="hidden md:flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1.5">{title}</p>
          <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`text-sm font-medium ${trend.value >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
        <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}
