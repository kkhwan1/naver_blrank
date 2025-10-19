import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, Loader2, TrendingUp, BarChart3 } from 'lucide-react';
import { useState } from 'react';

interface RelatedKeyword {
  keyword: string;
  type: 'related' | 'recommended';
  searchVolume?: number;
  verified?: boolean;
}

interface RelatedKeywordsData {
  keyword: string;
  related: RelatedKeyword[];
  recommended: RelatedKeyword[];
  total: number;
}

interface KeywordRelatedTabProps {
  keywordId: string | null;
  keyword: string;
}

export default function KeywordRelatedTab({ 
  keywordId, 
  keyword 
}: KeywordRelatedTabProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const { data, isLoading, refetch } = useQuery<RelatedKeywordsData>({
    queryKey: ['/api/keywords', keywordId, 'related-keywords'],
    queryFn: async () => {
      if (!keywordId) throw new Error('키워드 ID가 없습니다');
      const res = await fetch(`/api/keywords/${keywordId}/related-keywords`);
      if (!res.ok) throw new Error('추천키워드 조회 실패');
      return res.json();
    },
    enabled: false, // 수동으로 실행
  });

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await refetch();
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
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
          </div>
          <Button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing || isLoading}
            data-testid="button-analyze-keywords"
          >
            {isAnalyzing || isLoading ? (
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
        </div>

        {!data && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>분석하기 버튼을 눌러 추천 키워드를 확인하세요</p>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* 연관검색어 섹션 */}
            {data.related.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold">연관검색어</h4>
                  <Badge variant="secondary" className="ml-auto">
                    {data.related.length}개
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  실제 블로그 제목에서 추출된 키워드 조합
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.related.map((item, idx) => (
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
            {data.recommended.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold">추천검색어</h4>
                  <Badge variant="secondary" className="ml-auto">
                    {data.recommended.length}개
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  SEO 최적화된 수식어 조합 (검색 결과 100개 이상)
                </p>
                <div className="space-y-2">
                  {data.recommended.map((item, idx) => (
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

            {data.related.length === 0 && data.recommended.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>추천할 키워드가 없습니다</p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
