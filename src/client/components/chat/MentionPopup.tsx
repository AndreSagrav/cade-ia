import { useEffect, useRef, useState } from 'react';
import { File, Folder, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MentionPopupProps {
  suggestions: { type: 'file' | 'folder' | 'selection'; name: string; path: string }[];
  onSelect: (item: { type: 'file' | 'folder' | 'selection'; name: string; path: string }) => void;
  onClose: () => void;
}

export function MentionPopup({ suggestions, onSelect, onClose }: MentionPopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset selected index when suggestions list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions.length]);

  // Keyboard navigation (intercepting keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [suggestions, selectedIndex, onSelect, onClose]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (suggestions.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-[220px] overflow-y-auto rounded-xl border p-1 shadow-2xl backdrop-blur-xl animate-fade-in"
      style={{
        background: 'rgba(21, 21, 33, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        boxShadow: '0 -8px 30px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-b border-white/5 mb-1 select-none">
        Menciones de Contexto (@)
      </div>
      <div className="space-y-0.5">
        {suggestions.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={`${item.type}-${item.path}-${idx}`}
              onClick={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors',
                isSelected ? 'bg-accent/15 text-accent font-medium' : 'text-zinc-300 hover:bg-white/5 hover:text-foreground'
              )}
            >
              <span className="shrink-0">
                {item.type === 'file' ? (
                  <File size={13} className={isSelected ? 'text-accent' : 'text-zinc-400'} />
                ) : item.type === 'folder' ? (
                  <Folder size={13} className={isSelected ? 'text-accent' : 'text-zinc-400'} />
                ) : (
                  <Scissors size={13} className="text-amber-400" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate font-sans">{item.name}</div>
                {item.type !== 'selection' && (
                  <div className="truncate text-[10px] text-zinc-500 font-mono mt-0.5">{item.path}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
