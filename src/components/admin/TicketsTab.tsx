import { logger } from '@/src/utils/logger';
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LifeBuoy, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  MoreVertical,
  MessageSquare,
  Image as ImageIcon,
  Clock
} from "lucide-react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";

const TicketsTab = ({ db, addToast }: { db: any, addToast: any }) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "supportTickets"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  const handleUpdateStatus = async (ticketId: string, status: string) => {
    try {
      await updateDoc(doc(db, "supportTickets", ticketId), { status });
      addToast({ title: "Status Updated", message: `Ticket marked as ${status}`, type: "success" });
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
    } catch (e) {
      logger.error(e);
      addToast({ title: "Error", message: "Could not update ticket", type: "error" });
    }
  };

  const handleDelete = async (ticketId: string) => {
    if (window.confirm("Delete this ticket permanently?")) {
      try {
        await deleteDoc(doc(db, "supportTickets", ticketId));
        addToast({ title: "Ticket Deleted", message: "Ticket has been deleted.", type: "success" });
        if (selectedTicket?.id === ticketId) setSelectedTicket(null);
      } catch (e) {
        logger.error(e);
      }
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (filter === "open") return t.status === "open";
    if (filter === "resolved") return t.status === "resolved";
    if (filter === "bug") return t.type === "bug";
    if (filter === "feature") return t.type === "feature";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
            <LifeBuoy size={24} className="text-aeirmist-cyan" />
            Support Tickets
          </h2>
          <p className="text-xs text-white/40 mt-1 uppercase tracking-wider">Manage bug reports and user feedback</p>
        </div>
        
        <div className="flex gap-2">
          {["all", "open", "resolved", "bug", "feature"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                filter === f 
                  ? "bg-aeirmist-cyan text-black" 
                  : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Ticket List */}
        <div className="lg:col-span-1 bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest">Inbox ({filteredTickets.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-center text-white/40 py-8">Loading tickets...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center text-white/40 py-8">No tickets found</div>
            ) : (
              filteredTickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selectedTicket?.id === ticket.id 
                      ? "bg-white/10 border-white/20" 
                      : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${
                      ticket.type === "bug" ? "bg-red-500/20 text-red-400" :
                      ticket.type === "feature" ? "bg-aeirmist-cyan/20 text-aeirmist-cyan" :
                      "bg-white/10 text-white/60"
                    }`}>
                      {ticket.type}
                    </span>
                    <span className={`text-[10px] uppercase font-mono ${ticket.status === "open" ? "text-yellow-400" : "text-green-400"}`}>
                      {ticket.status || "open"}
                    </span>
                  </div>
                  <div className="text-sm text-white font-medium line-clamp-1 mb-1">{ticket.message}</div>
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <span className="truncate">{ticket.username}</span>
                    <span>•</span>
                    <span>{ticket.createdAt?.toDate?.()?.toLocaleDateString() || "Just now"}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Ticket Details */}
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden flex flex-col relative">
          {selectedTicket ? (
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Ticket Details</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">ID: {selectedTicket.id}</p>
                </div>
                <div className="flex gap-2">
                  {selectedTicket.status === "open" ? (
                    <button 
                      onClick={() => handleUpdateStatus(selectedTicket.id, "resolved")}
                      className="px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl text-xs font-bold uppercase hover:bg-green-500/20 transition-all"
                    >
                      Mark Resolved
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleUpdateStatus(selectedTicket.id, "open")}
                      className="px-4 py-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-xl text-xs font-bold uppercase hover:bg-yellow-500/20 transition-all"
                    >
                      Reopen
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(selectedTicket.id)}
                    className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                  >
                    <XCircle size={18} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white/5 rounded-2xl">
                    <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Reporter</div>
                    <div className="text-sm text-white font-medium">{selectedTicket.username}</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl">
                    <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Type</div>
                    <div className="text-sm text-white font-medium capitalize">{selectedTicket.type}</div>
                  </div>
                  {selectedTicket.area && (
                    <div className="p-4 bg-white/5 rounded-2xl">
                      <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Area</div>
                      <div className="text-sm text-white font-medium capitalize">{selectedTicket.area}</div>
                    </div>
                  )}
                  <div className="p-4 bg-white/5 rounded-2xl">
                    <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Date</div>
                    <div className="text-sm text-white font-medium">
                      {selectedTicket.createdAt?.toDate?.()?.toLocaleString() || "Unknown"}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest">Message</h4>
                  <div className="p-6 bg-white/5 rounded-3xl text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.message}
                  </div>
                </div>

                {selectedTicket.attachmentUrl && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest">Attachment</h4>
                    <div className="relative group rounded-3xl overflow-hidden border border-white/10">
                      <img src={selectedTicket.attachmentUrl} alt="Attachment" className="w-full h-auto max-h-96 object-contain bg-black/50" />
                      <a 
                        href={selectedTicket.attachmentUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="px-6 py-3 bg-white text-black font-bold uppercase tracking-widest rounded-xl text-xs">
                          Open Original
                        </span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-white/20">
              <MessageSquare size={48} className="mb-4 opacity-50" />
              <p className="uppercase tracking-widest font-bold text-sm">Select a ticket to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketsTab;
