import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

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
  durationMs: number;
  method: string;
  errorMessage?: string;
}

interface MeasurementDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keywordId: string | null;
  keyword: string;
}

export default function MeasurementDetailDialog({ 
  open, 
  onOpenChange, 
  keywordId,
  keyword 
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
      'ERROR': { label: '오류', variant: 'destructive' },
    };
    
    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-measurement-detail">
        <DialogHeader>
          <DialogTitle>{keyword} - 측정 결과</DialogTitle>
          <DialogDescription>
            스마트블록 순위 측정 상세 정보
          </DialogDescription>
        </DialogHeader>
        
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
      </DialogContent>
    </Dialog>
  );
}
