import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Rss, 
  Info, 
  Star, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Facebook, 
  Instagram, 
  MessageSquare, 
  Share2, 
  Send, 
  CheckCircle2, 
  CornerDownRight, 
  Trash2,
  Lock,
  MessageCircle,
  Plus,
  Image as ImageIcon,
  ShieldCheck,
  Settings
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { getAvatarUrl } from '../../lib/avatar';
import { EmptyState } from '../ui/EmptyState';
import { logger } from '@/src/utils/logger';

import { 
  Store, 
  Product, 
  StorePost, 
  StoreReview, 
  SEED_PRODUCTS, 
  SEED_STORE_POSTS, 
  SEED_STORE_REVIEWS 
} from './MarketplaceTypes';

interface StorePageProps {
  store: Store;
  onBack: () => void;
  onProductClick: (product: Product) => void;
  onMessageStoreClick: (store: Store, productContext?: Product) => void;
  onManageShop?: (store: Store) => void;
}

export const MarketplaceStorePage: React.FC<StorePageProps> = ({ 
  store, 
  onBack, 
  onProductClick, 
  onMessageStoreClick,
  onManageShop
}) => {
  const { db, profile, addToast } = useAeirmist();
  const [activeTab, setActiveTab] = useState<'products' | 'posts' | 'about' | 'reviews' | 'media'>('products');
  
  // Real-time states
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [storePosts, setStorePosts] = useState<StorePost[]>([]);
  const [storeReviews, setStoreReviews] = useState<StoreReview[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [ratingsBreakdown, setRatingsBreakdown] = useState({ avg: 5.0, total: 1, stars: [0,0,0,0,1] });

  // Review Form state
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Owner reply state
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const isOwner = profile?.id === store.ownerId;

  // Real-time syncing from Firestore
  useEffect(() => {
    if (!db) return;

    // Follow status
    setIsFollowing(store.followers?.includes(profile?.id) || false);

    // Products
    const qProducts = query(collection(db, 'products'), where('storeId', '==', store.id));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      if (snap.empty) {
        // Fallback to seed items for this store
        setStoreProducts(SEED_PRODUCTS.filter(p => p.storeId === store.id));
      } else {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setStoreProducts(list);
      }
    }, () => {
      setStoreProducts(SEED_PRODUCTS.filter(p => p.storeId === store.id));
    });

    // Posts
    const qPosts = query(collection(db, 'store_posts'), where('storeId', '==', store.id));
    const unsubPosts = onSnapshot(qPosts, (snap) => {
      if (snap.empty) {
        setStorePosts(SEED_STORE_POSTS.filter(p => p.storeId === store.id));
      } else {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StorePost));
        setStorePosts(list);
      }
    }, () => {
      setStorePosts(SEED_STORE_POSTS.filter(p => p.storeId === store.id));
    });

    // Reviews
    const qReviews = query(collection(db, 'store_reviews'), where('storeId', '==', store.id));
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      let list: StoreReview[] = [];
      if (snap.empty) {
        list = SEED_STORE_REVIEWS.filter(r => r.storeId === store.id);
      } else {
        list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreReview));
      }
      setStoreReviews(list);

      // Compute Breakdown
      if (list.length > 0) {
        const total = list.length;
        const sum = list.reduce((acc, r) => acc + r.rating, 0);
        const avg = parseFloat((sum / total).toFixed(1));
        const stars = [0, 0, 0, 0, 0]; // index 0 for 1 star, indexing ...
        list.forEach(r => {
          const idx = Math.min(Math.max(1, Math.round(r.rating)), 5) - 1;
          stars[idx] = (stars[idx] || 0) + 1;
        });
        setRatingsBreakdown({ avg, total, stars });
      } else {
        setRatingsBreakdown({ avg: 5.0, total: 0, stars: [0,0,0,0,0] });
      }
    }, () => {
      const list = SEED_STORE_REVIEWS.filter(r => r.storeId === store.id);
      setStoreReviews(list);
    });

    return () => {
      unsubProducts();
      unsubPosts();
      unsubReviews();
    };
  }, [db, store.id, profile?.id]);

  // Actions
  const handleToggleFollow = async () => {
    if (!profile || !db) {
      addToast({ title: 'AUTHENTICATION NEEDED', message: 'Please open or log into your account to follow.', type: 'warning' });
      return;
    }
    const currentFollowers = store.followers || [];
    let updatedFollowers = [...currentFollowers];
    const following = currentFollowers.includes(profile.id);

    if (following) {
      updatedFollowers = updatedFollowers.filter(id => id !== profile.id);
    } else {
      updatedFollowers.push(profile.id);
    }

    try {
      const storeRef = doc(db, 'stores', store.id);
      await updateDoc(storeRef, { followers: updatedFollowers });
      setIsFollowing(!following);
      addToast({
        title: following ? 'UNFOLLOWED STORE' : 'FOLLOWED STORE',
        message: following ? `You stopped following ${store.name}.` : `You are now receiving live feed updates of ${store.name}!`,
        type: 'success'
      });
    } catch (e) {
      logger.error(e);
    }
  };

  const handleShareStore = () => {
    try {
      navigator.clipboard.writeText(`${window.location.origin}/store/${store.username || store.id}`);
      addToast({
        title: 'SHOP LINK COPIED',
        message: `@${store.username} shop link is copied to clipboard!`,
        type: 'success'
      });
    } catch (err) {
      logger.error(err);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !db) {
      addToast({ title: 'AUTHENTICATION NEEDED', message: 'You must log in to review.', type: 'warning' });
      return;
    }
    if (!newComment.trim()) return;

    setIsSubmittingReview(true);
    try {
      await addDoc(collection(db, 'store_reviews'), {
        storeId: store.id,
        userId: profile.id,
        userName: profile.displayName || profile.username,
        userAvatar: profile.photoURL || '',
        rating: newRating,
        comment: newComment.trim(),
        createdAt: serverTimestamp()
      });

      // Update store average/total count
      const updatedTotal = ratingsBreakdown.total + 1;
      const sum = storeReviews.reduce((acc, r) => acc + r.rating, 0) + newRating;
      const updatedAvg = parseFloat((sum / updatedTotal).toFixed(1));
      
      await updateDoc(doc(db, 'stores', store.id), {
        avgRating: updatedAvg,
        totalReviews: updatedTotal
      });

      setNewComment('');
      addToast({ title: 'REVIEW RECORDED', message: 'Thank you! Your feedback star has expanded the business profile.', type: 'success' });
    } catch (e) {
      logger.error(e);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSaveReply = async (reviewId: string) => {
    const text = replyTextMap[reviewId]?.trim();
    if (!text || !db) return;

    try {
      await updateDoc(doc(db, 'store_reviews', reviewId), { reply: text });
      addToast({ title: 'REPLY SUBMITTED', message: 'Owner response has been recorded.', type: 'success' });
      // clear local text
      setReplyTextMap(prev => ({ ...prev, [reviewId]: '' }));
    } catch (err) {
      logger.error(err);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'store_reviews', reviewId));
      addToast({ title: 'REVIEW REMOVED', message: 'Review has been expunged.', type: 'success' });
    } catch (err) {
      logger.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto rounded-3xl overflow-hidden bg-zinc-950/80 border border-white/5 shadow-2xl">
      {/* Cover Header */}
      <div className="relative h-48 sm:h-64 md:h-80 w-full overflow-hidden bg-neutral-900 border-b border-white/5">
        <img 
          src={store.cover || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80'} 
          className="w-full h-full object-cover brightness-75" 
          alt={store.name} 
        />
        {/* Back Button */}
        <button 
          onClick={onBack}
          className="absolute top-4 left-4 px-4 py-2 rounded-xl bg-black/60 hover:bg-black/85 text-xs text-white backdrop-blur-md cursor-pointer border border-white/10 transition-all active:scale-95 z-20"
        >
          ← Back
        </button>
      </div>

      {/* Main Info Strip */}
      <div className="relative px-6 pb-6 pt-2 sm:pt-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
        {/* Logo and Name Section */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-16 sm:-mt-24 z-10 w-full sm:w-auto">
          <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-2xl bg-zinc-950 p-1 border-4 border-zinc-950 shadow-2xl overflow-hidden shrink-0">
            <img 
              src={getAvatarUrl(store.logo)} 
              className="w-full h-full object-cover rounded-xl"
              alt={store.name}
            />
          </div>
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">{store.name}</h1>
              {store.isVerified && (
                <ShieldCheck size={18} className="text-aeirmist-cyan shrink-0 mt-0.5" />
              )}
            </div>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">@{store.username}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2 text-xs text-neutral-300">
              <span className="font-semibold">{store.category}</span>
              {(store.city || store.location || store.country) && (
                <>
                  <span className="h-3 w-px bg-white/10" />
                  <span className="flex items-center gap-1 text-zinc-400 font-mono">
                    <MapPin size={12} className="text-zinc-500" />
                    {[store.city, store.country].filter(Boolean).join(', ') || store.location}
                  </span>
                </>
              )}
              {ratingsBreakdown.total > 0 && (
                <>
                  <span className="h-3 w-px bg-white/10" />
                  <span className="flex items-center gap-1 text-amber-400 font-mono font-bold">
                    <Star size={12} fill="currentColor" />
                    {ratingsBreakdown.avg} ({ratingsBreakdown.total})
                  </span>
                </>
              )}
              <span className="h-3 w-px bg-white/10" />
              <span className="font-mono text-zinc-400">{storeProducts.length} Products</span>
            </div>
          </div>
        </div>

        {/* Call to actions */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 shrink-0">
          {isOwner && onManageShop && (
            <button 
              type="button"
              onClick={() => onManageShop(store)}
              className="cursor-pointer px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 shadow-md"
            >
              <Settings size={14} />
              <span>Manage Shop</span>
            </button>
          )}

          {!isOwner && (
            <button 
              type="button"
              onClick={handleToggleFollow}
              className={`cursor-pointer px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 ${
                isFollowing 
                  ? 'bg-zinc-800 text-white hover:bg-zinc-700' 
                  : 'bg-white text-black hover:bg-neutral-100 shadow-md'
              }`}
            >
              <Rss size={14} />
              <span>{isFollowing ? 'Following' : 'Follow'}</span>
            </button>
          )}
          
          {!isOwner && (
            <button 
              type="button"
              onClick={() => onMessageStoreClick(store)}
              className="cursor-pointer px-4 py-2.5 rounded-xl bg-zinc-800 text-white hover:bg-zinc-750 border border-white/5 text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
            >
              <MessageSquare size={14} />
              <span>Message</span>
            </button>
          )}

          <button 
            type="button"
            onClick={handleShareStore}
            className="cursor-pointer p-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white border border-white/5 transition-all active:scale-95"
            title="Share Shop Link"
          >
            <Share2 size={14} />
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-white/5 px-6 pb-px bg-zinc-900/40 overflow-x-auto no-scrollbar scroll-smooth">
        {(['products', 'posts', 'about', 'reviews', 'media'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`cursor-pointer capitalize py-4 px-4 font-bold text-[11px] border-b-2 transition-all shrink-0 ${
              activeTab === tab 
                ? 'border-white text-white' 
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'products' && (
            <motion.div 
              key="products"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-100">Products Catalog</h3>
                <span className="text-xs text-neutral-500 font-mono">{storeProducts.length} items available</span>
              </div>

              {storeProducts.length === 0 ? (
                <EmptyState 
                  icon={<ShoppingBag size={24} />}
                  title="No products yet"
                  description="This merchant hasn't saved any physical artifacts yet."
                  actionLabel={isOwner ? "Add a product" : undefined}
                  onAction={isOwner ? () => {/* Logic for adding product */} : undefined}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {storeProducts.map((prod) => {
                    const price = prod.price;
                    const disc = prod.discountPrice;
                    const hasDiscount = disc && disc < price;
                    return (
                      <div 
                        key={prod.id}
                        onClick={() => onProductClick(prod)}
                        className="cursor-pointer rounded-2xl bg-zinc-900/50 border border-white/5 overflow-hidden hover:border-white/10 hover:bg-zinc-900 transition-all flex flex-col group"
                      >
                        <div className="aspect-square bg-neutral-900 relative overflow-hidden">
                          {prod.mediaItems && prod.mediaItems.length > 0 ? (
                            prod.mediaItems[0].type === 'video' ? (
                              <video src={prod.mediaItems[0].url} className="w-full h-full object-cover group-hover:scale-105 transition-all" muted playsInline />
                            ) : (
                              <img src={prod.mediaItems[0].url} className="w-full h-full object-cover group-hover:scale-105 transition-all" alt={prod.name} />
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-10">
                              <ShoppingBag size={48} />
                            </div>
                          )}
                          {prod.stockStatus === 'out_of_stock' && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-xs text-orange-400 font-bold uppercase tracking-widest">
                              Out of Stock
                            </div>
                          )}
                          {hasDiscount && (
                            <div className="absolute top-2 left-2 bg-cyan-500 text-black font-black text-[9px] px-2 py-0.5 rounded-full uppercase">
                              Sale
                            </div>
                          )}
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-neutral-200 line-clamp-1">{prod.name}</h4>
                            <p className="text-xs text-neutral-400 line-clamp-2 mt-1 min-h-[2rem] leading-relaxed">{prod.description}</p>
                          </div>

                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-2">
                              {hasDiscount ? (
                                <>
                                  <span className="text-sm font-black text-white">৳{disc?.toLocaleString()}</span>
                                  <span className="text-xs text-neutral-500 line-through">৳{price?.toLocaleString()}</span>
                                </>
                              ) : (
                                <span className="text-sm font-black text-white">৳{price?.toLocaleString()}</span>
                              )}
                            </div>
                            <span className="text-[10px] uppercase font-mono text-neutral-500 bg-white/5 border border-white/5 px-2 py-0.5 rounded">
                              {prod.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'posts' && (
            <motion.div 
              key="posts"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6"
            >
              <h3 className="text-sm font-bold text-zinc-100">Offers & Announcements</h3>

              {storePosts.length === 0 ? (
                <div className="py-12 text-center text-neutral-550">
                  <Rss className="mx-auto mb-2 opacity-20" size={36} />
                  <p className="text-xs font-mono">No announcements posted yet.</p>
                </div>
              ) : (
                <div className="space-y-6 max-w-2xl mx-auto">
                  {storePosts.map((post) => (
                    <div 
                      key={post.id}
                      className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 space-y-4 shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={getAvatarUrl(store.logo)} 
                          className="w-10 h-10 rounded-xl object-cover" 
                          alt={store.name} 
                        />
                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-1">
                            {store.name}
                            <ShieldCheck size={12} className="text-aeirmist-cyan shrink-0" />
                          </p>
                          <p className="text-[9px] text-neutral-500 font-mono">Synced official post</p>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed font-medium select-text whitespace-pre-wrap">{post.content}</p>

                      {post.mediaUrl && (
                        <div className="rounded-xl overflow-hidden border border-white/5 bg-black/45 max-h-96">
                          {post.mediaType === 'video' ? (
                            <video src={post.mediaUrl} className="w-full max-h-96 object-contain" controls />
                          ) : (
                            <img src={post.mediaUrl} className="w-full max-h-96 object-contain" alt="Announcement Media" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'about' && (
            <motion.div 
              key="about"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              <div className="md:col-span-2 space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Description</h4>
                  <p className="text-xs text-neutral-200 leading-relaxed font-medium select-text">{store.description}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Services & Category</h4>
                  <span className="inline-block px-3 py-1 bg-white/5 border border-white/5 rounded-full text-xs text-zinc-300">
                    {store.category}
                  </span>
                </div>
              </div>

              {/* Contact Info Card */}
              <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 space-y-4 h-fit">
                <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <Info size={14} />
                  Business Contacts
                </h4>

                <div className="space-y-3.5 text-xs text-neutral-300">
                  {store.location && (
                    <div className="flex items-start gap-2.5">
                      <MapPin size={14} className="text-neutral-500 shrink-0 mt-0.5" />
                      <span className="select-text">{store.location}</span>
                    </div>
                  )}
                  {store.contactInfo && (
                    <div className="flex items-start gap-2.5">
                      <Phone size={14} className="text-neutral-500 shrink-0 mt-0.5" />
                      <span className="select-text">{store.contactInfo}</span>
                    </div>
                  )}
                </div>

                {/* Social Network Grid */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Connect Waves</h4>
                  <div className="flex flex-wrap gap-2.5">
                    {store.websiteUrl && (
                      <a href={store.websiteUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-zinc-805 hover:bg-zinc-750 text-neutral-400 hover:text-white border border-white/5 transition-all">
                        <Globe size={14} />
                      </a>
                    )}
                    {store.facebookUrl && (
                      <a href={store.facebookUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-zinc-805 hover:bg-zinc-750 text-neutral-400 hover:text-white border border-white/5 transition-all">
                        <Facebook size={14} />
                      </a>
                    )}
                    {store.instagramUrl && (
                      <a href={store.instagramUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-zinc-805 hover:bg-zinc-750 text-neutral-400 hover:text-white border border-white/5 transition-all">
                        <Instagram size={14} />
                      </a>
                    )}
                    {store.whatsappUrl && (
                      <a href={store.whatsappUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-zinc-850 hover:bg-zinc-750 text-neutral-400 hover:text-white border border-white/5 transition-all flex items-center justify-center font-bold text-[10px] px-3.5">
                        <Phone size={11} className="mr-1" /> WhatsApp
                      </a>
                    )}
                    {store.telegramUrl && (
                      <a href={store.telegramUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-zinc-850 hover:bg-zinc-750 text-neutral-400 hover:text-white border border-white/5 transition-all flex items-center justify-center font-bold text-[10px] px-3.5">
                        <MessageCircle size={11} className="mr-1" /> Telegram
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'reviews' && (
            <motion.div 
              key="reviews"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {/* Reviews Breakdown Header */}
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 text-center space-y-3">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Merchant Score</h4>
                  <div>
                    <p className="text-4xl font-black text-white">{ratingsBreakdown.avg}</p>
                    <div className="flex items-center justify-center gap-1 mt-1 text-amber-400">
                      {[1,2,3,4,5].map(star => (
                        <Star key={star} size={14} fill={star <= Math.round(ratingsBreakdown.avg) ? "currentColor" : "none"} />
                      ))}
                    </div>
                    <p className="text-[10px] text-neutral-450 font-mono mt-1">{ratingsBreakdown.total} verified reviews</p>
                  </div>

                  {/* Star breakdown rows */}
                  <div className="space-y-1.5 pt-4 text-xs">
                    {ratingsBreakdown.stars.slice().reverse().map((count, index) => {
                      const starNum = 5 - index;
                      const percentage = ratingsBreakdown.total > 0 ? (count / ratingsBreakdown.total) * 100 : 0;
                      return (
                        <div key={starNum} className="flex items-center gap-2">
                          <span className="font-mono text-[10px] w-3 font-bold text-neutral-400">{starNum}</span>
                          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="font-mono text-[10px] w-5 text-neutral-500 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Post New Review (Customers only) */}
                {!isOwner && profile && (
                  <form onSubmit={handleSubmitReview} className="rounded-2xl border border-white/5 bg-zinc-900/20 p-5 space-y-4">
                    <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Submit merchant review</h4>
                    <div>
                      <p className="text-[10px] text-neutral-400 font-bold mb-1.5">Rating Score</p>
                      <div className="flex gap-2">
                        {[1,2,3,4,5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewRating(star)}
                            className="text-amber-400 hover:scale-115 transition-all text-lg cursor-pointer"
                          >
                            <Star size={18} fill={star <= newRating ? "currentColor" : "none"} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <textarea
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Share your buying experience & product rating..."
                        rows={3}
                        className="w-full text-xs text-white placeholder:text-neutral-600 bg-neutral-900 border border-white/5 rounded-xl p-3 focus:outline-none focus:border-white transition-all resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingReview || !newComment.trim()}
                      className="cursor-pointer w-full py-2 bg-white text-black text-xs font-black uppercase rounded-xl hover:bg-neutral-100 font-mono transition-all disabled:opacity-35"
                    >
                      {isSubmittingReview ? 'Recording...' : 'Publish Feedback'}
                    </button>
                  </form>
                )}
              </div>

              {/* Reviews List */}
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-sm font-bold text-zinc-100">Review Connections</h3>

                {storeReviews.length === 0 ? (
                  <div className="py-12 text-center text-neutral-500">
                    <Star className="mx-auto mb-2 opacity-15" size={36} />
                    <p className="text-xs font-mono select-none">No client reviews registered for this store yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {storeReviews.map((rev) => (
                      <div 
                        key={rev.id}
                        className="p-4 rounded-2xl border border-white/5 bg-zinc-900/40 space-y-3 text-xs shadow-xs relative group/review-card"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img 
                              src={getAvatarUrl(rev.userAvatar)} 
                              className="h-8 w-8 rounded-lg object-cover" 
                              alt={rev.userName} 
                            />
                            <div>
                              <p className="font-mono text-white text-[11px] font-bold">{rev.userName}</p>
                              <div className="flex gap-0.5 text-amber-400 text-[10px] mt-0.5">
                                {[1,2,3,4,5].map(st => (
                                  <Star key={st} size={10} fill={st <= rev.rating ? "currentColor" : "none"} />
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Delete option for creators or store owner */}
                          {(rev.userId === profile?.id) && (
                            <button
                              onClick={() => handleDeleteReview(rev.id)}
                              className="text-neutral-500 hover:text-red-500 p-1 rounded-lg hover:bg-zinc-800 transition-all cursor-pointer opacity-0 group-hover\/review-card:opacity-100"
                              title="Delete review"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        <p className="text-neutral-200 select-text font-medium leading-relaxed">{rev.comment}</p>

                        {/* Owner Response / Reply */}
                        {rev.reply && (
                          <div className="bg-zinc-950 p-3 rounded-xl border border-white/5 flex items-start gap-2.5 text-xs text-neutral-300">
                            <CornerDownRight size={14} className="text-neutral-500 shrink-0 mt-0.5" />
                            <div className="space-y-0.5 select-text">
                              <p className="font-bold text-white flex items-center gap-1 text-[11px]">
                                Reply from {store.name}
                                <ShieldCheck size={10} className="text-aeirmist-cyan shrink-0" />
                              </p>
                              <p className="leading-relaxed text-zinc-300 font-medium">{rev.reply}</p>
                            </div>
                          </div>
                        )}

                        {/* Store Owner Reply Composer Interface */}
                        {isOwner && !rev.reply && (
                          <div className="mt-3 flex items-center gap-2 pt-2 border-t border-white/5">
                            <input
                              type="text"
                              value={replyTextMap[rev.id] || ''}
                              onChange={e => setReplyTextMap(prev => ({ ...prev, [rev.id]: e.target.value }))}
                              placeholder="Type reply as store owner..."
                              className="flex-1 bg-zinc-950 border border-white/5 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-white text-white select-text h-8 leading-tight"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveReply(rev.id)}
                              disabled={!replyTextMap[rev.id]?.trim()}
                              className="cursor-pointer px-3.5 h-8 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg text-[10px] uppercase flex items-center gap-1"
                            >
                              Reply
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'media' && (
            <motion.div
              key="media_panel"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              <p className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 text-left">STORE VISUAL PORTAL MEDIA</p>
              
              {(() => {
                const prodMedia = storeProducts.flatMap(p => p.mediaItems?.map(m => ({ ...m, product: p, type: 'product' })) || []);
                const postMedia = storePosts.filter(sp => sp.mediaUrl).map(sp => ({ id: sp.id, url: sp.mediaUrl, type: 'post', post: sp }));
                const combined = [...prodMedia, ...postMedia] as Array<{ id: string; url: string; type: string; product?: Product; post?: StorePost }>;

                if (combined.length === 0) {
                  return (
                    <div className="py-20 text-center opacity-30 select-none border border-dashed border-white/5 rounded-3xl">
                      <ImageIcon className="mx-auto text-zinc-500 mb-1" size={24} />
                      <p className="text-xs font-mono">No visual media registered on this node.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-3 gap-2.5">
                    {combined.map((mItem, index) => (
                      <div
                        key={mItem.id || index}
                        onClick={() => {
                          if (mItem.type === 'product' && mItem.product) {
                            onProductClick(mItem.product);
                          } else {
                            addToast?.({ title: "Post details", message: mItem.post?.content || "Shared media from this store.", type: "info" });
                          }
                        }}
                        className="aspect-square bg-neutral-900 border border-white/5 rounded-xl overflow-hidden hover:border-white/20 transition-all cursor-pointer relative group"
                      >
                        <img src={mItem.url} className="w-full h-full object-cover group-hover:scale-105 duration-300 transition-all font-mono" alt="" />
                        <span className="absolute bottom-1 right-1 bg-black/65 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase text-zinc-300 tracking-wider font-bold">
                          {mItem.type}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
