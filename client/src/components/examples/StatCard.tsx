import StatCard from '../StatCard';
import { TrendingUp, ArrowUp, ArrowDown, Bell } from 'lucide-react';

export default function StatCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
      <StatCard
        title="추적 중"
        value="15"
        icon={TrendingUp}
        trend={{ value: 12, label: '지난 주 대비' }}
      />
      <StatCard
        title="순위 상승"
        value="8"
        icon={ArrowUp}
        trend={{ value: 33, label: '지난 주 대비' }}
      />
      <StatCard
        title="순위 하락"
        value="3"
        icon={ArrowDown}
        trend={{ value: -25, label: '지난 주 대비' }}
      />
      <StatCard
        title="알림"
        value="2"
        icon={Bell}
      />
    </div>
  );
}
