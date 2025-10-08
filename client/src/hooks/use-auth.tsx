import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "./use-toast";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  username: string;
  role: "admin" | "user";
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch("/api/user", {
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await apiRequest("POST", "/api/login", { username, password });
      const userData = await response.json();
      setUser(userData);
      toast({
        title: "로그인 성공",
        description: `${username}님, 환영합니다!`,
      });
    } catch (error: any) {
      // Extract error message from "status: message" format
      const errorMsg = error.message?.includes(':') 
        ? error.message.split(':').slice(1).join(':').trim()
        : error.message || "아이디 또는 비밀번호를 확인해주세요";
      
      toast({
        variant: "destructive",
        title: "로그인 실패",
        description: errorMsg,
      });
      throw error;
    }
  };

  const register = async (username: string, password: string) => {
    try {
      const response = await apiRequest("POST", "/api/register", { username, password });
      const userData = await response.json();
      setUser(userData);
      toast({
        title: "회원가입 성공",
        description: "계정이 생성되었습니다",
      });
    } catch (error: any) {
      // Extract error message from "status: message" format
      const errorMsg = error.message?.includes(':') 
        ? error.message.split(':').slice(1).join(':').trim()
        : error.message || "회원가입 중 오류가 발생했습니다";
      
      toast({
        variant: "destructive",
        title: "회원가입 실패",
        description: errorMsg,
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
      setUser(null);
      toast({
        title: "로그아웃",
        description: "로그아웃되었습니다",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "로그아웃 중 오류가 발생했습니다",
      });
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, isAdmin }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
