-- 주간 업무 메모/피드백 테이블
CREATE TABLE weekly_task_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  weekly_task_id UUID NOT NULL REFERENCES weekly_tasks(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  parent_note_id UUID REFERENCES weekly_task_notes(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'replied', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX idx_weekly_task_notes_weekly_task_id ON weekly_task_notes(weekly_task_id);
CREATE INDEX idx_weekly_task_notes_sender_id ON weekly_task_notes(sender_id);
CREATE INDEX idx_weekly_task_notes_recipient_id ON weekly_task_notes(recipient_id);
CREATE INDEX idx_weekly_task_notes_parent_note_id ON weekly_task_notes(parent_note_id);

-- RLS(Row Level Security) 정책 설정
ALTER TABLE weekly_task_notes ENABLE ROW LEVEL SECURITY;

-- ### 기존 정책 삭제 방법 (문제 발생 시 실행) ###
-- DROP POLICY IF EXISTS "Users can view their own notes" ON weekly_task_notes;
-- DROP POLICY IF EXISTS "Users can update notes they created" ON weekly_task_notes;
-- DROP POLICY IF EXISTS "Users can delete notes they created" ON weekly_task_notes;
-- DROP POLICY IF EXISTS "Users can insert new notes" ON weekly_task_notes;

-- ### 개선된 권한 설정 ###

-- 정책 설정: 발신자 또는 수신자는 자신의 메모에 접근 가능
CREATE POLICY "Users can view their own notes"
  ON weekly_task_notes
  FOR SELECT
  USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

-- 정책 설정: 상급자는 팀원의 메모 접근 가능 (사용자 정보 조회 위한 추가 함수)
CREATE OR REPLACE FUNCTION check_superior_permission(note_sender_id UUID, note_recipient_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  current_user_role TEXT;
  current_user_dept TEXT;
  current_user_team TEXT;
  sender_dept TEXT;
  sender_team TEXT;
  recipient_dept TEXT;
  recipient_team TEXT;
BEGIN
  -- 현재 인증된 사용자 정보
  current_user_id := auth.uid();
  
  -- 현재 사용자 정보 조회
  SELECT role, department_id, team_id INTO current_user_role, current_user_dept, current_user_team
  FROM users
  WHERE id = current_user_id;
  
  -- 발신자와 수신자의 부서/팀 정보 조회
  SELECT department_id, team_id INTO sender_dept, sender_team
  FROM users
  WHERE id = note_sender_id;
  
  SELECT department_id, team_id INTO recipient_dept, recipient_team
  FROM users
  WHERE id = note_recipient_id;
  
  -- SUPER, ADMIN은 모든 메모 접근 가능
  IF current_user_role IN ('SUPER', 'ADMIN') THEN
    RETURN TRUE;
  END IF;
  
  -- MANAGER는 같은 부서의 모든 메모 접근 가능
  IF current_user_role = 'MANAGER' AND (
    current_user_dept = sender_dept OR current_user_dept = recipient_dept
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- TEAM_LEADER는 같은 팀의 모든 메모 접근 가능
  IF current_user_role = 'TEAM_LEADER' AND (
    current_user_team = sender_team OR current_user_team = recipient_team
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- 그 외의 경우 접근 불가
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 정책 설정: 상급자는 팀원의 메모 조회 가능
CREATE POLICY "Superiors can view team member notes"
  ON weekly_task_notes
  FOR SELECT
  USING (
    check_superior_permission(sender_id, recipient_id)
  );

-- 정책 설정: 사용자는 자신이 보낸 메모만 수정 가능
CREATE POLICY "Users can update notes they created"
  ON weekly_task_notes
  FOR UPDATE
  USING (auth.uid() = sender_id);

-- 정책 설정: 사용자는 자신의 메모만 삭제 가능
CREATE POLICY "Users can delete notes they created"
  ON weekly_task_notes
  FOR DELETE
  USING (auth.uid() = sender_id);

-- 정책 설정: 사용자는 새 메모 추가 가능 (조건 업데이트로 답변 허용)
CREATE OR REPLACE POLICY "Users can insert new notes"
  ON weekly_task_notes
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND 
    (
      -- 자기 자신에게 메모를 보내지 못하게 함
      auth.uid() <> recipient_id OR 
      -- 답변인 경우는 예외 처리
      parent_note_id IS NOT NULL
    )
  );

-- 실행 방법:
-- 1. Supabase 대시보드에서 SQL 편집기를 엽니다.
-- 2. 위의 코드를 실행 전, 테이블이 이미 존재하는 경우 CREATE TABLE 부분은 제외하고 실행해도 됩니다.
-- 3. 기존 정책이 있는 경우, 주석 처리된 DROP POLICY 문을 활성화하여 먼저 실행한 다음 새 정책을 생성합니다.
-- 4. 테이블과 정책이 성공적으로 설정되었는지 확인합니다. 