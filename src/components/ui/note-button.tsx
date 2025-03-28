'use client';

import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NoteButtonProps {
  count: number;
  unreadCount?: number;
  hasUnresolved?: boolean;
  onClick: () => void;
}

export function NoteButton({ count, unreadCount = 0, hasUnresolved = false, onClick }: NoteButtonProps) {
  // 메모가 있고 미해결 상태가 있으면 빨간색, 메모가 있고 모두 해결되었으면 초록색, 메모가 없으면 기본 색상
  const getButtonStyle = () => {
    if (count > 0) {
      if (hasUnresolved) {
        return "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-800/50 border-red-200 dark:border-red-800/50";
      } else {
        return "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-800/50 border-green-200 dark:border-green-800/50";
      }
    }
    return "bg-transparent text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400";
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={`relative flex items-center gap-1 ${getButtonStyle()}`}
    >
      <MessageSquare size={16} />
      <span className="text-xs">메모</span>
    </Button>
  );
} 