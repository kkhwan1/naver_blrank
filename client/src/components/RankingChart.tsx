import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Measurement {
  id: number;
  measuredAt: string;
  rankSmartblock: number | null;
  smartblockStatus: string;
}

interface RankingChartProps {
  measurements: Measurement[];
  keyword: string;
  targetUrl: string;
}

export function RankingChart({ measurements, keyword, targetUrl }: RankingChartProps) {
  // Process measurements for chart
  const chartData = measurements
    .filter(m => m.rankSmartblock !== null) // Only show data points with rank
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
    .map(m => ({
      date: format(new Date(m.measuredAt), 'MM/dd HH:mm', { locale: ko }),
      fullDate: format(new Date(m.measuredAt), 'yyyy-MM-dd HH:mm:ss', { locale: ko }),
      rank: m.rankSmartblock,
      status: m.smartblockStatus,
    }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-md">
          <p className="text-sm font-medium">{data.fullDate}</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <p className="text-sm">
              순위: <span className="font-bold">{data.rank}위</span>
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            상태: {data.status === 'OK' ? '정상' : data.status}
          </p>
        </div>
      );
    }
    return null;
  };

  // No measurements at all
  if (measurements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>순위 변동 차트</CardTitle>
          <CardDescription>
            키워드: {keyword}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            측정 데이터가 없습니다. 측정을 실행해주세요.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Has measurements but no ranked data
  if (chartData.length === 0) {
    const getStatusLabel = (status: string) => {
      const statusMap: Record<string, string> = {
        'NOT_IN_BLOCK': '스마트블록에서 타겟 블로그를 찾을 수 없습니다',
        'BLOCK_MISSING': '스마트블록이 존재하지 않습니다',
        'RANKED_BUT_HIDDEN': '스마트블록에는 있지만 통합검색에서 숨겨져 있습니다',
        'ERROR': '측정 중 오류가 발생했습니다',
      };
      return statusMap[status] || '순위 정보 없음';
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>순위 변동 차트</CardTitle>
          <CardDescription>
            키워드: {keyword}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-md text-center">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              스마트블록 순위 없음
            </p>
            <p className="text-xs text-muted-foreground">
              {getStatusLabel(measurements[0].smartblockStatus)}
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-3">측정 이력 ({measurements.length}회)</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {measurements.slice(0, 10).map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-md text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{format(new Date(m.measuredAt), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getStatusLabel(m.smartblockStatus)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">순위 없음</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-ranking-chart">
      <CardHeader>
        <CardTitle>순위 변동 차트</CardTitle>
        <CardDescription>
          키워드: <span className="font-medium">{keyword}</span>
        </CardDescription>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          대상 URL: {targetUrl}
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              reversed
              domain={[1, 3]}
              ticks={[1, 2, 3]}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              label={{ value: '순위', angle: -90, position: 'insideLeft', fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={() => 'Smart Block 순위'}
            />
            
            {/* Reference lines for rank boundaries */}
            <ReferenceLine y={1} stroke="hsl(var(--chart-1))" strokeDasharray="3 3" strokeOpacity={0.3} />
            <ReferenceLine y={2} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" strokeOpacity={0.3} />
            <ReferenceLine y={3} stroke="hsl(var(--chart-3))" strokeDasharray="3 3" strokeOpacity={0.3} />
            
            <Line
              type="monotone"
              dataKey="rank"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
        
        <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">최고 순위</p>
            <p className="text-lg font-bold text-chart-1">
              {Math.min(...chartData.map(d => d.rank!))}위
            </p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">현재 순위</p>
            <p className="text-lg font-bold text-primary">
              {chartData[chartData.length - 1].rank}위
            </p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-muted-foreground">측정 횟수</p>
            <p className="text-lg font-bold">{chartData.length}회</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
