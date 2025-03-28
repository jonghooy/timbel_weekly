'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { createTaskNote, getTaskNotes, markNoteAsRead, updateNoteStatus, subscribeToTaskNotes } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Send, Check, CornerDownRight } from 'lucide-react';

interface NoteDialogProps {
  weeklyTaskId: string;
  recipientId: string;
  currentUserId: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onNotesUpdated?: () => void;
}

export function NoteDialog({
  weeklyTaskId,
  recipientId,
  currentUserId,
  isOpen,
  setIsOpen,
  onNotesUpdated
}: NoteDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<any[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [replyRecipientId, setReplyRecipientId] = useState<string | null>(null);
  const [localReplyContent, setLocalReplyContent] = useState<string>('');
  
  // 실시간 구독 취소 함수 참조 저장
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadNotes();
      
      // 실시간 구독 설정
      setupRealtimeSubscription();
    }
    
    // 컴포넌트 언마운트 또는 isOpen이 false로 변경될 때 구독 취소
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [isOpen, weeklyTaskId]);
  
  // 실시간 구독 설정
  const setupRealtimeSubscription = () => {
    // 이미 구독 중이면 취소 후 재구독
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    // 사용자 입력 중인지 확인하는 상태 추가
    let isUserTyping = false;
    
    // 폼 요소에 포커스 이벤트 리스너 추가
    const addFocusListeners = () => {
      const textareas = document.querySelectorAll('.note-dialog-textarea');
      textareas.forEach(textarea => {
        textarea.addEventListener('focus', () => { isUserTyping = true; });
        textarea.addEventListener('blur', () => { 
          // 약간의 지연을 두어 다른 작업 완료 후 상태 변경
          setTimeout(() => { isUserTyping = false; }, 100); 
        });
      });
    };
    
    // 초기 리스너 설정
    addFocusListeners();
    
    // 5초마다 메모 목록 갱신 (사용자가 입력 중이 아닐 때만)
    console.log('주기적 폴링 방식으로 메모 상태 확인 시작:', weeklyTaskId);
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && !isUserTyping) {
        console.log('주기적 폴링: 메모 목록 갱신');
        
        // 현재 포커스된 요소 저장
        const activeElement = document.activeElement;
        
        // 메모 목록 로드
        loadNotes().then(() => {
          // 로드 후 DOM이 업데이트되면 리스너 다시 추가
          setTimeout(() => {
            addFocusListeners();
            
            // 이전에 포커스된 요소가 있고 여전히 문서 내에 존재하면 포커스 복원
            if (activeElement && document.contains(activeElement)) {
              (activeElement as HTMLElement).focus();
            }
          }, 100);
        });
      }
    }, 5000);
    
    // 구독 취소 함수로 간격 타이머 취소 반환
    unsubscribeRef.current = () => {
      console.log('주기적 폴링 중지');
      clearInterval(intervalId);
    };
  };
  
  // 실시간 업데이트 처리 함수
  const handleRealtimeUpdate = (payload: any) => {
    console.log('메모 업데이트 감지:', payload);
    loadNotes();
    
    // 부모 컴포넌트에도 변경 알림
    if (onNotesUpdated) {
      onNotesUpdated();
    }
    
    // 알림 표시 (선택적)
    if (payload.eventType === 'INSERT' && payload.new.sender_id !== currentUserId) {
      toast({
        title: '새 메모 도착',
        description: '새로운 메모가 도착했습니다.',
      });
    }
  };

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      console.log('메모 대화창 데이터 로드 시작:', { weeklyTaskId, recipientId, currentUserId });
      
      // recipientId를 taskOwnerId로 전달
      const notesList = await getTaskNotes(weeklyTaskId, recipientId);
      console.log('로드된 메모 목록:', notesList);
      
      // 메모 목록을 계층 구조로 재정렬
      const organizedNotes = organizeNotes(notesList);
      console.log('계층 구조로 정렬된 메모:', organizedNotes);
      
      setNotes(organizedNotes);
      
      // 읽지 않은 메모가 있으면 읽음 표시 처리
      const unreadNotes = notesList.filter(
        note => !note.is_read && note.recipient.id === currentUserId
      );
      
      if (unreadNotes.length > 0) {
        console.log('읽지 않은 메모 처리:', unreadNotes.length);
        await Promise.all(
          unreadNotes.map(note => markNoteAsRead(note.id))
        );
      }
      
      return notesList;
    } catch (error) {
      console.error('메모 로드 중 오류 발생:', error);
      toast({
        title: '메모 로드 실패',
        description: '메모를 불러오는 중 문제가 발생했습니다.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // 메모를 계층 구조로 정렬하는 함수
  const organizeNotes = (notesList: any[]) => {
    // 메모를 ID 기준으로 맵핑
    const notesMap = new Map();
    notesList.forEach(note => {
      // 자식 메모 배열을 추가
      note.children = [];
      notesMap.set(note.id, note);
    });
    
    // 최상위 메모만 결과 배열에 포함
    const result: any[] = [];
    
    // 부모-자식 관계 설정
    notesList.forEach(note => {
      if (note.parent_note_id && notesMap.has(note.parent_note_id)) {
        // 부모 메모가 있으면 해당 부모의 자식으로 추가
        const parentNote = notesMap.get(note.parent_note_id);
        parentNote.children.push(note);
      } else {
        // 부모가 없으면 최상위 메모로 간주
        result.push(note);
      }
    });
    
    // 메모와 자식 메모를 생성일 기준으로 정렬
    const sortByDate = (notes: any[]) => {
      notes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      notes.forEach(note => {
        if (note.children.length > 0) {
          sortByDate(note.children);
        }
      });
      return notes;
    };
    
    return sortByDate(result);
  };

  const handleSendNote = async () => {
    // 현재 입력 내용 확인 (전역 또는 지역 답장 내용)
    const contentToSend = replyingTo ? localReplyContent : newNoteContent;
    
    if (!contentToSend.trim()) return;
    
    // 실제 수신자 ID 결정 (답변 모드일 경우 원 발신자로 설정)
    const actualRecipientId = replyingTo && replyRecipientId ? replyRecipientId : recipientId;
    
    // 디버깅 로그 추가
    console.log('메모 전송 대상 확인:', {
      recipientId,
      replyingTo,
      replyRecipientId,
      actualRecipientId,
      currentUserId,
      content: contentToSend
    });
    
    // 자기 자신에게 메모를 보내는 것 방지 (단, 답변 중일 때는 건너뜀)
    if (!replyingTo && actualRecipientId === currentUserId) {
      toast({
        title: '메모 전송 실패',
        description: '자기 자신에게 메모를 보낼 수 없습니다.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsLoading(true);
      console.log('메모 전송 시작:', { 
        weeklyTaskId, 
        recipientId: actualRecipientId, 
        content: contentToSend,
        replyingTo: replyingTo || undefined 
      });
      
      // 안전하게 try-catch로 감싸서 전송
      try {
        await createTaskNote(
          weeklyTaskId,
          actualRecipientId,
          contentToSend,
          replyingTo || undefined
        );
        
        console.log('메모 전송 완료');
        setNewNoteContent('');
        setLocalReplyContent('');
        setReplyingTo(null);
        setReplyRecipientId(null);
        
        // 메모가 부모 메모에 대한 답변인 경우, 부모 메모 상태 업데이트
        if (replyingTo) {
          await updateNoteStatus(replyingTo, 'replied');
        }
        
        await loadNotes();
        if (onNotesUpdated) onNotesUpdated();
        
        toast({
          title: '메모 전송 완료',
          description: '메모가 성공적으로 전송되었습니다.',
        });
      } catch (sendError: any) {
        console.error('메모 전송 세부 오류:', sendError);
        const errorMessage = sendError.message || '알 수 없는 오류가 발생했습니다.';
        toast({
          title: '메모 전송 실패',
          description: `메모를 전송하는 중 문제가 발생했습니다: ${errorMessage}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('메모 전송 중 오류 발생:', error);
      toast({
        title: '메모 전송 실패',
        description: '메모를 전송하는 중 문제가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMarkAsResolved = async (noteId: string) => {
    try {
      await updateNoteStatus(noteId, 'resolved');
      await loadNotes();
      if (onNotesUpdated) onNotesUpdated();
      
      toast({
        title: '메모 상태 업데이트',
        description: '메모가 해결됨으로 표시되었습니다.',
      });
    } catch (error) {
      console.error('메모 상태 업데이트 중 오류 발생:', error);
      toast({
        title: '상태 업데이트 실패',
        description: '메모 상태를 업데이트하는 중 문제가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleResolved = async (noteId: string, currentStatus: string) => {
    try {
      // 현재 상태에 따라 반대 상태로 토글
      const newStatus = currentStatus === 'resolved' ? 'pending' : 'resolved';
      await updateNoteStatus(noteId, newStatus);
      await loadNotes();
      
      // 메모 상태가 변경되었음을 부모 컴포넌트에 알림
      if (onNotesUpdated) onNotesUpdated();
      
      toast({
        title: '메모 상태 업데이트',
        description: newStatus === 'resolved' 
          ? '메모가 해결됨으로 표시되었습니다.' 
          : '메모가 미해결 상태로 변경되었습니다.',
      });
    } catch (error) {
      console.error('메모 상태 업데이트 중 오류 발생:', error);
      toast({
        title: '상태 업데이트 실패',
        description: '메모 상태를 업데이트하는 중 문제가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 계층 구조로 메모를 렌더링하는 재귀 함수
  const renderNotes = (notesList: any[], level = 0) => {
    return notesList.map((note) => (
      <div key={note.id}>
        <div 
          className={`flex gap-3 ${
            level > 0 ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''
          }`}
        >
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={note.sender.avatar_url} alt={note.sender.full_name} />
            <AvatarFallback>
              {note.sender.full_name.substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {note.sender.full_name}
              </span>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(note.created_at), { 
                  addSuffix: true,
                  locale: ko 
                })}
              </span>
              
              {/* 해결됨/미해결 상태는 최초 메모 발신자만 변경 가능(부모 메모가 없는 경우) */}
              {note.sender.id === currentUserId && !note.parent_note_id && (
                <>
                  {note.status === 'resolved' ? (
                    <span 
                      className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex items-center cursor-pointer hover:bg-green-100"
                      onClick={() => handleToggleResolved(note.id, note.status)}
                    >
                      <Check size={12} className="mr-1" />
                      해결됨
                    </span>
                  ) : (
                    <span 
                      className="text-xs text-white bg-red-600 px-1.5 py-0.5 rounded flex items-center cursor-pointer hover:bg-red-700"
                      onClick={() => handleToggleResolved(note.id, note.status)}
                    >
                      미해결
                    </span>
                  )}
                </>
              )}
              
              {/* 발신자가 아니거나 답변인 경우 읽기 전용으로 상태 표시 */}
              {(note.sender.id !== currentUserId || note.parent_note_id) && note.status === 'resolved' && (
                <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex items-center">
                  <Check size={12} className="mr-1" />
                  해결됨
                </span>
              )}
            </div>
            
            {note.parent_note && (
              <div className="text-xs text-gray-500 mt-1 mb-2 flex items-center">
                <CornerDownRight size={12} className="mr-1" />
                <span className="italic">
                  {note.parent_note.content.length > 50
                    ? `${note.parent_note.content.substring(0, 50)}...`
                    : note.parent_note.content}
                </span>
              </div>
            )}
            
            <div className="mt-1 text-sm whitespace-pre-wrap">
              {note.content}
            </div>
            
            <div className="mt-2 flex gap-2">
              {note.recipient.id === currentUserId && note.status !== 'resolved' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => {
                    setReplyingTo(note.id);
                    setReplyRecipientId(note.sender.id);
                    setLocalReplyContent(`@${note.sender.full_name} `);
                  }}
                >
                  답변하기
                </Button>
              )}
            </div>
            
            {/* 인라인 답장 입력 영역 */}
            {replyingTo === note.id && (
              <div className="mt-3 border-l-2 border-gray-200 pl-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded-md mb-2 text-xs flex justify-between items-center">
                  <span>답변 작성 중...</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 text-xs"
                    onClick={() => {
                      setReplyingTo(null);
                      setLocalReplyContent('');
                    }}
                  >
                    취소
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <Textarea
                    placeholder="답변 내용을 입력하세요..."
                    value={localReplyContent}
                    onChange={(e) => setLocalReplyContent(e.target.value)}
                    className="flex-1 h-20 resize-none note-dialog-textarea"
                    disabled={isLoading}
                    autoFocus
                  />
                  <Button
                    onClick={handleSendNote}
                    disabled={isLoading || !localReplyContent.trim()}
                    className="self-end"
                    size="sm"
                  >
                    <Send size={16} className="mr-1" />
                    전송
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 자식 메모 렌더링 */}
        {note.children.length > 0 && renderNotes(note.children, level + 1)}
      </div>
    ));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // 대화창이 닫힐 때 메모 카운트 새로고침
      if (!open && onNotesUpdated) {
        onNotesUpdated();
      }
      setIsOpen(open);
    }}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>주간 업무 메모</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col space-y-4 max-h-[60vh] overflow-y-auto p-2">
          {notes.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              아직 작성된 메모가 없습니다.
            </div>
          ) : (
            renderNotes(notes)
          )}
        </div>
        
        <div className="border-t pt-4">
          {!replyingTo && (
            <div className="flex gap-2">
              <Textarea
                placeholder="메모 내용을 입력하세요..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="flex-1 h-20 resize-none note-dialog-textarea"
                disabled={(recipientId === currentUserId) || isLoading}
              />
              <Button
                onClick={handleSendNote}
                disabled={isLoading || !newNoteContent.trim() || (recipientId === currentUserId)}
                className="self-end"
              >
                <Send size={16} className="mr-1" />
                전송
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 