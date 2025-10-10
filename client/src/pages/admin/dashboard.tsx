import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Activity, TrendingUp, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserStats {
  user: {
    id: string;
    username: string;
    role: string;
    createdAt: string;
  };
  keywordCount: number;
  measurementCount: number;
  lastActivityAt: string | null;
}

interface UserActivity {
  user: {
    id: string;
    username: string;
    role: string;
  };
  keywords: any[];
  measurements: any[];
}

export default function AdminDashboard() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: stats, isLoading } = useQuery<UserStats[]>({
    queryKey: ["/api/admin/users-stats"],
  });

  const { data: activityData } = useQuery<UserActivity>({
    queryKey: [`/api/admin/users/${selectedUserId}/activities`],
    enabled: !!selectedUserId,
  });

  const totalUsers = stats?.length || 0;
  const totalKeywords = stats?.reduce((sum, s) => sum + s.keywordCount, 0) || 0;
  const totalMeasurements = stats?.reduce((sum, s) => sum + s.measurementCount, 0) || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-admin-title">관리자 대시보드</h1>
        <p className="text-muted-foreground mt-1">모든 사용자의 활동을 모니터링합니다</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">{totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 키워드</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-keywords">{totalKeywords}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 측정</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-measurements">{totalMeasurements}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
          <CardDescription>각 사용자의 활동 통계를 확인하세요</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>사용자명</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead className="text-right">키워드 수</TableHead>
                  <TableHead className="text-right">측정 횟수</TableHead>
                  <TableHead>마지막 활동</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.map((stat) => (
                  <TableRow key={stat.user.id} data-testid={`row-user-${stat.user.id}`}>
                    <TableCell className="font-medium" data-testid={`text-username-${stat.user.id}`}>
                      {stat.user.username}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stat.user.role === "admin" ? "default" : "secondary"}>
                        {stat.user.role === "admin" ? "관리자" : "사용자"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-keyword-count-${stat.user.id}`}>
                      {stat.keywordCount}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-measurement-count-${stat.user.id}`}>
                      {stat.measurementCount}
                    </TableCell>
                    <TableCell>
                      {stat.lastActivityAt ? (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(stat.lastActivityAt), {
                              addSuffix: true,
                              locale: ko,
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">활동 없음</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedUserId(stat.user.id)}
                        data-testid={`button-view-activity-${stat.user.id}`}
                      >
                        활동 보기
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedUserId} onOpenChange={() => setSelectedUserId(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>사용자 활동 상세</DialogTitle>
            <DialogDescription>
              {activityData?.user.username}님의 최근 활동 내역
            </DialogDescription>
          </DialogHeader>
          
          {activityData && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">키워드 목록 ({activityData.keywords.length})</h3>
                {activityData.keywords.length > 0 ? (
                  <div className="space-y-2">
                    {activityData.keywords.map((keyword) => (
                      <Card key={keyword.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{keyword.keyword}</div>
                              <div className="text-sm text-muted-foreground truncate max-w-md">
                                {keyword.targetUrl}
                              </div>
                            </div>
                            <Badge variant={keyword.isActive ? "default" : "secondary"}>
                              {keyword.isActive ? "활성" : "비활성"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">키워드가 없습니다</p>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-3">최근 측정 ({activityData.measurements.length})</h3>
                {activityData.measurements.length > 0 ? (
                  <div className="space-y-2">
                    {activityData.measurements.slice(0, 10).map((measurement) => (
                      <div
                        key={measurement.id}
                        className="flex items-center justify-between p-3 rounded-md bg-muted"
                      >
                        <div className="text-sm">
                          <div className="font-medium">
                            스마트블록: {measurement.rankSmartblock || "-"}위
                          </div>
                          <div className="text-muted-foreground">
                            {formatDistanceToNow(new Date(measurement.measuredAt), {
                              addSuffix: true,
                              locale: ko,
                            })}
                          </div>
                        </div>
                        <Badge variant={measurement.smartblockStatus === "OK" ? "default" : "secondary"}>
                          {measurement.smartblockStatus}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">측정 기록이 없습니다</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
