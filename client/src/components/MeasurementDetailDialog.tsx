import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import KeywordStatsTab from './KeywordStatsTab';
import KeywordBlogsTab from './KeywordBlogsTab';
import { RankingChart } from './RankingChart';

interface SmartblockCategory {
  categoryName: string;
  rank: number | null;
  totalBlogs: number;
  status: string;
  confidence: string;
  topBlogs: Array<{
    url: string;
    title: string;
  }>;
  message?: string;
}

interface Measurement {
  id: number;
  keywordId: number;
  measuredAt: string;
  rankSmartblock: number | null;
  smartblockStatus: string;
  smartblockConfidence: string;
  smartblockDetails: string | null;
  isVisibleInSearch?: boolean; // Phase 1: 통합검색 실제 노출 여부
  hiddenReason?: string; // Phase 1: 숨겨진 이유
  durationMs: number;
  method: string;
  errorMessage?: string;
}

interface MeasurementDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keywordId: string | null;
  keyword: string;
  targetUrl: string;
}

export default function MeasurementDetailDialog({ 
  open, 
  onOpenChange, 
  keywordId,
  keyword,
  targetUrl 
}: MeasurementDetailDialogProps) {
  const { data: measurements = [], isLoading } = useQuery<Measurement[]>({
    queryKey: ['/api/measurements', keywordId],
    queryFn: async () => {
      if (!keywordId) return [];
      const res = await fetch(`/api/measurements/${keywordId}`);
      if (!res.ok) throw new Error('Failed to fetch measurements');
      return res.json();
    },
    enabled: open && !!keywordId,
  });

  const latestMeasurement = measurements[0];

  let categories: SmartblockCategory[] = [];
  if (latestMeasurement?.smartblockDetails) {
    try {
      if (typeof latestMeasurement.smartblockDetails === 'string') {
        categories = JSON.parse(latestMeasurement.smartblockDetails);
      } else {
        categories = latestMeasurement.smartblockDetails as SmartblockCategory[];
      }
    } catch (e) {
      console.error('Failed to parse smartblock details:', e);
      categories = [];
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'OK': { label: '정상', variant: 'default' },
      'NOT_IN_BLOCK': { label: '스마트블록 없음', variant: 'secondary' },
      'BLOCK_MISSING': { label: '블록 누락', variant: 'outline' },
      'RANKED_BUT_HIDDEN': { label: '통합검색 이탈', variant: 'destructive' }, // Phase 1
      'ERROR': { label: '오류', variant: 'destructive' },
    };
    
    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" data-testid="dialog-measurement-detail">
        <DialogHeader>
          <DialogTitle>{keyword} - 상세 정보</DialogTitle>
          <DialogDescription>
            키워드 측정 결과, 통계 및 블로그 검색 결과
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="measurement" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="measurement" data-testid="tab-measurement">측정 결과</TabsTrigger>
            <TabsTrigger value="chart" data-testid="tab-chart">순위 변동</TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats">키워드 통계</TabsTrigger>
            <TabsTrigger value="blogs" data-testid="tab-blogs">블로그 검색</TabsTrigger>
          </TabsList>

          <TabsContent value="measurement" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !latestMeasurement ? (
              <div className="text-center py-8 text-muted-foreground">
                측정 결과가 없습니다
              </div>
            ) : (
              <div className="space-y-4">
                {/* Phase 1: 통합검색 이탈 경고 배너 */}
                {latestMeasurement.smartblockStatus === 'RANKED_BUT_HIDDEN' && (
                  <Card className="p-4 bg-destructive/10 border-destructive/20" data-testid="alert-ranked-but-hidden">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <h4 className="font-semibold text-destructive">통합검색 이탈 감지</h4>
                        <p className="text-sm text-destructive/90">
                          스마트블록에서 {latestMeasurement.rankSmartblock}위로 표시되지만, 실제 검색 결과에서는 숨겨져 있습니다.
                        </p>
                        {latestMeasurement.hiddenReason && (
                          <p className="text-xs text-muted-foreground">
                            이유: {latestMeasurement.hiddenReason === 'display_none' && 'CSS display:none 속성'}
                            {latestMeasurement.hiddenReason === 'visibility_hidden' && 'CSS visibility:hidden 속성'}
                            {latestMeasurement.hiddenReason === 'opacity_zero' && 'CSS opacity:0 속성'}
                            {latestMeasurement.hiddenReason === 'css_class_hidden' && 'CSS hidden 클래스'}
                            {!['display_none', 'visibility_hidden', 'opacity_zero', 'css_class_hidden'].includes(latestMeasurement.hiddenReason) && latestMeasurement.hiddenReason}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">기본 정보</h3>
                    {getStatusBadge(latestMeasurement.smartblockStatus)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">측정 시간:</span>
                      <p className="font-medium">{formatDate(latestMeasurement.measuredAt)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">순위:</span>
                      <p className="font-medium">
                        {latestMeasurement.rankSmartblock ? `${latestMeasurement.rankSmartblock}위` : '순위 없음'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">신뢰도:</span>
                      <p className="font-medium">
                        {latestMeasurement.smartblockConfidence 
                          ? `${(parseFloat(latestMeasurement.smartblockConfidence) * 100).toFixed(0)}%`
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">측정 방식:</span>
                      <p className="font-medium">
                        {latestMeasurement.method === 'serpapi' ? 'SerpAPI' : 'HTML 파싱'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">소요 시간:</span>
                      <p className="font-medium">{(latestMeasurement.durationMs / 1000).toFixed(2)}초</p>
                    </div>
                  </div>

                  {latestMeasurement.errorMessage && (
                    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <p className="text-sm text-destructive">{latestMeasurement.errorMessage}</p>
                    </div>
                  )}
                </Card>

                {categories.length > 0 && (
                  <Card className="p-4 space-y-3">
                    <h3 className="font-semibold">스마트블록 카테고리 상세</h3>
                    <div className="space-y-3">
                      {categories.map((category, idx) => (
                        <div key={idx} className="p-3 border rounded-md space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{category.categoryName}</span>
                            <div className="flex items-center gap-2">
                              {category.rank ? (
                                <Badge variant={category.rank === 1 ? 'default' : 'secondary'}>
                                  {category.rank}위
                                </Badge>
                              ) : (
                                <Badge variant="outline">순위 없음</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                신뢰도 {category.confidence 
                                  ? `${(parseFloat(category.confidence) * 100).toFixed(0)}%`
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                          
                          {category.message && (
                            <p className={`text-sm ${category.rank ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                              {category.message}
                            </p>
                          )}
                          
                          <p className="text-xs text-muted-foreground">
                            전체 {category.totalBlogs}개 블로그
                          </p>

                          {category.topBlogs.length > 0 && (
                            <div className="space-y-1 mt-2">
                              <p className="text-xs font-medium text-muted-foreground">
                                {category.rank ? '해당 카테고리 상위 블로그:' : '이 카테고리에서 대신 노출된 상위 블로그:'}
                              </p>
                              {category.topBlogs.map((blog, blogIdx) => (
                                <a
                                  key={blogIdx}
                                  href={blog.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-xs hover:text-primary"
                                >
                                  <span className="text-muted-foreground">{blogIdx + 1}.</span>
                                  <span className="truncate flex-1">{blog.title || blog.url}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {measurements.length > 1 && (
                  <Card className="p-4 space-y-3">
                    <h3 className="font-semibold">최근 측정 기록</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {measurements.slice(1, 11).map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-sm p-2 hover-elevate rounded-md">
                          <span className="text-muted-foreground">{formatDate(m.measuredAt)}</span>
                          <div className="flex items-center gap-2">
                            {m.rankSmartblock ? (
                              <Badge variant="secondary">{m.rankSmartblock}위</Badge>
                            ) : (
                              <Badge variant="outline">순위 없음</Badge>
                            )}
                            {getStatusBadge(m.smartblockStatus)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="chart" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <RankingChart 
                measurements={measurements} 
                keyword={keyword} 
                targetUrl={targetUrl}
              />
            )}
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <KeywordStatsTab keywordId={keywordId} keyword={keyword} />
          </TabsContent>

          <TabsContent value="blogs" className="mt-4">
            <KeywordBlogsTab keywordId={keywordId} keyword={keyword} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
