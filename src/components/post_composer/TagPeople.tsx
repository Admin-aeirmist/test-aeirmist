import React, { useState } from 'react';
import { Users, Search, X, UserCheck } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';
import { logger } from '@/src/utils/logger';


interface TagPeopleProps {
  taggedUsers: any[];
  onChange: (users: any[]) => void;
}

export const TagPeople: React.FC<TagPeopleProps> = ({ taggedUsers, onChange }) => {
  const { searchUsers, addToast } = useAeirmist();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!text) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const users = await searchUsers(text);
      // Filter out users already tagged
      const filtered = users.filter((u: any) => !taggedUsers.some(tu => tu.id === u.id));
      setResults(filtered);
    } catch (e: any) { logger.error("Error searching users:", e); addToast({ title: "Search Error", message: "Failed to search for users", type: "warning" }); } finally {
      setIsSearching(false);
    }
  };

  const addTag = (user: any) => {
    const updated = [...taggedUsers, user];
    onChange(updated);
    setQuery('');
    setResults([]);
  };

  const removeTag = (userId: string) => {
    const updated = taggedUsers.filter(tu => tu.id !== userId);
    onChange(updated);
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
      <div className="flex justify-between items-center border-b border-white/10 pb-2">
        <span className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5">
          <Users size={14} className="text-[#00f3ff]" />
          <span>Tag People</span>
        </span>
        {taggedUsers.length > 0 && (
          <span className="text-[10px] bg-[#00f3ff]/10 text-[#00f3ff] px-2 py-0.5 rounded-full font-bold">
            {taggedUsers.length} Tagged
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search username to tag..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f3ff] placeholder:text-white/20"
          />
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
        </div>

        {isSearching && (
          <div className="text-[10px] text-white/40 italic">Searching users...</div>
        )}

        {results.length > 0 && (
          <div className="space-y-1 bg-black/40 border border-white/5 rounded-xl p-2 max-h-36 overflow-y-auto">
            {results.map((user) => (
              <button
                key={user.id}
                onClick={() => addTag(user)}
                className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 text-left transition-all"
              >
                <img
                  src={getAvatarUrl(user.photoURL)}
                  className="w-5 h-5 rounded-md object-cover border border-white/10"
                  alt=""
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate font-bold">@{user.username}</div>
                  <div className="text-[9px] text-white/40 truncate">{user.displayName}</div>
                </div>
                <span className="text-[9px] font-bold text-[#00f3ff] uppercase px-1.5 py-0.5 bg-[#00f3ff]/10 rounded">Tag</span>
              </button>
            ))}
          </div>
        )}

        {taggedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {taggedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-[10px] text-white px-2 py-1 rounded-lg"
              >
                <span>@{user.username}</span>
                <button
                  onClick={() => removeTag(user.id)}
                  className="text-white/40 hover:text-red-400 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
