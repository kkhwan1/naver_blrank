import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export interface MeasurementData {
  date: string;
  rank: number | null;
}

interface RankTrendChartProps {
  data: MeasurementData[];
  timeRange?: '7d' | '30d' | '90d';
}

export default function RankTrendChart({ data, timeRange = '30d' }: RankTrendChartProps) {
  const [selectedRange, setSelectedRange] = useState(timeRange);

  const chartData = data
    .filter((d) => d.rank !== null)
    .map((d) => ({
      date: d.date,
      rank: d.rank || 0,
    }));

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">순위 추이</h3>
        <div className="flex gap-2">
          <Button
            variant={selectedRange === '7d' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setSelectedRange('7d')}
            data-testid="range-7d"
          >
            7일
          </Button>
          <Button
            variant={selectedRange === '30d' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setSelectedRange('30d')}
            data-testid="range-30d"
          >
            30일
          </Button>
          <Button
            variant={selectedRange === '90d' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setSelectedRange('90d')}
            data-testid="range-90d"
          >
            90일
          </Button>
        </div>
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
