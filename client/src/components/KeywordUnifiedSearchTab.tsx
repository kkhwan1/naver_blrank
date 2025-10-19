import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, Target, Search } from 'lucide-react';
import { useState } from 'react';

interface Blog {
  url: string;
  title: string;
  position: number;
  blogName?: string;
  author?: string;
  publishedDate?: string;
  description?: string;
  imageUrl?: string;
}

interface UnifiedSearchData {
  keyword: string;
  targetUrl: string;
  targetRank: number | null;
  blogs: Blog[];
  totalResults: number;
}

interface KeywordUnifiedSearchTabProps {
  keywordId: string | null;
  keyword: string;
  targetUrl: string;
}

export default function KeywordUnifiedSearchTab({ 
  keywordId, 
  keyword,
  targetUrl 
}: KeywordUnifiedSearchTabProps) {
  const [isSearching, setIsSearching] = useState(false);
  
  const { data, isLoading, refetch } = useQuery<UnifiedSearchData>({
    queryKey: ['/api/keywords', keywordId, 'unified-search'],
    queryFn: async () => {
      if (!keywordId) throw new Error('키워드 ID가 없습니다');
      const res = await fetch(`/api/keywords/${keywordId}/unified-search`);
      if (!res.ok) throw new Error('통합검색 조회 실패');
      return res.json();
    },
    enabled: false, // 수동으로 실행
  });

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      await refetch();
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Search className="w-5 h-5" />
              네이버 통합검색 블로그 탭
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              실제 통합검색 결과에서 타겟 블로그의 순위를 확인합니다
            </p>
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={isSearching || isLoading}
            data-testid="button-unified-search"
          >
            {isSearching || isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                검색 중...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                검색하기
              </>
            )}
          </Button>
        </div>

        {!data && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>검색하기 버튼을 눌러 통합검색 결과를 확인하세요</p>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* 타겟 순위 표시 */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <span className="font-medium">타겟 블로그 순위</span>
              </div>
              {data.targetRank !== null ? (
                <Badge variant="default" className="text-lg px-3 py-1" data-testid="badge-target-rank">
                  {data.targetRank}위
                </Badge>
              ) : (
                <Badge variant="outline" className="text-sm" data-testid="badge-target-not-found">
                  순위권 외
                </Badge>
              )}
            </div>

            {/* 통합검색 결과 목록 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">
                  검색 결과 ({data.totalResults}개)
                </h4>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {data.blogs.map((blog, idx) => {
                  const isTarget = blog.url === targetUrl || 
                    blog.url.replace(/^https?:\/\//, '').replace(/\/$/, '') === 
                    targetUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

                  return (
                    <Card 
                      key={idx} 
                      className={`p-3 hover-elevate ${isTarget ? 'border-primary bg-primary/5' : ''}`}
                      data-testid={`unified-blog-${idx}`}
                    >
                      <a
                        href={blog.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3"
                      >
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-muted rounded-full text-sm font-semibold">
                          {idx + 1}
                        </div>

                        {blog.imageUrl && (
                          <img
                            src={blog.imageUrl}
                            alt={blog.title}
                            className="w-20 h-20 object-cover rounded flex-shrink-0"
                            data-testid={`unified-blog-image-${idx}`}
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-medium line-clamp-1 ${isTarget ? 'text-primary' : 'hover:text-primary'}`}>
                              {blog.title}
                            </span>
                            {isTarget && (
                              <Badge variant="default" className="flex-shrink-0">타겟</Badge>
                            )}
                            <ExternalLink className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                          </div>

                          {blog.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {blog.description}
                            </p>
                          )}

                          {(blog.blogName || blog.author || blog.publishedDate) && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {(blog.blogName || blog.author) && (
                                <span className="truncate">
                                  {blog.blogName || blog.author}
                                </span>
                              )}
                              {blog.publishedDate && (
                                <>
                                  {(blog.blogName || blog.author) && <span>·</span>}
                                  <span className="whitespace-nowrap">{blog.publishedDate}</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </a>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
