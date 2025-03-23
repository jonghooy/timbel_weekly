"use client";

import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { 
  supabase, 
  getCurrentUser, 
  getWeeklyTasksByUser, 
  saveWeeklyTask, 
  getUserDetails, 
  getUsersWithWeeklyTasks,
  UserRole,
  createUserIfNotExists,
  getAllTeams,
  getDepartments
} from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { UserMenu } from "@/components/ui/user-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LoaderCircle, RefreshCcw, AlertCircle } from "lucide-react";

// 탭 관련 컴포넌트 추가
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WeekData {
  weekNum: number;
  dateRange: string;
  isCurrentWeek: boolean;
  isPastWeek: boolean;
  thisWeekPlans: string;
  nextWeekPlans: string;
  isExistInDB: boolean;
}

export default function WeeklyTaskPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [savingWeeks, setSavingWeeks] = useState<number[]>([]);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [accessibleUsers, setAccessibleUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [hasViewPermission, setHasViewPermission] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // 팀원 관련 상태 추가
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string>('my-tasks');
  // 팀 목록 상태 추가
  const [teams, setTeams] = useState<any[]>([]);
  // 부서 목록 상태 추가
  const [departments, setDepartments] = useState<any[]>([]);

  // 현재 날짜 정보 가져오기
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  
  // 주차 계산 함수
  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };
  
  // 현재 주차 계산
  const currentWeek = getWeekNumber(currentDate);
  
  // 주차 별 날짜 범위 계산 함수
  const getWeekDateRange = (year: number, weekNum: number) => {
    const firstDayOfYear = new Date(year, 0, 1);
    const daysOffset = firstDayOfYear.getDay() - 1; // 월요일 기준으로 조정
    
    // 해당 주의 월요일 계산
    const monday = new Date(year, 0, 1 + (weekNum - 1) * 7 - daysOffset);
    
    // 해당 주의 금요일 계산
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    
    return {
      monday,
      friday,
      dateRange: `${monday.getMonth() + 1}월 ${monday.getDate()}일 ~ ${friday.getMonth() + 1}월 ${friday.getDate()}일`
    };
  };
  
  // 주차 필터링 상태 추가
  const [weekFilter, setWeekFilter] = useState<'all' | 'recent10' | 'recent4' | 'current'>('current');
  
  // 주차 데이터 생성 (현재 주차까지만)
  const generateWeeksData = (): WeekData[] => {
    const weeksData = [];
    
    // 1주차부터 현재 주차까지 생성
    const startWeek = 1;
    for (let weekNum = startWeek; weekNum <= currentWeek; weekNum++) {
      const { monday, friday, dateRange } = getWeekDateRange(currentYear, weekNum);
      
      weeksData.push({
        weekNum,
        dateRange,
        isCurrentWeek: weekNum === currentWeek,
        isPastWeek: weekNum < currentWeek,
        thisWeekPlans: "",
        nextWeekPlans: "",
        isExistInDB: false
      });
    }
    
    return weeksData;
  };
  
  // 주차 데이터 상태
  const [weeksData, setWeeksData] = useState<WeekData[]>(generateWeeksData());
  
  // 초기 필터링된 주차 데이터 생성 함수
  const getInitialFilteredData = (data: WeekData[]) => {
    // 이번주만 필터링
    return data.filter(week => week.isCurrentWeek);
  };
  
  const [filteredWeeksData, setFilteredWeeksData] = useState<WeekData[]>(getInitialFilteredData(weeksData));
  const currentWeekRef = useRef<HTMLTableRowElement>(null);
  
  // 테이블 컨테이너 참조 (직접 접근 대신 useRef 사용)
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // 주차 필터링 적용
  useEffect(() => {
    if (weekFilter === 'all') {
      setFilteredWeeksData(weeksData);
    } else if (weekFilter === 'recent10') {
      // 최근 10주차 필터링
      const filteredData = [...weeksData]
        .sort((a, b) => b.weekNum - a.weekNum)
        .slice(0, 10)
        .sort((a, b) => a.weekNum - b.weekNum);
      setFilteredWeeksData(filteredData);
    } else if (weekFilter === 'recent4') {
      // 최근 4주차 필터링
      const filteredData = [...weeksData]
        .sort((a, b) => b.weekNum - a.weekNum)
        .slice(0, 4)
        .sort((a, b) => a.weekNum - b.weekNum);
      setFilteredWeeksData(filteredData);
    } else if (weekFilter === 'current') {
      // 이번주만 필터링
      const filteredData = weeksData.filter(week => week.isCurrentWeek);
      setFilteredWeeksData(filteredData);
    }
  }, [weekFilter, weeksData]);
  
  // 주간 업무 저장 핸들러
  const handleSave = async (weekNum: number) => {
    if (!userId || !selectedUserId || isLoading) return;

    try {
      // 저장 상태 업데이트
      setSavingWeeks(prev => [...prev, weekNum]);

      // 해당 주차 데이터 찾기
      const weekData = weeksData.find(week => week.weekNum === weekNum);
      if (!weekData) {
        throw new Error("주차 데이터를 찾을 수 없습니다.");
      }

      // API를 통해 데이터 저장
      const success = await saveWeeklyTask(
        selectedUserId,
        currentYear,
        weekNum,
        weekData.thisWeekPlans,
        weekData.nextWeekPlans,
        "", // notes (빈 문자열)
        userId // 현재 사용자 ID
      );

      if (!success) {
        throw new Error("주간 업무 저장에 실패했습니다.");
      }

      // 저장 성공 후 상태 업데이트
      setWeeksData(prev => 
        prev.map(week => 
          week.weekNum === weekNum 
            ? { ...week, isExistInDB: true } 
            : week
        )
      );

      toast({
        title: "저장 완료",
        description: `${weekNum}주차 업무 계획이 저장되었습니다.`,
      });
    } catch (error) {
      console.error("저장 중 오류 발생:", error);
      toast({
        title: "저장 실패",
        description: "업무 계획을 저장하는 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      // 저장 상태 업데이트
      setSavingWeeks(prev => prev.filter(week => week !== weekNum));
    }
  };
  
  // 이벤트 시스템 초기화 함수 - 인터랙션 문제 해결
  const initializeEventSystem = useCallback(() => {
    setTimeout(() => {
      if (tableContainerRef.current) {
        // 테이블 컨테이너에 직접 이벤트 발생
        const testEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        
        tableContainerRef.current.dispatchEvent(testEvent);
        
        // 테이블 내부 요소들에 강제 포커스
        const firstRow = tableContainerRef.current.querySelector('tbody tr');
        if (firstRow) {
          (firstRow as HTMLElement).click();
        }
      }
    }, 800);
  }, []);
  
  // 사용자 정보 및 주간 업무 데이터 로드 함수
  const loadUserAndTasks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 전체 로딩 타임아웃 처리
      const globalTimeoutId = setTimeout(() => {
        setIsLoading(false);
        setError("로딩 시간 초과. 새로고침 후 다시 시도해주세요.");
        toast({
          title: "로딩 시간 초과",
          description: "데이터를 불러오는 중 시간이 초과되었습니다. 새로고침 후 다시 시도해주세요.",
          variant: "destructive",
        });
      }, 15000); // 15초 후에 타임아웃 처리
      
      // 세션 상태 초기화 시도 - 인증 문제를 해결하기 위한 추가 단계
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('세션 조회 오류:', sessionError);
        }
        
        // 세션이 없는 경우 로그인 페이지로 리디렉션
        if (!sessionData.session) {
          clearTimeout(globalTimeoutId); // 타임아웃 취소
          window.location.replace('/login');
          return;
        }
      } catch (sessionError) {
        console.error('세션 확인 중 오류 발생:', sessionError);
      }
      
      // 현재 사용자 정보 가져오기
      const user = await getCurrentUser();
      if (!user) {
        // 사용자가 없으면 로그인 페이지로 리디렉션 (부드러운 전환)
        clearTimeout(globalTimeoutId); // 타임아웃 취소
        window.location.replace('/login');
        return;
      }
      
      setUserId(user.id);
      setUser(user);
      setSelectedUserId(user.id);
      
      // users 테이블에 정보가 없는 경우 자동으로 생성
      try {
        await createUserIfNotExists(user);
      } catch (userCreateError) {
        console.error('사용자 정보 자동 생성 중 오류:', userCreateError);
        // 계속 진행 (오류가 발생해도 기존 로직은 계속)
      }
      
      // 부서 및 팀 정보 로드 (모든 사용자에게 필요한 정보)
      try {
        // 부서 정보 로드
        const departmentsList = await getDepartments();
        setDepartments(departmentsList);
        
        // 팀 정보 로드
        const teamsList = await getAllTeams();
        setTeams(teamsList);
      } catch (loadError) {
        console.error('팀/부서 정보 로드 중 오류:', loadError);
        // 오류가 발생해도 계속 진행
      }
      
      // 사용자 프로필 정보 가져오기
      let userDetails = null;
      try {
        userDetails = await getUserDetails(user.id);
      } catch (profileError) {
        console.error('사용자 프로필 정보 로드 중 오류:', profileError);
        // 프로필 로드 실패 시 기본값으로 계속 진행
      }
      
      if (userDetails) {
        setProfile(userDetails);
        
        // 권한에 따라 볼 수 있는 사용자 설정
        const hasHigherPermission = [
          UserRole.SUPER, 
          UserRole.ADMIN, 
          UserRole.MANAGER, 
          UserRole.TEAM_LEADER
        ].includes(userDetails.role as UserRole);
        
        setHasViewPermission(hasHigherPermission);
        
        // 권한이 있는 경우, 볼 수 있는 사용자 목록 가져오기
        if (hasHigherPermission) {
          try {
            const accessibleUsersList = await getUsersWithWeeklyTasks(user.id);
            setAccessibleUsers(accessibleUsersList);
            
            // 사업부장인 경우 부서 내 모든 사용자 필터링
            if (userDetails.role === UserRole.MANAGER && userDetails.department_id) {
              const departmentMembers = accessibleUsersList.filter(
                (member: any) => 
                  member.department_id === userDetails.department_id && 
                  member.id !== user.id
              );
              
              // 팀별로 구분된 부서원 목록 생성
              const departmentMembersByTeam = departmentMembers.reduce((acc: any, member: any) => {
                if (!member.team_id) {
                  if (!acc['no-team']) acc['no-team'] = { id: 'no-team', name: '팀 미지정', members: [] };
                  acc['no-team'].members.push(member);
                } else {
                  if (!acc[member.team_id]) {
                    // 팀 정보 찾기 로직 개선
                    let teamName = '팀 이름 없음';
                    
                    // 1. teams 배열에서 먼저 찾기
                    const teamFromList = teams.find((team: any) => team.id === member.team_id);
                    if (teamFromList && teamFromList.name) {
                      teamName = teamFromList.name;
                    } 
                    // 2. 사용자 자신의 team_name 사용
                    else if (member.team_name) {
                      teamName = member.team_name;
                    }
                    // 3. accessibleUsersList에서 같은 팀을 가진 다른 사용자의 team_name 사용
                    else {
                      const userWithSameTeam = accessibleUsersList.find(
                        (u: any) => u.team_id === member.team_id && u.team_name
                      );
                      if (userWithSameTeam && userWithSameTeam.team_name) {
                        teamName = userWithSameTeam.team_name;
                      }
                    }
                    
                    acc[member.team_id] = { 
                      id: member.team_id, 
                      name: teamName,
                      original_team_id: member.team_id, // 원본 팀 ID 보존
                      members: [] 
                    };
                  }
                  acc[member.team_id].members.push(member);
                }
                return acc;
              }, {});
              
              // 팀 목록 설정 - team_name 기준으로 정렬
              setTeamMembers(
                Object.values(departmentMembersByTeam).sort((a: any, b: any) => {
                  // '팀 미지정'은 항상 마지막에
                  if (a.id === 'no-team') return 1;
                  if (b.id === 'no-team') return -1;
                  // 그 외에는 이름 순서로 정렬
                  return a.name.localeCompare(b.name);
                })
              );
            }
            // 팀장인 경우 팀원 목록 필터링
            else if (userDetails.role === UserRole.TEAM_LEADER && userDetails.team_id) {
              const filteredTeamMembers = accessibleUsersList.filter(
                (member: any) => 
                  member.team_id === userDetails.team_id && 
                  member.id !== user.id
              );
              
              if (filteredTeamMembers.length > 0) {
                setTeamMembers([{ 
                  id: userDetails.team_id,
                  name: '내 팀',
                  members: filteredTeamMembers 
                }]);
              } else {
                setTeamMembers([]);
              }
            }
          } catch (usersListError) {
            console.error('사용자 목록 로드 중 오류:', usersListError);
            // 사용자 목록 로드 실패 시 빈 목록으로 계속 진행
            setAccessibleUsers([]);
            setTeamMembers([]);
          }
        }
      } else {
        // 사용자 정보가 없는 경우 기본 정보 설정
        setProfile({
          id: user.id,
          email: user.email || "",
          full_name: user.user_metadata?.full_name || "사용자",
          department_id: null,
          team_id: null,
          role: "MEMBER",
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        // 기본적으로 본인의 주간 업무만 볼 수 있음
        setHasViewPermission(false);
      }
      
      // 주간 업무 데이터 로드
      try {
        await loadWeeklyTasks(user.id);
        
        // 팀장이고 팀원이 있는 경우 팀원 데이터도 미리 로드
        if (
          teamMembers.length > 0 && 
          (userDetails?.role === UserRole.TEAM_LEADER || userDetails?.role === UserRole.MANAGER)
        ) {
          // 첫 번째 팀원의 데이터도 미리 로드 (탭 전환 시 빠른 반응을 위해)
          const firstTeamMember = teamMembers[0];
          if (firstTeamMember) {
            try {
              // 백그라운드에서 첫 번째 팀원 데이터 미리 로드
              getWeeklyTasksByUser(firstTeamMember.id, currentYear, userId || undefined)
                .then(() => {
                  // 나머지 팀원들의 데이터도 비동기적으로 로드하되 결과는 무시
                  Promise.all(
                    teamMembers.slice(1).map(member => 
                      getWeeklyTasksByUser(member.id, currentYear, userId || undefined)
                    )
                  ).catch(() => {}); // 오류가 발생해도 무시
                })
                .catch(() => {}); // 오류가 발생해도 무시
            } catch (error) {
              // 백그라운드 로드 실패해도 계속 진행
            }
          }
        }
      } catch (tasksError) {
        console.error('주간 업무 데이터 로드 중 오류:', tasksError);
        // 데이터 로드 실패 시 빈 데이터로 계속
      }
      
      // 전체 데이터 로드가 완료되면 타임아웃 취소
      clearTimeout(globalTimeoutId);
      
      // 데이터 로드 후 이벤트 시스템 초기화
      setTimeout(() => {
        setIsLoading(false);
        // 모든 데이터 로딩 후 이벤트 시스템 초기화
        initializeEventSystem();
      }, 200);
    } catch (error) {
      console.error("데이터 로드 중 오류 발생:", error);
      setError("데이터를 불러오는 중 문제가 발생했습니다. 새로고침 후 다시 시도해주세요.");
      toast({
        title: "오류 발생",
        description: "데이터를 불러오는 중 문제가 발생했습니다.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // 사용자 정보 및 주간 업무 데이터 로드
  useEffect(() => {
    const loadInitialData = async () => {
      await loadUserAndTasks();
    };
    
    loadInitialData();
    
    // 인증 상태 변경 리스너
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event);
      if (event === "SIGNED_OUT") {
        window.location.replace('/login');
      }
    });
    
    // 클린업 함수에서 리스너 제거
    return () => {
      data.subscription.unsubscribe();
    };
  }, [initializeEventSystem]);

  // 주간 업무 데이터 로드
  const loadWeeklyTasks = async (targetUserId: string) => {
    // 타임아웃 ID 변수를 밖에 선언하고 초기화
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    try {
      // 로딩 타임아웃 처리
      timeoutId = setTimeout(() => {
        setIsLoading(false);
        
        // 타임아웃 발생 시에도 기본 데이터로 계속 진행
        const generatedData = generateWeeksData();
        setWeeksData(generatedData);
        // 필터 적용
        applyWeekFilter(generatedData);
        
        // 토스트 메시지 표시
        toast({
          title: "데이터 로드 시간 초과",
          description: "일부 데이터를 불러오지 못했습니다. 저장 기능은 계속 사용 가능합니다.",
          variant: "destructive",
        });
        
        // 이벤트 시스템 초기화 (타임아웃 후에도 인터랙션이 작동하도록)
        setTimeout(() => {
          initializeEventSystem();
        }, 500);
      }, 7000); // 7초로 단축
      
      // 사용자의 주간 업무 데이터 가져오기
      let tasks = [];
      try {
        tasks = await getWeeklyTasksByUser(targetUserId, currentYear, userId || undefined);
      } catch (taskError) {
        // 오류 발생 시 빈 데이터로 계속 진행
        tasks = [];
      }
      
      // 타임아웃이 발생하지 않았다면 취소
      clearTimeout(timeoutId);
      
      // DB 데이터를 weeksData에 병합
      const updatedWeeksData = weeksData.map(week => {
        // 해당 주차에 대한 DB 데이터 찾기
        const taskData = tasks.find(task => task.week_number === week.weekNum);
        
        if (taskData) {
          // DB에 저장된 데이터가 있으면 해당 데이터로 업데이트
          return {
            ...week,
            thisWeekPlans: taskData.this_week_tasks || "",
            nextWeekPlans: taskData.next_week_plan || "",
            isExistInDB: true
          };
        }
        
        return {
          ...week,
          thisWeekPlans: "",  // 새로운 사용자 선택 시 초기화
          nextWeekPlans: "",  // 새로운 사용자 선택 시 초기화
          isExistInDB: false
        };
      });
      
      setWeeksData(updatedWeeksData);
      // 필터 적용
      applyWeekFilter(updatedWeeksData);
      
      // 데이터 로드 완료 후 이벤트 시스템 초기화
      setTimeout(() => {
        initializeEventSystem();
      }, 300);
    } catch (error) {
      // 오류 발생 시 타임아웃 취소
      if (timeoutId) clearTimeout(timeoutId);
      
      // 기본 주차 데이터로 초기화 (실패해도 UI는 보여주기 위함)
      const generatedData = generateWeeksData();
      setWeeksData(generatedData);
      // 필터 적용
      applyWeekFilter(generatedData);
      
      toast({
        title: "데이터 로드 오류",
        description: "주간 업무 데이터를 불러오는 중 문제가 발생했습니다. 기본 데이터로 계속합니다.",
        variant: "destructive",
      });
      
      // 오류 발생 후에도 이벤트 시스템 초기화 시도
      setTimeout(() => {
        setIsLoading(false);
        initializeEventSystem();
      }, 300);
    }
  };

  // 주차 필터 적용 함수
  const applyWeekFilter = (data: WeekData[]) => {
    if (weekFilter === 'all') {
      setFilteredWeeksData(data);
    } else if (weekFilter === 'recent10') {
      // 최근 10주차 필터링
      const filteredData = [...data]
        .sort((a, b) => b.weekNum - a.weekNum)
        .slice(0, 10)
        .sort((a, b) => a.weekNum - b.weekNum);
      setFilteredWeeksData(filteredData);
    } else if (weekFilter === 'recent4') {
      // 최근 4주차 필터링
      const filteredData = [...data]
        .sort((a, b) => b.weekNum - a.weekNum)
        .slice(0, 4)
        .sort((a, b) => a.weekNum - b.weekNum);
      setFilteredWeeksData(filteredData);
    } else if (weekFilter === 'current') {
      // 이번주만 필터링
      const filteredData = data.filter(week => week.isCurrentWeek);
      setFilteredWeeksData(filteredData);
    }
  };

  // 주차 필터 변경 핸들러
  const handleWeekFilterChange = (filter: 'all' | 'recent10' | 'recent4' | 'current') => {
    setWeekFilter(filter);
  };

  // 사용자 변경 처리 함수
  const handleUserChange = useCallback(async (newUserId: string) => {
    try {
      // 이전 사용자 ID 저장 (null인 경우 기본값으로 빈 문자열 사용)
      const previousUserId = selectedUserId || userId || "";
      
      // 상태 업데이트
      setIsLoading(true);
      setSelectedUserId(newUserId);
      
      // 로딩 타임아웃 설정
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
        
        // 실패 시 이전 사용자로 복귀
        setSelectedUserId(previousUserId || null);
        
        toast({
          title: "로딩 시간 초과",
          description: "해당 사용자의 주간 업무 데이터를 불러오는데 실패했습니다.",
          variant: "destructive",
        });
      }, 10000);
      
      try {
        // 선택한 사용자의 주간 업무 로드
        await loadWeeklyTasks(newUserId);
        clearTimeout(timeoutId);
        
        toast({
          title: "사용자 변경 완료",
          description: `${accessibleUsers.find(u => u.id === newUserId)?.full_name || "선택한 사용자"}의 주간 업무를 로드했습니다.`,
          variant: "default",
        });
      } catch (error) {
        // 실패 시 이전 사용자로 복귀
        setSelectedUserId(previousUserId || null);
        clearTimeout(timeoutId);
        
        toast({
          title: "오류 발생",
          description: "해당 사용자의 주간 업무 데이터를 불러오는데 실패했습니다.",
          variant: "destructive",
        });
        
        // 이전 사용자의 데이터로 복구 시도 (ID가 있을 경우만)
        if (previousUserId) {
          try {
            await loadWeeklyTasks(previousUserId);
          } catch (recoveryError) {
            // 복구 실패 - 기본 상태 유지
          }
        }
      }
    } catch (outerError) {
      // 오류 처리
      setIsLoading(false);
    }
  }, [selectedUserId, accessibleUsers, loadWeeklyTasks, userId]);

  // 변경 핸들러 수정
  const handleInputChange = (weekNum: number, field: string, value: string) => {
    // 지난 주차는 변경 불가
    if (weekNum < currentWeek) return;
    
    setWeeksData(prev => 
      prev.map(week => 
        week.weekNum === weekNum 
          ? { ...week, [field]: value } 
          : week
      )
    );
  };
  
  // 현재 주차로 자동 스크롤
  useEffect(() => {
    if (currentWeekRef.current && !isLoading) {
      currentWeekRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isLoading]);
  
  // 권한에 따른 읽기 전용 여부 확인
  const isReadOnly = selectedUserId !== userId;
  
  // 사용자/탭 변경 처리 함수
  const handleTabChange = async (tabId: string) => {
    // 탭이 이미 선택된 상태인 경우 다시 로드하지 않음
    if (tabId === activeTab) return;
    
    setActiveTab(tabId);
    
    try {
      setIsLoading(true);
      
      // 내 업무 탭인 경우
      if (tabId === 'my-tasks') {
        setSelectedUserId(userId);
        await loadWeeklyTasks(userId || '');
      } 
      // 팀원 업무 탭인 경우
      else if (tabId.startsWith('member-')) {
        const memberId = tabId.replace('member-', '');
        const selectedMember = accessibleUsers.find(u => u.id === memberId);
        
        if (selectedMember) {
          setSelectedUserId(memberId);
          await loadWeeklyTasks(memberId);
        }
      }
      // 사업부장의 팀 탭인 경우
      else if (tabId.startsWith('team-')) {
        // 팀 탭을 클릭했을 때는 해당 팀의 첫 번째 멤버를 선택
        const teamId = tabId.replace('team-', '');
        const selectedTeam = teamMembers.find((team: any) => team.id === teamId);
        
        if (selectedTeam && selectedTeam.members.length > 0) {
          const firstMember = selectedTeam.members[0];
          setSelectedUserId(firstMember.id);
          await loadWeeklyTasks(firstMember.id);
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      toast({
        title: "오류 발생",
        description: "업무 데이터를 불러오는 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 팀 이름 가져오는 헬퍼 함수 추가
  const getTeamName = (teamId: string | null) => {
    if (!teamId) return '팀 미지정';
    
    // 1. teams 배열에서 먼저 찾기
    const teamInfo = teams.find((team: any) => team.id === teamId);
    if (teamInfo && teamInfo.name) {
      return teamInfo.name;
    }
    
    // 2. accessibleUsers에서 같은 팀을 가진 사용자의 팀 이름 찾기
    const userWithSameTeam = accessibleUsers.find(
      (u: any) => u.team_id === teamId && u.team_name
    );
    if (userWithSameTeam && userWithSameTeam.team_name) {
      return userWithSameTeam.team_name;
    }
    
    // 3. teamMembers에서 찾기
    for (const team of teamMembers) {
      if (team.id === teamId && team.name && team.name !== '팀 이름 없음') {
        return team.name;
      }
    }
    
    return '팀 이름 없음';
  };

  // 부서 이름 가져오는 헬퍼 함수 수정
  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return '사업부 미지정';
    
    // 직접 departments 배열에서 부서 정보 찾기
    const departmentInfo = departments.find(dept => dept.id === departmentId);
    if (departmentInfo) {
      return departmentInfo.name;
    }
    
    // departments에 없는 경우 accessibleUsers에서 찾기 (기존 방식 유지)
    const userWithDept = accessibleUsers.find(u => u.department_id === departmentId);
    return userWithDept?.department_name || '사업부 미지정';
  };

  // 역할에 따른 UI 표시
  const renderUserSelectionUI = () => {
    // 팀장이나 사업부장 권한이 있을 경우 탭 UI 표시
    if ((profile?.role === UserRole.TEAM_LEADER || profile?.role === UserRole.MANAGER) && teamMembers.length > 0) {
      return (
        <Tabs 
          defaultValue="my-tasks" 
          value={activeTab}
          onValueChange={handleTabChange}
          className="mb-6"
        >
          <div className="relative">
            <div className="absolute left-0 bottom-0 w-full h-[1px] bg-border"></div>
            <div className="overflow-x-auto pb-1 hide-scrollbar">
              <TabsList className="bg-transparent p-0 h-auto flex space-x-2 relative">
                <TabsTrigger 
                  value="my-tasks" 
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-400 rounded-t-lg rounded-b-none px-4 py-2 h-10 transition-all"
                >
                  <div className="flex items-center space-x-2">
                    <Avatar className="h-6 w-6 border-2 border-white dark:border-gray-900 shadow-sm">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-blue-600 text-white text-xs">
                        {profile?.full_name?.substring(0, 2) || 'ME'}
                      </AvatarFallback>
                    </Avatar>
                    <span>내 업무</span>
                  </div>
                </TabsTrigger>
                
                {/* 사업부장인 경우 팀별로 그룹화하여 탭 표시 */}
                {profile?.role === UserRole.MANAGER && teamMembers.map((team: any) => (
                  <div key={team.id} className="relative group">
                    <TabsTrigger 
                      value={`team-${team.id}`}
                      className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-400 rounded-t-lg rounded-b-none px-4 py-2 h-10 transition-all"
                      title={`${profile?.department_name || '사업부 미지정'} / ${team.name || '팀 미지정'}`}
                    >
                      <div className="flex items-center space-x-2">
                        <span>{team.name !== '팀 이름 없음' ? team.name : getTeamName(team.original_team_id) || '팀 미지정'} ({team.members.length}명)</span>
                      </div>
                      {/* 툴팁 추가 */}
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
                        {profile?.department_name || '사업부 미지정'} / {team.name !== '팀 이름 없음' ? team.name : getTeamName(team.original_team_id) || '팀 미지정'}
                      </div>
                    </TabsTrigger>
                    
                    {/* 팀원 목록 드롭다운 */}
                    <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 w-60 hidden group-hover:block">
                      <div className="p-2">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">팀원 목록</p>
                        {team.members.map((member: any) => (
                          <button
                            key={member.id}
                            onClick={() => {
                              setSelectedUserId(member.id);
                              loadWeeklyTasks(member.id);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center space-x-2 ${
                              selectedUserId === member.id
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            title={`${getDepartmentName(member.department_id)} / ${getTeamName(member.team_id)}`}
                          >
                            <Avatar className="h-6 w-6 border border-gray-200 dark:border-gray-700">
                              <AvatarImage src={member.avatar_url || undefined} />
                              <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs">
                                {member.full_name?.substring(0, 2) || '??'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{member.full_name || '이름 없음'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* 팀장인 경우 팀원 목록 표시 */}
                {profile?.role === UserRole.TEAM_LEADER && teamMembers.length > 0 && 
                 teamMembers[0].members.map((member: any) => (
                  <TabsTrigger 
                    key={member.id} 
                    value={`member-${member.id}`}
                    className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-md data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-400 rounded-t-lg rounded-b-none px-4 py-2 h-10 transition-all group relative"
                    title={`${getDepartmentName(member.department_id)} / ${getTeamName(member.team_id)}`}
                    onClick={() => {
                      setSelectedUserId(member.id);
                      loadWeeklyTasks(member.id);
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <span>{member.full_name || '이름 없음'}</span>
                    </div>
                    {/* 툴팁 추가 */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50">
                      {getDepartmentName(member.department_id)} / {getTeamName(member.team_id)}
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>
          
          {/* 사업부장인 경우 현재 선택된 팀의 멤버 목록 표시 */}
          {profile?.role === UserRole.MANAGER && activeTab.startsWith('team-') && (
            <div className="mt-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {teamMembers
                  .find((team: any) => `team-${team.id}` === activeTab)
                  ?.members.map((member: any) => (
                    <button
                      key={member.id}
                      onClick={() => {
                        setSelectedUserId(member.id);
                        loadWeeklyTasks(member.id);
                      }}
                      className={`flex items-center space-x-3 p-2 rounded-md ${
                        selectedUserId === member.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                      }`}
                      title={`${getDepartmentName(member.department_id)} / ${getTeamName(member.team_id)}`}
                    >
                      <Avatar className="h-8 w-8 border-2 border-gray-50 dark:border-gray-800 shadow-sm">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-r from-blue-400 to-indigo-400 text-white text-xs">
                          {member.full_name?.substring(0, 2) || '??'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-left">
                        <p className="text-sm font-medium truncate">{member.full_name || '이름 없음'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.role || 'MEMBER'}</p>
                      </div>
                    </button>
                ))}
              </div>
            </div>
          )}
        </Tabs>
      );
    }
    
    // SUPER 또는 ADMIN 권한이 있는 경우 사용자 선택 드롭다운 표시
    if ((profile?.role === UserRole.SUPER || profile?.role === UserRole.ADMIN) && accessibleUsers.length > 0) {
      return (
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <h2 className="text-lg font-semibold">사용자 업무 확인</h2>
          </div>
          
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-grow">
                <Label htmlFor="userSelect" className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 block">사용자 선택</Label>
                <Select 
                  value={selectedUserId || userId || undefined}
                  onValueChange={(value) => {
                    if (value !== selectedUserId) {
                      handleUserChange(value);
                    }
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="사용자 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>사용자 목록</SelectLabel>
                      {accessibleUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id} className="py-2">
                          <div className="flex items-center">
                            <Avatar className="h-6 w-6 mr-2">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200 text-xs">
                                {user.full_name?.substring(0, 2) || '??'}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {user.full_name} 
                              {user.id === userId ? (
                                <span className="ml-1 text-xs font-medium text-blue-600 dark:text-blue-400">(나)</span>
                              ) : null}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center sm:justify-start text-gray-500 dark:text-gray-400">
                  <LoaderCircle size={16} className="mr-2 animate-spin" />
                  <span className="text-sm">데이터 로드 중...</span>
                </div>
              ) : selectedUserId && selectedUserId !== userId ? (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setSelectedUserId(userId);
                    loadWeeklyTasks(userId || '');
                  }}
                  className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                >
                  내 업무로 돌아가기
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      {/* 오류 메시지 표시 */}
      {error && (
        <div className="mb-6 rounded-lg bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 p-4 border border-red-200 dark:border-red-800/50 shadow-sm">
          <div className="flex items-start">
            <AlertCircle className="text-red-500 mt-0.5 mr-3" size={20} />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 dark:text-red-300 mb-1">오류가 발생했습니다</h3>
              <p className="text-sm text-red-700 dark:text-red-400 mb-3">{error}</p>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setError(null);
                  // 로딩 처리 및 데이터 로드 재시도
                  loadUserAndTasks();
                }}
                className="bg-white dark:bg-gray-900 text-red-600 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50"
              >
                <RefreshCcw size={14} className="mr-1.5" />
                다시 시도
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && !user ? (
        // 로딩 중일 때 표시할 UI
        <div className="min-h-[70vh] flex flex-col items-center justify-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full border-4 border-t-blue-600 border-r-transparent border-b-blue-200 border-l-transparent animate-spin"></div>
            <div className="w-16 h-16 rounded-full border-4 border-t-transparent border-r-transparent border-b-transparent border-l-indigo-600 animate-spin absolute inset-0" style={{animationDuration: '1.5s'}}></div>
          </div>
          <h2 className="text-xl font-semibold mb-2">데이터를 불러오는 중입니다</h2>
          <p className="text-gray-500">잠시만 기다려 주세요...</p>
        </div>
      ) : !user ? (
        // 인증되지 않은 경우 표시할 UI
        <div className="min-h-[70vh] flex flex-col items-center justify-center">
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 rounded-lg p-8 max-w-md shadow-md border border-yellow-200 dark:border-yellow-800/50 text-center">
            <AlertCircle className="mx-auto mb-4 text-yellow-600 dark:text-yellow-400" size={48} />
            <h2 className="text-xl font-semibold mb-3">로그인이 필요합니다</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">주간 업무 계획을 확인하려면 로그인해 주세요.</p>
            <Button 
              onClick={() => window.location.replace('/login')} 
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6"
              size="lg"
            >
              로그인 페이지로 이동
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* 헤더 섹션 */}
          <div className="mb-8">
            <div className="flex items-center mb-4 relative">
              <div className="flex-1">
                {/* 왼쪽 상단에 Timbel Weekly 추가 */}
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timbel Weekly</h1>
              </div>
              
              <div className="flex-1 flex justify-center">
                <div className="text-center">
                  <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                    주간 업무 기록
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-sm font-medium rounded-full px-3 py-1">
                      {currentWeek}주차
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="flex-1 flex justify-end">
                <UserMenu user={{
                  id: user?.id || '',
                  email: user?.email || '',
                  name: profile?.full_name || user?.user_metadata?.full_name || '',
                  full_name: profile?.full_name || '',
                  avatar_url: profile?.avatar_url || '',
                  user_metadata: user?.user_metadata
                }} />
              </div>
            </div>
            
            <div className="h-1 w-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-sm"></div>
          </div>
          
          {/* 사용자 선택 UI - 권한에 따라 다른 UI 표시 */}
          {renderUserSelectionUI()}
          
          {/* 현재 선택된 사용자 정보 표시 (탭 또는 드롭다운에서 선택된 사용자) */}
          {selectedUserId && selectedUserId !== userId && (
            <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg shadow-sm border border-blue-200 dark:border-blue-800/50 p-4">
              <div className="flex items-center">
                <Avatar className="h-10 w-10 mr-3 border-2 border-white dark:border-gray-800 shadow-sm">
                  <AvatarImage src={accessibleUsers.find(u => u.id === selectedUserId)?.avatar_url || undefined} />
                  <AvatarFallback className="bg-blue-600 text-white">
                    {accessibleUsers.find(u => u.id === selectedUserId)?.full_name?.substring(0, 2) || '??'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {accessibleUsers.find(u => u.id === selectedUserId)?.full_name || '선택된 사용자'} 님의 주간 업무
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="text-blue-600 dark:text-blue-400">
                      {(() => {
                        const selectedUser = accessibleUsers.find(u => u.id === selectedUserId);
                        if (selectedUser) {
                          const deptName = getDepartmentName(selectedUser.department_id);
                          const teamName = getTeamName(selectedUser.team_id);
                          return `${deptName} / ${teamName}`;
                        }
                        return "";
                      })()}
                    </span>
                    <span className="ml-2">(읽기 전용 모드)</span>
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="ml-auto bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => {
                    setSelectedUserId(userId);
                    loadWeeklyTasks(userId || '');
                    setActiveTab('my-tasks');
                  }}
                >
                  내 업무로 돌아가기
                </Button>
              </div>
            </div>
          )}
          
          {/* 주간 업무 리스트 */}
          <Card className="border-none shadow-md overflow-hidden">
            <CardContent className="p-0">
              <div className="relative">
                {/* 주차 필터 버튼 */}
                <div className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 p-3 flex items-center justify-between">
                  <div className="inline-flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <button
                      onClick={() => handleWeekFilterChange('current')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        weekFilter === 'current'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      이번주
                    </button>
                    <button
                      onClick={() => handleWeekFilterChange('recent4')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        weekFilter === 'recent4'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      최근 4주
                    </button>
                    <button
                      onClick={() => handleWeekFilterChange('recent10')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        weekFilter === 'recent10'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      최근 10주
                    </button>
                    <button
                      onClick={() => handleWeekFilterChange('all')}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        weekFilter === 'all'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      전체
                    </button>
                  </div>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    총 {filteredWeeksData.length}개 주차 표시 중
                  </div>
                </div>
                
                {/* 테이블 컨테이너 - 버블링 문제 해결을 위해 구조 단순화 */}
                <div 
                  id="table-container"
                  ref={tableContainerRef}
                  className="overflow-auto max-h-[calc(100vh-12rem)]"
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  <table 
                    className="w-full border-collapse !border-separate"
                    cellSpacing="0" 
                    cellPadding="0" 
                    style={{borderSpacing: 0}}
                  >
                    <colgroup>
                      <col style={{ width: "150px" }} />{/* 주차 */}
                      <col style={{ width: "42%" }} />{/* 이번주 업무 */}
                      <col style={{ width: "42%" }} />{/* 다음주 업무 */}
                      <col style={{ width: "80px" }} />{/* 상태 */}
                    </colgroup>
                    <thead className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-800 dark:to-indigo-900 sticky top-0 z-10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                      <tr className="border-none">
                        <th className="py-4 text-center text-white font-bold border-b-0">주차</th>
                        <th className="py-4 text-center text-white font-bold border-b-0">이번주 업무 진행</th>
                        <th className="py-4 text-center text-white font-bold border-b-0">다음주 업무 계획</th>
                        <th className="py-4 text-center text-white font-bold border-b-0">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWeeksData.map((week) => (
                        <tr
                          key={week.weekNum}
                          ref={week.isCurrentWeek ? currentWeekRef : null}
                          data-current-week={week.isCurrentWeek ? "true" : "false"}
                          className={`transition-all duration-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/20 ${
                            week.isCurrentWeek
                              ? "bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/10 border-l-4 border-l-blue-500 shadow-[0_2px_5px_rgba(0,0,0,0.05)]"
                              : week.isPastWeek
                              ? "bg-gray-50 dark:bg-gray-900/20"
                              : "bg-white dark:bg-gray-950/10"
                          }`}
                        >
                          <td className="font-medium text-center py-3 border-t">
                            <div className="flex flex-col items-center">
                              {week.isCurrentWeek ? (
                                <div className="bg-blue-600 dark:bg-blue-700 text-white rounded-full px-3 py-1 text-sm inline-block mb-1.5">
                                  {week.weekNum}주차
                                </div>
                              ) : (
                                <div className={`text-lg font-medium mb-1 ${week.isPastWeek ? "text-gray-500 dark:text-gray-400" : ""}`}>
                                  {week.weekNum}주차
                                </div>
                              )}
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {week.dateRange}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 border-t">
                            {isReadOnly || week.isPastWeek ? (
                              <div 
                                className={`min-h-[100px] p-3 whitespace-pre-wrap break-words rounded-md ${
                                  !isReadOnly && week.isPastWeek 
                                    ? "border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50" 
                                    : "border border-transparent"
                                } ${week.isPastWeek ? "text-gray-500 dark:text-gray-400" : ""}`}
                              >
                                {week.thisWeekPlans || "-"}
                              </div>
                            ) : (
                              <Textarea
                                defaultValue={week.thisWeekPlans || ""}
                                placeholder="이번주 완료한 업무를 입력하세요"
                                className="resize-none min-h-[100px] border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500"
                                onBlur={(e) => handleInputChange(week.weekNum, 'thisWeekPlans', e.target.value)}
                              />
                            )}
                          </td>
                          <td className="py-3 px-4 border-t">
                            {isReadOnly || week.isPastWeek ? (
                              <div 
                                className={`min-h-[100px] p-3 whitespace-pre-wrap break-words rounded-md ${
                                  !isReadOnly && week.isPastWeek 
                                    ? "border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50" 
                                    : "border border-transparent"
                                } ${week.isPastWeek ? "text-gray-500 dark:text-gray-400" : ""}`}
                              >
                                {week.nextWeekPlans || "-"}
                              </div>
                            ) : (
                              <Textarea
                                defaultValue={week.nextWeekPlans || ""}
                                placeholder="다음주 진행할 업무를 입력하세요"
                                className="resize-none min-h-[100px] border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500"
                                onBlur={(e) => handleInputChange(week.weekNum, 'nextWeekPlans', e.target.value)}
                              />
                            )}
                          </td>
                          <td className="text-center py-3 border-t">
                            {!isReadOnly && week.isCurrentWeek ? (
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => handleSave(week.weekNum)}
                                className={`${
                                  savingWeeks.includes(week.weekNum) 
                                    ? "bg-gray-400 text-white" 
                                    : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                                } transition-all font-medium shadow-sm`}
                                disabled={savingWeeks.includes(week.weekNum)}
                              >
                                {savingWeeks.includes(week.weekNum) ? (
                                  <div className="flex items-center">
                                    <LoaderCircle size={14} className="animate-spin mr-1" />
                                    <span>처리중</span>
                                  </div>
                                ) : (
                                  "등록"
                                )}
                              </Button>
                            ) : !isReadOnly && week.isPastWeek ? (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs rounded-full">
                                완료
                              </span>
                            ) : !isReadOnly ? (
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => handleSave(week.weekNum)}
                                className={`${
                                  savingWeeks.includes(week.weekNum) 
                                    ? "bg-gray-400 text-white" 
                                    : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                                } transition-all font-medium shadow-sm`}
                                disabled={savingWeeks.includes(week.weekNum)}
                              >
                                {savingWeeks.includes(week.weekNum) ? (
                                  <div className="flex items-center">
                                    <LoaderCircle size={14} className="animate-spin mr-1" />
                                    <span>처리중</span>
                                  </div>
                                ) : (
                                  "등록"
                                )}
                              </Button>
                            ) : (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                week.isExistInDB 
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" 
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                              }`}>
                                {week.isExistInDB ? "완료됨" : "-"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 페이지 하단 로고 */}
          <div className="mt-10 flex flex-col items-center justify-center opacity-70">
            <div className="h-18 w-18">
              <Image 
                src="/timbel_logo.png" 
                alt="Timbel Logo" 
                width={72} 
                height={72} 
                className="object-contain"
                priority
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
} 