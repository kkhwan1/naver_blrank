import { useLocation } from "wouter";
import { Link } from "wouter";
import { LayoutDashboard, BarChart3, FolderOpen, Settings, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();

  // 알림 개수 조회
  const { data: alertsCount = 0 } = useQuery<number>({
    queryKey: ['/api/alerts/count'],
    select: (data: any) => data?.count || 0,
    refetchInterval: 60000, // 1분마다 갱신
  });

  const navItems = [
    {
      path: "/",
      label: "대시보드",
      icon: LayoutDashboard,
      matchPaths: ["/", "/dashboard"],
    },
    {
      path: "/analytics",
      label: "통계 분석",
      icon: BarChart3,
      matchPaths: ["/analytics"],
    },
    {
      path: "/groups",
      label: "그룹 관리",
      icon: FolderOpen,
      matchPaths: ["/groups"],
    },
    {
      path: "/settings",
      label: "설정",
      icon: Settings,
      matchPaths: ["/settings"],
    },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* 웹 헤더 탭 네비게이션 (md 이상) */}
      <header className="hidden md:block border-b bg-background">
        <div className="container max-w-7xl mx-auto px-4">
          <nav className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link href="/">
                <div className="font-bold text-lg cursor-pointer text-primary">blrank</div>
              </Link>
              <div className="flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = item.matchPaths.includes(location);
                  return (
                    <Link key={item.path} href={item.path}>
                      <div
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                          "hover-elevate",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        data-testid={`nav-${item.path === "/" ? "dashboard" : item.path.slice(1)}`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative"
                data-testid="button-alerts"
              >
                <Bell className="h-5 w-5" />
                {alertsCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-xs"
                    data-testid="badge-alerts-count"
                  >
                    {alertsCount > 99 ? '99+' : alertsCount}
                  </Badge>
                )}
              </Button>
            </div>
          </nav>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* 모바일 하단 네비게이션 (md 미만) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50">
        <div className="grid grid-cols-4">
          {navItems.map((item) => {
            const isActive = item.matchPaths.includes(location);
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex flex-col items-center justify-center h-16 gap-1 transition-colors cursor-pointer",
                    "hover-elevate",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                  data-testid={`nav-mobile-${item.path === "/" ? "dashboard" : item.path.slice(1)}`}
                >
                  <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                  <span className={cn("text-xs", isActive && "font-semibold")}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
