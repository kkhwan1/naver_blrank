import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Keyword, Measurement } from "@shared/schema";

type KeywordWithRank = Keyword & {
  latestMeasurement?: Measurement;
  previousMeasurement?: Measurement;
  change?: number;
};

export default function Analytics() {
  const { data: keywords = [], isLoading } = useQuery<KeywordWithRank[]>({
    queryKey: ["/api/keywords"],
  });

  // 기간 필터 (7일 또는 30일)
  const [period, setPeriod] = useState<"7d" | "30d">("30d");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  // 순위 변동이 있는 키워드 필터링
  const rankingKeywords = keywords.filter(k => k.latestMeasurement?.rankSmartblock);
  
  // 상승/하락 순위
  const topRanking = [...rankingKeywords]
    .filter(k => k.latestMeasurement?.rankSmartblock)
    .sort((a, b) => (a.latestMeasurement?.rankSmartblock || 999) - (b.latestMeasurement?.rankSmartblock || 999))
    .slice(0, 5);

  return (
    <div className="h-full overflow-auto">
      <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">통계 분석</h1>
          <p className="text-muted-foreground mt-1">키워드 순위 변동 및 측정 이력을 확인하세요</p>
        </div>

        {/* 기간 필터 */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as "7d" | "30d")} className="w-full">
          <TabsList data-testid="tabs-period-filter">
            <TabsTrigger value="7d" data-testid="tab-7days">최근 7일</TabsTrigger>
            <TabsTrigger value="30d" data-testid="tab-30days">최근 30일</TabsTrigger>
          </TabsList>

          <TabsContent value={period} className="space-y-6 mt-6">
            {/* 통계 요약 */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">전체 키워드</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-keywords">{keywords.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    활성: {keywords.filter(k => k.isActive).length}개
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">스마트블록 노출</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-smartblock-keywords">
                    {rankingKeywords.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    노출률: {keywords.length > 0 ? Math.round((rankingKeywords.length / keywords.length) * 100) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">평균 순위</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-avg-rank">
                    {rankingKeywords.length > 0
                      ? (rankingKeywords.reduce((sum, k) => sum + (k.latestMeasurement?.rankSmartblock || 0), 0) / rankingKeywords.length).toFixed(1)
                      : "-"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">스마트블록 기준</p>
                </CardContent>
              </Card>
            </div>

            {/* 순위 변동 차트 */}
            <Card>
              <CardHeader>
                <CardTitle>순위 변동 추이</CardTitle>
                <CardDescription>최근 측정된 스마트블록 순위</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]" data-testid="chart-rank-trend">
                  {rankingKeywords.length > 0 ? (
                    <div className="space-y-4">
                      {rankingKeywords.slice(0, 10).map((keyword) => (
                        <div key={keyword.id} className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{keyword.keyword}</div>
                            <div className="text-sm text-muted-foreground">
                              {keyword.latestMeasurement?.measuredAt
                                ? format(new Date(keyword.latestMeasurement.measuredAt), "yyyy-MM-dd HH:mm", { locale: ko })
                                : "-"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {keyword.change !== undefined && keyword.change !== 0 && (
                              <span className={cn(
                                "text-sm",
                                keyword.change > 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {keyword.change > 0 ? "↑" : "↓"} {Math.abs(keyword.change)}
                              </span>
                            )}
                            <div className="text-2xl font-bold">
                              {keyword.latestMeasurement?.rankSmartblock}위
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      측정 데이터가 없습니다
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 상위 순위 키워드 */}
            <Card>
              <CardHeader>
                <CardTitle>스마트블록 상위 순위</CardTitle>
                <CardDescription>현재 스마트블록에 노출 중인 키워드</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="list-top-keywords">
                  {topRanking.length > 0 ? (
                    topRanking.map((keyword) => (
                      <div
                        key={keyword.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                        data-testid={`keyword-rank-${keyword.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{keyword.keyword}</div>
                          <div className="text-sm text-muted-foreground truncate">{keyword.targetUrl}</div>
                        </div>
                        <div className="ml-4 flex items-center gap-3">
                          <div className="text-2xl font-bold" data-testid={`rank-${keyword.id}`}>
                            {keyword.latestMeasurement?.rankSmartblock}위
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      스마트블록에 노출된 키워드가 없습니다
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 측정 내역 */}
            <Card>
              <CardHeader>
                <CardTitle>최근 측정 내역</CardTitle>
                <CardDescription>전체 키워드의 최근 측정 결과</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="table-recent-measurements">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">키워드</th>
                        <th className="text-left py-3 px-2 font-medium hidden md:table-cell">URL</th>
                        <th className="text-center py-3 px-2 font-medium">순위</th>
                        <th className="text-center py-3 px-2 font-medium hidden sm:table-cell">상태</th>
                        <th className="text-right py-3 px-2 font-medium">측정 시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.slice(0, 10).map((keyword) => (
                        <tr key={keyword.id} className="border-b" data-testid={`measurement-row-${keyword.id}`}>
                          <td className="py-3 px-2">
                            <div className="font-medium">{keyword.keyword}</div>
                          </td>
                          <td className="py-3 px-2 hidden md:table-cell">
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {keyword.targetUrl}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center">
                            {keyword.latestMeasurement?.rankSmartblock ? (
                              <span className="font-bold">{keyword.latestMeasurement.rankSmartblock}위</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center hidden sm:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {keyword.latestMeasurement?.smartblockStatus || "-"}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right text-sm text-muted-foreground">
                            {keyword.latestMeasurement?.measuredAt
                              ? format(new Date(keyword.latestMeasurement.measuredAt), "MM/dd HH:mm", { locale: ko })
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
