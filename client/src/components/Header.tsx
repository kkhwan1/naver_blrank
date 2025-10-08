import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Moon, Sun, BarChart3, Link as LinkIcon, LogOut, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';

interface HeaderProps {
  onAddKeyword?: () => void;
}

export default function Header({ onAddKeyword }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(false);
  const [location] = useLocation();
  const { user, logout, isAdmin } = useAuth();

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    console.log('Dark mode:', newMode ? 'enabled' : 'disabled');
  };

  return (
    <header className="border-b bg-card sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/">
              <div className="flex items-center gap-1 cursor-pointer">
                <h1 className="text-xl font-bold">Rank Tracker</h1>
                <div className="w-2 h-2 rounded-full bg-primary" />
              </div>
            </Link>

            <nav className="hidden md:flex gap-1">
              <Link href="/analyze">
                <Button
                  variant={location === '/analyze' || location === '/' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <LinkIcon className="w-4 h-4" />
                  URL 분석
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button
                  variant={location === '/dashboard' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  대시보드
                </Button>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="키워드 검색..."
                className="pl-9 w-64"
                data-testid="search-input"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              data-testid="toggle-dark-mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            {onAddKeyword && (
              <Button onClick={onAddKeyword} data-testid="button-add-keyword">
                <Plus className="w-4 h-4 mr-2" />
                키워드 추가
              </Button>
            )}

            {user && (
              <div className="flex items-center gap-2 ml-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium" data-testid="text-username">
                    {user.username}
                  </span>
                  {isAdmin && (
                    <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full">
                      관리자
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  data-testid="button-logout"
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">로그아웃</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
