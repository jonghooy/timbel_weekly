import { createClient } from '@supabase/supabase-js';

// Supabase URL과 API Key를 환경 변수에서 가져옵니다.
// 실제 환경에서는 .env.local 파일에 아래 값들이 설정되어 있어야 합니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anonymous Key');
}

// Database 타입 정의
export type Database = any;

/**
 * 파일 업로드 결과를 위한 인터페이스
 */
export interface UploadResult {
  path: string;
  fullPath: string;
  success: boolean;
  error?: string;
}

// Supabase 클라이언트 생성
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// 부서 목록을 가져오는 함수
export async function getDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name');

  if (error) {
    console.error('부서 목록을 가져오는 중 오류 발생:', error);
    return [];
  }

  return data || [];
}

// 특정 부서의 팀 목록을 가져오는 함수
export async function getTeamsByDepartment(departmentId: string) {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('department_id', departmentId)
    .order('name');

  if (error) {
    console.error('팀 목록을 가져오는 중 오류 발생:', error);
    return [];
  }

  return data || [];
}

// 현재 로그인한 사용자 정보 가져오기
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('사용자 정보 가져오기 오류:', error);
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('getCurrentUser 오류:', error);
    return null;
  }
}

// 특정 사용자의 주간 업무 데이터를 가져오는 함수 (권한 체크 추가)
export const getWeeklyTasksByUser = async (
  userId: string, 
  year: number,
  currentUserId?: string
): Promise<any[]> => {
  try {
    // 쿼리 타임아웃을 위한 프로미스 생성
    const timeoutPromise = new Promise<any[]>((resolve) => {
      setTimeout(() => {
        resolve([]); // 조용히 빈 배열 반환
      }, 5000); // 5초 타임아웃
    });

    // 데이터를 가져오는 프로미스
    const fetchDataPromise = (async () => {
      try {
        // 1. 본인 데이터인 경우 바로 조회
        if (!currentUserId || currentUserId === userId) {
          // 본인 데이터는 권한 체크 없이 즉시 반환
          try {
            const { data, error } = await supabase
              .from('weekly_tasks')
              .select('*')
              .eq('user_id', userId)
              .eq('year', year)
              .order('week_number', { ascending: true });

            if (error) {
              return [];
            }

            return data || [];
          } catch (err) {
            return [];
          }
        }

        // 2. 다른 사용자 데이터인 경우 권한 체크
        try {
          const hasPermission = await checkPermission(currentUserId, userId);
          if (!hasPermission) {
            return [];
          }

          try {
            const { data, error } = await supabase
              .from('weekly_tasks')
              .select('*')
              .eq('user_id', userId)
              .eq('year', year)
              .order('week_number', { ascending: true });

            if (error) {
              return [];
            }

            return data || [];
          } catch (queryErr) {
            return [];
          }
        } catch (permissionError) {
          // 권한 체크에 실패한 경우 빈 배열 반환
          return [];
        }
      } catch (generalError) {
        return [];
      }
    })();

    // 타임아웃과 데이터 로드 경쟁 - 예외 처리 강화
    try {
      return await Promise.race([fetchDataPromise, timeoutPromise]);
    } catch (raceError) {
      return []; // 어떤 오류가 발생하더라도 빈 배열 반환
    }
  } catch (error) {
    return [];
  }
};

// 모든 사용자의 주간 업무 데이터를 가져오는 함수 (권한에 따라 필터링)
export const getAllWeeklyTasks = async (
  currentUserId: string,
  year: number,
  weekNumber?: number
): Promise<any[]> => {
  try {
    // 현재 사용자 정보 조회
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUserId)
      .single();

    if (currentUserError || !currentUser) {
      console.error('사용자 정보를 가져오는 중 오류 발생:', currentUserError);
      return [];
    }

    // 권한에 따라 사용자 목록 필터링
    const users = await getUsersWithWeeklyTasks(currentUserId);
    if (users.length === 0) {
      return [];
    }

    // 볼 수 있는 사용자 ID 목록
    const userIds = users.map((user: any) => user.id);

    // 주간 업무 쿼리 빌드
    let query = supabase
      .from('weekly_tasks')
      .select(`
        *,
        users:user_id (
          id,
          email,
          full_name,
          department_id,
          team_id,
          role
        )
      `)
      .eq('year', year)
      .in('user_id', userIds);

    // 특정 주차만 필터링 (주차 번호가 제공된 경우)
    if (weekNumber) {
      query = query.eq('week_number', weekNumber);
    }

    // 주차 번호 오름차순, 사용자 이름 오름차순 정렬
    query = query.order('week_number', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('주간 업무 데이터를 가져오는 중 오류 발생:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('모든 주간 업무 데이터를 가져오는 중 오류 발생:', error);
    return [];
  }
};

// 특정 주차의 업무를 가져오는 함수
export const getWeeklyTask = async (
  userId: string, 
  year: number, 
  weekNumber: number, 
  currentUserId?: string
): Promise<any> => {
  try {
    // 권한 확인 (현재 사용자 ID가 제공된 경우)
    if (currentUserId && currentUserId !== userId) {
      const hasPermission = await checkPermission(currentUserId, userId);
      if (!hasPermission) {
        console.error('권한이 없습니다.');
        return null;
      }
    }

    const { data, error } = await supabase
      .from('weekly_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('week_number', weekNumber)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: 결과가 없는 경우
      console.error('주간 업무를 가져오는 중 오류 발생:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('주간 업무를 가져오는 중 오류 발생:', error);
    return null;
  }
};

// 주간 업무를 저장하거나 업데이트하는 함수
export async function saveWeeklyTask(
  userId: string,
  year: number,
  weekNumber: number,
  thisWeekTasks: string,
  nextWeekPlan: string,
  notes: string = '',
  currentUserId?: string
): Promise<boolean> {
  try {
    // 본인 데이터만 수정 가능
    if (currentUserId && currentUserId !== userId) {
      console.error('본인 데이터만 수정할 수 있습니다.');
      return false;
    }

    // 먼저 해당 주차의 업무가 이미 존재하는지 확인
    const existingTask = await getWeeklyTask(userId, year, weekNumber);
    
    const submissionDate = new Date().toISOString();
    
    if (existingTask) {
      // 업데이트
      const { data, error } = await supabase
        .from('weekly_tasks')
        .update({
          this_week_tasks: thisWeekTasks,
          next_week_plan: nextWeekPlan,
          note: notes,
          submission_date: submissionDate
        })
        .eq('id', existingTask.id)
        .select();
        
      if (error) {
        console.error('주간 업무 업데이트 중 오류 발생:', error);
        return false;
      }
      
      return true;
    } else {
      // 새로 생성
      const { data, error } = await supabase
        .from('weekly_tasks')
        .insert([{
          user_id: userId,
          year: year,
          week_number: weekNumber,
          this_week_tasks: thisWeekTasks,
          next_week_plan: nextWeekPlan,
          note: notes,
          submission_date: submissionDate
        }])
        .select();
        
      if (error) {
        console.error('주간 업무 저장 중 오류 발생:', error);
        return false;
      }
      
      return true;
    }
  } catch (error) {
    console.error('주간 업무 저장 중 오류 발생:', error);
    return false;
  }
}

// 사용자 로그인
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}

// 사용자 로그아웃
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
  
  return true;
}

// 비밀번호 변경
export async function updatePassword(newPassword: string) {
  try {
    // 현재 로그인된 사용자의 비밀번호를 업데이트
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('비밀번호 변경 중 오류 발생:', error);
    throw error;
  }
}

// 특정 사용자의 세부 정보를 가져오는 함수
export async function getUserDetails(userId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('사용자 세부 정보 조회 중 오류:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('getUserDetails 오류:', error);
    return null;
  }
}

// 현재 사용자의 세부 정보 가져오기
export async function getCurrentUserDetails() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    
    let userDetails = await getUserDetails(user.id);
    
    // 사용자 정보가 없으면 자동으로 생성
    if (!userDetails) {
      await createUserIfNotExists(user);
      userDetails = await getUserDetails(user.id);
    }
    
    return userDetails;
  } catch (error) {
    console.error('현재 사용자 세부 정보를 가져오는 중 오류:', error);
    return null;
  }
}

// 사용자 정보가 없으면 자동으로 생성
export async function createUserIfNotExists(user: any) {
  // 사용자 존재 여부 확인
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .single();
  
  // 오류가 있거나 데이터가 없으면 (사용자가 존재하지 않으면)
  if (error || !data) {
    console.log('사용자 정보가 존재하지 않습니다. 새 사용자 정보 생성...');
    
    // 재시도 최대 횟수 설정
    let maxRetries = 3;
    let success = false;
    let retryCount = 0;
    
    while (!success && retryCount < maxRetries) {
      try {
        // 새 사용자 정보 삽입 시도
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || '사용자',
            department_id: null,
            team_id: null,
            role: 'MEMBER',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            avatar_url: null
          });
        
        if (insertError) {
          console.error(`사용자 정보 생성 시도 ${retryCount + 1}/${maxRetries} 중 오류:`, insertError);
          
          // 외래 키 제약 조건 위반 또는 동시성 문제인 경우 재시도
          if (insertError.message && (
              insertError.message.includes('violates foreign key constraint') ||
              insertError.message.includes('duplicate key value') ||
              insertError.message.includes('conflict')
          )) {
            retryCount++;
            // 지수 백오프 (점점 대기 시간 증가)
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            console.log(`${retryCount}번째 재시도 중...`);
            continue;
          } else {
            // 다른 종류의 오류인 경우 재시도하지 않고 실패로 처리
            return false;
          }
        }
        
        console.log('새 사용자 정보가 성공적으로 생성되었습니다.');
        success = true;
        return true;
      } catch (e) {
        console.error('예상치 못한 오류 발생:', e);
        retryCount++;
        // 예외 발생 시에도 지수 백오프
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    if (!success) {
      console.error(`최대 재시도 횟수(${maxRetries})를 초과했습니다. 사용자 생성에 실패했습니다.`);
      return false;
    }
  }
  
  return true; // 이미 사용자가 존재하는 경우에도 성공으로 처리
}

// 사용자 프로필 업데이트 (avatar_url 포함)
export async function updateUserProfile(
  userId: string,
  data: {
    full_name?: string;
    department_id?: string;
    team_id?: string;
    avatar_url?: string;
    role?: string;
  }
) {
  const { data: userData, error } = await supabase
    .from('users')
    .update({
      ...data,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select();
  
  if (error) {
    console.error('사용자 프로필 업데이트 중 오류:', error);
    throw error;
  }
  
  return userData?.[0] || null;
}

// 버킷이 존재하는지 확인하고 없으면 생성하는 함수
export async function ensureBucketExists(bucketName: string) {
  try {
    // 버킷 목록 가져오기
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.error('버킷 목록 가져오기 오류:', bucketError);
      if (bucketError.message.includes('does not exist') || bucketError.message.includes('not found')) {
        // 버킷 생성 시도
      } else {
        throw bucketError;
      }
    }
    
    // 버킷이 있는지 확인
    const bucketExists = buckets?.some(b => b.name === bucketName) ?? false;
    
    if (!bucketExists) {
      try {
        // 사용자 세션 가져오기 (권한 확인용)
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        
        if (!session) {
          console.error('인증되지 않은 상태입니다.');
          return { error: '인증 필요' };
        }
        
        // API를 직접 호출하여 버킷 생성
        const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: bucketName,
            public: true,
            file_size_limit: 10485760
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`버킷 "${bucketName}" 생성 API 응답 오류:`, response.status, errorText);
          return { error: `버킷 생성 실패: ${response.status} - ${errorText}` };
        }
        
        const result = await response.json();
        return { success: true, data: result };
      } catch (createError) {
        console.error(`버킷 "${bucketName}" 생성 중 예외 발생:`, createError);
        return { error: `버킷 생성 중 예외: ${createError}` };
      }
    }
    
    return { success: true, message: `버킷 "${bucketName}"이 이미 존재합니다.` };
  } catch (error) {
    console.error('버킷 확인/생성 중 오류:', error);
    return { error: `버킷 확인/생성 중 오류: ${error}` };
  }
}

/**
 * 버킷 생성을 시도하는 함수 (관리자 권한 필요)
 * 일반 권한으로는 생성이 안되므로 관리자가 대시보드에서 생성해야 함
 */
export async function createBucket(name: string) {
  try {
    // 버킷 목록 확인
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('버킷 목록 가져오기 오류:', listError);
      return { success: false, error: listError };
    }
    
    // 이미 버킷이 존재하는지 확인
    const bucketExists = buckets.some(bucket => bucket.name === name);
    if (bucketExists) {
      return { success: true, message: '이미 존재하는 버킷' };
    }
    
    // 버킷 생성 시도
    const { data, error } = await supabase.storage.createBucket(name, {
      public: true,
      fileSizeLimit: 5242880, // 5MB
    });
    
    if (error) {
      console.error('버킷 생성 오류:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('버킷 생성 중 예외 발생:', error);
    return { success: false, error };
  }
}

/**
 * Supabase Storage에 파일을 업로드하는 함수
 * @param bucket 업로드할 버킷 이름
 * @param userId 사용자 ID (RLS 정책에 맞게 경로를 구성하기 위해 필요)
 * @param file 업로드할 파일 객체
 * @returns 업로드 결과 (path, fullPath, success 등의 정보 포함)
 */
export async function uploadFile(bucket: string, userId: string, file: File): Promise<UploadResult> {
  try {
    // 버킷 존재 여부 확인
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.error('버킷 목록 조회 실패:', bucketError);
    }
  
    // 파일 확장자 추출
    const fileExt = file.name.split('.').pop() || 'jpg';
    
    // 고정된 파일명 사용 (사용자별로 하나의 프로필 이미지만 유지)
    const safeFileName = `profile.${fileExt}`;
    
    // 사용자 ID를 폴더명으로 사용 (RLS 정책 준수)
    const filePath = `${userId}/${safeFileName}`;
    
    // 파일을 Blob 객체로 변환 (타입 호환성 문제 방지)
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    
    // Supabase Storage API 직접 호출 (upsert: true로 기존 파일 덮어쓰기)
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(filePath, blob, {
        contentType: file.type,
        upsert: true, // 같은 경로에 파일이 있으면 덮어씁니다
        cacheControl: '3600'
      });
    
    // 오류 발생 시
    if (error) {
      console.error('파일 업로드 오류:', error.message);
      
      // RLS 정책 오류 감지
      if (error.message.includes('permission denied') || error.message.includes('row-level security')) {
        console.error('스토리지 권한 오류: 버킷의 RLS 정책을 확인해주세요');
      }
      
      throw error;
    }
    
    // 성공 시 반환값
    return {
      path: data.path,
      fullPath: `${supabaseUrl}/storage/v1/object/public/${bucket}/${data.path}`,
      success: true
    };
    
  } catch (error: any) {
    console.error('업로드 중 예외 발생:', error);
    
    // 개발 환경에서만 더미 URL 반환
    if (process.env.NODE_ENV !== 'production') {
      return { 
        path: 'dummy/path/image.jpg', 
        fullPath: `https://placehold.co/400x400?text=Avatar`,
        success: false,
        error: error.message
      };
    }
    throw error;
  }
}

/**
 * Supabase Storage 버킷에서 파일의 공개 URL을 생성합니다.
 * @param bucket 파일이 저장된 버킷 이름
 * @param path 버킷 내 파일 경로
 * @returns 파일의 공개 액세스 URL
 */
export function getPublicUrl(bucket: string, path: string): string {
  if (!bucket || !path) {
    console.warn('getPublicUrl: 버킷 또는 경로가 제공되지 않았습니다', { bucket, path });
    return '';
  }
  
  try {
    // 더미 경로인 경우 대체 URL 반환
    if (path.includes('dummy/path')) {
      return 'https://placehold.co/400x400?text=Avatar';
    }
    
    // Supabase 클라이언트를 통해 공개 URL 가져오기
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    
    if (data?.publicUrl) {
      return data.publicUrl;
    }
    
    // 백업: URL 수동 구성
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
    
    return publicUrl;
  } catch (error) {
    console.error('공개 URL 생성 중 오류 발생:', error);
    // 실패시 수동 URL 생성
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  }
}

// 사용자 역할 정의
export enum UserRole {
  SUPER = 'SUPER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  TEAM_LEADER = 'TEAM_LEADER',
  MEMBER = 'MEMBER'
}

// 역할에 따른 권한 체크 함수
export const checkPermission = async (
  currentUserId: string, 
  targetUserId: string
): Promise<boolean> => {
  try {
    // 자기 자신의 데이터는 항상 볼 수 있음
    if (currentUserId === targetUserId) {
      return true;
    }

    // 현재 사용자 정보 가져오기
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUserId)
      .single();

    if (currentUserError || !currentUser) {
      console.error('현재 사용자 정보를 가져오는 중 오류 발생:', currentUserError);
      return false;
    }

    // SUPER와 ADMIN은 모든 데이터에 접근 가능
    if (currentUser.role === UserRole.SUPER || currentUser.role === UserRole.ADMIN) {
      return true;
    }

    // 대상 사용자 정보 가져오기
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (targetUserError || !targetUser) {
      console.error('대상 사용자 정보를 가져오는 중 오류 발생:', targetUserError);
      return false;
    }

    // MANAGER인 경우 같은 부서에 속한 모든 사용자(팀장, 팀원)에 접근 가능
    if (currentUser.role === UserRole.MANAGER) {
      return currentUser.department_id === targetUser.department_id;
    }

    // TEAM_LEADER인 경우 같은 팀에 속한 사용자만 접근 가능
    if (currentUser.role === UserRole.TEAM_LEADER) {
      return currentUser.team_id === targetUser.team_id;
    }

    // MEMBER는 자신의 데이터만 볼 수 있음(이미 위에서 체크됨)
    return false;
  } catch (error) {
    console.error('권한 체크 중 오류 발생:', error);
    return false;
  }
};

// 특정 사용자의 주간 업무 리스트를 가져오는 함수
export const getUsersWithWeeklyTasks = async (currentUserId: string): Promise<any[]> => {
  try {
    // 현재 사용자 정보 조회
    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUserId)
      .single();

    if (currentUserError || !currentUser) {
      console.error('사용자 정보를 가져오는 중 오류 발생:', currentUserError);
      return [];
    }

    let query = supabase.from('users').select('*');

    // 권한에 따른 필터링
    if (currentUser.role === UserRole.SUPER || currentUser.role === UserRole.ADMIN) {
      // 모든 사용자 조회 (필터링 없음)
    } else if (currentUser.role === UserRole.MANAGER) {
      // 같은 부서에 속한 모든 사용자(팀장, 팀원) 조회
      query = query.eq('department_id', currentUser.department_id);
    } else if (currentUser.role === UserRole.TEAM_LEADER) {
      // 같은 팀에 속한 사용자만 조회
      query = query.eq('team_id', currentUser.team_id);
    } else {
      // MEMBER는 자신만 조회
      query = query.eq('id', currentUserId);
    }

    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error('사용자 목록을 가져오는 중 오류 발생:', usersError);
      return [];
    }

    return users || [];
  } catch (error) {
    console.error('사용자 정보 조회 중 오류 발생:', error);
    return [];
  }
};

/**
 * 특정 사용자의 이전 프로필 이미지를 삭제하는 함수
 * 사용자가 새 이미지를 업로드하기 전에 호출하여 스토리지 정리 용도로 사용
 * @param bucket 버킷 이름
 * @param userId 사용자 ID
 * @returns 삭제 성공 여부
 */
export async function deleteOldProfileImages(bucket: string, userId: string): Promise<boolean> {
  try {
    // 사용자 폴더 내 파일 목록 가져오기
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .list(`${userId}`, {
        limit: 100,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (error) {
      console.error('사용자 이미지 목록 조회 실패:', error);
      return false;
    }
    
    if (!data || data.length === 0) {
      return true;
    }
    
    // 현재 profile.* 파일을 제외한 이전 파일들 찾기
    const oldImages = data.filter(file => 
      !file.name.startsWith('profile.') && 
      (file.name.includes('profile_') || file.name.startsWith('profile_image_'))
    );
    
    if (oldImages.length === 0) {
      return true;
    }
    
    // 이전 이미지 삭제
    for (const file of oldImages) {
      const { error: deleteError } = await supabase
        .storage
        .from(bucket)
        .remove([`${userId}/${file.name}`]);
      
      if (deleteError) {
        console.error(`'${file.name}' 삭제 실패:`, deleteError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('이전 프로필 이미지 삭제 중 오류:', error);
    return false;
  }
}

// 특정 팀의 세부 정보를 가져오는 함수
export async function getTeamDetails(teamId: string) {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error) {
      console.error('팀 세부 정보 조회 중 오류:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('getTeamDetails 오류:', error);
    return null;
  }
}

// 모든 팀 정보 가져오기
export async function getAllTeams() {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');

    if (error) {
      console.error('팀 목록 조회 중 오류:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('getAllTeams 오류:', error);
    return [];
  }
}

/**
 * 사용자 회원가입 함수 - 이미 등록된 이메일인 경우 에러를 반환
 * @param email 이메일
 * @param password 비밀번호
 * @param fullName 사용자 이름
 * @returns 회원가입 결과
 */
export async function signUp(email: string, password: string, fullName: string) {
  try {
    // 이미 존재하는 이메일인지 확인
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();
    
    if (checkError) {
      console.error('이메일 중복 확인 중 오류 발생:', checkError);
      // 오류가 발생해도 계속 진행 (사용자 경험 저하 방지)
    } else if (existingUser) {
      console.log('이메일 중복:', email);
      return {
        user: null,
        error: '이미 등록된 이메일 주소입니다. 다른 이메일을 사용하거나 로그인해 주세요.',
        success: false
      };
    }
    
    // Supabase Auth로 회원가입 진행
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    
    if (error) {
      // Supabase 에러 메시지 분석
      if (error.message.includes('User already registered')) {
        return {
          user: null,
          error: '이미 등록된 이메일 주소입니다. 다른 이메일을 사용하거나 로그인해 주세요.',
          success: false
        };
      }
      
      return {
        user: null,
        error: error.message,
        success: false
      };
    }
    
    return {
      user: data.user,
      session: data.session,
      success: true
    };
  } catch (error) {
    console.error('회원가입 중 오류 발생:', error);
    return {
      user: null,
      error: '회원가입 중 오류가 발생했습니다. 다시 시도해 주세요.',
      success: false
    };
  }
} 