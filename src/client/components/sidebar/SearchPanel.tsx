import { useState } from 'react';
import { Search } from 'lucide-react';

export function SearchPanel() {
  const [query, setQuery] = useState('');

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border p-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10">
          <Search size={13} className="text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en archivos..."
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
        Escribe para buscar en los archivos del proyecto.
      </div>
    </div>
  );
}
