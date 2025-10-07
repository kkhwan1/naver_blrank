import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Users, MousePointer, BarChart3 } from 'lucide-react';

interface KeywordStats {
  relKeyword: string;
  monthlyPcQcCnt: number;
  monthlyMobileQcCnt: number;
  monthlyAvePcClkCnt: number;
  monthlyAveMobileClkCnt: number;
  monthlyAvePcCtr: number;
  monthlyAveMobileCtr: number;
  plAvgDepth: number;
  compIdx: string;
}

interface RelatedKeyword {
  relKeyword: string;
  monthlyPcQcCnt: number;
  monthlyMobileQcCnt: number;
  monthlyAvePcClkCnt: number;
  monthlyAveMobileClkCnt: number;
  monthlyAvePcCtr: number;
  monthlyAveMobileCtr: number;
  plAvgDepth: number;
  compIdx: string;
}

interface KeywordStatsResponse {
  keyword: string;
  stats: KeywordStats | null;
  relatedKeywords: RelatedKeyword[];
}

interface KeywordStatsTabProps {
  keywordId: string | null;
  keyword: string;
}

export default function KeywordStatsTab({ keywordId, keyword }: KeywordStatsTabProps) {
  const { data, isLoading, error } = useQuery<KeywordStatsResponse>({
    queryKey: ['/api/keywords', keywordId, 'stats'],
    queryFn: async () => {
      if (!keywordId) throw new Error('No keyword ID');
      const res = await fetch(`/api/keywords/${keywordId}/stats`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch stats');
      }
      return res.json();
    },
    enabled: !!keywordId,
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const formatPercentage = (num: number) => {
    return `${(num * 100).toFixed(2)}%`;
  };

  const getCompetitionLevel = (compIdx: string) => {
    const level = parseFloat(compIdx);
    if (level >= 80) return { label: '매우 높음', variant: 'destructive' as const };
    if (level >= 60) return { label: '높음', variant: 'default' as const };
    if (level >= 40) return { label: '보통', variant: 'secondary' as const };
    if (level >= 20) return { label: '낮음', variant: 'outline' as const };
    return { label: '매우 낮음', variant: 'outline' as const };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">통계를 불러오는 중 오류가 발생했습니다</p>
        <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
      </div>
    );
  }

  if (!data?.stats) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        키워드 통계 데이터가 없습니다
      </div>
    );
  }

  const stats = data.stats;
  const totalSearchVolume = stats.monthlyPcQcCnt + stats.monthlyMobileQcCnt;
  const totalClicks = stats.monthlyAvePcClkCnt + stats.monthlyAveMobileClkCnt;
  const mobileRatio = totalSearchVolume > 0 ? (stats.monthlyMobileQcCnt / totalSearchVolume) : 0;
  const competition = getCompetitionLevel(stats.compIdx);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-4">키워드: {keyword}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">월간 총 검색량</p>
                <p className="text-2xl font-bold">{formatNumber(totalSearchVolume)}</p>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>PC: {formatNumber(stats.monthlyPcQcCnt)}</span>
                  <span>모바일: {formatNumber(stats.monthlyMobileQcCnt)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <MousePointer className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">월간 평균 클릭수</p>
                <p className="text-2xl font-bold">{formatNumber(totalClicks)}</p>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>PC: {formatNumber(stats.monthlyAvePcClkCnt)}</span>
                  <span>모바일: {formatNumber(stats.monthlyAveMobileClkCnt)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">클릭률 (CTR)</p>
                <div className="flex gap-4 mt-1">
                  <div>
                    <p className="text-lg font-semibold">{formatPercentage(stats.monthlyAvePcCtr)}</p>
                    <p className="text-xs text-muted-foreground">PC</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{formatPercentage(stats.monthlyAveMobileCtr)}</p>
                    <p className="text-xs text-muted-foreground">모바일</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">경쟁 강도</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={competition.variant}>{competition.label}</Badge>
                  <span className="text-sm text-muted-foreground">({stats.compIdx})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">모바일 비율</p>
              <p className="font-medium">{formatPercentage(mobileRatio)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">평균 노출 순위</p>
              <p className="font-medium">{stats.plAvgDepth.toFixed(1)}위</p>
            </div>
          </div>
        </div>
      </Card>

      {data.relatedKeywords.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">연관 키워드</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.relatedKeywords.map((rk, idx) => {
              const totalVol = rk.monthlyPcQcCnt + rk.monthlyMobileQcCnt;
              const comp = getCompetitionLevel(rk.compIdx);
              
              return (
                <div key={idx} className="p-3 border rounded-md hover-elevate">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{rk.relKeyword}</span>
                    <Badge variant={comp.variant} className="text-xs">
                      {comp.label}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <p>검색량</p>
                      <p className="font-semibold text-foreground">{formatNumber(totalVol)}</p>
                    </div>
                    <div>
                      <p>클릭수</p>
                      <p className="font-semibold text-foreground">
                        {formatNumber(rk.monthlyAvePcClkCnt + rk.monthlyAveMobileClkCnt)}
                      </p>
                    </div>
                    <div>
                      <p>평균 CTR</p>
                      <p className="font-semibold text-foreground">
                        {formatPercentage((rk.monthlyAvePcCtr + rk.monthlyAveMobileCtr) / 2)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
