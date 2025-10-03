import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';

interface HeaderProps {
  onAddKeyword?: () => void;
}

export default function Header({ onAddKeyword }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(false);

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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <h1 className="text-xl font-bold">Rank Tracker</h1>
              <div className="w-2 h-2 rounded-full bg-primary" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
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

            <Button onClick={onAddKeyword} data-testid="button-add-keyword">
              <Plus className="w-4 h-4 mr-2" />
              키워드 추가
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
