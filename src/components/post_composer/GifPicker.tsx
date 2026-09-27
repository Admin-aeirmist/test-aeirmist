import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Flame, Laugh, Heart, Coffee, Loader2 } from 'lucide-react';

// Tenor public demo key — free for non-commercial use
const TENOR_KEY = 'LIVDSRZULELA';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
}

export const GifPicker: React.FC<GifPickerProps> = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('trending');
  const [gifs, setGifs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categories = [
    { id: 'trending', label: 'Trending', icon: Flame, query: 'trending' },
    { id: 'reactions', label: 'Reactions', icon: Laugh, query: 'reaction' },
    { id: 'meme', label: 'Memes', icon: Coffee, query: 'meme' },
    { id: 'coding', label: 'Coding', icon: Sparkles, query: 'coding developer' },
    { id: 'gaming', label: 'Gaming', icon: Heart, query: 'gaming' },
  ];

  const fetchGifs = async (searchTerm: string) => {
    setLoading(true);
    try {
      const endpoint = searchTerm
        ? `https://api.tenor.com/v1/search?q=${encodeURIComponent(searchTerm)}&key=${TENOR_KEY}&limit=18&media_filter=minimal`
        : `https://api.tenor.com/v1/trending?key=${TENOR_KEY}&limit=18&media_filter=minimal`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const urls: string[] = (data.results || [])
          .map((r: any) => r?.media?.[0]?.gif?.url || r?.media?.[0]?.tinygif?.url)
          .filter(Boolean);
        setGifs(urls);
      }
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  // Load category GIFs on mount and category change
  useEffect(() => {
    if (!query) {
      const cat = categories.find(c => c.id === activeCategory);
      fetchGifs(cat?.query || 'trending');
    }
  }, [activeCategory]);

  // Debounce search input
  useEffect(() => {
    if (!query.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
      <div className="flex justify-between items-center border-b border-white/10 pb-2">
        <span className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
          <Sparkles size={14} className="text-[#00f3ff]" />
          <span>GIF Picker</span>
        </span>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value) fetchGifs(categories.find(c => c.id === activeCategory)?.query || 'trending');
            }}
            placeholder="Search GIFs..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f3ff] placeholder:text-white/20"
          />
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
        </div>

        {/* Categories strip */}
        {!query && (
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setQuery(''); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all shrink-0 ${activeCategory === cat.id ? 'bg-[#00f3ff] text-black border-[#00f3ff]' : 'bg-white/5 border-white/5 text-white/60 hover:border-white/10'}`}
              >
                <cat.icon size={12} />
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* GIF results grid */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-[#00f3ff]" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-xs">No GIFs found. Try a different search.</div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {gifs.map((gif, idx) => (
              <button
                key={idx}
                onClick={() => onSelect(gif)}
                className="relative aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-[#00f3ff] hover:scale-[1.02] transition-all group"
              >
                <img src={gif} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" loading="lazy" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-[9px] font-black uppercase text-white bg-black/80 px-2 py-0.5 rounded">Select</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

