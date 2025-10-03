interface StatusDotProps {
  status: 'rank1' | 'rank2-3' | 'out' | 'error';
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
  };

  return (
    <div
      className={`rounded-full ${sizeClasses[size]} ${colorClasses[status]}`}
      data-testid={`status-dot-${status}`}
    />
  );
}
