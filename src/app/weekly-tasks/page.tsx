"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeeklyTaskForm } from "@/components/weekly-task-form";
import { WeeklyTaskList } from "@/components/weekly-task-list";
import { useToast } from "@/hooks/use-toast";
import { 
  getCurrentUser, 
  getWeeklyTasksByUser, 
  getWeeklyTaskNoteCounts,
  subscribeToUserNotes
} from "@/lib/supabase";

export default function WeeklyTasksPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weeklyTasks, setWeeklyTasks] = useState<any[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<number, {total: number, unread: number, hasUnresolved: boolean}>>({});
  const [isLoading, setIsLoading] = useState(true);

  // 사용자 정보 로드
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await getCurrentUser();
        if (!userData) {
          toast({
            title: "로그인 필요",
            description: "주간 업무 기록을 보려면 로그인이 필요합니다.",
            variant: "destructive",
          });
          router.push("/login");
          return;
        }
        setUser(userData);
      } catch (error) {
        console.error("사용자 정보 로드 중 오류:", error);
        toast({
          title: "오류 발생",
          description: "사용자 정보를 불러오는 중 문제가 발생했습니다.",
          variant: "destructive",
        });
      }
    };

    loadUser();
  }, [router, toast]);

  // 주간 업무 로드
  const loadWeeklyTasks = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      const tasks = await getWeeklyTasksByUser(user.id, currentYear);
      setWeeklyTasks(tasks);
    } catch (error) {
      console.error("주간 업무 로드 중 오류:", error);
      toast({
        title: "오류 발생",
        description: "주간 업무 정보를 불러오는 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentYear, toast]);

  // 메모 개수 로드 함수
  const loadNoteCounts = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const counts = await getWeeklyTaskNoteCounts(user.id, currentYear);
      setNoteCounts(counts);
    } catch (error) {
      console.error('메모 개수 로드 중 오류:', error);
    }
  }, [user?.id, currentYear]);

  // 실시간 구독 설정
  useEffect(() => {
    if (!user?.id) return;

    console.log('실시간 구독 설정 시작:', user.id);

    // 초기 데이터 로드
    const loadInitialData = async () => {
      await Promise.all([
        loadWeeklyTasks(),
        loadNoteCounts()
      ]);
    };
    loadInitialData();

    // 메모 변경 구독
    const unsubscribe = subscribeToUserNotes(user.id, (payload) => {
      console.log('메모 변경 감지:', payload);
      // 변경된 메모의 주차 정보 확인
      if (payload.new || payload.old) {
        // 메모가 추가, 수정, 삭제된 경우 카운트 업데이트
        loadNoteCounts();
      }
    });

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      console.log('실시간 구독 해제:', user.id);
      unsubscribe();
    };
  }, [user?.id, loadWeeklyTasks, loadNoteCounts]);

  // 주차 변경 시 주간 업무만 다시 로드
  useEffect(() => {
    if (!user?.id) return;
    loadWeeklyTasks();
  }, [currentWeek, currentYear, loadWeeklyTasks]);

  // 주차 변경 핸들러
  const handleWeekChange = (week: number) => {
    setCurrentWeek(week);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">주간 업무 기록</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="1" className="w-full">
            <TabsList className="grid w-full grid-cols-52">
              {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
                <TabsTrigger
                  key={week}
                  value={week.toString()}
                  onClick={() => handleWeekChange(week)}
                  className={`relative ${
                    currentWeek === week ? "bg-blue-600 text-white" : ""
                  }`}
                >
                  {week}주
                  {noteCounts[week] && noteCounts[week].total > 0 && (
                    <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center ${
                      noteCounts[week].hasUnresolved 
                        ? "bg-red-500 text-white" 
                        : noteCounts[week].unread > 0
                        ? "bg-yellow-500 text-white"
                        : "bg-green-500 text-white"
                    }`}>
                      {noteCounts[week].total}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {Array.from({ length: 52 }, (_, i) => i + 1).map((week) => (
              <TabsContent key={week} value={week.toString()}>
                {currentWeek === week && (
                  <div className="space-y-6">
                    <WeeklyTaskForm
                      userId={user.id}
                      year={currentYear}
                      weekNumber={week}
                      onSuccess={loadWeeklyTasks}
                    />
                    <WeeklyTaskList
                      tasks={weeklyTasks.filter(task => task.week_number === week)}
                      isLoading={isLoading}
                    />
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 