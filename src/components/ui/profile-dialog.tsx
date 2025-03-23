"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  supabase, 
  getCurrentUser, 
  getDepartments,
  getTeamsByDepartment,
  getUserDetails,
  updateUserProfile,
  uploadFile,
  deleteOldProfileImages,
  ensureBucketExists,
} from "@/lib/supabase";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { X, Upload, ImageIcon } from "lucide-react";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState({
    name: "",
    department: "",
    team: "",
    role: "",
    avatar_url: ""
  });
  
  // 이미지 관련 상태 추가
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 부서 및 팀 데이터
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [teams, setTeams] = useState<{id: string, name: string}[]>([]);

  // 부서가 변경되면 해당하는 팀 목록 로드
  useEffect(() => {
    if (profile.department) {
      loadTeams(profile.department);
    } else {
      // 부서가 선택되지 않았을 때 팀 목록 초기화
      setTeams([]);
      setProfile(prev => ({ ...prev, team: "" }));
    }
  }, [profile.department]);

  // 팀 목록 로드
  const loadTeams = async (departmentId: string) => {
    try {
      const teamsData = await getTeamsByDepartment(departmentId);
      setTeams(teamsData);
    } catch (error) {
      console.error("팀 목록 로드 중 오류:", error);
    }
  };

  // 사용자 정보 로드
  useEffect(() => {
    if (open) {
      loadUserProfile();
    } else {
      // 다이얼로그가 닫힐 때 이미지 상태 초기화
      setImage(null);
      setImagePreview(null);
    }
  }, [open]);

  // 부서 목록 로드
  const loadDepartments = async () => {
    try {
      const departmentsData = await getDepartments();
      setDepartments(departmentsData);
    } catch (error) {
      console.error("부서 목록 로드 중 오류:", error);
    }
  };

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      
      // 부서 목록 로드
      await loadDepartments();
      
      // 현재 사용자 정보 가져오기
      const userData = await getCurrentUser();
      if (!userData) {
        // 사용자가 없으면 다이얼로그 닫기
        onOpenChange(false);
        return;
      }
      
      setUser(userData);
      
      // 사용자 세부 정보 가져오기
      const userDetails = await getUserDetails(userData.id);
      
      if (userDetails) {
        setProfile({
          name: userDetails.full_name || "",
          department: userDetails.department_id || "",
          team: userDetails.team_id || "",
          role: userDetails.role || "MEMBER",
          avatar_url: userDetails.avatar_url || ""
        });
        
        // 부서가 있으면 해당하는 팀 목록 로드
        if (userDetails.department_id) {
          await loadTeams(userDetails.department_id);
        }
      } else {
        // 세부 정보가 없는 경우 기본값 설정
        setProfile({
          name: userData.email?.split('@')[0] || "",
          department: "",
          team: "",
          role: "MEMBER",
          avatar_url: ""
        });
      }
    } catch (error) {
      console.error("프로필 로드 중 오류 발생:", error);
      toast({
        title: "오류 발생",
        description: "프로필 정보를 불러오는 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 이미지 변경 핸들러
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 파일 크기 확인 (2MB 제한)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "이미지 크기는 2MB 이하여야 합니다.",
        variant: "destructive",
      });
      return;
    }
    
    // 이미지 타입 확인
    if (!file.type.startsWith('image/')) {
      toast({
        title: "잘못된 파일 형식",
        description: "이미지 파일만 업로드 가능합니다.",
        variant: "destructive",
      });
      return;
    }
    
    // 파일 저장 및 미리보기 생성
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  // 이미지 제거 핸들러
  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // 이미지 업로드 핸들러
  const uploadProfileImage = async (userId: string): Promise<string | null> => {
    if (!image) return profile.avatar_url;
    
    try {
      setIsUploading(true);
      
      // 프로필 이미지용 버킷 확인 및 생성
      const bucketName = 'avatars';
      await ensureBucketExists(bucketName);
      
      // 기존 이미지 삭제 (선택적)
      await deleteOldProfileImages(bucketName, userId);
      
      // 새 이미지 업로드
      const uploadResult = await uploadFile(bucketName, userId, image);
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '이미지 업로드 실패');
      }
      
      return uploadResult.fullPath;
    } catch (error) {
      console.error('이미지 업로드 중 오류:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // 부서 변경 핸들러
  const handleDepartmentChange = (departmentId: string) => {
    setProfile(prev => ({
      ...prev,
      department: departmentId === "none" ? "" : departmentId,
      team: "", // 부서가 변경되면 팀 초기화
    }));
  };

  // 팀 변경 핸들러
  const handleTeamChange = (teamId: string) => {
    setProfile(prev => ({
      ...prev,
      team: teamId === "none" ? "" : teamId
    }));
  };

  // 이름 변경 핸들러
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile(prev => ({
      ...prev,
      name: e.target.value
    }));
  };

  // 권한 변경 핸들러
  const handleRoleChange = (role: string) => {
    setProfile(prev => ({
      ...prev,
      role: role
    }));
  };

  // 프로필 업데이트 핸들러
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!user) return;
    
    try {
      setIsSaving(true);
      
      // 새로운 프로필 이미지 업로드
      let newAvatarUrl = profile.avatar_url;
      
      if (image) {
        try {
          newAvatarUrl = await uploadProfileImage(user.id) || profile.avatar_url;
        } catch (uploadError) {
          console.error('이미지 업로드 오류:', uploadError);
          toast({
            title: "이미지 업로드 실패",
            description: "프로필 이미지 업로드 중 오류가 발생했습니다. 다른 정보는 저장됩니다.",
            variant: "destructive",
          });
          // 이미지 업로드 실패해도 계속 진행 (다른 정보는 저장)
        }
      }
      
      try {
        // 사용자 프로필 업데이트 (이름, 부서, 팀, 권한, 아바타 URL 포함)
        const updateResult = await updateUserProfile(user.id, {
          full_name: profile.name,
          department_id: profile.department || undefined,
          team_id: profile.team || undefined,
          role: profile.role, // 권한 정보도 함께 업데이트
          avatar_url: newAvatarUrl || undefined // 새 이미지 URL 또는 기존 URL
        });
        
        console.log('프로필 업데이트 결과:', updateResult);
        
        // 권한 변경 성공 메시지 표시
        if (user.role !== profile.role) {
          console.log('권한 변경됨:', user.role, '->', profile.role);
          toast({
            title: "권한 변경 완료",
            description: `권한이 ${getRoleDisplayName(profile.role)}(으)로 변경되었습니다.`,
            variant: "default",
          });
        }
        
        toast({
          title: "저장 완료",
          description: "프로필이 업데이트되었습니다.",
        });
        
        // 다이얼로그 닫기
        onOpenChange(false);
        
        // 프로필 업데이트 후 1초 뒤 새로고침
        setTimeout(() => {
          router.refresh();
        }, 1000);
      } catch (updateError) {
        console.error('프로필 업데이트 오류 상세 정보:', updateError);
        throw new Error(`프로필 업데이트 실패: ${JSON.stringify(updateError)}`);
      }
      
    } catch (error) {
      console.error("프로필 저장 중 오류:", error);
      toast({
        title: "저장 실패",
        description: error instanceof Error ? error.message : "프로필 정보를 저장하는 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 권한 이름을 한글로 변환하는 함수
  const getRoleDisplayName = (role: string): string => {
    const roleMap: Record<string, string> = {
      'SUPER': '최고 관리자',
      'ADMIN': '관리자',
      'MANAGER': '사업부장',
      'TEAM_LEADER': '팀장',
      'MEMBER': '구성원'
    };
    
    return roleMap[role] || role;
  };

  // 사용 가능한 모든 권한
  const availableRoles = [
    { value: 'SUPER', label: '최고 관리자' },
    { value: 'ADMIN', label: '관리자' },
    { value: 'MANAGER', label: '사업부장' },
    { value: 'TEAM_LEADER', label: '팀장' },
    { value: 'MEMBER', label: '구성원' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">프로필 정보 수정</DialogTitle>
          <DialogDescription>
            사용자 정보를 관리하세요.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-500">데이터를 불러오는 중...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 프로필 이미지 섹션 */}
            <div className="space-y-3">
              <Label className="text-base font-medium">프로필 이미지</Label>
              <div className="flex items-start gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20 border-2 border-gray-100 dark:border-gray-800 shadow-sm">
                    {imagePreview ? (
                      <AvatarImage src={imagePreview} alt="프로필 미리보기" />
                    ) : profile.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} alt="현재 프로필" />
                    ) : (
                      <AvatarFallback className="bg-blue-600 text-white text-xl">
                        {profile.name ? profile.name[0].toUpperCase() : user.email ? user.email[0].toUpperCase() : "U"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  
                  {(imagePreview || profile.avatar_url) && (
                    <button 
                      type="button" 
                      onClick={handleRemoveImage} 
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                      title="이미지 제거"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={16} />
                      이미지 선택
                    </Button>
                    
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange}
                      className="hidden" 
                    />
                    
                    {isUploading && <span className="text-xs text-gray-500">업로드 중...</span>}
                  </div>
                  
                  <p className="text-xs text-gray-500">
                    {image ? (
                      <>선택됨: {image.name} ({(image.size / 1024).toFixed(1)} KB)</>
                    ) : (
                      <>권장: 정사각형 이미지, 최대 2MB</>
                    )}
                  </p>
                </div>
              </div>
            </div>
            
            {/* 이름과 권한 (같은 줄에 배치) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 이름 필드 (편집 가능) */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-base font-medium">이름</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={handleNameChange}
                  className="border-gray-300 dark:border-gray-700"
                />
              </div>
              
              {/* 권한 필드 (선택 가능) */}
              <div className="space-y-2">
                <Label htmlFor="role" className="text-base font-medium">권한</Label>
                <Select
                  value={profile.role}
                  onValueChange={handleRoleChange}
                >
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue placeholder="권한 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* 사업부와 팀 (같은 줄에 배치) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 사업부 선택 */}
              <div className="space-y-2">
                <Label htmlFor="department" className="text-base font-medium">사업부</Label>
                <Select
                  value={profile.department || "none"}
                  onValueChange={handleDepartmentChange}
                >
                  <SelectTrigger id="department" className="w-full">
                    <SelectValue placeholder="사업부 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안함</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* 팀 선택 */}
              <div className="space-y-2">
                <Label htmlFor="team" className="text-base font-medium">팀</Label>
                <Select
                  value={profile.team || "none"}
                  onValueChange={handleTeamChange}
                  disabled={!profile.department || teams.length === 0}
                >
                  <SelectTrigger id="team" className="w-full">
                    <SelectValue placeholder={!profile.department ? "사업부를 먼저 선택하세요" : "팀 선택"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안함</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!profile.department && (
                  <p className="text-xs text-gray-500">사업부를 먼저 선택하세요.</p>
                )}
              </div>
            </div>
            
            <DialogFooter className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isSaving || isUploading}
              >
                {isSaving ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export async function signUp(email: string, password: string, fullName: string) {
  try {
    // Supabase Auth로 회원가입
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
    
    if (authError) throw authError;
    
    return authData;
  } catch (error) {
    console.error('회원가입 중 오류 발생:', error);
    throw error;
  }
} 