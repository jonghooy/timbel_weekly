"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  getAllUsers, 
  getDepartments, 
  getTeamsByDepartment, 
  updateUserBySuperAdmin, 
  UserRole,
  getCurrentUserDetails,
  signOut
} from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [teamsMap, setTeamsMap] = useState<{ [key: string]: any[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<{ [key: string]: any }>({});
  const [saveLoading, setSaveLoading] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const userDetails = await getCurrentUserDetails();
        
        if (!userDetails || userDetails.role !== 'SUPER') {
          toast({
            title: "접근 권한 없음",
            description: "이 페이지는 SUPER 관리자만 접근할 수 있습니다.",
            variant: "destructive",
          });
          router.push('/weekly-task');
          return;
        }
        
        // 접근 권한이 있으면 데이터 로드
        loadAllData();
      } catch (error) {
        console.error("권한 확인 오류:", error);
        router.push('/login');
      }
    };
    
    checkAccess();
  }, [router]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    setPendingChanges({}); // 변경 사항 초기화
    
    try {
      // 1. 사용자 목록 가져오기
      const usersResult = await getAllUsers();
      if (!usersResult.success) {
        throw new Error(usersResult.error as string);
      }
      
      console.log("불러온 사용자 데이터:", usersResult.data);
      
      // 사용자 데이터 설정
      setUsers(usersResult.data || []);
      
      // 2. 부서 목록 가져오기
      const departmentsList = await getDepartments();
      const deptData = Array.isArray(departmentsList) ? departmentsList : [];
      console.log("불러온 부서 데이터:", deptData);
      setDepartments(deptData);
      
      // 3. 각 부서별 팀 목록 가져오기
      const teamMap: { [key: string]: any[] } = {};
      
      if (deptData.length > 0) {
        for (const dept of deptData) {
          if (dept && dept.id) {
            const teamsResult = await getTeamsByDepartment(dept.id);
            teamMap[dept.id] = Array.isArray(teamsResult) ? teamsResult : [];
          }
        }
      }
      
      console.log("불러온 팀 데이터:", teamMap);
      setTeamsMap(teamMap);
      
    } catch (err: any) {
      console.error("데이터 로드 오류:", err);
      setError(err.message || "데이터를 로드하는 중 오류가 발생했습니다.");
      
      toast({
        title: "데이터 로드 오류",
        description: err.message || "데이터를 로드하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 부서 변경 처리 함수
  const handleDepartmentChange = (userId: string, departmentId: string) => {
    console.log(`부서 변경: 사용자 ${userId}, 새 부서 ID: ${departmentId}`);
    
    // 현재 변경 사항 복사
    const changes = { ...pendingChanges };
    
    // 부서 변경 시 팀 정보도 null로 설정
    changes[userId] = {
      ...changes[userId],
      department_id: departmentId === "none" ? null : departmentId,
      team_id: null
    };
    
    console.log("변경된 사항:", changes[userId]);
    setPendingChanges(changes);
  };

  // 팀 변경 처리 함수
  const handleTeamChange = (userId: string, teamId: string) => {
    console.log(`팀 변경: 사용자 ${userId}, 새 팀 ID: ${teamId}`);
    
    const changes = { ...pendingChanges };
    
    changes[userId] = {
      ...changes[userId],
      team_id: teamId === "none" ? null : teamId
    };
    
    console.log("변경된 사항:", changes[userId]);
    setPendingChanges(changes);
  };

  // 권한 변경 처리 함수
  const handleRoleChange = (userId: string, role: string) => {
    console.log(`권한 변경: 사용자 ${userId}, 새 권한: ${role}`);
    
    const changes = { ...pendingChanges };
    
    changes[userId] = {
      ...changes[userId],
      role: role as UserRole
    };
    
    console.log("변경된 사항:", changes[userId]);
    setPendingChanges(changes);
  };

  // 변경 사항 저장 함수
  const handleSaveChanges = async (userId: string) => {
    // 해당 사용자에 대한 변경 사항이 없으면 리턴
    if (!pendingChanges[userId]) {
      console.log(`변경사항 없음: 사용자 ${userId}`);
      return;
    }
    
    // 저장 중 상태 설정
    const changes = { ...saveLoading };
    changes[userId] = true;
    setSaveLoading(changes);
    
    try {
      console.log(`저장 시작: 사용자 ${userId}`, pendingChanges[userId]);
      
      // 변경 데이터 구성 및 null 값 명시적 처리
      const updateData = { ...pendingChanges[userId] };
      
      // 명시적으로 null 지정 (Supabase에서 빈 문자열을 null로 처리하지 않을 수 있음)
      if (updateData.department_id === "none") updateData.department_id = null;
      if (updateData.team_id === "none") updateData.team_id = null;
      
      console.log(`최종 업데이트 데이터:`, updateData);
      
      // DB에 변경사항 저장
      const result = await updateUserBySuperAdmin(userId, updateData);
      console.log('업데이트 결과:', result);
      
      if (!result.success) {
        toast({
          title: "저장 실패",
          description: result.error || "사용자 정보를 업데이트하지 못했습니다.",
          variant: "destructive",
        });
        throw new Error(result.error as string);
      }
      
      // 데이터가 실제로 변경되었는지 확인
      if (result.changed) {
        toast({
          title: "저장 완료",
          description: "사용자 정보가 성공적으로 업데이트되었습니다.",
        });
      } else {
        toast({
          title: "변경 사항 없음",
          description: "데이터베이스에 실제 변경사항이 없었습니다.",
          variant: "default",
        });
      }
      
      // 변경 사항 목록에서 제거
      const newChanges = { ...pendingChanges };
      delete newChanges[userId];
      setPendingChanges(newChanges);
      
      // 사용자 목록 최신 데이터로 직접 갱신
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, ...result.data } : user
        )
      );
      
      // 전체 데이터 새로고침 (선택사항)
      await loadAllData();
      
    } catch (err: any) {
      console.error("사용자 정보 업데이트 오류:", err);
      
      toast({
        title: "업데이트 오류",
        description: err.message || "사용자 정보를 업데이트하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      // 로딩 상태 해제
      const newLoadingState = { ...saveLoading };
      newLoadingState[userId] = false;
      setSaveLoading(newLoadingState);
    }
  };

  // 변경 사항 취소 함수
  const handleCancelChanges = (userId: string) => {
    const newChanges = { ...pendingChanges };
    delete newChanges[userId];
    setPendingChanges(newChanges);
  };

  // 특정 사용자에 대한 변경 사항이 있는지 확인
  const hasChanges = (userId: string) => {
    return !!pendingChanges[userId];
  };

  // 사용자 권한 레벨에 따른 배지 색상
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER':
        return "bg-purple-500 hover:bg-purple-600";
      case 'ADMIN':
        return "bg-red-500 hover:bg-red-600";
      case 'MANAGER':
        return "bg-blue-500 hover:bg-blue-600";
      case 'TEAM_LEADER':
        return "bg-green-500 hover:bg-green-600";
      case 'MEMBER':
        return "bg-gray-500 hover:bg-gray-600";
      default:
        return "bg-gray-500 hover:bg-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">오류가 발생했습니다</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadAllData}>다시 시도</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <div className="flex space-x-2">
          <Button onClick={() => router.push('/weekly-task')}>
            주간 업무 페이지로 이동
          </Button>
          <Button variant="outline" onClick={loadAllData}>
            새로고침
          </Button>
          <Button 
            variant="destructive" 
            onClick={async () => {
              try {
                await signOut();
                toast({
                  title: "로그아웃 성공",
                  description: "로그아웃되었습니다.",
                });
                router.push('/login');
              } catch (error) {
                console.error("로그아웃 중 오류:", error);
                toast({
                  title: "로그아웃 실패",
                  description: "로그아웃 중 문제가 발생했습니다.",
                  variant: "destructive",
                });
              }
            }}
          >
            로그아웃
          </Button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <Table>
          <TableCaption>총 {users.length}명의 회원이 등록되어 있습니다.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">이름</TableHead>
              <TableHead className="w-[250px]">이메일</TableHead>
              <TableHead className="w-[180px]">부서</TableHead>
              <TableHead className="w-[180px]">팀</TableHead>
              <TableHead className="w-[150px]">권한</TableHead>
              <TableHead className="w-[180px]">가입일</TableHead>
              <TableHead className="w-[150px] text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              console.log(`사용자 ${user.id} 정보:`, user);
              const userDeptId = pendingChanges[user.id]?.department_id !== undefined 
                ? pendingChanges[user.id]?.department_id 
                : user.department_id;
              
              const userTeamId = pendingChanges[user.id]?.team_id !== undefined 
                ? pendingChanges[user.id]?.team_id 
                : user.team_id;
                
              console.log(`사용자 ${user.id} 부서:`, userDeptId, '팀:', userTeamId);
              
              // 현재 부서에 해당하는 팀 목록 가져오기
              const availableTeams = userDeptId ? (teamsMap[userDeptId] || []) : [];
              console.log(`사용자 ${user.id}의 부서(${userDeptId})에 속한 팀 목록:`, availableTeams);
              
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={userDeptId || "none"}
                      onValueChange={(value) => handleDepartmentChange(user.id, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="부서 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">미지정</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={userTeamId || "none"}
                      onValueChange={(value) => handleTeamChange(user.id, value)}
                      disabled={!userDeptId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="팀 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">미지정</SelectItem>
                        {availableTeams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={pendingChanges[user.id]?.role || user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="권한 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUPER">최고 관리자</SelectItem>
                        <SelectItem value="ADMIN">관리자</SelectItem>
                        <SelectItem value="MANAGER">부서장</SelectItem>
                        <SelectItem value="TEAM_LEADER">팀장</SelectItem>
                        <SelectItem value="MEMBER">일반 회원</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell className="text-right">
                    {hasChanges(user.id) ? (
                      <div className="flex space-x-2 justify-end">
                        <Button 
                          variant="default" 
                          onClick={() => handleSaveChanges(user.id)}
                          disabled={saveLoading[user.id]}
                          size="sm"
                        >
                          {saveLoading[user.id] ? "저장 중..." : "저장"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleCancelChanges(user.id)}
                          size="sm"
                        >
                          취소
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                        {user.role === 'SUPER' && '최고 관리자'}
                        {user.role === 'ADMIN' && '관리자'}
                        {user.role === 'MANAGER' && '부서장'}
                        {user.role === 'TEAM_LEADER' && '팀장'}
                        {user.role === 'MEMBER' && '일반 회원'}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 