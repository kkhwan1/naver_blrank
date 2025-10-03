import RankTrendChart, { MeasurementData } from '../RankTrendChart';

const mockData: MeasurementData[] = [
  { date: '01/01', rank: 3 },
  { date: '01/02', rank: 3 },
  { date: '01/03', rank: 2 },
  { date: '01/04', rank: 2 },
  { date: '01/05', rank: 1 },
  { date: '01/06', rank: 1 },
  { date: '01/07', rank: 2 },
  { date: '01/08', rank: 2 },
  { date: '01/09', rank: 1 },
  { date: '01/10', rank: 1 },
];

export default function RankTrendChartExample() {
  return (
    <div className="p-4">
      <RankTrendChart data={mockData} />
    </div>
  );
}
