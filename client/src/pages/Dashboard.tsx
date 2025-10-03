import { useState } from 'react';
import { TrendingUp, ArrowUp, ArrowDown, Bell } from 'lucide-react';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import KeywordTable, { KeywordData } from '@/components/KeywordTable';
import AddKeywordDialog from '@/components/AddKeywordDialog';

// todo: remove mock functionality
const mockKeywords: KeywordData[] = [
  {
    id: '1',
    keyword: '블로그 SEO',
    rank: 1,
    change: 2,
    lastMeasured: '5분 전',
    targetUrl: 'https://blog.naver.com/example/123456',
    status: 'rank1',
  },
  {
    id: '2',
    keyword: '마케팅 전략',
    rank: 3,
    change: -1,
    lastMeasured: '10분 전',
    targetUrl: 'https://blog.naver.com/example/123457',
    status: 'rank2-3',
  },
  {
    id: '3',
    keyword: '콘텐츠 마케팅',
    rank: 2,
    change: 0,
    lastMeasured: '15분 전',
    targetUrl: 'https://blog.naver.com/example/123458',
    status: 'rank2-3',
  },
  {
    id: '4',
    keyword: '키워드 분석',
    rank: null,
    change: -3,
    lastMeasured: '20분 전',
    targetUrl: 'https://blog.naver.com/example/123459',
    status: 'out',
  },
  {
    id: '5',
    keyword: 'SNS 마케팅',
    rank: 1,
    change: 1,
    lastMeasured: '25분 전',
    targetUrl: 'https://blog.naver.com/example/123460',
    status: 'rank1',
  },
];

export default function Dashboard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [keywords, setKeywords] = useState(mockKeywords);

  const stats = {
    total: keywords.length,
    increased: keywords.filter((k) => k.change > 0).length,
    decreased: keywords.filter((k) => k.change < 0).length,
    alerts: keywords.filter((k) => k.status === 'out').length,
  };

  const handleAddKeyword = (data: { keyword: string; targetUrl: string }) => {
    const newKeyword: KeywordData = {
      id: String(keywords.length + 1),
      keyword: data.keyword,
      rank: null,
      change: 0,
      lastMeasured: '방금',
      targetUrl: data.targetUrl,
      status: 'out',
    };
    setKeywords([...keywords, newKeyword]);
    console.log('Keyword added:', newKeyword);
  };

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
            <h2 className="text-2xl font-bold mb-4">키워드 목록</h2>
            <KeywordTable
              keywords={keywords}
              onRowClick={(id) => console.log('View keyword details:', id)}
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
