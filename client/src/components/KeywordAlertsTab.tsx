import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Bell } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface KeywordAlert {
  id: number;
  keywordId: number;
  alertType: 'rank_drop' | 'visibility_loss' | 'measurement_failure';
  threshold: {
    rankThreshold?: number;
  } | null;
  isActive: boolean;
  createdAt: string;
}

interface KeywordAlertsTabProps {
  keywordId: string | null;
  keyword: string;
}

const ALERT_TYPE_LABELS = {
  'rank_drop': '순위 하락',
  'visibility_loss': '통합검색 이탈',
  'measurement_failure': '측정 실패',
};

export default function KeywordAlertsTab({ keywordId, keyword }: KeywordAlertsTabProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [alertType, setAlertType] = useState<'rank_drop' | 'visibility_loss' | 'measurement_failure'>('rank_drop');
  const [rankThreshold, setRankThreshold] = useState('3');

  const { data: alerts = [], isLoading } = useQuery<KeywordAlert[]>({
    queryKey: ['/api/keywords', keywordId, 'alerts'],
    queryFn: async () => {
      if (!keywordId) return [];
      const res = await fetch(`/api/keywords/${keywordId}/alerts`);
      if (!res.ok) throw new Error('알림 설정 조회 실패');
      return res.json();
    },
    enabled: !!keywordId,
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: { alertType: string; threshold: any }) => {
      if (!keywordId) throw new Error('키워드 ID가 없습니다');
      return apiRequest(`/api/keywords/${keywordId}/alerts`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/keywords', keywordId, 'alerts'] });
      toast({
        title: '알림 설정 추가',
        description: '새 알림이 추가되었습니다.',
      });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: '알림 설정 실패',
        description: error.message || '알림 설정 중 오류가 발생했습니다.',
      });
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: number) => {
      if (!keywordId) throw new Error('키워드 ID가 없습니다');
      return apiRequest(`/api/alerts/${alertId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/keywords', keywordId, 'alerts'] });
      toast({
        title: '알림 삭제',
        description: '알림이 삭제되었습니다.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: '알림 삭제 실패',
        description: error.message || '알림 삭제 중 오류가 발생했습니다.',
      });
    },
  });

  const handleCreateAlert = () => {
    if (!keywordId) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '키워드 ID가 없습니다.',
      });
      return;
    }

    // Validate rank threshold for rank_drop type
    if (alertType === 'rank_drop') {
      const parsedThreshold = parseInt(rankThreshold);
      if (isNaN(parsedThreshold) || parsedThreshold < 1 || parsedThreshold > 10) {
        toast({
          variant: 'destructive',
          title: '입력 오류',
          description: '순위 임계값은 1-10 사이의 숫자여야 합니다.',
        });
        return;
      }
    }

    const threshold = alertType === 'rank_drop' 
      ? { rankThreshold: parseInt(rankThreshold) } 
      : null;

    createAlertMutation.mutate({
      alertType,
      threshold,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">알림 설정</h3>
          <p className="text-sm text-muted-foreground">
            {keyword} 키워드에 대한 알림을 설정합니다
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-alert">
              <Plus className="w-4 h-4 mr-2" />
              알림 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 알림 추가</DialogTitle>
              <DialogDescription>
                키워드에 대한 알림 조건을 설정합니다
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="alert-type">알림 타입</Label>
                <Select
                  value={alertType}
                  onValueChange={(value: any) => setAlertType(value)}
                >
                  <SelectTrigger id="alert-type" data-testid="select-alert-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rank_drop">순위 하락</SelectItem>
                    <SelectItem value="visibility_loss">통합검색 이탈</SelectItem>
                    <SelectItem value="measurement_failure">측정 실패</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {alertType === 'rank_drop' && (
                <div className="space-y-2">
                  <Label htmlFor="rank-threshold">순위 임계값</Label>
                  <Input
                    id="rank-threshold"
                    type="number"
                    min="1"
                    max="10"
                    value={rankThreshold}
                    onChange={(e) => setRankThreshold(e.target.value)}
                    placeholder="예: 3"
                    data-testid="input-rank-threshold"
                  />
                  <p className="text-xs text-muted-foreground">
                    순위가 이 값보다 낮아지면 알림을 받습니다
                  </p>
                </div>
              )}

              <Button
                onClick={handleCreateAlert}
                disabled={createAlertMutation.isPending}
                className="w-full"
                data-testid="button-confirm-alert"
              >
                {createAlertMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    추가 중...
                  </>
                ) : (
                  '알림 추가'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {alerts.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">설정된 알림이 없습니다</h3>
          <p className="text-sm text-muted-foreground mb-4">
            알림을 추가하여 키워드 변화를 실시간으로 감지하세요
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id} className="p-4" data-testid={`card-alert-${alert.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="default">
                      {ALERT_TYPE_LABELS[alert.alertType]}
                    </Badge>
                    {!alert.isActive && (
                      <Badge variant="secondary">비활성</Badge>
                    )}
                  </div>
                  {alert.alertType === 'rank_drop' && alert.threshold && (
                    <p className="text-sm text-muted-foreground">
                      순위 임계값: {(alert.threshold as any).rankThreshold}위 이하
                    </p>
                  )}
                  {alert.alertType === 'visibility_loss' && (
                    <p className="text-sm text-muted-foreground">
                      통합검색에서 숨겨질 때 알림
                    </p>
                  )}
                  {alert.alertType === 'measurement_failure' && (
                    <p className="text-sm text-muted-foreground">
                      측정 실패 시 알림
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    생성일: {new Date(alert.createdAt).toLocaleString('ko-KR')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteAlertMutation.mutate(alert.id)}
                  disabled={deleteAlertMutation.isPending}
                  data-testid={`button-delete-alert-${alert.id}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
