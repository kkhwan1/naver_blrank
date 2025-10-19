import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export interface MeasurementData {
  date: string;
  rank: number | null;
}

interface RankTrendChartProps {
  data: MeasurementData[];
}

export default function RankTrendChart({ data }: RankTrendChartProps) {
  const chartData = data
    .filter((d) => d.rank !== null)
    .map((d) => ({
      date: d.date,
      rank: d.rank || 0,
    }));

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold">순위 추이</h3>
        <p className="text-xs text-muted-foreground mt-1">최근 7일간 평균 순위 변화</p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <defs>
            <linearGradient id="rankGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            reversed
            domain={[1, 10]}
            ticks={[1, 2, 3, 4, 5, 10]}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
            itemStyle={{ color: 'hsl(var(--primary))' }}
            formatter={(value: number) => [`순위: ${value}위`, '']}
          />
          <Line
            type="monotone"
            dataKey="rank"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', r: 3 }}
            activeDot={{ r: 5 }}
            fill="url(#rankGradient)"
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
