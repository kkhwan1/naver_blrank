import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { TrendingUp, ArrowUp, ArrowDown, Bell, Loader2, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import KeywordTable, { KeywordData } from '@/components/KeywordTable';
import AddKeywordDialog from '@/components/AddKeywordDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface KeywordResponse {
  id: string;
  keyword: string;
  targetUrl: string;
  rank: number | null;
  change: number;
  smartblockStatus: string;
  lastMeasured: string | null;
  createdAt: string;
  isActive: boolean;
}

function mapStatusToKeywordStatus(status: string, rank: number | null): KeywordData['status'] {
  if (status === 'ERROR') return 'error';
  if (rank === 1) return 'rank1';
  if (rank === 2 || rank === 3) return 'rank2-3';
  return 'out';
}

function formatLastMeasured(dateString: string | null): string {
  if (!dateString) return '측정 대기 중';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return '방금';
  if (diffMins < 60) return `${diffMins}분 전`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [measuringId, setMeasuringId] = useState<string | null>(null);

  const { data: keywords = [], isLoading } = useQuery<KeywordResponse[]>({
    queryKey: ['/api/keywords'],
  });

  const addKeywordMutation = useMutation({
    mutationFn: async (data: { keyword: string; targetUrl: string }) => {
      return apiRequest('POST', '/api/keywords', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/keywords'] });
      toast({
        title: '키워드 추가 완료',
        description: '새 키워드가 추가되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '키워드 추가 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const measureMutation = useMutation({
    mutationFn: async (id: string) => {
      setMeasuringId(id);
      return apiRequest('POST', `/api/measure/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/keywords'] });
      toast({
        title: '측정 완료',
        description: '스마트블록 순위 측정이 완료되었습니다.',
      });
      setMeasuringId(null);
    },
    onError: (error: Error) => {
      toast({
        title: '측정 실패',
        description: error.message,
        variant: 'destructive',
      });
      setMeasuringId(null);
    },
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/keywords/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/keywords'] });
      toast({
        title: '키워드 삭제 완료',
        description: '키워드가 삭제되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '키워드 삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleAddKeyword = (data: { keyword: string; targetUrl: string }) => {
    addKeywordMutation.mutate(data);
  };

  const handleMeasureKeyword = (id: string) => {
    measureMutation.mutate(id);
  };

  const keywordsData: KeywordData[] = keywords.map((k) => ({
    id: k.id,
    keyword: k.keyword,
    rank: k.rank,
    change: k.change,
    lastMeasured: formatLastMeasured(k.lastMeasured),
    targetUrl: k.targetUrl,
    status: mapStatusToKeywordStatus(k.smartblockStatus, k.rank),
  }));

  const stats = {
    total: keywordsData.length,
    increased: keywordsData.filter((k) => k.change > 0).length,
    decreased: keywordsData.filter((k) => k.change < 0).length,
    alerts: keywordsData.filter((k) => k.status === 'out' || k.status === 'error').length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onAddKeyword={() => setDialogOpen(true)} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="추적 중"
              value={stats.total}
              icon={TrendingUp}
              trend={{ value: 12, label: '지난 주 대비' }}
            />
            <StatCard
              title="순위 상승"
              value={stats.increased}
              icon={ArrowUp}
              trend={{ value: 33, label: '지난 주 대비' }}
            />
            <StatCard
              title="순위 하락"
              value={stats.decreased}
              icon={ArrowDown}
              trend={{ value: -25, label: '지난 주 대비' }}
            />
            <StatCard
              title="알림"
              value={stats.alerts}
              icon={Bell}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">키워드 목록</h2>
              <Button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/keywords'] })}
                variant="outline"
                size="sm"
                data-testid="button-refresh"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                새로고침
              </Button>
            </div>
            <KeywordTable
              keywords={keywordsData}
              onRowClick={(id: string) => {
                if (measuringId === id) return;
                handleMeasureKeyword(id);
              }}
            />
          </div>
        </div>
      </main>

      <AddKeywordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleAddKeyword}
      />
    </div>
  );
}
