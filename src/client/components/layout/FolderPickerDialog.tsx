import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Folder, HardDrive, ArrowUp, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface FolderPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function FolderPickerDialog({ open, onClose, onSelect }: FolderPickerDialogProps) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [items, setItems] = useState<{ name: string; path: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadDirectory(null);
    } else {
      setCurrentPath(null);
      setItems([]);
    }
  }, [open]);

  const loadDirectory = async (path: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listDirectories(path || undefined);
      if (res.ok) {
        setItems(res.items);
        setParentPath(res.parent);
        setCurrentPath(res.current || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (currentPath) {
      onSelect(currentPath);
      onClose();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(val) => !val && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 bg-card border shadow-xl sm:rounded-xl z-50 flex flex-col max-h-[85vh]">
          
          <div className="flex items-center justify-between p-4 border-b">
            <Dialog.Title className="text-lg font-semibold">Seleccionar Proyecto</Dialog.Title>
            <Dialog.Close className="p-1 hover:bg-muted rounded-md">
              <X className="w-5 h-5 text-muted-foreground" />
            </Dialog.Close>
          </div>

          <div className="p-3 border-b flex items-center gap-2 bg-muted/30">
            <button
              disabled={!parentPath || loading}
              onClick={() => loadDirectory(parentPath)}
              className="p-1.5 hover:bg-muted rounded-md disabled:opacity-50"
              title="Subir de nivel"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <div className="text-sm px-2 truncate flex-1 font-mono text-muted-foreground bg-background rounded border p-1">
              {currentPath || 'Este equipo'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-destructive text-center">{error}</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Carpeta vacía</div>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {items.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => loadDirectory(item.path)}
                    className="flex items-center gap-2 p-2 hover:bg-accent rounded-md text-left transition-colors"
                  >
                    {!currentPath ? (
                      <HardDrive className="w-5 h-5 text-blue-500" />
                    ) : (
                      <Folder className="w-5 h-5 text-yellow-500" />
                    )}
                    <span className="text-sm truncate select-none">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t flex justify-end gap-2 bg-muted/20">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSelect}
              disabled={!currentPath || loading}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Abrir aquí
            </button>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
