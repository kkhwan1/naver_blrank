import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ExternalLink, Link as LinkIcon } from 'lucide-react';
import Header from '@/components/Header';
import { Badge } from '@/components/ui/badge';

interface AnalysisResult {
  url: string;
  title: string;
  keywords: string[];
  naverLinks: string[];
  content: string;
  metadata: {
    wordCount: number;
    linkCount: number;
  };
}

export default function UrlAnalyzer() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!url) {
      setError('URL을 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('분석에 실패했습니다');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">URL 분석</h1>
            <p className="text-muted-foreground">
              분석할 웹페이지 URL을 입력하여 네이버 링크와 키워드를 추출합니다
            </p>
          </div>

          <Card className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">웹페이지 URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                    disabled={loading}
                    data-testid="input-analyze-url"
                  />
                  <Button
                    onClick={handleAnalyze}
                    disabled={loading}
                    data-testid="button-analyze"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        분석 중...
                      </>
                    ) : (
                      '분석'
                    )}
                  </Button>
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
            </div>
          </Card>

          {result && (
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">페이지 정보</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">제목</p>
                    <p className="font-medium">{result.title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">URL</p>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-primary hover:underline flex items-center gap-1"
                    >
                      {result.url}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">단어 수</p>
                      <p className="text-2xl font-bold">{result.metadata.wordCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">링크 수</p>
                      <p className="text-2xl font-bold">{result.metadata.linkCount}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">추출된 키워드</h2>
                {result.keywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {result.keywords.map((keyword, index) => (
                      <Badge key={index} variant="secondary" className="text-sm">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">키워드를 찾을 수 없습니다</p>
                )}
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  네이버 링크
                </h2>
                {result.naverLinks.length > 0 ? (
                  <div className="space-y-2">
                    {result.naverLinks.map((link, index) => (
                      <a
                        key={index}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-md bg-muted hover-elevate font-mono text-sm flex items-center justify-between group"
                        data-testid={`naver-link-${index}`}
                      >
                        <span className="truncate">{link}</span>
                        <ExternalLink className="w-4 h-4 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">네이버 링크를 찾을 수 없습니다</p>
                )}
              </Card>

              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">콘텐츠 미리보기</h2>
                <div className="prose prose-sm max-w-none">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {result.content.substring(0, 500)}
                    {result.content.length > 500 && '...'}
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
