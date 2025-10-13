import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { TrendingUp, TrendingDown, Activity, Target, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
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
  
  // 1위 키워드 개수
  const rank1Keywords = keywords.filter(k => k.latestMeasurement?.rankSmartblock === 1).length;

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
            {/* 통계 요약 - 모바일 4×1, 데스크톱 4칸 */}
            <div className="grid gap-3 grid-cols-4 md:gap-4 md:grid-cols-4">
              <StatCard
                title="전체 키워드"
                value={keywords.length}
                icon={Activity}
              />
              <StatCard
                title="스마트블록"
                value={rankingKeywords.length}
                icon={TrendingUp}
              />
              <StatCard
                title="1위 키워드"
                value={rank1Keywords}
                icon={Target}
              />
              <StatCard
                title="평균 순위"
                value={rankingKeywords.length > 0
                  ? (rankingKeywords.reduce((sum, k) => sum + (k.latestMeasurement?.rankSmartblock || 0), 0) / rankingKeywords.length).toFixed(1)
                  : "-"}
                icon={TrendingDown}
              />
            </div>

            {/* 순위 분석 - 아코디언 통합 */}
            <Card>
              <CardHeader>
                <CardTitle>순위 분석</CardTitle>
                <CardDescription>스마트블록 순위 추이 및 상위 키워드</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full" data-testid="accordion-rank-analysis">
                  {/* 순위 변동 추이 */}
                  <AccordionItem value="trend" data-testid="accordion-item-trend">
                    <AccordionTrigger className="hover:no-underline" data-testid="trigger-rank-trend">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        <span>순위 변동 추이 ({rankingKeywords.length}개)</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {rankingKeywords.length > 0 ? (
                        <div className="space-y-4">
                          {/* 차트 */}
                          <div className="h-[250px] w-full" data-testid="chart-rank-trend">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={(() => {
                                // 유효한 순위 데이터만 필터링
                                const validKeywords = rankingKeywords
                                  .filter(k => k.latestMeasurement?.rankSmartblock && k.latestMeasurement.rankSmartblock > 0)
                                  .slice(0, 10);
                                
                                return validKeywords.map((k) => ({
                                  name: k.keyword.length > 10 ? k.keyword.substring(0, 10) + '...' : k.keyword,
                                  순위: k.latestMeasurement?.rankSmartblock || null,
                                  이전순위: k.previousMeasurement?.rankSmartblock || null
                                }));
                              })()}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={11} />
                                <YAxis 
                                  reversed 
                                  domain={['dataMin - 1', 'dataMax + 1']} 
                                  allowDataOverflow={false}
                                  fontSize={11}
                                />
                                <Tooltip />
                                <Legend />
                                <Line 
                                  type="monotone" 
                                  dataKey="순위" 
                                  stroke="#3b82f6" 
                                  strokeWidth={2} 
                                  dot={{ r: 4 }}
                                  connectNulls
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="이전순위" 
                                  stroke="#94a3b8" 
                                  strokeWidth={1} 
                                  strokeDasharray="5 5"
                                  connectNulls
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          
                          {/* 키워드 리스트 */}
                          <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                            {rankingKeywords.slice(0, 10).map((keyword) => (
                              <div key={keyword.id} className="flex items-center gap-2 p-3 rounded-lg border">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate text-sm">{keyword.keyword}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {keyword.latestMeasurement?.measuredAt
                                      ? format(new Date(keyword.latestMeasurement.measuredAt), "MM/dd HH:mm", { locale: ko })
                                      : "-"}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <div className="text-xl font-bold">
                                    {keyword.latestMeasurement?.rankSmartblock}위
                                  </div>
                                  {keyword.change !== undefined && keyword.change !== 0 && (
                                    <span className={cn(
                                      "text-xs",
                                      keyword.change > 0 ? "text-green-600" : "text-red-600"
                                    )}>
                                      {keyword.change > 0 ? "↑" : "↓"} {Math.abs(keyword.change)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-32 text-muted-foreground">
                          측정 데이터가 없습니다
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* 스마트블록 상위 순위 */}
                  <AccordionItem value="top-ranking" data-testid="accordion-item-top">
                    <AccordionTrigger className="hover:no-underline" data-testid="trigger-top-ranking">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        <span>스마트블록 상위 순위 (Top {topRanking.length})</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="max-h-[400px] overflow-y-auto" data-testid="list-top-keywords">
                        {topRanking.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3">
                            {topRanking.map((keyword) => (
                              <div
                                key={keyword.id}
                                className="flex items-center gap-2 p-3 rounded-lg border"
                                data-testid={`keyword-rank-${keyword.id}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate text-sm">{keyword.keyword}</div>
                                  <div className="text-xs text-muted-foreground truncate">{keyword.targetUrl}</div>
                                </div>
                                <div className="text-xl font-bold" data-testid={`rank-${keyword.id}`}>
                                  {keyword.latestMeasurement?.rankSmartblock}위
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            스마트블록에 노출된 키워드가 없습니다
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            {/* 측정 내역 */}
            <Card>
              <CardHeader>
                <CardTitle>최근 측정 내역</CardTitle>
                <CardDescription>전체 키워드의 최근 측정 결과</CardDescription>
              </CardHeader>
              <CardContent>
                {keywords.length > 0 ? (
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
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg mb-2">등록된 키워드가 없습니다</p>
                    <p className="text-sm">대시보드에서 키워드를 추가해주세요</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
