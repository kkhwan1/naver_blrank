import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Navigation } from 'lucide-react';
import type { UserSettings } from '@shared/schema';

interface NavigationItem {
  id: string;
  label: string;
  path: string;
  isPinned: boolean;
  isFixed?: boolean;
}

const DEFAULT_NAV_ITEMS: NavigationItem[] = [
  { id: 'dashboard', label: '대시보드', path: '/', isPinned: true, isFixed: true },
  { id: 'analytics', label: '통계 분석', path: '/analytics', isPinned: true },
  { id: 'groups', label: '그룹 관리', path: '/groups', isPinned: true },
  { id: 'settings', label: '설정', path: '/settings', isPinned: true },
];

export default function Settings() {
  const { toast } = useToast();
  const [navItems, setNavItems] = useState<NavigationItem[]>(DEFAULT_NAV_ITEMS);

  const { data: userSettings, isLoading } = useQuery<UserSettings>({
    queryKey: ['/api/settings'],
  });

  useEffect(() => {
    if (userSettings?.navigationItems && Array.isArray(userSettings.navigationItems)) {
      const savedItems = userSettings.navigationItems as NavigationItem[];
      setNavItems(
        DEFAULT_NAV_ITEMS.map((item) => {
          const saved = savedItems.find((s) => s.id === item.id);
          return saved ? { ...item, isPinned: saved.isPinned } : item;
        })
      );
    }
  }, [userSettings]);

  const updateMutation = useMutation({
    mutationFn: async (items: NavigationItem[]) => {
      const res = await apiRequest('PUT', '/api/settings', {
        navigationItems: items,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: '설정이 저장되었습니다',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '설정 저장 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleTogglePin = (itemId: string) => {
    const updatedItems = navItems.map((item) =>
      item.id === itemId && !item.isFixed ? { ...item, isPinned: !item.isPinned } : item
    );
    setNavItems(updatedItems);
    updateMutation.mutate(updatedItems);
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">설정</h1>
          <p className="text-muted-foreground mt-1">
            애플리케이션 설정을 관리하세요
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 네비게이션 커스터마이징 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              네비게이션 메뉴
            </CardTitle>
            <CardDescription>
              네비게이션 메뉴에 표시할 항목을 선택하세요
              <br />
              대시보드는 항상 고정됩니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                로딩 중...
              </div>
            ) : (
              navItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 border rounded-md"
                  data-testid={`nav-setting-${item.id}`}
                >
                  <div className="flex-1">
                    <Label htmlFor={`nav-${item.id}`} className="text-base font-medium">
                      {item.label}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.path}
                    </p>
                    {item.isFixed && (
                      <p className="text-xs text-muted-foreground mt-1">
                        이 항목은 항상 표시됩니다
                      </p>
                    )}
                  </div>
                  <Switch
                    id={`nav-${item.id}`}
                    checked={item.isPinned}
                    onCheckedChange={() => handleTogglePin(item.id)}
                    disabled={item.isFixed || updateMutation.isPending}
                    data-testid={`switch-nav-${item.id}`}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 추가 설정 섹션 (미래 확장용) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              기타 설정
            </CardTitle>
            <CardDescription>
              추가 설정 옵션
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-8">
              추가 설정 옵션이 곧 추가될 예정입니다
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
