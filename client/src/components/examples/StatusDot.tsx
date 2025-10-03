import StatusDot from '../StatusDot';

export default function StatusDotExample() {
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <StatusDot status="rank1" size="sm" />
          <span className="text-sm">Rank 1 (Small)</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status="rank1" size="md" />
          <span className="text-sm">Rank 1 (Medium)</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status="rank1" size="lg" />
          <span className="text-sm">Rank 1 (Large)</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <StatusDot status="rank2-3" />
          <span className="text-sm">Rank 2-3</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status="out" />
          <span className="text-sm">Out of Block</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status="error" />
          <span className="text-sm">Error</span>
        </div>
      </div>
    </div>
  );
}
