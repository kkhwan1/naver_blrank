import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Calendar, User } from 'lucide-react';

interface BlogSearchResult {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  bloggerlink: string;
  postdate: string;
}

interface BlogSearchResponse {
  keyword: string;
  total: number;
  start: number;
  display: number;
  items: BlogSearchResult[];
}

interface KeywordBlogsTabProps {
  keywordId: string | null;
  keyword: string;
}

export default function KeywordBlogsTab({ keywordId, keyword }: KeywordBlogsTabProps) {
  const { data, isLoading, error } = useQuery<BlogSearchResponse>({
    queryKey: ['/api/keywords', keywordId, 'blogs'],
    queryFn: async () => {
      if (!keywordId) throw new Error('No keyword ID');
      const res = await fetch(`/api/keywords/${keywordId}/blogs?display=20`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch blogs');
      }
      return res.json();
    },
    enabled: !!keywordId,
  });

  const formatDate = (dateString: string) => {
    if (!dateString || dateString.length !== 8) return dateString;
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    return `${year}.${month}.${day}`;
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">블로그 검색 중 오류가 발생했습니다</p>
        <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        블로그 검색 결과가 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">"{keyword}" 블로그 검색 결과</h3>
        <Badge variant="secondary">총 {data.total.toLocaleString()}건</Badge>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {/* 순위 근거: 네이버 블로그 검색 API의 응답 순서에 따라 1위부터 순차적으로 표시
            - API는 relevance(정확도순) 또는 date(최신순) 기준으로 정렬된 결과를 반환
            - 현재는 정확도순(기본값)으로 검색하여, API가 반환한 순서가 곧 네이버의 검색 순위를 의미
            - idx + 1이 각 블로그의 검색 순위 (1위, 2위, 3위...) */}
        {data.items.map((blog, idx) => (
          <Card key={idx} className="p-4 hover-elevate" data-testid={`blog-item-${idx}`}>
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <a
                  href={blog.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 hover:text-primary transition-colors"
                  data-testid={`blog-link-${idx}`}
                >
                  <h4 className="font-semibold text-base line-clamp-2">
                    {stripHtml(blog.title)}
                  </h4>
                </a>
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {stripHtml(blog.description)}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <a
                    href={blog.bloggerlink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary"
                  >
                    {blog.bloggername}
                  </a>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(blog.postdate)}</span>
                </div>
                {/* 순위 표시: API 응답 순서 기준 (idx + 1) */}
                <Badge variant="outline" className="text-xs">
                  {idx + 1}위
                </Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
