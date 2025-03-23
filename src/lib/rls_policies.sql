-- users 테이블에 대한 RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- weekly_tasks 테이블에 대한 RLS 활성화
ALTER TABLE weekly_tasks ENABLE ROW LEVEL SECURITY;

-- 사용자 인증 체크 함수
CREATE OR REPLACE FUNCTION auth.is_authenticated() RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', TRUE)::json->'sub' IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 현재 사용자 ID 가져오기 함수
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', TRUE)::json->>'sub')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용자 권한 확인 함수
CREATE OR REPLACE FUNCTION public.check_user_permission(target_user_id UUID) RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    current_user_role TEXT;
    current_user_department_id UUID;
    current_user_team_id UUID;
    target_user_department_id UUID;
    target_user_team_id UUID;
BEGIN
    -- 인증된 사용자인지 확인
    IF NOT auth.is_authenticated() THEN
        RETURN FALSE;
    END IF;

    -- 현재 사용자 ID 가져오기
    current_user_id := auth.uid();
    
    -- 자기 자신의 데이터는 항상 접근 가능
    IF current_user_id = target_user_id THEN
        RETURN TRUE;
    END IF;
    
    -- 현재 사용자 정보 조회
    SELECT role, department_id, team_id 
    INTO current_user_role, current_user_department_id, current_user_team_id
    FROM users 
    WHERE id = current_user_id;
    
    -- 대상 사용자 정보 조회
    SELECT department_id, team_id 
    INTO target_user_department_id, target_user_team_id
    FROM users 
    WHERE id = target_user_id;
    
    -- SUPER 또는 ADMIN은 모든 데이터에 접근 가능
    IF current_user_role IN ('SUPER', 'ADMIN') THEN
        RETURN TRUE;
    END IF;
    
    -- MANAGER는 같은 부서의 사용자 데이터에 접근 가능
    IF current_user_role = 'MANAGER' AND current_user_department_id = target_user_department_id THEN
        RETURN TRUE;
    END IF;
    
    -- TEAM_LEADER는 같은 팀의 사용자 데이터에 접근 가능
    IF current_user_role = 'TEAM_LEADER' AND current_user_team_id = target_user_team_id THEN
        RETURN TRUE;
    END IF;
    
    -- 그 외에는 접근 불가
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- users 테이블에 대한 정책 생성
-- 읽기 정책: 자신의 데이터 또는 권한이 있는 사용자만 읽기 가능
CREATE POLICY "users_select_policy" ON users
    FOR SELECT
    USING (
        id = auth.uid() OR 
        public.check_user_permission(id)
    );

-- 수정 정책: 자신의 데이터만 수정 가능
CREATE POLICY "users_update_policy" ON users
    FOR UPDATE
    USING (id = auth.uid());

-- weekly_tasks 테이블에 대한 정책 생성
-- 읽기 정책: 자신의 데이터 또는 권한이 있는 사용자만 읽기 가능
CREATE POLICY "weekly_tasks_select_policy" ON weekly_tasks
    FOR SELECT
    USING (
        user_id = auth.uid() OR 
        public.check_user_permission(user_id)
    );

-- 생성/수정/삭제 정책: 자신의 데이터만 생성/수정/삭제 가능
CREATE POLICY "weekly_tasks_insert_policy" ON weekly_tasks
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "weekly_tasks_update_policy" ON weekly_tasks
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "weekly_tasks_delete_policy" ON weekly_tasks
    FOR DELETE
    USING (user_id = auth.uid()); 