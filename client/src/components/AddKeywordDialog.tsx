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

interface AddKeywordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: { keyword: string; targetUrl: string }) => void;
}

export default function AddKeywordDialog({ open, onOpenChange, onSubmit }: AddKeywordDialogProps) {
  const [keyword, setKeyword] = useState('');
  const [targetUrl, setTargetUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Adding keyword:', { keyword, targetUrl });
    onSubmit?.({ keyword, targetUrl });
    setKeyword('');
    setTargetUrl('');
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
