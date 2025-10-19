import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { RankingChart } from '@/components/RankingChart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface BlogResult {
  url: string;
  title: string;
  position: number;
  isVisible?: boolean;
  blogName?: string;
  publishedDate?: string;
  description?: string;
  imageUrl?: string;
}

interface UnifiedSearchResult {
  keyword: string;
  targetUrl: string;
  targetRank: number | null;
  blogs: BlogResult[];
  totalResults: number;
}

interface Measurement {
  id: number;
  keywordId: number;
  measuredAt: string;
  rankSmartblock: number | null;
  smartblockStatus: string;
  smartblockConfidence: string;
  durationMs: number;
  method: string;
}

export default function KeywordDetail() {
  const [, params] = useRoute('/keyword/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'smartblock' | 'allsearch'>('smartblock');
  const [measuringSmartblock, setMeasuringSmartblock] = useState(false);

  const keywordId = params?.id;

  // 키워드 정보 조회
  const { data: keyword, isLoading: keywordLoading } = useQuery({
    queryKey: ['/api/keywords', keywordId],
    queryFn: async () => {
      const response = await fetch(`/api/keywords`);
      if (!response.ok) throw new Error('키워드 조회 실패');
      const keywords = await response.json();
      // ID를 문자열로 비교 (API가 문자열 ID를 반환함)
      const found = keywords.find((k: any) => String(k.id) === String(keywordId));
      if (!found) throw new Error('키워드를 찾을 수 없습니다');
      return found;
    },
    enabled: !!keywordId,
    retry: 1,
  });

  // 측정 결과 조회
  const { data: measurements = [], isLoading: measurementsLoading } = useQuery<Measurement[]>({
    queryKey: ['/api/measurements', keywordId],
    enabled: !!keywordId,
  });

  // 통합검색 결과 조회
  const { data: unifiedSearchData, isLoading: unifiedSearchLoading, refetch: refetchUnifiedSearch } = useQuery<UnifiedSearchResult>({
    queryKey: ['/api/keywords', keywordId, 'unified-search'],
    queryFn: async () => {
      const response = await fetch(`/api/keywords/${keywordId}/unified-search`);
      if (!response.ok) throw new Error('통합검색 조회 실패');
      return response.json();
    },
    enabled: false, // 수동 조회
  });

  // 스마트블록 측정
  const measureSmartblockMutation = useMutation({
    mutationFn: async () => {
      setMeasuringSmartblock(true);
      const res = await apiRequest('POST', `/api/measure/${keywordId}?method=html`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/keywords'] });
      queryClient.invalidateQueries({ queryKey: ['/api/measurements', keywordId] });
      toast({
        title: '측정 완료',
        description: '스마트블록 순위 측정이 완료되었습니다.',
      });
      setMeasuringSmartblock(false);
    },
    onError: (error: Error) => {
      toast({
        title: '측정 실패',
        description: error.message,
        variant: 'destructive',
      });
      setMeasuringSmartblock(false);
    },
  });

  if (keywordLoading || !keyword) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-keyword-title">
              {keyword.keyword}
            </h1>
            <p className="text-sm text-muted-foreground">
              {keyword.targetUrl}
            </p>
          </div>
        </div>
      </div>

      {/* 탭 버튼 (이미지처럼) */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'smartblock' | 'allsearch')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="smartblock" data-testid="tab-smartblock">
            스마트블록
          </TabsTrigger>
          <TabsTrigger value="allsearch" data-testid="tab-allsearch">
            통합검색
          </TabsTrigger>
        </TabsList>

        {/* 스마트블록 탭 */}
        <TabsContent value="smartblock" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">스마트블록 측정 결과</h2>
            <Button
              onClick={() => measureSmartblockMutation.mutate()}
              disabled={measuringSmartblock}
              data-testid="button-measure-smartblock"
            >
              {measuringSmartblock ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  측정 중...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  재측정
                </>
              )}
            </Button>
          </div>

          {measurementsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : measurements.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">측정 데이터가 없습니다. 측정을 실행해주세요.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <RankingChart measurements={measurements} keyword={keyword.keyword} targetUrl={keyword.targetUrl} />
              
              <Card>
                <CardHeader>
                  <CardTitle>최근 측정 결과</CardTitle>
                  <CardDescription>최근 10개의 측정 결과</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>측정 시간</TableHead>
                        <TableHead>순위</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>소요 시간</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {measurements.slice(0, 10).map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{new Date(m.measuredAt).toLocaleString('ko-KR')}</TableCell>
                          <TableCell>
                            {m.rankSmartblock ? (
                              <Badge variant={m.rankSmartblock === 1 ? 'default' : 'secondary'}>
                                {m.rankSmartblock}위
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={m.smartblockStatus === 'OK' ? 'default' : 'destructive'}>
                              {m.smartblockStatus === 'OK' ? '정상' : m.smartblockStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{m.durationMs}ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* 통합검색 탭 */}
        <TabsContent value="allsearch" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">통합검색 결과</h2>
            <Button
              onClick={() => refetchUnifiedSearch()}
              disabled={unifiedSearchLoading}
              data-testid="button-search-unified"
            >
              {unifiedSearchLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  검색 중...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  통합검색 조회
                </>
              )}
            </Button>
          </div>

          {unifiedSearchData ? (
            <div className="space-y-4">
              {/* 타겟 순위 표시 */}
              {unifiedSearchData.targetRank && (
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">통합검색 순위</p>
                      <p className="text-3xl font-bold text-primary">
                        {unifiedSearchData.targetRank}위
                      </p>
                    </div>
                    <Badge variant="outline" className="text-base">
                      전체 {unifiedSearchData.totalResults}개 중
                    </Badge>
                  </div>
                </Card>
              )}

              {!unifiedSearchData.targetRank && (
                <Card className="p-6">
                  <p className="text-center text-muted-foreground">
                    타겟 블로그가 통합검색 결과에서 발견되지 않았습니다.
                  </p>
                </Card>
              )}

              {/* 블로그 목록 */}
              <div>
                <h3 className="text-sm font-medium mb-3">
                  전체 블로그 목록 ({unifiedSearchData.blogs.length}개)
                </h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {unifiedSearchData.blogs.map((blog, index) => {
                    const isTarget = blog.url === unifiedSearchData.targetUrl || 
                      blog.url.replace(/^https?:\/\//, '').replace(/\/$/, '') === 
                      unifiedSearchData.targetUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

                    return (
                      <Card
                        key={index}
                        className={`p-4 ${isTarget ? 'border-primary border-2' : ''}`}
                        data-testid={`blog-card-${index}`}
                      >
                        <div className="flex gap-4">
                          {/* 썸네일 */}
                          {blog.imageUrl && (
                            <img
                              src={blog.imageUrl}
                              alt={blog.title}
                              className="w-20 h-20 object-cover rounded"
                            />
                          )}

                          <div className="flex-1">
                            {/* 순위 배지 */}
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary">{index + 1}위</Badge>
                              {isTarget && (
                                <Badge variant="default">타겟</Badge>
                              )}
                            </div>

                            {/* 제목 */}
                            <h4 className="font-medium mb-1">
                              <a
                                href={blog.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary"
                              >
                                {blog.title}
                              </a>
                            </h4>

                            {/* 메타 정보 */}
                            <div className="flex gap-2 text-sm text-muted-foreground">
                              {blog.blogName && <span>{blog.blogName}</span>}
                              {blog.publishedDate && <span>• {blog.publishedDate}</span>}
                            </div>

                            {/* 설명 */}
                            {blog.description && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {blog.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <Card className="p-12">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  "통합검색 조회" 버튼을 클릭하여 네이버 통합검색 결과를 확인하세요.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
