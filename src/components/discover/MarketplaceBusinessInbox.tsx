import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  FileText, 
  ShoppingBag, 
  User, 
  ShieldAlert, 
  HelpCircle, 
  Store,
  ChevronRight,
  Sparkles,
  ArrowRightLeft,
  Truck,
  Package,
  MapPin,
  CheckCircle2,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc,
  Timestamp 
} from 'firebase/firestore';
import { getAvatarUrl } from '../../lib/avatar';
import { StoreChat, ChatMessage, Order } from './MarketplaceTypes';
import { logger } from '@/src/utils/logger';


interface BusinessInboxProps {
  onBack?: () => void;
  overrideActiveChat?: StoreChat | null;
}

export const MarketplaceBusinessInbox: React.FC<BusinessInboxProps> = ({ 
  onBack,
  overrideActiveChat 
}) => {
  const { db, profile, user, addToast } = useAeirmist();
  
  // Tabs for Inbox Category
  const [activeCategory, setActiveCategory] = useState<'store' | 'personal' | 'support' | 'orders'>('store');
  
  // Real-time conversation states
  const [chats, setChats] = useState<StoreChat[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedChat, setSelectedChat] = useState<StoreChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync list of chats
  useEffect(() => {
    if (!db || !profile) return;

    const chatsRef = collection(db, 'store_chats');
    const userKeys = Array.from(new Set([profile.id, user?.uid, profile?.uid, profile?.ownerUid].filter(Boolean)));
    
    // Listen for customer chats and owner chats with rule-compliant queries
    const qCustomer = query(chatsRef, where('customerId', '==', profile.id));
    const qOwner = query(chatsRef, where('storeOwnerId', '==', profile.id));

    let customerDocs: StoreChat[] = [];
    let ownerDocs: StoreChat[] = [];

    const mergeAndSetChats = () => {
      const chatMap = new Map<string, StoreChat>();
      [...customerDocs, ...ownerDocs].forEach(c => chatMap.set(c.id, c));
      const merged = Array.from(chatMap.values());
      merged.sort((a, b) => {
        const timeA = (a.lastMessageAt as any)?.toMillis ? (a.lastMessageAt as any).toMillis() : new Date(a.lastMessageAt || 0).getTime();
        const timeB = (b.lastMessageAt as any)?.toMillis ? (b.lastMessageAt as any).toMillis() : new Date(b.lastMessageAt || 0).getTime();
        return timeB - timeA;
      });
      setChats(merged);
    };

    const unsubCustomer = onSnapshot(qCustomer, (snapshot) => {
      customerDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreChat));
      mergeAndSetChats();
    }, (err) => {
      logger.info("Failed to sync customer store_chats:", err);
    });

    const unsubOwner = onSnapshot(qOwner, (snapshot) => {
      ownerDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreChat));
      mergeAndSetChats();
    }, (err) => {
      logger.info("Failed to sync owner store_chats:", err);
    });

    return () => {
      unsubCustomer();
      unsubOwner();
    };
  }, [db, profile?.id, user?.uid]);

  // Sync list of orders with composite-index resilience
  useEffect(() => {
    if (!db || !profile) return;

    const ordersRef = collection(db, 'orders');
    const userKeys = Array.from(new Set([profile.id, user?.uid, profile?.uid, profile?.ownerUid].filter(Boolean)));
    
    const processOrderDocs = (snapshot: any) => {
      const list = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as any));
      list.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setOrders(list);
    };

    const qPrimary = query(
      ordersRef, 
      where('sellerUids', 'array-contains-any', userKeys),
      orderBy('createdAt', 'desc')
    );
    const qFallback = query(
      ordersRef, 
      where('sellerUids', 'array-contains-any', userKeys)
    );
    
    let unsubFallback: (() => void) | null = null;
    const unsub = onSnapshot(qPrimary, (snapshot) => {
      processOrderDocs(snapshot);
    }, (err) => {
      logger.info("Orders primary sync, switching to fallback:", err);
      unsubFallback = onSnapshot(qFallback, (snapshot) => {
        processOrderDocs(snapshot);
      }, (fallbackErr) => {
        logger.error("Failed to sync orders fallback:", fallbackErr);
      });
    });

    return () => {
      unsub();
      if (unsubFallback) unsubFallback();
    };
  }, [db, profile?.id, user?.uid]);

  // Keep overrides in sync
  useEffect(() => {
    if (overrideActiveChat) {
      setSelectedChat(overrideActiveChat);
      setActiveCategory(overrideActiveChat.chatCategory || 'store');
    }
  }, [overrideActiveChat]);

  // Sync messages for selected chat
  useEffect(() => {
    if (!db || !selectedChat) {
      setMessages([]);
      return;
    }

    const msgsRef = collection(db, 'store_chats', selectedChat.id, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ChatMessage));
      setMessages(list);
      
      // auto scroll
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }, (err) => {
      logger.info("Failed to sync messages:", err);
    });

    return () => unsub();
  }, [db, selectedChat?.id]);

  // Filter chats by folder/category
  const filteredChats = chats.filter(c => c.chatCategory === activeCategory);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !profile || !selectedChat || !messageInput.trim() || submittingMessage) return;

    const textVal = messageInput.trim();
    setMessageInput('');
    setSubmittingMessage(true);

    try {
      // 1. Add message doc
      const msgsRef = collection(db, 'store_chats', selectedChat.id, 'messages');
      await addDoc(msgsRef, {
        senderId: profile.id,
        senderName: profile.displayName || profile.username,
        text: textVal,
        createdAt: serverTimestamp()
      });

      // 2. Update parent chat preview
      const chatRef = doc(db, 'store_chats', selectedChat.id);
      await updateDoc(chatRef, {
        lastMessage: textVal,
        lastSenderId: profile.id,
        lastMessageAt: serverTimestamp()
      });

      // Auto scroll
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } catch (err) {
      logger.error(err);
    } finally {
      setSubmittingMessage(false);
    }
  };

  const getChatTime = (createdAt: any) => {
    if (!createdAt) return '';
    try {
      let date: Date;
      if (createdAt.toDate) date = createdAt.toDate();
      else if (createdAt instanceof Date) date = createdAt;
      else if (createdAt.seconds) date = new Date(createdAt.seconds * 1000);
      else date = new Date(createdAt);

      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto rounded-3xl overflow-hidden bg-zinc-950/85 border border-white/5 shadow-2xl h-[70vh] flex flex-col md:flex-row">
      {/* Sidebar List */}
      <div className="w-full md:w-80 border-r border-white/5 flex flex-col h-1/2 md:h-full bg-zinc-950">
        {/* Header title */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-black text-white flex items-center gap-1.5 font-mono">
            <MessageSquare size={16} />
            BUSINESS INBOX
          </h2>
          {onBack && (
            <button 
              onClick={onBack}
              className="px-2.5 py-1 text-[10px] text-zinc-400 font-mono hover:text-white bg-zinc-90 w-fit rounded border border-white/10"
            >
              Close
            </button>
          )}
        </div>

        {/* Categories togglers */}
        <div className="grid grid-cols-3 border-b border-white/5 text-center text-xs text-neutral-400 bg-zinc-900/10">
          <button
            type="button"
            onClick={() => { setActiveCategory('store'); setSelectedChat(null); }}
            className={`py-3 font-semibold border-b-2 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-aeirmist-cyan ${
              activeCategory === 'store' ? 'border-indigo-400 text-white bg-white/[0.02]' : 'border-transparent'
            }`}
            aria-selected={activeCategory === 'store'}
            role="tab"
          >
            Store Chats
          </button>
          <button
            type="button"
            onClick={() => { setActiveCategory('personal'); setSelectedChat(null); }}
            className={`py-3 font-semibold border-b-2 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-aeirmist-cyan ${
              activeCategory === 'personal' ? 'border-indigo-400 text-white bg-white/[0.02]' : 'border-transparent'
            }`}
            aria-selected={activeCategory === 'personal'}
            role="tab"
          >
            Personal
          </button>
          <button
            type="button"
            onClick={() => { setActiveCategory('support'); setSelectedChat(null); }}
            className={`py-3 font-semibold border-b-2 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-aeirmist-cyan ${
              activeCategory === 'support' ? 'border-indigo-400 text-white bg-white/[0.02]' : 'border-transparent'
            }`}
            aria-selected={activeCategory === 'support'}
            role="tab"
          >
            Support
          </button>
          <button
            type="button"
            onClick={() => { setActiveCategory('orders'); setSelectedChat(null); }}
            className={`py-3 font-semibold border-b-2 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-aeirmist-cyan ${
              activeCategory === 'orders' ? 'border-indigo-400 text-white bg-white/[0.02]' : 'border-transparent'
            }`}
            aria-selected={activeCategory === 'orders'}
            role="tab"
          >
            Orders
          </button>
        </div>

        {/* Chats List Scroller */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.02] scrollbar-hide">
          {activeCategory === 'orders' ? (
            orders.length === 0 ? (
              <div className="py-12 px-4 text-center text-neutral-500 text-xs">
                <Package className="mx-auto mb-2 opacity-15" size={24} />
                <p className="font-mono">No customer orders found.</p>
              </div>
            ) : (
              orders.map((order) => {
                const isSelected = (selectedChat as any)?.id === order.id;
                return (
                    <button
                      type="button"
                      key={order.id}
                      onClick={() => setSelectedChat(order as any)}
                      className={`p-4 w-full flex items-start gap-3 cursor-pointer transition-all border-none text-left focus-visible:outline-none focus-visible:bg-white/[0.03] ${
                        isSelected ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-900/30 text-zinc-300'
                      }`}
                      aria-label={`Order ${order.id.substring(0, 8)}, Status: ${order.currentStatus}`}
                    >
                      <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <Package size={16} className="text-indigo-400" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold truncate">#{order.id.substring(0, 8)}</p>
                          <span className="text-[9px] text-neutral-500 font-mono">
                            {order.currentStatus.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {order.shippingAddress.fullName} • {order.items.length} items
                        </p>
                        {order.refundStatus === 'requested' && (
                          <span className="inline-flex items-center gap-1 text-[8px] uppercase tracking-wider font-mono text-orange-300 bg-orange-500/10 border border-orange-500/15 py-0.5 px-1.5 rounded mt-1.5">
                            Refund Requested
                          </span>
                        )}
                      </div>
                    </button>
                );
              })
            )
          ) : (
            filteredChats.length === 0 ? (
              <div className="py-12 px-4 text-center text-neutral-500 text-xs">
                <ShoppingBag className="mx-auto mb-2 opacity-15" size={24} />
                <p className="font-mono">No {activeCategory} conversations found.</p>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const isSelected = selectedChat?.id === chat.id;
                const isMerchant = chat.customerId !== profile?.id;
                const title = isMerchant ? `@${chat.customerName}` : `@${chat.storeName}`;
                const isSentByMe = (chat as any).lastSenderId === profile?.id;
                const rawDesc = chat.lastMessage || 'Connected to feed thread...';
                const desc = (isSentByMe && rawDesc && rawDesc !== 'Connected to feed thread...' && !rawDesc.startsWith('You: '))
                  ? `You: ${rawDesc}`
                  : rawDesc;
                const avatar = isMerchant ? chat.customerAvatar : (chat.storeLogo || '');

                return (
                  <button
                    type="button"
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`p-4 w-full flex items-start gap-3 cursor-pointer transition-all border-none text-left focus-visible:outline-none focus-visible:bg-white/[0.03] ${
                      isSelected ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-900/30 text-zinc-300'
                    }`}
                    aria-label={`Chat with ${title}`}
                  >
                    <img 
                      src={getAvatarUrl(avatar)} 
                      className="h-9 w-9 rounded-xl object-cover border border-white/5 shrink-0" 
                      alt="" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold truncate">{title}</p>
                        <span className="text-[9px] text-neutral-500 font-mono">
                          {getChatTime(chat.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">{desc}</p>
                      {chat.productContext && (
                        <span className="inline-flex items-center gap-1 text-[8px] uppercase tracking-wider font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/15 py-0.5 px-1.5 rounded mt-1.5">
                          <ShoppingBag size={8} /> Product Query
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )
          )}
        </div>
      </div>

      {/* Main Chat Panel Area */}
      <div className="flex-1 flex flex-col h-1/2 md:h-full bg-zinc-950/40">
        <AnimatePresence mode="wait">
          {activeCategory === 'orders' && selectedChat ? (
            <motion.div 
              key={(selectedChat as any).id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-6 text-left"
            >
              {/* Order Detail Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 flex items-center justify-center">
                    <Package size={20} className="text-aeirmist-cyan" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white font-mono uppercase">ORDER #{(selectedChat as any).id.substring(0, 12)}</h3>
                    <p className="text-[10px] text-zinc-500 font-mono">Customer: {(selectedChat as any).shippingAddress.fullName}</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  (selectedChat as any).currentStatus === 'delivered' ? 'bg-aeirmist-cyan/20 text-aeirmist-cyan' : 'bg-aeirmist-cyan/20 text-aeirmist-cyan'
                }`}>
                  {(selectedChat as any).currentStatus}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="p-4 bg-zinc-900/40 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase font-black">
                  <MapPin size={12} /> Shipping Destination Node
                </div>
                <div className="text-xs text-zinc-300 space-y-1">
                  <p className="text-white font-bold">{(selectedChat as any).shippingAddress.fullName}</p>
                  <p>{(selectedChat as any).shippingAddress.addressLine}</p>
                  <p>{(selectedChat as any).shippingAddress.city}, {(selectedChat as any).shippingAddress.postalCode}</p>
                  <p className="font-mono text-[10px] pt-1">PH: {(selectedChat as any).shippingAddress.phone}</p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <p className="text-[10px] font-mono text-zinc-500 uppercase font-black px-1">Order Items ({(selectedChat as any).items.length})</p>
                <div className="space-y-2">
                  {(selectedChat as any).items.map((item: any, idx: number) => (
                    <div key={idx} className="flex gap-3 p-2 bg-white/[0.02] border border-white/5 rounded-xl">
                      <img src={item.product.mediaItems?.[0]?.url} className="h-10 w-10 rounded-lg object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{item.product.name}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">Qty: {item.quantity} • ৳{(item.product.discountPrice || item.product.price).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Update Controls */}
              <div className="p-5 bg-zinc-950 border border-white/10 rounded-3xl space-y-4">
                <p className="text-[10px] font-mono text-zinc-500 uppercase font-black">Logistic Controls Dispatch</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'processing', label: 'Processing', icon: RefreshCw },
                    { id: 'packed', label: 'Packed', icon: Package },
                    { id: 'shipped', label: 'Shipped', icon: Truck },
                    { id: 'delivered', label: 'Delivered', icon: CheckCircle2 }
                  ].map((status) => (
                    <button
                      key={status.id}
                      onClick={async () => {
                        if (!db) return;
                        const orderId = (selectedChat as any).id;
                        const timeline = [...(selectedChat as any).trackingTimeline];
                        
                        // Priority levels
                        const levels: Record<string, number> = { processing: 0, packed: 1, shipped: 2, delivered: 3 };
                        const targetLevel = levels[status.id];
                        
                        // Update timeline entries up to target level
                        const updatedTimeline = timeline.map(entry => {
                          const entryLevel = levels[entry.status];
                          if (entryLevel <= targetLevel) {
                            return {
                              ...entry,
                              active: true,
                              date: entry.date || new Date().toISOString()
                            };
                          }
                          return entry;
                        });

                        try {
                          await updateDoc(doc(db, 'orders', orderId), {
                            currentStatus: status.id,
                            trackingTimeline: updatedTimeline
                          });
                          addToast({ title: 'STATUS UPDATED', message: `Order advanced to ${status.label}.`, type: 'success' });
                        } catch (err: any) {
                          logger.error(err);
                          addToast({ title: 'UPDATE FAILED', message: err?.message || 'Could not update order status.', type: 'warning' });
                        }
                      }}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${
                        (selectedChat as any).currentStatus === status.id
                          ? 'bg-aeirmist-cyan text-black border-aeirmist-cyan'
                          : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white hover:border-white/10'
                      }`}
                    >
                      <status.icon size={12} />
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Refund Request Flow */}
              {(selectedChat as any).refundStatus === 'requested' && (
                <div className="p-5 bg-orange-500/10 border border-orange-500/20 rounded-3xl space-y-4">
                  <div className="flex items-center gap-2 text-orange-400">
                    <ShieldAlert size={18} />
                    <h4 className="text-xs font-black uppercase font-mono">Refund Request Action Required</h4>
                  </div>
                  <div className="bg-black/20 p-3 rounded-xl">
                    <p className="text-[10px] text-zinc-500 font-mono uppercase mb-1">Reason provided:</p>
                    <p className="text-xs text-white">{(selectedChat as any).refundReason || "No reason provided."}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!db) return;
                        try {
                          await updateDoc(doc(db, 'orders', (selectedChat as any).id), {
                            refundStatus: 'approved'
                          });
                          addToast({ title: 'REFUND APPROVED', message: 'Refund request processed successfully.', type: 'success' });
                        } catch (err: any) { 
                          logger.error(err); 
                          addToast({ title: 'APPROVAL FAILED', message: err?.message || 'Could not approve refund.', type: 'warning' });
                        }
                      }}
                      className="flex-1 py-3 bg-cyan-500 text-black rounded-xl text-[10px] font-bold uppercase hover:bg-cyan-400 transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={12} /> Approve
                    </button>
                    <button
                      onClick={async () => {
                        if (!db) return;
                        try {
                          await updateDoc(doc(db, 'orders', (selectedChat as any).id), {
                            refundStatus: 'rejected'
                          });
                          addToast({ title: 'REFUND REJECTED', message: 'Refund request has been declined.', type: 'info' });
                        } catch (err: any) { 
                          logger.error(err); 
                          addToast({ title: 'REJECTION FAILED', message: err?.message || 'Could not decline refund.', type: 'warning' });
                        }
                      }}
                      className="flex-1 py-3 bg-red-500 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-red-400 transition-all flex items-center justify-center gap-1.5"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : selectedChat ? (
            <motion.div 
              key={selectedChat.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              {/* Active Conversation Banner / Product context attachment */}
              <div className="p-4 border-b border-white/5 bg-zinc-950/60 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={getAvatarUrl(selectedChat.customerId === profile?.id ? (selectedChat.storeLogo || '') : selectedChat.customerAvatar)} 
                      className="h-8 w-8 rounded-lg object-cover" 
                      alt="Avatar" 
                    />
                    <div>
                      <p className="text-xs font-bold text-white leading-normal">
                        {selectedChat.customerId === profile?.id ? selectedChat.storeName : `@${selectedChat.customerName}`}
                      </p>
                      <p className="text-[9px] text-neutral-500 font-mono">Real-time saved transmission</p>
                    </div>
                  </div>
                </div>

                {/* PRODUCT CONTEXT HUD */}
                {selectedChat.productContext && (
                  <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-2.5 flex items-center justify-between text-xs text-neutral-300">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img 
                        src={selectedChat.productContext.thumb} 
                        className="h-9 w-9 rounded-lg object-cover bg-neutral-900 border border-white/5 shrink-0" 
                        alt="" 
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate text-[11px]">{selectedChat.productContext.name}</p>
                        <p className="text-[10px] text-indigo-300 font-bold font-mono mt-0.5">৳{selectedChat.productContext.price.toLocaleString()}</p>
                      </div>
                    </div>
                    <span className="text-[8px] uppercase font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/10 py-1 px-2 rounded-lg shrink-0 select-none">
                      Context Info
                    </span>
                  </div>
                )}
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-hide">
                {messages.length === 0 ? (
                  <div className="py-24 text-center opacity-10">
                    <MessageSquare size={36} className="mx-auto mb-2" />
                    <p className="text-xs font-mono">No direct messages exchanged yet.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isSelf = m.senderId === profile?.id;
                    return (
                      <div 
                        key={m.id}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div 
                          className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs select-text leading-relaxed font-semibold transition-all ${
                            isSelf 
                              ? 'bg-white text-black rounded-tr-sm' 
                              : 'bg-zinc-900 text-zinc-200 rounded-tl-sm border border-white/5'
                          }`}
                        >
                          <p className="break-all whitespace-pre-wrap">{m.text}</p>
                        </div>
                        <span className="text-[8px] text-neutral-500 font-mono mt-1 px-1">
                          {getChatTime(m.createdAt)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer Footer Form */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-zinc-950/60 flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Type a message to reply..."
                  className="flex-1 text-xs text-white placeholder:text-neutral-600 bg-neutral-900 border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:border-white transition-all select-text"
                  disabled={submittingMessage}
                />
                <button
                  type="submit"
                  disabled={submittingMessage || !messageInput.trim()}
                  className="cursor-pointer bg-white text-black p-3 rounded-xl hover:bg-neutral-100 transition-all font-bold text-xs disabled:opacity-30 self-center shrink-0"
                >
                  <Send size={14} />
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              key="chat_empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center"
            >
              <MessageSquare size={48} className="text-neutral-500 mb-2 opacity-30 animate-pulse" />
              <h3 className="text-sm font-bold text-zinc-300 font-mono">No Conversation Active</h3>
              <p className="text-[11px] text-neutral-500 font-mono mt-1 max-w-xs leading-relaxed">
                Connect with stores or customer queries directly. Select a thread on the left panel to begin.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
