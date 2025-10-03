import RankBadge from '../RankBadge';

export default function RankBadgeExample() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <RankBadge rank={1} />
        <RankBadge rank={2} />
        <RankBadge rank={3} />
        <RankBadge rank={null} />
      </div>
      <div className="flex items-center gap-3">
        <RankBadge rank={1} variant="compact" />
        <RankBadge rank={2} variant="compact" />
        <RankBadge rank={3} variant="compact" />
      </div>
    </div>
  );
}
