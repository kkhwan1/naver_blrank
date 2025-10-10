import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AddKeywordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: { keyword: string; targetUrl: string; measurementInterval: string }) => void;
}

export default function AddKeywordDialog({ open, onOpenChange, onSubmit }: AddKeywordDialogProps) {
  const [keyword, setKeyword] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [measurementInterval, setMeasurementInterval] = useState('24h');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Adding keyword:', { keyword, targetUrl, measurementInterval });
    onSubmit?.({ keyword, targetUrl, measurementInterval });
    setKeyword('');
    setTargetUrl('');
    setMeasurementInterval('24h');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-add-keyword">
        <DialogHeader>
          <DialogTitle>새 키워드 추가</DialogTitle>
          <DialogDescription>
            추적할 키워드와 블로그 URL을 입력하세요.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyword">키워드</Label>
              <Input
                id="keyword"
                placeholder="예: 블로그 SEO"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                required
                data-testid="input-keyword"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">블로그 URL</Label>
              <Input
                id="url"
                placeholder="https://blog.naver.com/..."
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                required
                data-testid="input-url"
              />
              <p className="text-xs text-muted-foreground">
                네이버 블로그 포스트의 전체 URL을 입력하세요.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval">측정 주기</Label>
              <Select value={measurementInterval} onValueChange={setMeasurementInterval}>
                <SelectTrigger id="interval" data-testid="select-interval">
                  <SelectValue placeholder="측정 주기 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1시간마다</SelectItem>
                  <SelectItem value="6h">6시간마다</SelectItem>
                  <SelectItem value="12h">12시간마다</SelectItem>
                  <SelectItem value="24h">24시간마다</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                자동 측정 주기를 설정하세요.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" data-testid="button-submit-keyword">
              추가
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
