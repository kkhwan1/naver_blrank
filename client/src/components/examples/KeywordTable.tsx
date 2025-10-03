import KeywordTable, { KeywordData } from '../KeywordTable';

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
    keyword: '콘텐츠 작성법',
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
];

export default function KeywordTableExample() {
  return (
    <div className="p-4">
      <KeywordTable
        keywords={mockKeywords}
        onRowClick={(id) => console.log('Clicked keyword:', id)}
      />
    </div>
  );
}
