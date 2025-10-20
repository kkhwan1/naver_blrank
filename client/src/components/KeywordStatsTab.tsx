import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, Users, MousePointer, BarChart3, Lightbulb } from 'lucide-react';
import { useState } from 'react';

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

interface RecommendedKeyword {
  keyword: string;
  type: 'related' | 'recommended';
  searchVolume?: number;
  verified?: boolean;
}

interface RelatedKeywordsData {
  keyword: string;
  related: RecommendedKeyword[];
  recommended: RecommendedKeyword[];
  total: number;
  analyzedAt?: string;
  cached?: boolean;
}

interface KeywordStatsTabProps {
  keywordId: string | null;
  keyword: string;
}

export default function KeywordStatsTab({ keywordId, keyword }: KeywordStatsTabProps) {
  const [viewMode, setViewMode] = useState<'related' | 'recommended'>('related');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 키워드 통계 API (네이버 광고 API)
  const { data: statsData, isLoading: statsLoading, error: statsError } = useQuery<KeywordStatsResponse>({
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
    enabled: !!keywordId && viewMode === 'related',
  });

  // 추천 키워드 API (블로그 제목 분석)
  const { data: recommendedData, isFetching: recommendedFetching, refetch: refetchRecommended } = useQuery<RelatedKeywordsData>({
    queryKey: ['/api/keywords', keywordId, 'related-keywords'],
    queryFn: async ({ queryKey }) => {
      if (!keywordId) throw new Error('키워드 ID가 없습니다');
      const force = (queryKey[3] as boolean) || false;
      const url = `/api/keywords/${keywordId}/related-keywords${force ? '?force=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('추천키워드 조회 실패');
      return res.json();
    },
    enabled: false, // 수동으로 실행
  });

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await refetchRecommended();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleForceAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      // force=true로 강제 재분석
      const res = await fetch(`/api/keywords/${keywordId}/related-keywords?force=true`);
      if (res.ok) {
        const freshData = await res.json();
        // queryClient에 새로운 데이터 직접 설정
        queryClient.setQueryData(['/api/keywords', keywordId, 'related-keywords'], freshData);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  const formatPercentage = (num: number) => {
    return `${(num * 100).toFixed(2)}%`;
  };

  // Helper function to parse search volume (can be string like "< 10" or number)
  const parseSearchVolume = (value: string | number): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Handle "< 10" format - return 5 as estimate
      if (value.includes('<')) return 5;
      // Handle "> 1000000" format - return 1000000 as estimate
      if (value.includes('>')) return parseInt(value.replace(/[^0-9]/g, '')) || 1000000;
      // Try to parse as number
      const parsed = parseInt(value.replace(/,/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const getCompetitionLevel = (compIdx: string) => {
    const level = parseFloat(compIdx);
    if (level >= 80) return { label: '매우 높음', variant: 'destructive' as const };
    if (level >= 60) return { label: '높음', variant: 'default' as const };
    if (level >= 40) return { label: '보통', variant: 'secondary' as const };
    if (level >= 20) return { label: '낮음', variant: 'outline' as const };
    return { label: '매우 낮음', variant: 'outline' as const };
  };

  // 연관키워드 뷰 렌더링
  const renderRelatedView = () => {
    if (statsLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    if (statsError) {
      return (
        <div className="text-center py-8">
          <p className="text-destructive">통계를 불러오는 중 오류가 발생했습니다</p>
          <p className="text-sm text-muted-foreground mt-2">{(statsError as Error).message}</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {statsData?.stats ? (
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
                    <p className="text-2xl font-bold">{formatNumber(parseSearchVolume(statsData.stats.monthlyPcQcCnt) + parseSearchVolume(statsData.stats.monthlyMobileQcCnt))}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>PC: {typeof statsData.stats.monthlyPcQcCnt === 'string' ? statsData.stats.monthlyPcQcCnt : formatNumber(statsData.stats.monthlyPcQcCnt)}</span>
                      <span>모바일: {typeof statsData.stats.monthlyMobileQcCnt === 'string' ? statsData.stats.monthlyMobileQcCnt : formatNumber(statsData.stats.monthlyMobileQcCnt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <MousePointer className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">월간 평균 클릭수</p>
                    <p className="text-2xl font-bold">{formatNumber(statsData.stats.monthlyAvePcClkCnt + statsData.stats.monthlyAveMobileClkCnt)}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>PC: {formatNumber(statsData.stats.monthlyAvePcClkCnt)}</span>
                      <span>모바일: {formatNumber(statsData.stats.monthlyAveMobileClkCnt)}</span>
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
                        <p className="text-lg font-semibold">{formatPercentage(statsData.stats.monthlyAvePcCtr)}</p>
                        <p className="text-xs text-muted-foreground">PC</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{formatPercentage(statsData.stats.monthlyAveMobileCtr)}</p>
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
                      <Badge variant={getCompetitionLevel(statsData.stats.compIdx).variant}>{getCompetitionLevel(statsData.stats.compIdx).label}</Badge>
                      <span className="text-sm text-muted-foreground">({statsData.stats.compIdx})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">모바일 비율</p>
                  <p className="font-medium">{formatPercentage((parseSearchVolume(statsData.stats.monthlyMobileQcCnt) / (parseSearchVolume(statsData.stats.monthlyPcQcCnt) + parseSearchVolume(statsData.stats.monthlyMobileQcCnt)) || 0))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">평균 노출 순위</p>
                  <p className="font-medium">{statsData.stats.plAvgDepth.toFixed(1)}위</p>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4">
            <div className="text-center py-4 text-muted-foreground">
              <p className="font-semibold mb-1">키워드: {keyword}</p>
              <p className="text-sm">키워드 통계 데이터가 없습니다</p>
            </div>
          </Card>
        )}

        {statsData?.relatedKeywords && statsData.relatedKeywords.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">연관 키워드</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {statsData.relatedKeywords.map((rk, idx) => {
                const rkPcVol = parseSearchVolume(rk.monthlyPcQcCnt);
                const rkMobileVol = parseSearchVolume(rk.monthlyMobileQcCnt);
                const totalVol = rkPcVol + rkMobileVol;
                const comp = getCompetitionLevel(rk.compIdx);
                
                return (
                  <div key={idx} className="p-3 border rounded-md hover-elevate" data-testid={`related-keyword-${idx}`}>
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
  };

  // 추천키워드 뷰 렌더링
  const renderRecommendedView = () => {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              추천 키워드 분석
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              실제 블로그 제목을 분석하여 연관/추천 키워드를 추출합니다
            </p>
            {recommendedData?.analyzedAt && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>마지막 분석: {formatRelativeTime(recommendedData.analyzedAt)}</span>
                {recommendedData.cached && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">캐시</Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!recommendedData ? (
              <Button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing || recommendedFetching}
                data-testid="button-analyze-keywords"
              >
                {isAnalyzing || recommendedFetching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    분석하기
                  </>
                )}
              </Button>
            ) : (
              <Button 
                onClick={handleForceAnalyze} 
                disabled={isAnalyzing || recommendedFetching}
                variant="outline"
                data-testid="button-reanalyze-keywords"
              >
                {isAnalyzing || recommendedFetching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    다시 분석하기
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {!recommendedData && !recommendedFetching && (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>분석하기 버튼을 눌러 추천 키워드를 확인하세요</p>
          </div>
        )}

        {recommendedData && (
          <div className="space-y-6">
            {/* 연관검색어 섹션 */}
            {recommendedData.related.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold">연관검색어</h4>
                  <Badge variant="secondary" className="ml-auto">
                    {recommendedData.related.length}개
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  실제 블로그 제목에서 추출된 키워드 조합
                </p>
                <div className="flex flex-wrap gap-2">
                  {recommendedData.related.map((item, idx) => (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="px-3 py-1.5 hover-elevate cursor-pointer"
                      data-testid={`related-keyword-${idx}`}
                      onClick={() => {
                        window.open(`https://search.naver.com/search.naver?query=${encodeURIComponent(item.keyword)}`, '_blank');
                      }}
                    >
                      {item.keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 추천검색어 섹션 */}
            {recommendedData.recommended.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold">추천검색어</h4>
                  <Badge variant="secondary" className="ml-auto">
                    {recommendedData.recommended.length}개
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  SEO 최적화된 수식어 조합 (검색 결과 100개 이상)
                </p>
                <div className="space-y-2">
                  {recommendedData.recommended.map((item, idx) => (
                    <Card 
                      key={idx}
                      className="p-3 hover-elevate cursor-pointer"
                      data-testid={`recommended-keyword-${idx}`}
                      onClick={() => {
                        window.open(`https://search.naver.com/search.naver?query=${encodeURIComponent(item.keyword)}`, '_blank');
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.keyword}</span>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {item.searchVolume && (
                            <span>
                              {item.searchVolume.toLocaleString()}개 결과
                            </span>
                          )}
                          {item.verified && (
                            <Badge variant="default" className="text-xs">
                              검증됨
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {recommendedData.related.length === 0 && recommendedData.recommended.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>추천할 키워드가 없습니다</p>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* 버튼 토글 (스마트블록/통합검색 스타일) */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'related' ? 'default' : 'outline'}
          onClick={() => setViewMode('related')}
          data-testid="button-view-related"
          className="flex-1"
        >
          연관키워드
        </Button>
        <Button
          variant={viewMode === 'recommended' ? 'default' : 'outline'}
          onClick={() => setViewMode('recommended')}
          data-testid="button-view-recommended"
          className="flex-1"
        >
          추천키워드
        </Button>
      </div>

      {/* 뷰 렌더링 */}
      {viewMode === 'related' ? renderRelatedView() : renderRecommendedView()}
    </div>
  );
}
