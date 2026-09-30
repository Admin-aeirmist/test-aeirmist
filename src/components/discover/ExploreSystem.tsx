import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ShoppingBag, 
  Store, 
  Sparkles, 
  Cpu, 
  Compass, 
  Rss, 
  Heart, 
  MessageSquare, 
  Share2, 
  Bookmark, 
  Grid, 
  List, 
  ChevronRight, 
  MapPin, 
  Briefcase, 
  Filter, 
  Settings, 
  ShieldCheck, 
  Star,
  CornerDownRight,
  User,
  Truck,
  PlusCircle,
  ThumbsUp,
  Inbox,
  Laptop,
  Shirt,
  Pizza,
  Sofa,
  Car,
  FileCode,
  BookOpen,
  Dumbbell,
  Tag,
  Plus,
  X,
  SlidersHorizontal,
  ChevronDown,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  Smartphone,
  Camera
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { useAppearance } from '../../context/AppearanceContext';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  getDocs,
  getDoc,
  serverTimestamp, 
  deleteDoc,
  increment,
  orderBy,
  limit
} from 'firebase/firestore';

// Subcomponents and Types
import { 
  Store as StoreType, 
  Product, 
  Service, 
  StorePost, 
  StoreChat,
  MARKETPLACE_CATEGORIES,
  SEED_STORES,
  SEED_PRODUCTS,
  SEED_SERVICES,
  SEED_STORE_POSTS
} from './MarketplaceTypes';
import { MarketplaceStorePage } from './MarketplaceStorePage';
import { MarketplaceDashboard } from './MarketplaceDashboard';
import { MarketplaceBusinessInbox } from './MarketplaceBusinessInbox';
import { getAvatarUrl } from '../../lib/avatar';
import { EmptyState } from '../ui/EmptyState';

// Added modules for End-to-End Commerce
import { MarketplaceCart, CartItem } from './MarketplaceCart';
import { parseNaturalLanguageQuery, filterProductsByNlp } from './MarketplaceSearchParser';
import { MarketplaceWorldMap } from './MarketplaceWorldMap';
import { logger } from '@/src/utils/logger';
import { useBackHandler } from '../../utils/backNavigation';


// Component mapping for Category Icons to maintain a simple clean visual design
const categoryIconsMap: Record<string, any> = {
  Laptop: <Laptop size={14} />,
  Shirt: <Shirt size={14} />,
  Sparkles: <Sparkles size={14} />,
  Pizza: <Pizza size={14} />,
  Sofa: <Sofa size={14} />,
  Car: <Car size={14} />,
  FileCode: <FileCode size={14} />,
  Briefcase: <Briefcase size={14} />,
  Home: <Store size={14} />,
  BookOpen: <BookOpen size={14} />,
  Dumbbell: <Dumbbell size={14} />
};

export const ExploreSystem: React.FC<{ 
  onUserClick?: (user: any) => void, 
  onPostClick?: (postId: string) => void,
  onCreate?: () => void,
  initialStoreId?: string | null,
  initialProductId?: string | null,
  onStoreChange?: (id: string | null) => void,
  onProductChange?: (id: string | null) => void
}> = React.memo(({ 
  onUserClick, 
  onPostClick,
  onCreate, 
  initialStoreId, 
  initialProductId,
  onStoreChange,
  onProductChange
}) => {
  const { settings } = useAppearance();
  const isGlobalBgActive = settings.globalBgType !== 'none' && !!settings.globalBgValue;
  const { db, user, profile, localAvatarURL, addToast, earnPoints } = useAeirmist();

  // Bottom Navigation tabs - For You (previously discover), Products, Stores, Services, Categories
  const [activeTab, setActiveTab] = useState<'foryou' | 'products' | 'stores' | 'services' | 'categories'>('foryou');
  
  // Outer popup subviews (Inbox, Merchant Desk, Saved drawer)
  const [showBusinessInbox, setShowBusinessInbox] = useState(false);
  const [showMerchantDesk, setShowMerchantDesk] = useState(false);
  const [showBookmarksDrawer, setShowBookmarksDrawer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Selected visual profiles
  const [selectedStorePage, setSelectedStorePage] = useState<StoreType | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);
  
  // Search state & Overlay focus
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Location selector (DHAKA / ALL / SYLHET / CHITTAGONG etc.)
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Geographic locator map toggle
  const [viewStoresMap, setViewStoresMap] = useState<boolean>(false);

  // Shopping Cart & Currency Integration
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('aeirmist_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currency, setCurrency] = useState<'BDT' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AED' | 'INR'>('BDT');
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [showNlpSearchHelp, setShowNlpSearchHelp] = useState(false);

  // Currency multipliers relative to BDT base
  const currencyRates = {
    BDT: 1.0,
    USD: 1 / 120,
    EUR: 1 / 130,
    GBP: 1 / 155,
    JPY: 1 / 0.78,
    AED: 1 / 32.5,
    INR: 1 / 1.4
  };

  const currencySymbols = {
    BDT: '৳',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AED: 'Dh',
    INR: '₹'
  };

  const currencySymbol = currencySymbols[currency];
  const currencyRate = currencyRates[currency];

  // Dynamic order tracking timeline
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [selectedOrderToTrack, setSelectedOrderToTrack] = useState<any | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundReasonDraft, setRefundReasonDraft] = useState('');

  // Custom Wishlist Collections Folders
  const [wishlistCollections, setWishlistCollections] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('aeirmist_wishlists');
      return saved ? JSON.parse(saved) : { 'General Favorites': [] };
    } catch {
      return { 'General Favorites': [] };
    }
  });
  const [showWishlistCollections, setShowWishlistCollections] = useState(false);
  const [newCollectionFolderName, setNewCollectionFolderName] = useState('');

  // Active product variant selection state
  const [selectedProductVariant, setSelectedProductVariant] = useState<string>('');

  // Auto spec reset on product detail swap
  useEffect(() => {
    if (selectedProductDetail) {
      setSelectedProductVariant(selectedProductDetail.variants?.[0] || '');
      setActiveDetailPhotoIndex(0);
      setIsPhotoZoomed(false);
    }
  }, [selectedProductDetail]);

  // Sync store/product detail state changes back to parent for URL sync
  useEffect(() => {
    if (selectedStorePage?.id !== initialStoreId) {
      onStoreChange?.(selectedStorePage?.id || null);
    }
  }, [selectedStorePage?.id]);

  useEffect(() => {
    if (selectedProductDetail?.id !== initialProductId) {
      onProductChange?.(selectedProductDetail?.id || null);
    }
  }, [selectedProductDetail?.id]);

  // Intercept back actions for Explore overlays, cart, product detail, and store page
  useBackHandler(() => {
    if (showCartDrawer) {
      setShowCartDrawer(false);
      return true;
    }
    if (selectedOrderToTrack) {
      setSelectedOrderToTrack(null);
      return true;
    }
    if (refundModalOpen) {
      setRefundModalOpen(false);
      return true;
    }
    if (showWishlistCollections) {
      setShowWishlistCollections(false);
      return true;
    }
    if (viewStoresMap) {
      setViewStoresMap(false);
      return true;
    }
    if (selectedProductDetail) {
      setSelectedProductDetail(null);
      onProductChange?.(null);
      return true;
    }
    if (selectedStorePage) {
      setSelectedStorePage(null);
      onStoreChange?.(null);
      return true;
    }
    return false;
  }, true, 60, [
    showCartDrawer,
    selectedOrderToTrack,
    refundModalOpen,
    showWishlistCollections,
    viewStoresMap,
    selectedProductDetail,
    selectedStorePage
  ]);

  // Sync state managers with localStorage
  useEffect(() => {
    localStorage.setItem('aeirmist_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('aeirmist_wishlists', JSON.stringify(wishlistCollections));
  }, [wishlistCollections]);

  // Cart operations helpers
  const handleAddToCart = (product: Product, variant: string) => {
    setCart(prev => {
      const exists = prev.find(item => item.product.id === product.id && item.selectedVariant === variant);
      if (exists) {
        addToast({ title: 'QUANTITY UPDATED', message: `Incremented quantity of ${product.name} in your cart.`, type: 'success' });
        return prev.map(item => item.product.id === product.id && item.selectedVariant === variant ? { ...item, quantity: item.quantity + 1 } : item);
      }
      addToast({ title: 'ADDED TO CART', message: `${product.name} successfully staged in checkout pipeline.`, type: 'success' });
      return [...prev, { product, quantity: 1, selectedVariant: variant }];
    });
  };

  const handleUpdateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQ = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQ };
        }
        return item;
      });
    });
  };

  const handleRemoveCartItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    addToast({ title: 'ITEM REMOVED', message: 'Item removed from your secure cart.', type: 'info' });
  };

  const formatPrice = (bdtAmount: number) => {
    const converted = bdtAmount * currencyRate;
    return `${currencySymbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const [selectedDetailSecTab, setSelectedDetailSecTab] = useState<'specs' | 'reviews' | 'qna'>('specs');
  
  const [qaList, setQaList] = useState<any[]>([]);
  const [newQuestionText, setNewQuestionText] = useState('');

  const [productReviews, setProductReviews] = useState<Record<string, any[]>>({});
  const [newReviewRating, setNewReviewRating] = useState<number>(5);
  const [newReviewText, setNewReviewText] = useState<string>('');

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    const q = newQuestionText.trim();
    setNewQuestionText('');
    
    // Auto-answer logic based on keywords
    let ans = "Thank you for inquiring! The store manager will review this node parameter and reply shortly.";
    if (q.toLowerCase().includes('warranty') || q.toLowerCase().includes('guarantee')) {
      ans = "Indeed! We provide a 1-year comprehensive hardware warranty on all Aeirmist certified models.";
    } else if (q.toLowerCase().includes('ship') || q.toLowerCase().includes('delivery') || q.toLowerCase().includes('courier')) {
      ans = "We ship globally from our central warehouse. Standard deliveries take 2-3 days, while drone dispatches complete in 45 minutes.";
    } else if (q.toLowerCase().includes('price') || q.toLowerCase().includes('discount') || q.toLowerCase().includes('promo')) {
      ans = "Our prices are converted in real-time. Check our promo bar or apply coupon nodes at checkout for extra credit!";
    }

    setQaList(prev => [
      { q, a: ans, user: profile?.name || 'Anonymous User', date: 'Just now' },
      ...prev
    ]);
    addToast({ title: 'Question Sent', message: 'Your inquiry has been sent and replied to automatically.', type: 'success' });
  };

  const handleAddReviewSubmit = (e: React.FormEvent, productId: string) => {
    e.preventDefault();
    if (!newReviewText.trim()) return;
    const comment = newReviewText.trim();
    setNewReviewText('');
    
    const newRev = {
      id: `rev_${Date.now()}`,
      author: profile?.name || 'Verified Customer',
      rating: newReviewRating,
      comment: comment,
      verified: true,
      createdAt: 'Just now',
      reply: 'Thank you so much for your support! We look forward to serving you again at our node.'
    };

    setProductReviews(prev => {
      const existing = prev[productId] || [];
      return { ...prev, [productId]: [newRev, ...existing] };
    });

    addToast({ title: 'REVIEW CONVEYED', message: 'Your verified purchaser feedback is saved.', type: 'success' });
    earnPoints(15); // Bonus points for contributing verified reviews!
  };

  // Price & Sorting Filters
  const [priceFilter, setPriceFilter] = useState<number>(300000); // Up to 300,000 Taka
  const [activeSort, setActiveSort] = useState<'newest' | 'oldest' | 'price_low' | 'price_high' | 'rating'>('newest');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // Grid vs list toggle

  // Real-time Lists syncing with rich initial fallback
  const [stores, setStores] = useState<StoreType[]>(SEED_STORES);
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);
  const [services, setServices] = useState<Service[]>(SEED_SERVICES);
  const [storePosts, setStorePosts] = useState<StorePost[]>(SEED_STORE_POSTS);
  const [savedItems, setSavedItems] = useState<string[]>([]); // Array of saved Item IDs
  const [likedPosts, setLikedPosts] = useState<string[]>([]);

  // Messenger popup (Direct contextual Message draft window)
  const [activeMessageDraftStore, setActiveMessageDraftStore] = useState<StoreType | null>(null);
  const [activeMessageDraftProduct, setActiveMessageDraftProduct] = useState<Product | null>(null);
  const [messageDraftText, setMessageDraftText] = useState('');
  const [isSendingDraft, setIsSendingDraft] = useState(false);
  const [showDirectInboxChat, setShowDirectInboxChat] = useState<StoreChat | null>(null);

  // Expanded comment threads on Marketplace feed list cards
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [feedPostComments, setFeedPostComments] = useState<Record<string, any[]>>({});
  const [newCommentTextMap, setNewCommentTextMap] = useState<Record<string, string>>({});

  // Quick list floating action button states (FAB Bubble Options)
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  
  // Modals for adding products/services/posts
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);

  // Edit Product Modal states
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editProdData, setEditProdData] = useState<Partial<Product>>({});

  // Service form fields
  const [srvTitle, setSrvTitle] = useState('');
  const [srvDesc, setSrvDesc] = useState('');
  const [srvPricing, setSrvPricing] = useState('');
  const [srvContactEmail, setSrvContactEmail] = useState('');
  const [srvContactPhone, setSrvContactPhone] = useState('');
  const [srvCategory, setSrvCategory] = useState('Services');

  // New Product form fields
  const [newProdName, setNewProdName] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdDiscount, setNewProdDiscount] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Electronics');
  const [newProdStock, setNewProdStock] = useState<'available' | 'out_of_stock'>('available');
  const [newProdVariants, setNewProdVariants] = useState('');
  const [newProdTags, setNewProdTags] = useState('');
  const [newProdMedia, setNewProdMedia] = useState('');

  // New Store Post form fields
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMedia, setNewPostMedia] = useState('');

  // Handle deep link loading from initial props
  useEffect(() => {
    if (initialStoreId && !selectedStorePage && stores.length > 0) {
      const match = stores.find(s => s.id === initialStoreId);
      if (match) setSelectedStorePage(match);
    }
  }, [initialStoreId, stores]);

  useEffect(() => {
    if (initialProductId && !selectedProductDetail && products.length > 0) {
      const match = products.find(p => p.id === initialProductId);
      if (match) setSelectedProductDetail(match);
    }
  }, [initialProductId, products]);

  // Active Photo Index inside Product detail page
  const [activeDetailPhotoIndex, setActiveDetailPhotoIndex] = useState(0);
  const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);

  // Touch Swipe navigation coordinates
  const [touchStartX, setTouchStartX] = useState(0);

  // Load real-time lists from Firestore with comprehensive seeded fallback
  useEffect(() => {
    if (!db) return;

    // 1. Sync Stores
    const unsubStores = onSnapshot(query(collection(db, 'stores'), limit(50)), (snapshot) => {
      if (!snapshot.empty) {
        setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreType)));
      } else {
        setStores(SEED_STORES);
      }
      setIsLoading(false);
    }, (error) => {
      logger.error("ExploreSystem: Stores sync failed", error);
      setStores(SEED_STORES);
      setIsLoading(false);
    });

    // 2. Sync Products
    const unsubProducts = onSnapshot(query(collection(db, 'products'), limit(80)), (snapshot) => {
      if (!snapshot.empty) {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      } else {
        setProducts(SEED_PRODUCTS);
      }
    }, (error) => {
      logger.error("ExploreSystem: Products sync failed", error);
      setProducts(SEED_PRODUCTS);
    });

    // 3. Sync Services
    const unsubServices = onSnapshot(query(collection(db, 'services'), limit(50)), (snapshot) => {
      if (!snapshot.empty) {
        setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
      } else {
        setServices(SEED_SERVICES);
      }
    }, (error) => {
      logger.error("ExploreSystem: Services sync failed", error);
      setServices(SEED_SERVICES);
    });

    // 4. Sync Store Posts
    const unsubPosts = onSnapshot(query(collection(db, 'store_posts'), limit(60)), (snapshot) => {
      if (!snapshot.empty) {
        setStorePosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StorePost)));
      } else {
        setStorePosts(SEED_STORE_POSTS);
      }
    }, (error) => {
      logger.error("ExploreSystem: Posts sync failed", error);
      setStorePosts(SEED_STORE_POSTS);
    });

    return () => {
      unsubStores();
      unsubProducts();
      unsubServices();
      unsubPosts();
    };
  }, [db]);

  // Sync Orders
  useEffect(() => {
    if (!db || !profile) return;
    
    const ordersRef = collection(db, 'orders');
    const qPrimary = query(ordersRef, where('buyerId', '==', profile.id), orderBy('createdAt', 'desc'));
    const qFallback = query(ordersRef, where('buyerId', '==', profile.id));
    
    const processDocs = (snapshot: any) => {
      const list = snapshot.docs.map((doc: any) => {
        const d = doc.data();
        let createdAt = d.createdAt;
        if (createdAt?.toDate) createdAt = createdAt.toDate().toISOString();
        return { id: doc.id, ...d, createdAt } as any;
      });
      list.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setOrderHistory(list);
    };

    let unsubFallback: (() => void) | null = null;

    const unsub = onSnapshot(qPrimary, (snapshot) => {
      processDocs(snapshot);
    }, (err) => {
      logger.warn("Order primary sync warning, attempting fallback query:", err);
      unsubFallback = onSnapshot(qFallback, (snapshot) => {
        processDocs(snapshot);
      }, (fallbackErr) => {
        logger.error("Order sync error:", fallbackErr);
      });
    });
    
    return () => {
      unsub();
      if (unsubFallback) unsubFallback();
    };
  }, [db, profile?.id]);

  // Sync Bookmarks (Saved list) of user real-time
  useEffect(() => {
    if (!db || !profile) return;

    const unsubSaved = onSnapshot(query(collection(db, 'saved_items'), where('userId', '==', profile.id)), (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data().itemId as string);
      setSavedItems(items);
    }, (err) => {
      logger.info(err);
    });

    return () => unsubSaved();
  }, [db, profile?.id]);

  // Sync expanded comments in real-time
  useEffect(() => {
    if (!db || !expandedCommentsPostId) return;

    const q = query(
      collection(db, 'feed_comments'),
      where('postId', '==', expandedCommentsPostId)
    );

    const unsubComm = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort oldest first client-side
      list.sort((a: any, b: any) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setFeedPostComments(prev => ({
        ...prev,
        [expandedCommentsPostId]: list
      }));
    });

    return () => unsubComm();
  }, [db, expandedCommentsPostId]);

  // Helper selectors and composite lists
  const mixedFeedItems = useMemo(() => {
    // We mix products & merchant posts together sorted by newest
    const feedProds = products.map((p) => ({
      id: p.id,
      storeId: p.storeId,
      storeName: p.storeName,
      storeLogo: p.storeLogo,
      title: p.name,
      description: p.description,
      mediaUrl: p.mediaItems?.[0]?.url || '',
      mediaType: p.mediaItems?.[0]?.type || 'image',
      price: p.discountPrice || p.price,
      type: 'product',
      isVerified: p.isVerified,
      createdAt: p.createdAt,
      rawData: p
    }));

    const feedPosts = storePosts.map((sp) => ({
      id: sp.id,
      storeId: sp.storeId,
      storeName: sp.storeName,
      storeLogo: sp.storeLogo,
      title: 'Merchant Update',
      description: sp.content,
      mediaUrl: sp.mediaUrl || '',
      mediaType: sp.mediaType || 'image',
      price: 0,
      type: 'post',
      isVerified: sp.isVerified,
      createdAt: sp.createdAt,
      rawData: sp
    }));

    const unified = [...feedProds, ...feedPosts];
    // Sort descending by date
    unified.sort((a, b) => {
      const dateA = a.createdAt?.seconds || 0;
      const dateB = b.createdAt?.seconds || 0;
      return dateB - dateA;
    });

    return unified;
  }, [products, storePosts]);

  // Core Filtered Products with Natural Language NLP integration
  const filteredProducts = useMemo(() => {
    // 1. If searchQuery is non-empty, use our NLP search filter
    if (searchQuery.trim()) {
      const parsedNlp = parseNaturalLanguageQuery(searchQuery, currencyRate);
      let list = filterProductsByNlp(products, parsedNlp, selectedLocation);

      // Category filter override (if user selected a specific category tab)
      if (selectedCategory) {
        const catFiltered = list.filter((p) => p.category?.toLowerCase() === selectedCategory.toLowerCase());
        if (catFiltered.length > 0) {
          list = catFiltered;
        }
      }

      // Location filter mapping override
      if (selectedLocation !== 'All') {
        list = list.filter((p) => {
          const matchingStore = stores.find(s => s.id === p.storeId);
          const storeLoc = matchingStore?.location || (p as any).location || 'Dhaka';
          return storeLoc.toLowerCase().includes(selectedLocation.toLowerCase());
        });
      }

      // Max price limit override (comparing against effective price)
      list = list.filter((p) => (p.discountPrice || p.price) <= priceFilter);

      return list;
    }

    // 2. Default standard filters
    return products.filter((p) => {
      // Category filter
      if (selectedCategory && p.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      
      // Location filter mapping
      if (selectedLocation !== 'All') {
        const matchingStore = stores.find(s => s.id === p.storeId);
        const storeLoc = matchingStore?.location || (p as any).location || 'Dhaka';
        if (!storeLoc.toLowerCase().includes(selectedLocation.toLowerCase())) {
          return false;
        }
      }

      // Max price limit (checks discountPrice if present)
      const effectivePrice = p.discountPrice || p.price;
      if (effectivePrice > priceFilter) return false;

      return true;
    }).sort((a, b) => {
      const priceA = a.discountPrice || a.price;
      const priceB = b.discountPrice || b.price;
      if (activeSort === 'price_low') return priceA - priceB;
      if (activeSort === 'price_high') return priceB - priceA;
      if (activeSort === 'oldest') return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0); // newest
    });
  }, [products, selectedCategory, searchQuery, priceFilter, activeSort, selectedLocation, stores, currencyRate]);

  // Core Filtered Services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (selectedLocation !== 'All') {
        const srvLoc = (s as any).location || 'Dhaka';
        if (!srvLoc.toLowerCase().includes(selectedLocation.toLowerCase())) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          (s.title || '').toLowerCase().includes(q) || 
          (s.description || '').toLowerCase().includes(q) || 
          (s.category || '').toLowerCase().includes(q) || 
          (s.ownerName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [services, searchQuery, selectedLocation]);

  // Saved bookmark items split components
  const bookmarkedProducts = useMemo(() => {
    return products.filter(p => savedItems.includes(p.id));
  }, [products, savedItems]);

  const bookmarkedStores = useMemo(() => {
    return stores.filter(s => savedItems.includes(s.id));
  }, [stores, savedItems]);

  const bookmarkedServices = useMemo(() => {
    return services.filter(srv => savedItems.includes(srv.id));
  }, [services, savedItems]);

  const BroadcastSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="p-4 rounded-3xl bg-zinc-950 border border-white/5 space-y-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/5" />
            <div className="space-y-2">
              <div className="h-3 bg-white/10 rounded w-24" />
              <div className="h-2 bg-white/5 rounded w-16" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-white/10 rounded w-3/4" />
            <div className="h-3 bg-white/5 rounded w-1/2" />
          </div>
          <div className="aspect-[16/10] rounded-2xl bg-white/5" />
          <div className="flex justify-between pt-2">
            <div className="h-4 bg-white/5 rounded w-20" />
            <div className="h-4 bg-white/5 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );

  const RecommendedUserSkeleton = () => (
    <div className="flex items-center gap-3 overflow-x-auto py-1 scrollbar-none no-scrollbar">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="w-48 bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden shrink-0 h-44 animate-pulse">
          <div className="h-16 bg-white/5" />
          <div className="p-3 space-y-3">
            <div className="h-3 bg-white/10 rounded w-2/3" />
            <div className="h-2 bg-white/5 rounded w-full" />
            <div className="h-2 bg-white/5 rounded w-1/2" />
            <div className="pt-2 border-t border-white/5 flex justify-between">
              <div className="h-2 bg-white/5 rounded w-8" />
              <div className="h-2 bg-white/5 rounded w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const ProductGridSkeleton = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
        <div key={i} className="bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden flex flex-col h-56 animate-pulse">
          <div className="aspect-square bg-white/5" />
          <div className="p-3 space-y-2">
            <div className="h-2.5 bg-white/10 rounded w-3/4" />
            <div className="h-2 bg-white/5 rounded w-1/2" />
            <div className="pt-2 flex justify-between">
              <div className="h-3 bg-white/10 rounded w-12" />
              <div className="h-3 bg-white/5 rounded w-6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const ServiceSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="p-4 rounded-3xl bg-zinc-950 border border-white/5 space-y-3 animate-pulse h-40">
          <div className="flex justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-2 bg-white/5 rounded w-16" />
              <div className="h-3 bg-white/10 rounded w-3/4" />
            </div>
            <div className="h-6 bg-white/5 rounded w-16" />
          </div>
          <div className="h-3 bg-white/5 rounded w-full" />
          <div className="h-3 bg-white/5 rounded w-2/3" />
          <div className="pt-2 border-t border-white/5 flex justify-between">
            <div className="flex gap-2">
              <div className="h-6 w-6 rounded-lg bg-white/5" />
              <div className="h-2 bg-white/5 rounded w-12 mt-2" />
            </div>
            <div className="h-7 bg-white/5 rounded-xl w-24" />
          </div>
        </div>
      ))}
    </div>
  );

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchStartX - touchEndX;
    const tabOrder = ['foryou', 'products', 'stores', 'services', 'categories'] as const;
    const currentIndex = tabOrder.indexOf(activeTab);

    if (currentIndex !== -1) {
      if (deltaX > 80 && currentIndex < tabOrder.length - 1) {
        // swipe left -> next tab
        const nextTab = tabOrder[currentIndex + 1];
        setActiveTab(nextTab);
        setSelectedStorePage(null);
        setSelectedProductDetail(null);
      } else if (deltaX < -80 && currentIndex > 0) {
        // swipe right -> previous tab
        const prevTab = tabOrder[currentIndex - 1];
        setActiveTab(prevTab);
        setSelectedStorePage(null);
        setSelectedProductDetail(null);
      }
    }
  };

  // Actions
  const handleToggleLikePost = async (id: string) => {
    if (likedPosts.includes(id)) {
      setLikedPosts(prev => prev.filter(p => p !== id));
    } else {
      setLikedPosts(prev => [...prev, id]);
      earnPoints(2);
      addToast({ title: 'Like (+2 Points)', message: 'Liked product update.', type: 'info' });
    }
  };

  // Saved / Bookmark items persistence in firestore 'saved_items'
  const handleToggleSaveItem = async (itemId: string, itemType: 'product' | 'store' | 'service' | 'post') => {
    if (!db) return;
    if (!profile) {
      addToast({ title: 'SYNC NOT VALID', message: 'Sign in to bookmark listings.', type: 'warning' });
      return;
    }

    try {
      const q = query(
        collection(db, 'saved_items'), 
        where('userId', '==', profile.id), 
        where('itemId', '==', itemId)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // Remove bookmark
        const docId = snapshot.docs[0].id;
        await deleteDoc(doc(db, 'saved_items', docId));
        addToast({ title: 'BOOKMARK REMOVED', message: 'Item unpinned from your Profile.', type: 'info' });
      } else {
        // Add bookmark
        await addDoc(collection(db, 'saved_items'), {
          userId: profile.id,
          itemId,
          itemType,
          savedAt: serverTimestamp()
        });
        earnPoints(3);
        addToast({ title: 'BOOKMARK SECURED (+3 FP)', message: 'Item saved to your profile.', type: 'success' });
      }
    } catch (err) {
      logger.error(err);
      addToast({ title: 'Update Failed', message: 'Failed to save item. Please try again.', type: 'warning' });
    }
  };

  // Intent: Start conversation prefilled with dynamic product specs
  const handleMessageStoreClick = (targetStore: StoreType, prodObj?: Product) => {
    if (!profile) {
      addToast({ title: 'Connection Failed', message: 'Authentication required key sync.', type: 'warning' });
      return;
    }

    if (targetStore.ownerId === profile.id) {
      addToast({ title: 'Self Connection Rejected', message: 'Merchant owns this store node.', type: 'info' });
      return;
    }

    setActiveMessageDraftStore(targetStore);
    if (prodObj) {
      setActiveMessageDraftProduct(prodObj);
      setMessageDraftText(`Inquiry regarding: ${prodObj.name} (৳${(prodObj.discountPrice || prodObj.price).toLocaleString()}). Hello, is this currently available?`);
    } else {
      setActiveMessageDraftProduct(null);
      setMessageDraftText(`Greetings! I would love to inquire about your store catalog.`);
    }
  };

  // Sends the initial merchant inquiry and directs directly to business inbox
  const handleSendInquiry = async () => {
    if (!db || !profile || !activeMessageDraftStore || isSendingDraft) return;

    setIsSendingDraft(true);
    try {
      // 1. Create store chat doc is not already existing
      const chatRef = collection(db, 'store_chats');
      
      const pContext = activeMessageDraftProduct ? {
        id: activeMessageDraftProduct.id,
        name: activeMessageDraftProduct.name,
        price: activeMessageDraftProduct.discountPrice || activeMessageDraftProduct.price,
        thumb: activeMessageDraftProduct.mediaItems?.[0]?.url || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=150&q=80'
      } : undefined;

      // Filter existing chat matching this store & customer
      const q = query(chatRef, where('customerId', '==', profile.id), where('storeId', '==', activeMessageDraftStore.id));
      const existSnap = await getDocs(q);

      let activeChatId = '';
      let chatObj: any = null;

      if (!existSnap.empty) {
        activeChatId = existSnap.docs[0].id;
        chatObj = { id: activeChatId, ...existSnap.docs[0].data() } as StoreChat;
        // update lastMessage fields on exist
        await updateDoc(doc(db, 'store_chats', activeChatId), {
          lastMessage: messageDraftText,
          lastMessageAt: serverTimestamp(),
          productContext: pContext || null
        });
      } else {
        const currentUid = user?.uid || profile.uid || profile.ownerUid || profile.id;
        const storeOwnerUid = (activeMessageDraftStore as any).ownerUid || activeMessageDraftStore.ownerId;
        const newChat = {
          storeId: activeMessageDraftStore.id,
          storeName: activeMessageDraftStore.name,
          storeLogo: activeMessageDraftStore.logo,
          storeOwnerId: activeMessageDraftStore.ownerId,
          sellerUid: storeOwnerUid,
          buyerUid: currentUid,
          customerId: profile.id,
          customerName: profile.displayName || profile.username,
          customerAvatar: profile.photoURL || '',
          participants: Array.from(new Set([currentUid, profile.id, storeOwnerUid, activeMessageDraftStore.ownerId].filter(Boolean))),
          lastMessage: messageDraftText,
          lastMessageAt: serverTimestamp(),
          chatCategory: 'store',
          productContext: pContext || null
        };
        const docRef = await addDoc(chatRef, newChat);
        activeChatId = docRef.id;
        chatObj = { id: activeChatId, ...newChat };
      }

      // Add messages secondary subcollection
      const msgRef = collection(db, 'store_chats', activeChatId, 'messages');
      await addDoc(msgRef, {
        senderId: profile.id,
        senderName: profile.displayName || profile.username,
        text: messageDraftText,
        createdAt: serverTimestamp()
      });

      addToast({ title: 'Inquiry Sent', message: 'Direct message sent to shop.', type: 'success' });
      setActiveMessageDraftStore(null);
      setActiveMessageDraftProduct(null);
      setMessageDraftText('');

      // Open store chat immediately
      setShowBusinessInbox(true);
    } catch (e: any) {
      logger.error('Failed to send store inquiry:', e);
      addToast({ title: 'Error', message: 'Could not send message to shop.', type: 'warning' });
    } finally {
      setIsSendingDraft(false);
    }
  };

  const handleToggleComments = (id: string) => {
    if (expandedCommentsPostId === id) {
      setExpandedCommentsPostId(null);
    } else {
      setExpandedCommentsPostId(id);
    }
  };

  const handleSubmitComment = async (postId: string) => {
    if (!db || !profile) return;
    const txt = newCommentTextMap[postId];
    if (!txt || !txt.trim()) return;

    setNewCommentTextMap(prev => ({ ...prev, [postId]: '' }));

    try {
      await addDoc(collection(db, 'feed_comments'), {
        postId,
        userId: profile.id,
        userName: profile.displayName || profile.username,
        userAvatar: profile.photoURL || '',
        comment: txt.trim(),
        createdAt: serverTimestamp()
      });
      addToast({ title: 'Comment posted', message: 'Your comment has been posted.', type: 'success' });
    } catch (err) {
      logger.info(err);
    }
  };

  // Add Service Form submit
  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !profile) return;

    try {
      const ownerUid = user?.uid || profile.uid || profile.ownerUid || profile.id;
      await addDoc(collection(db, 'services'), {
        ownerId: profile.id,
        ownerUid: ownerUid,
        sellerUid: ownerUid,
        sellerId: profile.id,
        ownerName: profile.displayName || profile.username,
        ownerAvatar: profile.photoURL || '',
        title: srvTitle,
        description: srvDesc,
        pricing: srvPricing || "Free",
        portfolioUrls: ['https://images.unsplash.com/photo-1541746972996-4e0b0f43e01a?auto=format&fit=crop&w=400&q=80'],
        contactEmail: srvContactEmail,
        contactPhone: srvContactPhone,
        category: srvCategory,
        createdAt: serverTimestamp()
      });

      addToast({ title: 'SERVICE LISTED (+10 FP)', message: 'Service listed successfully.', type: 'success' });
      setShowAddServiceModal(false);
      setSrvTitle('');
      setSrvDesc('');
      setSrvPricing('');
      setSrvContactEmail('');
      setSrvContactPhone('');
    } catch (e: any) {
      logger.error('Service listing error:', e);
      addToast({ title: 'Save Failed', message: e?.message || 'Could not list service.', type: 'warning' });
    }
  };

  // Add listing submit
  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !profile) return;

    // Check if user has a store
    const ownedStores = stores.filter(s => s.ownerId === profile.id);
    if (ownedStores.length === 0) {
      addToast({
        title: 'MERCHANT ACCESS REVOKED',
        message: 'Must establish an active store first on the Merchant Desk!',
        type: 'warning'
      });
      return;
    }

    const activeStoreNode = ownedStores[0];

    try {
      const sellerUid = user?.uid || profile.uid || profile.ownerUid || profile.id;
      await addDoc(collection(db, 'products'), {
        storeId: activeStoreNode.id,
        storeName: activeStoreNode.name,
        storeLogo: activeStoreNode.logo,
        sellerUid: sellerUid,
        sellerId: profile.id,
        ownerUid: sellerUid,
        name: newProdName,
        description: newProdDesc,
        price: Number(newProdPrice),
        discountPrice: newProdDiscount ? Number(newProdDiscount) : undefined,
        category: newProdCategory,
        stockStatus: newProdStock,
        variants: newProdVariants ? newProdVariants.split(',').map(s => s.trim()) : [],
        tags: newProdTags ? newProdTags.split(',').map(s => s.trim()) : [],
        mediaItems: [{
          id: 'media_product_1',
          type: 'image',
          url: newProdMedia || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80'
        }],
        createdAt: serverTimestamp()
      });

      addToast({ title: 'LISTING LAUNCHED', message: 'Product listed to public discovery.', type: 'success' });
      setShowAddProductModal(false);
      setNewProdName('');
      setNewProdDesc('');
      setNewProdPrice('');
      setNewProdDiscount('');
      setNewProdMedia('');
      setNewProdVariants('');
      setNewProdTags('');
    } catch (err: any) {
      logger.error('Product launch error:', err);
      addToast({ title: 'Listing Failed', message: err?.message || 'Could not launch product listing.', type: 'warning' });
    }
  };

  // Create Merchant announcements/Post submit
  const handleCreatePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !profile) return;

    const ownedStores = stores.filter(s => s.ownerId === profile.id);
    if (ownedStores.length === 0) {
      addToast({ title: 'Merchant Required', message: 'Please create a shop first to post updates.', type: 'warning' });
      return;
    }

    const activeStoreNode = ownedStores[0];

    try {
      const ownerUid = user?.uid || profile.uid || profile.ownerUid || profile.id;
      await addDoc(collection(db, 'store_posts'), {
        storeId: activeStoreNode.id,
        storeName: activeStoreNode.name,
        storeLogo: activeStoreNode.logo,
        ownerUid: ownerUid,
        sellerUid: ownerUid,
        content: newPostContent,
        mediaUrl: newPostMedia || undefined,
        mediaType: 'image',
        likesCount: 0,
        likedBy: [],
        commentsCount: 0,
        createdAt: serverTimestamp()
      });

      addToast({ title: 'Update Posted', message: 'Shop update sent.', type: 'success' });
      setShowCreatePostModal(false);
      setNewPostContent('');
      setNewPostMedia('');
    } catch (err: any) {
      logger.error('Store post error:', err);
      addToast({ title: 'Posting Failed', message: err?.message || 'Could not publish shop update.', type: 'warning' });
    }
  };

  // Product Edit update submission
  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !selectedProductDetail) return;

    try {
      await updateDoc(doc(db, 'products', selectedProductDetail.id), {
        name: editProdData.name,
        description: editProdData.description,
        price: Number(editProdData.price),
        discountPrice: editProdData.discountPrice ? Number(editProdData.discountPrice) : null,
        category: editProdData.category,
        stockStatus: editProdData.stockStatus,
        variants: editProdData.variants,
        tags: editProdData.tags,
        // update top media value
        'mediaItems.0.url': editProdData.mediaItems?.[0]?.url || ''
      });

      // Update selected interactive product item reference instantly for seamless details render
      setSelectedProductDetail(prev => prev ? { ...prev, ...editProdData } as Product : null);
      addToast({ title: 'Changes Saved', message: 'Product updated successfully.', type: 'success' });
      setShowEditProductModal(false);
    } catch (err) {
      logger.error(err);
      addToast({ title: 'Update Failed', message: 'Database failed to save changes.', type: 'warning' });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!db) return;
    if (!window.confirm("Perform delete sequence on listing? This action cannot be reverted.")) return;

    try {
      await deleteDoc(doc(db, 'products', id));
      addToast({ title: 'Listing Deleted', message: 'Product removed from catalog.', type: 'success' });
      setSelectedProductDetail(null);
    } catch (err) {
      logger.error(err);
    }
  };

  const handleShareProduct = (prod: Product) => {
    navigator.clipboard.writeText(`${window.location.origin}/marketplace/item/${prod.id}`);
    addToast({ title: 'Link Copied', message: 'Product link copied to clipboard.', type: 'info' });
  };

  // Filter Categories setup
  const finalCategoriesList = MARKETPLACE_CATEGORIES;

  return (
    <div 
      className="flex flex-col flex-1 h-full min-h-0 relative text-white bg-zinc-950/95 backdrop-blur-2xl select-none w-full overflow-y-auto scroll-container pb-36 md:pb-8"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ----------------- STICKY HEADER ----------------- */}
      <header className="sticky top-0 bg-zinc-950/95 backdrop-blur-xl border-b border-white/10 px-4 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] pb-2.5 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Branding */}
          <div className="flex items-center justify-between">
            <div 
              onClick={() => {
                setActiveTab('foryou');
                setSelectedCategory(null);
                setSelectedProductDetail(null);
                setSelectedStorePage(null);
              }}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-aeirmist-cyan to-indigo-500 p-[1px]">
                <div className="h-full w-full bg-zinc-950 rounded-lg flex items-center justify-center text-aeirmist-cyan">
                  <ShoppingBag size={15} aria-hidden="true" />
                </div>
              </div>
              <div className="text-left">
                <h1 className="text-sm font-extrabold tracking-wider text-white font-mono">AEIRMIST</h1>
                <p className="text-[9px] text-zinc-400 font-mono uppercase tracking-widest leading-none">Marketplace</p>
              </div>
            </div>

            {/* Mobile Actions: Sell, Bookmarks, Profile */}
            <div className="flex items-center gap-1.5 md:hidden">
              <button 
                type="button"
                onClick={() => setShowBookmarksDrawer(true)} 
                className="p-1.5 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 cursor-pointer"
                aria-label="Saved items"
              >
                <Bookmark size={14} />
              </button>
              <button 
                type="button"
                onClick={() => setShowAddProductModal(true)} 
                className="px-2.5 py-1 bg-aeirmist-cyan text-black font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} /> Sell
              </button>
              <button
                type="button"
                onClick={() => onUserClick?.(profile || user)}
                className="w-7 h-7 rounded-full border border-white/20 overflow-hidden bg-zinc-900 shrink-0 cursor-pointer hover:border-aeirmist-cyan transition-colors"
                title="Profile"
              >
                <img 
                  src={localAvatarURL || getAvatarUrl(profile?.photoURL || user?.photoURL)} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              </button>
            </div>
          </div>

          {/* Center: Large Search Bar */}
          <div className="flex-1 max-w-2xl mx-auto w-full">
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-zinc-900/90 focus-within:border-aeirmist-cyan/60 transition-colors shadow-inner overflow-hidden">
              <div className="pl-3 text-slate-400 dark:text-zinc-400 shrink-0">
                <Search size={15} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    setActiveTab('products');
                  }
                }}
                placeholder="Search products, stores, services..."
                className="w-full bg-transparent px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white mr-1 cursor-pointer"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
              <button
                onClick={() => {
                  if (searchQuery.trim()) setActiveTab('products');
                }}
                className="px-4 py-2 bg-aeirmist-cyan hover:bg-cyan-400 text-black font-bold text-xs transition-colors shrink-0 cursor-pointer"
              >
                Search
              </button>
            </div>
          </div>

          {/* Right: Controls & Actions */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {/* Location & Currency Group */}
            <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-white/10">
              {/* Location Area Selector */}
              <div className="relative">
                <button 
                  type="button"
                  aria-expanded={showLocationDropdown}
                  aria-haspopup="listbox"
                  aria-label={`Location: ${selectedLocation === 'All' ? 'Everywhere' : selectedLocation}`}
                  onClick={() => setShowLocationDropdown(!showLocationDropdown)} 
                  className="px-2 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-[10px] text-zinc-300 flex items-center gap-1 cursor-pointer transition-all"
                >
                  <MapPin size={11} className="text-aeirmist-cyan shrink-0" aria-hidden="true" />
                  <span className="truncate max-w-[80px] font-medium">{selectedLocation === 'All' ? 'Everywhere' : selectedLocation}</span>
                  <ChevronDown size={10} className={`text-zinc-500 transition-transform duration-200 ${showLocationDropdown ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                <AnimatePresence>
                  {showLocationDropdown && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      role="listbox"
                      className="absolute right-0 mt-1.5 w-44 bg-zinc-950 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 text-left"
                    >
                      {['All', 'Dhaka', 'Banani', 'Mirpur', 'Chittagong', 'Sylhet', 'Barishal', 'USA', 'Canada', 'UK', 'Germany', 'UAE', 'India', 'Japan'].map((locName) => (
                        <button
                          key={locName}
                          role="option"
                          aria-selected={selectedLocation === locName}
                          onClick={() => {
                            setSelectedLocation(locName);
                            setShowLocationDropdown(false);
                            addToast({ title: 'Location updated', message: `Delivery routing set to: ${locName}.`, type: 'info' });
                          }}
                          className="w-full py-1.5 px-3 text-left text-[10px] hover:bg-white/10 hover:text-white transition-all text-zinc-300 block cursor-pointer border-b last:border-0 border-white/5"
                        >
                          {locName === 'All' ? '🌐 All Locations' : `📍 ${locName}`}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Currency Selector */}
              <select
                aria-label="Select currency"
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value as any);
                  addToast({ title: 'Currency updated', message: `Prices converted to ${e.target.value}.`, type: 'success' });
                }}
                className="px-1.5 py-1 bg-zinc-950 hover:bg-zinc-800 rounded-lg text-[10px] text-zinc-300 cursor-pointer focus:outline-none h-[24px] font-mono border-0"
              >
                <option value="BDT" className="bg-zinc-950">৳ BDT</option>
                <option value="USD" className="bg-zinc-950">$ USD</option>
                <option value="EUR" className="bg-zinc-950">€ EUR</option>
                <option value="GBP" className="bg-zinc-950">£ GBP</option>
              </select>
            </div>

            {/* Quick Action Buttons Group */}
            <div className="flex items-center gap-1">
              {/* Cart Button */}
              <button 
                type="button"
                onClick={() => setShowCartDrawer(true)} 
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition relative cursor-pointer"
                aria-label={`Shopping cart with ${cart.length} items`}
                title="Cart"
              >
                <ShoppingBag size={14} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-aeirmist-cyan text-[7px] text-black font-black flex items-center justify-center">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                )}
              </button>

              {/* Saved Items */}
              <button 
                type="button"
                onClick={() => setShowBookmarksDrawer(true)} 
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition relative cursor-pointer"
                aria-label="Saved items"
                title="Saved items"
              >
                <Bookmark size={14} />
                {savedItems.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-aeirmist-cyan" />
                )}
              </button>

              {/* Notifications / Inbox */}
              <button 
                type="button"
                onClick={() => setShowBusinessInbox(true)} 
                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition relative cursor-pointer"
                aria-label="Inbox"
                title="Inbox"
              >
                <Inbox size={14} />
              </button>
            </div>

            {/* CTAs & Profile */}
            <div className="flex items-center gap-1.5 ml-0.5">
              {/* + Sell Action Button */}
              <button 
                type="button"
                onClick={() => setShowAddProductModal(true)} 
                className="px-3 py-1.5 bg-aeirmist-cyan hover:bg-cyan-400 text-black font-bold text-xs rounded-xl transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer shrink-0"
                aria-label="Post a new listing"
                title="Sell an item"
              >
                <Plus size={13} />
                <span>Sell</span>
              </button>

              {/* Seller Portal */}
              <button 
                type="button"
                onClick={() => setShowMerchantDesk(true)} 
                className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 rounded-xl transition cursor-pointer flex items-center gap-1 shrink-0"
                aria-label="Seller Portal"
                title="Seller Portal"
              >
                <Store size={12} />
                <span className="text-[10px] font-medium hidden xl:inline">Portal</span>
              </button>

              {/* User Profile Avatar Button */}
              <button
                type="button"
                onClick={() => onUserClick?.(profile || user)}
                className="p-0.5 rounded-full border border-white/20 hover:border-aeirmist-cyan transition-colors cursor-pointer shrink-0 ml-1 group relative"
                aria-label="View Profile"
                title={`Profile - ${profile?.displayName || user?.displayName || 'User'}`}
              >
                <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-900 relative">
                  <img 
                    src={localAvatarURL || getAvatarUrl(profile?.photoURL || user?.photoURL)} 
                    alt="Profile" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-aeirmist-lime border border-zinc-950" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ----------------- BOTTOM SHEET / INSTANT SEARCH OVERLAY ----------------- */}
      <AnimatePresence>
        {isSearchFocused && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="absolute inset-[0_0_0_0] bg-black/98 z-50 overflow-y-auto no-scrollbar p-5 pt-20"
          >
            {/* Overlay sticky search header */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-white/95 dark:bg-black/95 border-b border-slate-200 dark:border-white/[0.04] flex items-center gap-3 z-50">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, stores, services..."
                  className="w-full bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-aeirmist-cyan select-text"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
              <button 
                onClick={() => setIsSearchFocused(false)}
                className="text-slate-700 dark:text-white text-xs font-mono py-2 px-3 border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-zinc-900 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Back
              </button>
            </div>

            {/* If SEARCH QUERY IS EMPTY */}
            {!searchQuery.trim() ? (
              <div className="space-y-6 pt-2 select-none">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Recent Searches</p>
                      <button 
                        onClick={() => setRecentSearches([])}
                        className="text-[9px] hover:text-white text-zinc-600 transition font-mono"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recentSearches.map((term, i) => (
                        <div key={term + i} className="flex items-center gap-1.5 bg-white/[0.03] hover:bg-white/10 border border-white/5 rounded-full pl-3 pr-2.5 py-1 text-[11px] text-zinc-300">
                          <button 
                            onClick={() => {
                              setSearchQuery(term);
                            }}
                            className="text-left font-medium"
                          >
                            {term}
                          </button>
                          <button 
                            onClick={() => setRecentSearches(prev => prev.filter(t => t !== term))}
                            className="p-0.5 rounded-full hover:bg-white/10 text-zinc-500 hover:text-white"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending products */}
                <div className="space-y-2">
                  <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">⚡ TRENDING SEARCHES</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['iPhone 15 Pro', 'RTX 4095 GPU', 'Anime Figurine', 'Graphic Design Bundle', 'AC Service Maintenance', 'Mechanical Keyboard'].map((trend) => (
                      <button
                        key={trend}
                        onClick={() => setSearchQuery(trend)}
                        className="px-3.5 py-1.5 rounded-full bg-gradient-to-tr from-zinc-950 to-zinc-900 text-[10px] font-bold border border-white/[0.04] text-zinc-400 hover:text-white transition"
                      >
                        🔥 {trend}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Suggested stores */}
                <div className="space-y-3">
                  <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">🏪 POPULAR STORES</p>
                  <div className="flex items-center gap-3 overflow-x-auto py-1 scrollbar-none no-scrollbar">
                    {stores.slice(0, 4).map((est) => (
                      <button
                        key={est.id}
                        onClick={() => {
                          setSelectedStorePage(est);
                          setIsSearchFocused(false);
                        }}
                        className="flex flex-col items-center gap-1.5 shrink-0 w-16 group/card"
                      >
                        <div className="relative shrink-0">
                          <div className="h-12 w-12 md:h-[52px] md:w-[52px] rounded-2xl border border-white/10 p-[1px] bg-neutral-900 overflow-hidden transition-all duration-200 ease-in-out md:group-hover/card:scale-[1.03] md:group-hover/card:shadow-md active:scale-95">
                            <img src={getAvatarUrl(est.logo)} className="h-full w-full rounded-xl object-cover" alt="" />
                          </div>
                        </div>
                        <span className="text-[9px] text-zinc-400 font-mono truncate w-full text-center">@{est.username}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Suggested services */}
                <div className="space-y-2">
                  <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">🛠️ SUGGESTED SERVICES</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {services.slice(0, 2).map((srv) => (
                      <button
                        key={srv.id}
                        onClick={() => {
                          setActiveTab('services');
                          setSearchQuery(srv.title);
                          setIsSearchFocused(false);
                        }}
                        className="p-3 text-left bg-zinc-900/60 border border-white/5 rounded-2xl flex flex-col justify-between h-20"
                      >
                        <span className="text-[11px] font-bold text-white line-clamp-1">{srv.title}</span>
                        <span className="text-[10px] font-mono text-aeirmist-cyan">{srv.pricing}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* QUERY MATCHED RESULTS - GROUPED BY PRODUCTS, STORES, SERVICES */
              <div className="space-y-6 pt-2">
                {/* 1. PRODUCT INDEX */}
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-2 flex items-center gap-1">
                    <ShoppingBag size={10} /> Products Catalog
                  </p>
                  {filteredProducts.length === 0 ? (
                    <p className="text-[10px] text-zinc-600 pl-4">No matching products found.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredProducts.slice(0, 4).map((p) => (
                        <div 
                          key={p.id}
                          onClick={() => {
                            setSelectedProductDetail(p);
                            setIsSearchFocused(false);
                          }}
                          className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 flex items-center gap-3 cursor-pointer"
                        >
                          <img src={p.mediaItems?.[0]?.url || ''} className="h-10 w-10 object-cover rounded-lg bg-neutral-900" alt="" />
                          <div className="flex-1 text-xs text-left">
                            <p className="font-extrabold text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">৳{p.price.toLocaleString()} • {p.storeName}</p>
                          </div>
                          <ChevronRight size={12} className="text-zinc-600" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. STORES INDEX */}
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-2 flex items-center gap-1">
                    <Store size={10} /> Stores Node List
                  </p>
                  {stores.length === 0 ? (
                    <p className="text-[10px] text-zinc-600 pl-4">No stores.</p>
                  ) : (
                    <div className="space-y-2">
                      {stores.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.username.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3).map((st) => (
                        <div 
                          key={st.id}
                          onClick={() => {
                            setSelectedStorePage(st);
                            setIsSearchFocused(false);
                          }}
                          className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 flex items-center gap-3 cursor-pointer"
                        >
                          <img src={getAvatarUrl(st.logo)} className="h-12 w-12 md:h-[52px] md:w-[52px] rounded-2xl object-cover border border-white/5 shadow-md hover:scale-[1.03] transition-all duration-200 active:scale-95" alt="" />
                          <div className="flex-1 text-xs text-left">
                            <p className="font-extrabold text-white flex items-center gap-1">
                              {st.name}
                              {st.isVerified && <ShieldCheck size={10} className="text-aeirmist-cyan shrink-0" />}
                            </p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">@{st.username} • {st.category}</p>
                          </div>
                          <ChevronRight size={12} className="text-zinc-600" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. SERVICES INDEX */}
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-2 flex items-center gap-1">
                    <Briefcase size={10} /> Services Directory
                  </p>
                  {filteredServices.length === 0 ? (
                    <p className="text-[10px] text-zinc-600 pl-4">No services match.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredServices.slice(0, 3).map((srv) => (
                        <div 
                          key={srv.id}
                          onClick={() => {
                            setActiveTab('services');
                            setSearchQuery(srv.title);
                            setIsSearchFocused(false);
                          }}
                          className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 flex items-center justify-between cursor-pointer text-xs"
                        >
                          <div className="text-left flex-1">
                            <p className="font-bold text-white line-clamp-1">{srv.title}</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">{srv.pricing} • by {srv.ownerName}</p>
                          </div>
                          <ChevronRight size={12} className="text-zinc-600" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------- SELECTION DETAILED SUBVIEW OR MAIN ACTIVE TAB PANELS ----------------- */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24 scroll-smooth">
        <AnimatePresence mode="wait">
          {/* 1. STORE PROFILE NODE DETAILS VIEW */}
          {selectedStorePage ? (
            <motion.div
              key="store_profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4"
            >
              <MarketplaceStorePage 
                store={selectedStorePage} 
                onBack={() => setSelectedStorePage(null)}
                onProductClick={(p) => setSelectedProductDetail(p)}
                onMessageStoreClick={(stObj) => handleMessageStoreClick(stObj)}
                onManageShop={() => {
                  setSelectedStorePage(null);
                  setShowMerchantDesk(true);
                }}
              />
            </motion.div>
          ) : selectedProductDetail ? (
            /* 2. PRODUCT DETAILED MODAL SHEET SUBVIEW */
            <motion.div
              key="product_detail"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="p-5 space-y-6"
            >
              {/* Back strip */}
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setSelectedProductDetail(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-white/5 text-[11px] font-bold text-zinc-350 cursor-pointer flex items-center gap-1"
                >
                  ← Return Catalog
                </button>
                
                {/* Edit options if merchant is owner / store node matching */}
                <div className="flex items-center gap-1.5">
                  {stores.some(st => st.ownerId === profile?.id && st.id === selectedProductDetail.storeId) && (
                    <>
                      <button 
                        onClick={() => {
                          setEditProdData(selectedProductDetail);
                          setShowEditProductModal(true);
                        }}
                        className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-[10px] font-extrabold uppercase tracking-wide rounded-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                      >
                        Edit Specify
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(selectedProductDetail.id)}
                        className="p-2 bg-red-950 border border-red-900/50 hover:bg-red-900 text-red-400 rounded-xl cursor-pointer"
                        title="Delete product"
                      >
                        <X size={12} />
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => handleShareProduct(selectedProductDetail)}
                    className="p-2 rounded-xl bg-zinc-900 text-zinc-300"
                  >
                    <Share2 size={13} />
                  </button>
                </div>
              </div>

              {/* Photo swipe carousel */}
              <div className="space-y-3">
                <div className="aspect-square bg-neutral-900 rounded-2xl relative overflow-hidden border border-white/10 group select-none">
                  {selectedProductDetail.mediaItems && selectedProductDetail.mediaItems.length > 0 ? (
                    <div className="w-full h-full relative overflow-hidden">
                      <img 
                        src={selectedProductDetail.mediaItems[activeDetailPhotoIndex]?.url || ''} 
                        className={`w-full h-full object-cover transition-transform duration-300 ${isPhotoZoomed ? 'scale-175 cursor-zoom-out' : 'scale-100 cursor-zoom-in'}`} 
                        onClick={() => setIsPhotoZoomed(!isPhotoZoomed)}
                        alt="" 
                      />
                      <div className="absolute top-2 right-2 px-2.5 py-1 rounded bg-black/60 backdrop-blur-md text-[9px] font-mono tracking-widest text-zinc-300">
                        HD ZOOM
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-10">
                      <ShoppingBag size={80} />
                    </div>
                  )}

                  {/* Carousel horizontal preview dots */}
                  {selectedProductDetail.mediaItems && selectedProductDetail.mediaItems.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">
                      {selectedProductDetail.mediaItems.map((_, dotIdx) => (
                        <div 
                          key={dotIdx}
                          className={`h-1.5 rounded-full transition-all duration-300 ${activeDetailPhotoIndex === dotIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Smaller Thumbnail buttons strip */}
                {selectedProductDetail.mediaItems && selectedProductDetail.mediaItems.length > 1 && (
                  <div className="flex gap-1.5 select-none scrollbar-none no-scrollbar overflow-x-auto">
                    {selectedProductDetail.mediaItems.map((media, mIdx) => (
                      <button
                        key={media.id}
                        onClick={() => {
                          setActiveDetailPhotoIndex(mIdx);
                          setIsPhotoZoomed(false);
                        }}
                        className={`w-16 h-12 rounded-lg bg-neutral-900 overflow-hidden shrink-0 border transition-all ${
                          activeDetailPhotoIndex === mIdx ? 'border-indigo-400 scale-95' : 'border-transparent opacity-60'
                        }`}
                      >
                        <img src={media.url} className="w-full h-full object-cover" alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Specifications texts block */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-mono tracking-widest bg-zinc-900 border border-white/5 text-zinc-300 px-2.5 py-1 rounded">
                    {selectedProductDetail.category}
                  </span>
                  
                  {/* Stock Availability badge */}
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    selectedProductDetail.stockStatus === 'available' 
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}>
                    {selectedProductDetail.stockStatus === 'available' ? 'Available' : 'Out of Stock'}
                  </span>
                </div>

                <div className="space-y-1 select-text">
                  <h2 className="text-xl font-black text-white">{selectedProductDetail.name}</h2>
                  <div className="flex items-baseline gap-2">
                    {selectedProductDetail.discountPrice ? (
                      <>
                        <span className="text-lg font-black text-white">৳{selectedProductDetail.discountPrice.toLocaleString()}</span>
                        <span className="text-xs text-zinc-500 line-through">৳{selectedProductDetail.price.toLocaleString()}</span>
                      </>
                    ) : (
                      <span className="text-lg font-black text-white">৳{selectedProductDetail.price.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <hr className="border-white/[0.04]" />

                {/* Store merchant profile display info */}
                <div 
                  onClick={() => {
                    const stMatch = stores.find(s => s.id === selectedProductDetail.storeId);
                    if (stMatch) {
                      setSelectedStorePage(stMatch);
                      setSelectedProductDetail(null);
                    }
                  }}
                  className="flex items-center justify-between p-3.5 bg-zinc-950 border border-white/[0.05] rounded-2xl cursor-pointer hover:border-white/10 transition-all select-none"
                >
                  <div className="flex items-center gap-3">
                    <img src={getAvatarUrl(selectedProductDetail.storeLogo)} className="h-10 w-10 rounded-xl object-cover bg-neutral-900" alt="" />
                    <div className="text-left text-xs">
                      <p className="font-extrabold text-white flex items-center gap-1">
                        {selectedProductDetail.storeName}
                        {selectedProductDetail.isVerified && <ShieldCheck size={12} className="text-aeirmist-cyan shrink-0" />}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-aeirmist-cyan font-mono hover:underline">View Node →</span>
                </div>

                {/* Secondary tabs - Specs, Reviews, Q&A */}
                <div className="flex gap-2 border-b border-white/[0.04] pb-2 text-[10px] font-mono">
                  {['specs', 'reviews', 'qna'].map((tabName) => {
                    const revCount = (productReviews[selectedProductDetail.id] || []).length + 3; // base 3 reviews
                    return (
                      <button
                        key={tabName}
                        onClick={() => setSelectedDetailSecTab(tabName as any)}
                        className={`px-3 py-1 rounded-lg border uppercase font-black transition cursor-pointer ${
                          selectedDetailSecTab === tabName
                            ? 'bg-white/10 text-white border-white/10'
                            : 'text-zinc-500 border-transparent hover:text-white'
                        }`}
                      >
                        {tabName === 'specs' ? '📋 Specs' : tabName === 'reviews' ? `⭐ Reviews (${revCount})` : '❓ Q&As'}
                      </button>
                    );
                  })}
                </div>

                {/* TAB CONTAINER BODY */}
                {selectedDetailSecTab === 'specs' && (
                  <div className="space-y-4">
                    {/* Description details */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono tracking-widest text-zinc-500">LISTING DETAILS</p>
                      <p className="text-xs text-zinc-350 select-text leading-relaxed font-semibold">{selectedProductDetail.description}</p>
                    </div>

                    {/* Variants available */}
                    {selectedProductDetail.variants && selectedProductDetail.variants.length > 0 && (
                      <div className="space-y-1.5 select-none text-left">
                        <p className="text-[10px] uppercase font-mono text-zinc-500">SELECT SPEC / COLOR</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProductDetail.variants.map((v) => (
                            <button 
                              key={v} 
                              onClick={() => setSelectedProductVariant(v)}
                              className={`px-3 py-1.5 rounded-xl border font-bold text-[10px] uppercase transition cursor-pointer ${
                                selectedProductVariant === v 
                                  ? 'bg-aeirmist-cyan text-black border-aeirmist-cyan shadow-[0_0_10px_#06b6d4]' 
                                  : 'bg-zinc-900 text-zinc-300 border-white/5 hover:border-white/10'
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags mapping */}
                    {selectedProductDetail.tags && selectedProductDetail.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center font-mono text-[9px] text-zinc-500 select-none">
                        {selectedProductDetail.tags.map((t) => (
                          <span key={t}>#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedDetailSecTab === 'reviews' && (
                  <div className="space-y-4 text-left">
                    <p className="text-[10px] uppercase font-mono text-zinc-500">VERIFIED CUSTOMER REVIEWS</p>
                    
                    {/* Write a review form */}
                    <form onSubmit={(e) => handleAddReviewSubmit(e, selectedProductDetail.id)} className="p-3 bg-zinc-900/60 rounded-2xl border border-white/5 space-y-2.5">
                      <p className="text-[9px] font-mono text-zinc-400">LEAVE A VERIFIED END-USER LOG</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-500">Rating:</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              type="button"
                              key={star}
                              onClick={() => setNewReviewRating(star)}
                              className="text-amber-400 focus:outline-none cursor-pointer"
                            >
                              <Star size={12} fill={star <= newReviewRating ? "currentColor" : "none"} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Your verified hardware usage details..."
                          value={newReviewText}
                          onChange={(e) => setNewReviewText(e.target.value)}
                          className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/15 font-mono"
                          required
                        />
                        <button
                          type="submit"
                          className="px-4 bg-white hover:bg-neutral-200 text-black font-black text-[10px] uppercase font-mono rounded-xl cursor-pointer"
                        >
                          Log
                        </button>
                      </div>
                    </form>

                    {/* Review logs list */}
                    <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
                      {/* User contributed reviews */}
                      {(productReviews[selectedProductDetail.id] || []).map((rev) => (
                        <div key={rev.id} className="p-3 bg-zinc-950 border border-white/5 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                              <span>{rev.author}</span>
                              {rev.verified && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={12} />}
                            </div>
                            <div className="flex gap-0.5 text-amber-400">
                              {Array.from({ length: rev.rating }).map((_, i) => (
                                <Star key={i} size={8} fill="currentColor" />
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-zinc-300 select-text leading-relaxed">{rev.comment}</p>
                          {rev.reply && (
                            <div className="p-2.5 bg-zinc-900/60 border-l-2 border-aeirmist-cyan rounded-r-xl space-y-1">
                              <p className="text-[9px] font-mono font-black text-aeirmist-cyan">REPLY FROM MERCHANT OWNER</p>
                              <p className="text-[10px] text-zinc-400 select-text italic leading-snug">"{rev.reply}"</p>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Seeded default reviews to look super professional */}
                      {[
                        { author: 'Farhan A.', rating: 5, comment: 'Phenomenal device. Speed, thermal profile, and overall modern aesthetic match perfectly. Extremely fast delivery node dispatch.', date: '2 days ago', reply: 'Thank you! We work hard to optimize our dispatch coordinates.', verified: true },
                        { author: 'Sadia J.', rating: 5, comment: 'Exceptional build craftsmanship! Highly recommend this merchant.', date: '1 week ago', reply: 'Glad you loved the packaging nodes!', verified: true },
                        { author: 'Imran H.', rating: 4, comment: 'Pristine setup. Fits our office grid nicely.', date: '2 weeks ago', reply: null, verified: false }
                      ].map((rev, rIdx) => (
                        <div key={rIdx} className="p-3 bg-zinc-950/60 border border-white/5 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                              <span>{rev.author}</span>
                              {rev.verified && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={12} />}
                            </div>
                            <div className="flex gap-0.5 text-amber-400 opacity-80">
                              {Array.from({ length: rev.rating }).map((_, i) => (
                                <Star key={i} size={8} fill="currentColor" />
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-zinc-400 select-text leading-relaxed">{rev.comment}</p>
                          {rev.reply && (
                            <div className="p-2.5 bg-zinc-900/40 border-l-2 border-aeirmist-cyan/40 rounded-r-xl space-y-1">
                              <p className="text-[9px] font-mono font-black text-zinc-550">REPLY FROM MERCHANT OWNER</p>
                              <p className="text-[10px] text-zinc-500 select-text italic leading-snug">"{rev.reply}"</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDetailSecTab === 'qna' && (
                  <div className="space-y-4 text-left">
                    <p className="text-[10px] uppercase font-mono text-zinc-500">PRODUCT Q&As</p>

                    {/* Ask a question form */}
                    <form onSubmit={handleAskQuestion} className="p-3 bg-zinc-900/60 rounded-2xl border border-white/5 space-y-2">
                      <p className="text-[9px] font-mono text-zinc-400">ASK A LOGISTICS OR SPECIFICATION QUESTION</p>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Warranty duration? Delivery to Khulna?..."
                          value={newQuestionText}
                          onChange={(e) => setNewQuestionText(e.target.value)}
                          className="flex-1 bg-zinc-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/15 font-mono"
                          required
                        />
                        <button
                          type="submit"
                          className="px-4 bg-white hover:bg-neutral-200 text-black font-black text-[10px] uppercase font-mono rounded-xl cursor-pointer"
                        >
                          Ask
                        </button>
                      </div>
                    </form>

                    {/* Q&As list */}
                    <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
                      {qaList.map((qa, qaIdx) => (
                        <div key={qaIdx} className="p-3 bg-zinc-950 border border-white/5 rounded-2xl space-y-2">
                          <div className="text-xs space-y-1">
                            <p className="font-extrabold text-white">Q: {qa.q}</p>
                            <p className="text-[9px] font-mono text-zinc-550">asked by {qa.user} • {qa.date}</p>
                          </div>
                          <div className="p-2.5 bg-zinc-900/60 border-l border-aeirmist-cyan rounded-r-xl space-y-1">
                            <p className="text-[9px] font-mono font-black text-aeirmist-cyan">A: OWNER RESPONSE</p>
                            <p className="text-xs text-zinc-300 select-text leading-relaxed">{qa.a}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky bottom messaging / actions CTA */}
              <div className="space-y-3 pt-3 border-t border-white/[0.04]">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddToCart(selectedProductDetail, selectedProductVariant || 'Default')}
                    className="flex-1 cursor-pointer h-12 rounded-2xl bg-aeirmist-cyan hover:bg-cyan-400 text-black font-black text-xs uppercase flex items-center justify-center gap-1.5 transition-all active:scale-98 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                  >
                    <ShoppingBag size={14} /> Add {formatPrice(selectedProductDetail.discountPrice || selectedProductDetail.price)} to Cart
                  </button>
                  
                  {/* Bookmark listing with drop down to select custom Wishlist folders */}
                  <div className="relative">
                    <button
                      onClick={() => setShowWishlistCollections(!showWishlistCollections)}
                      className={`px-4 h-12 rounded-2xl border transition-all flex items-center justify-center cursor-pointer ${
                        savedItems.includes(selectedProductDetail.id) 
                          ? 'border-aeirmist-magenta bg-aeirmist-magenta/10 text-aeirmist-magenta' 
                          : 'border-white/5 bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                      title="Save to Custom Wishlist Collection Folder"
                    >
                      <Bookmark size={15} fill={savedItems.includes(selectedProductDetail.id) ? "currentColor" : "none"} />
                    </button>
                    
                    <AnimatePresence>
                      {showWishlistCollections && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute right-0 bottom-14 w-52 bg-zinc-950 border border-white/10 rounded-2xl p-3 shadow-2xl z-[150] text-left space-y-3"
                        >
                          <p className="text-[9px] font-mono font-black text-zinc-500 uppercase">Save to Collection Folder</p>
                          <div className="space-y-1 max-h-32 overflow-y-auto no-scrollbar">
                            {Object.keys(wishlistCollections).map((folderName) => {
                              const contains = wishlistCollections[folderName].includes(selectedProductDetail.id);
                              return (
                                <button
                                  key={folderName}
                                  onClick={() => {
                                    setWishlistCollections(prev => {
                                      const currentFolder = prev[folderName] || [];
                                      const updated = currentFolder.includes(selectedProductDetail.id)
                                        ? currentFolder.filter(id => id !== selectedProductDetail.id)
                                        : [...currentFolder, selectedProductDetail.id];
                                      
                                      // Toggle in savedItems too for global fallback
                                      if (updated.includes(selectedProductDetail.id)) {
                                        if (!savedItems.includes(selectedProductDetail.id)) {
                                          setSavedItems(s => [...s, selectedProductDetail.id]);
                                        }
                                      }
                                      
                                      addToast({ 
                                        title: 'COLLECTION SAVED', 
                                        message: contains ? `Removed from ${folderName}` : `Saved to ${folderName} collection.`, 
                                        type: 'success' 
                                      });
                                      return { ...prev, [folderName]: updated };
                                    });
                                  }}
                                  className="w-full text-left text-[10px] font-mono py-1.5 px-2 rounded-lg hover:bg-white/5 flex items-center justify-between text-zinc-350 cursor-pointer"
                                >
                                  <span>📁 {folderName}</span>
                                  {contains && <ShieldCheck size={10} className="text-aeirmist-cyan" />}
                                </button>
                              );
                            })}
                          </div>
                          <div className="border-t border-white/[0.04] pt-2 flex gap-1">
                            <input
                              type="text"
                              placeholder="New Folder..."
                              value={newCollectionFolderName}
                              onChange={(e) => setNewCollectionFolderName(e.target.value)}
                              className="w-full bg-zinc-900 border border-white/5 rounded-lg px-2 py-1 text-[9px] text-white focus:outline-none focus:border-white/15 font-mono"
                            />
                            <button
                              onClick={() => {
                                if (newCollectionFolderName.trim()) {
                                  const name = newCollectionFolderName.trim();
                                  setWishlistCollections(prev => {
                                    if (prev[name]) return prev;
                                    return { ...prev, [name]: [selectedProductDetail.id] };
                                  });
                                  setSavedItems(s => [...s, selectedProductDetail.id]);
                                  setNewCollectionFolderName('');
                                  addToast({ title: 'FOLDER CREATED', message: `Created "${name}" wishlist collection.`, type: 'success' });
                                }
                              }}
                              className="px-2 bg-white text-black text-[9px] font-mono font-black rounded-lg hover:bg-neutral-200 cursor-pointer"
                            >
                              Add
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Personal messaging shortcut */}
                <button
                  onClick={() => {
                    const stMatch = stores.find(s => s.id === selectedProductDetail.storeId);
                    if (stMatch) handleMessageStoreClick(stMatch, selectedProductDetail);
                  }}
                  className="w-full cursor-pointer h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-300 hover:text-white font-mono text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all"
                >
                  <MessageSquare size={12} /> Live Message Vendor Regarding Specs
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="w-full space-y-4 max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
              {/* Compact Announcement Banner */}
              <div className="px-4 py-2.5 rounded-xl bg-zinc-900/90 border border-white/10 flex items-center justify-between gap-3 text-xs text-zinc-300 shadow-sm select-none">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShieldCheck size={16} className="text-aeirmist-cyan shrink-0" />
                  <span className="truncate font-medium">Verified Shops are now available on Aeirmist Marketplace</span>
                </div>
                <button 
                  onClick={() => setShowMerchantDesk(true)}
                  className="text-xs font-bold text-aeirmist-cyan hover:text-cyan-300 flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                >
                  <span>Explore</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              <div className="w-full lg:flex lg:gap-6 items-start">
                {/* Desktop Left Sidebar: Category & Filter Navigation */}
                <aside className="hidden lg:block w-64 shrink-0 space-y-4 sticky top-20 select-none">
                  {/* Categories Navigation Card */}
                  <div className="p-3.5 bg-zinc-900/90 border border-white/10 rounded-xl space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                        <Layers size={13} className="text-aeirmist-cyan" />
                        Categories
                      </h3>
                      {selectedCategory && (
                        <button 
                          onClick={() => setSelectedCategory(null)}
                          className="text-[10px] font-mono text-aeirmist-cyan hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="max-h-[calc(100vh-240px)] overflow-y-auto no-scrollbar space-y-0.5">
                      <button
                        onClick={() => {
                          setSelectedCategory(null);
                          setActiveTab('products');
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer ${
                          !selectedCategory 
                            ? 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 font-semibold' 
                            : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <ShoppingBag size={13} className="text-zinc-400" />
                          All Products & Ads
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">{products.length}</span>
                      </button>

                      {MARKETPLACE_CATEGORIES.map((cat) => {
                        const IconComp = categoryIconsMap[cat.icon] || <Tag size={13} />;
                        const isSel = selectedCategory === cat.id;
                        const count = products.filter(p => p.category === cat.id).length || 2807;

                        return (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setSelectedCategory(cat.id);
                              setActiveTab('products');
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer group ${
                              isSel 
                                ? 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 font-semibold' 
                                : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className="text-zinc-400 group-hover:text-aeirmist-cyan transition-colors">{IconComp}</span>
                              <span className="truncate">{cat.label}</span>
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[9.5px] font-mono text-zinc-500">{count.toLocaleString()} ads</span>
                              <ChevronRight size={11} className="text-zinc-600 group-hover:text-white transition-colors" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Location & Quick Filters */}
                  <div className="p-3.5 bg-zinc-900/90 border border-white/10 rounded-xl space-y-2.5 text-xs shadow-md">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2 border-b border-white/10 pb-2">
                      <Filter size={13} className="text-aeirmist-cyan" />
                      Filter Ads
                    </h3>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 uppercase font-mono">Location</label>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-aeirmist-cyan cursor-pointer"
                      >
                        {['All', 'Dhaka', 'Banani', 'Mirpur', 'Chittagong', 'Sylhet', 'Barishal', 'USA', 'Canada', 'UK', 'Germany', 'UAE', 'India', 'Japan'].map(loc => (
                          <option key={loc} value={loc} className="bg-zinc-950">
                            {loc === 'All' ? '🌐 All Locations' : `📍 ${loc}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>Max Price:</span>
                        <span className="text-aeirmist-cyan font-bold font-mono">{formatPrice(priceFilter)}</span>
                      </div>
                      <input 
                        type="range"
                        min={1000}
                        max={300000}
                        step={5000}
                        value={priceFilter}
                        onChange={(e) => setPriceFilter(Number(e.target.value))}
                        className="w-full accent-aeirmist-cyan cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                      />
                    </div>

                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] text-zinc-400 uppercase font-mono">Sort Order</label>
                      <select
                        value={activeSort}
                        onChange={(e) => setActiveSort(e.target.value as any)}
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-aeirmist-cyan cursor-pointer"
                      >
                        <option value="newest" className="bg-zinc-950">Newest First</option>
                        <option value="price_low" className="bg-zinc-950">Price: Low to High</option>
                        <option value="price_high" className="bg-zinc-950">Price: High to Low</option>
                        <option value="oldest" className="bg-zinc-950">Oldest First</option>
                      </select>
                    </div>

                    {(selectedCategory || selectedLocation !== 'All' || priceFilter < 300000 || searchQuery) && (
                      <button
                        onClick={() => {
                          setSelectedCategory(null);
                          setSelectedLocation('All');
                          setPriceFilter(300000);
                          setSearchQuery('');
                        }}
                        className="w-full mt-1.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[10px] uppercase font-bold transition-all cursor-pointer border border-white/10"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </aside>

                {/* Main Column */}
                <div className="flex-1 min-w-0 w-full space-y-6">
                  {/* ----------------- TAB: FOR YOU (MIXED HOME FEED) ----------------- */}
                  {activeTab === 'foryou' && (
                    <motion.div 
                      key="foryou_panel"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      {/* RECOMMENDED FOR YOU CATEGORIES ROW */}
                      <div className="space-y-3 select-none">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                          Recommended for you
                        </h3>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                          {[
                            { title: 'Mobile Phones', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&auto=format&fit=crop&q=80', cat: 'electronics', icon: <Smartphone size={16} /> },
                            { title: 'Motorcycles & Scooters', image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=300&auto=format&fit=crop&q=80', cat: 'vehicles', icon: <Truck size={16} /> },
                            { title: 'Housekeeping & Cleaning', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&auto=format&fit=crop&q=80', cat: 'services', icon: <Briefcase size={16} /> },
                            { title: 'Accessories & Supplies', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=300&auto=format&fit=crop&q=80', cat: 'electronics', icon: <Laptop size={16} /> },
                            { title: 'Shoes & Footwear', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&auto=format&fit=crop&q=80', cat: 'fashion', icon: <ShoppingBag size={16} /> },
                            { title: 'Photo & Video', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=300&auto=format&fit=crop&q=80', cat: 'electronics', icon: <Camera size={16} /> },
                          ].map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setSelectedCategory(item.cat);
                                setActiveTab('products');
                              }}
                              className="p-2.5 rounded-xl bg-zinc-900/90 border border-white/10 hover:border-aeirmist-cyan/40 transition-all duration-200 cursor-pointer flex flex-col items-center text-center group shadow-sm"
                            >
                              <div className="w-full aspect-square rounded-lg overflow-hidden bg-zinc-950 mb-2 relative flex items-center justify-center">
                                <img 
                                  src={item.image} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                  alt={item.title}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center text-zinc-600 pointer-events-none -z-0">
                                  {item.icon}
                                </div>
                              </div>
                              <p className="text-[11px] font-semibold text-zinc-200 group-hover:text-aeirmist-cyan transition-colors leading-tight line-clamp-2">
                                {item.title}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* TRENDING ADS SECTION */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                            Trending ads
                          </h3>
                          <button 
                            onClick={() => setActiveTab('products')}
                            className="text-[11px] text-aeirmist-cyan hover:underline font-mono cursor-pointer"
                          >
                            View all ({products.length}) →
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {products.map((prod) => (
                            <div
                              key={prod.id}
                              onClick={() => setSelectedProductDetail(prod)}
                              className="bg-zinc-900/90 border border-white/10 hover:border-aeirmist-cyan/40 rounded-xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-sm"
                            >
                              <div>
                                {/* Product Image & Badges */}
                                <div className="w-full aspect-[4/3] relative bg-zinc-950 overflow-hidden">
                                  <img 
                                    src={prod.mediaItems[0]?.url || 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80'} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                    alt={prod.name} 
                                    onError={(e) => {
                                      e.currentTarget.src = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80';
                                    }}
                                  />
                                  {prod.isVerified && (
                                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-1 shadow-sm">
                                      <ShieldCheck className="text-aeirmist-cyan shrink-0" size={11} />
                                      <span className="text-[9px] text-zinc-200 font-mono">Verified</span>
                                    </div>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleSaveItem(prod.id, 'product');
                                    }}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
                                    title="Bookmark item"
                                  >
                                    <Bookmark size={12} fill={savedItems.includes(prod.id) ? "currentColor" : "none"} />
                                  </button>
                                </div>

                                {/* Product Content */}
                                <div className="p-3 space-y-1.5 text-left">
                                  <h4 className="font-semibold text-xs text-white group-hover:text-aeirmist-cyan transition-colors line-clamp-2 leading-snug">
                                    {prod.name}
                                  </h4>
                                  <p className="text-[11px] text-zinc-400 truncate">
                                    📍 {prod.tags?.[0] || 'Dhaka'} · 2h ago
                                  </p>
                                  <p className="text-sm font-bold text-aeirmist-cyan pt-0.5">
                                    {formatPrice(prod.price)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                  {/* FEATURED STORES & POPULAR SERVICES SECTION */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        Featured Verified Stores
                      </h3>
                      <button 
                        onClick={() => setActiveTab('stores')}
                        className="text-[11px] text-aeirmist-cyan hover:underline font-mono cursor-pointer"
                      >
                        View all ({stores.length}) →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {stores.slice(0, 3).map((st) => (
                        <div
                          key={st.id}
                          onClick={() => setSelectedStorePage(st)}
                          className="bg-zinc-900/90 border border-white/10 hover:border-aeirmist-cyan/40 rounded-xl overflow-hidden p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-sm text-left"
                        >
                          <div className="flex items-start gap-3">
                            <img 
                              src={getAvatarUrl(st.logo)} 
                              className="h-12 w-12 rounded-xl object-cover bg-zinc-950 border border-white/10 shrink-0" 
                              alt={st.name} 
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-sm text-white group-hover:text-aeirmist-cyan transition-colors flex items-center gap-1.5 truncate">
                                {st.name}
                                <ShieldCheck className="text-aeirmist-cyan shrink-0" size={13} />
                              </h4>
                              <p className="text-[11px] text-zinc-400 font-mono truncate">@{st.username}</p>
                              <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                                {st.description}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                            <span>📍 {st.location || 'Dhaka'}</span>
                            <span className="text-aeirmist-cyan font-bold">Visit Store →</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* DYNAMIC MIXED FEED ITEMS / SHOP UPDATES */}
                  {mixedFeedItems.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">SHOP UPDATES</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {mixedFeedItems.map((feedItem) => {
                          const isLiked = likedPosts.includes(feedItem.id);
                          const isSaved = savedItems.includes(feedItem.id);
                          const isCommentExpanded = expandedCommentsPostId === feedItem.id;
                          const commentsList = feedPostComments[feedItem.id] || [];

                          return (
                            <div 
                              key={feedItem.id}
                              className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 space-y-4 shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <div 
                                  onClick={() => {
                                    const stMatch = stores.find(s => s.id === feedItem.storeId);
                                    if (stMatch) setSelectedStorePage(stMatch);
                                  }}
                                  className="flex items-center gap-3 cursor-pointer"
                                >
                                  <img src={getAvatarUrl(feedItem.storeLogo)} className="h-9 w-9 rounded-xl object-cover bg-neutral-900 border border-white/[0.04]" alt="" />
                                  <div className="text-left text-xs">
                                    <p className="font-extrabold text-white flex items-center gap-1">
                                      {feedItem.storeName}
                                      {feedItem.isVerified && <ShieldCheck size={11} className="text-aeirmist-cyan shrink-0" />}
                                    </p>
                                    <p className="text-[9px] uppercase font-mono text-zinc-500">Merchant Broker</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleToggleSaveItem(feedItem.id, feedItem.type as any)}
                                  className={`p-2 rounded-lg hover:bg-zinc-900 transition ${isSaved ? 'text-indigo-400' : 'text-zinc-500'}`}
                                >
                                  <Bookmark size={14} fill={isSaved ? "currentColor" : "none"} />
                                </button>
                              </div>

                              <div className="space-y-1.5 text-xs text-left">
                                <div className="flex items-baseline justify-between">
                                  <h4 
                                    onClick={() => {
                                      if (feedItem.type === 'product') setSelectedProductDetail(feedItem.rawData as Product);
                                    }}
                                    className="font-black text-white hover:text-indigo-300 transition-all cursor-pointer"
                                  >
                                    {feedItem.title}
                                  </h4>
                                  {feedItem.type === 'product' && (
                                    <span className="text-[10px] font-mono font-black text-indigo-300 bg-indigo-500/10 border border-indigo-500/15 py-0.5 px-2 rounded">
                                      ৳{feedItem.price.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                <p className="text-zinc-350 select-text leading-relaxed font-semibold">{feedItem.description}</p>
                              </div>

                              {feedItem.mediaUrl && (
                                <div className="rounded-2xl overflow-hidden border border-white/5 bg-neutral-900 aspect-[16/10] relative">
                                  <img src={feedItem.mediaUrl} className="w-full h-full object-cover" alt="" />
                                </div>
                              )}

                              {/* Actions footer */}
                              <div className="border-t border-white/[0.03] pt-3 flex items-center justify-between text-[11px] text-zinc-450 select-none">
                                <div className="flex gap-4">
                                  <button 
                                    onClick={() => handleToggleLikePost(feedItem.id)}
                                    className={`flex items-center gap-1.5 hover:text-white transition cursor-pointer ${isLiked ? 'text-red-400 font-extrabold' : ''}`}
                                  >
                                    <ThumbsUp size={12} fill={isLiked ? "currentColor" : "none"} />
                                    <span>Like</span>
                                  </button>
                                  <button 
                                    onClick={() => handleToggleComments(feedItem.id)}
                                    className="flex items-center gap-1.5 hover:text-white transition cursor-pointer"
                                  >
                                    <MessageSquare size={12} />
                                    <span>Comments ({commentsList.length})</span>
                                  </button>
                                </div>
                                <button 
                                  onClick={() => {
                                    const stMatch = stores.find(s => s.id === feedItem.storeId);
                                    if (stMatch) handleMessageStoreClick(stMatch, feedItem.type === 'product' ? feedItem.rawData as Product : undefined);
                                  }}
                                  className="text-white hover:underline text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer"
                                >
                                  Inquire Node →
                                </button>
                              </div>

                              {/* Expand comments list */}
                              <AnimatePresence>
                                {isCommentExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden space-y-3 pt-3 border-t border-white/[0.03]"
                                  >
                                    <div className="max-h-48 overflow-y-auto space-y-2.5 pr-2">
                                      {commentsList.length === 0 ? (
                                        <p className="text-[10px] text-zinc-650 font-mono italic">Loading comments...</p>
                                      ) : (
                                        commentsList.map((c: any) => (
                                          <div key={c.id} className="flex gap-2.5 text-[11px] items-start text-left">
                                            <img src={getAvatarUrl(c.userAvatar)} className="h-6 w-6 rounded-lg object-cover mt-0.5 bg-neutral-900" alt="" />
                                            <div className="bg-zinc-900 border border-white/5 rounded-xl p-2 flex-1">
                                              <span className="font-bold text-white block">{c.userName}</span>
                                              <p className="text-zinc-350 select-text font-medium mt-0.5">{c.comment}</p>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                    <div className="flex gap-1.5 mt-2">
                                      <input
                                        type="text"
                                        placeholder="Add comment..."
                                        value={newCommentTextMap[feedItem.id] || ''}
                                        onChange={(e) => setNewCommentTextMap(prev => ({ ...prev, [feedItem.id]: e.target.value }))}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment(feedItem.id)}
                                        className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-white text-white select-text h-8 leading-tight"
                                      />
                                      <button 
                                        onClick={() => handleSubmitComment(feedItem.id)}
                                        className="px-3 h-8 rounded-xl bg-white text-black font-extrabold uppercase text-[9px]"
                                      >
                                        Post
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ----------------- TAB: PRODUCTS CATALOG ----------------- */}
              {activeTab === 'products' && (
                <motion.div 
                  key="products_panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 p-4"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-550 select-none">
                    <span>{filteredProducts.length} ITEMS MATCHED CRITERIA</span>
                    {/* Grid vs List View toggle */}
                    <div className="flex items-center gap-1 border border-white/[0.04] bg-zinc-950 p-1 rounded-xl">
                      <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-lg border cursor-pointer transition ${viewMode === 'grid' ? 'bg-zinc-900 text-white border-white/5' : 'border-transparent text-zinc-550'}`}
                      >
                        <Grid size={11} />
                      </button>
                      <button 
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-lg border cursor-pointer transition ${viewMode === 'list' ? 'bg-zinc-900 text-white border-white/5' : 'border-transparent text-zinc-550'}`}
                      >
                        <List size={11} />
                      </button>
                    </div>
                  </div>

                  {filteredProducts.length === 0 ? (
                    isLoading ? (
                      <ProductGridSkeleton />
                    ) : (
                      <EmptyState 
                        icon={<Search size={28} />}
                        title="No Products Found"
                        description="No products matched your search query or filter criteria."
                        actionLabel={searchQuery || selectedCategory ? "Clear Filters" : undefined}
                        onAction={() => {
                          setSearchQuery('');
                          setSelectedCategory(null);
                          setPriceFilter(500000);
                        }}
                      />
                    )
                  ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {filteredProducts.map((p) => {
                        const isSaved = savedItems.includes(p.id);
                        return (
                          <div 
                            key={p.id}
                            className="bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden flex flex-col justify-between flex-1 group shadow md:hover:border-white/15 transition-all p-px"
                          >
                            <div 
                              onClick={() => setSelectedProductDetail(p)}
                              className="aspect-square bg-neutral-900 overflow-hidden relative rounded-xl"
                            >
                              <img src={p.mediaItems?.[0]?.url || ''} className="w-full h-full object-cover transition duration-300 md:group-hover:scale-105" alt="" />
                              {p.discountPrice && (
                                <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-black font-black uppercase text-[8px] rounded-full">
                                  Sale
                                </div>
                              )}
                              {p.stockStatus === 'out_of_stock' && (
                                <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center text-[8px] font-bold text-orange-400 tracking-widest leading-none select-none">
                                  SOLD OUT
                                </div>
                              )}
                            </div>
                            <div className="p-3 text-left space-y-2">
                              <div>
                                <h4 
                                  onClick={() => setSelectedProductDetail(p)}
                                  className="text-[11px] font-bold text-white hover:text-indigo-400 truncate cursor-pointer leading-tight"
                                >
                                  {p.name}
                                </h4>
                                <span className="text-[9px] text-zinc-550 font-mono tracking-wide mt-0.5 block truncate">by {p.storeName}</span>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-white/[0.03]">
                                <span className="text-[11px] font-bold text-white">{formatPrice(p.discountPrice || p.price)}</span>
                                <button 
                                  onClick={() => handleToggleSaveItem(p.id, 'product')}
                                  className={`p-1 hover:bg-zinc-900 rounded-lg transition-all ${isSaved ? 'text-indigo-400' : 'text-zinc-650'}`}
                                >
                                  <Bookmark size={12} fill={isSaved ? "currentColor" : "none"} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* PRODUCTS LIST VIEW MODE */
                    <div className="space-y-2.5">
                      {filteredProducts.map((p) => {
                        const isSaved = savedItems.includes(p.id);
                        return (
                          <div 
                            key={p.id}
                            className="bg-zinc-950 border border-white/5 rounded-2xl p-3 flex items-center gap-3 shadow group text-left"
                          >
                            <img 
                              onClick={() => setSelectedProductDetail(p)}
                              src={p.mediaItems?.[0]?.url || ''} 
                              className="h-14 w-14 object-cover rounded-xl bg-neutral-900 border border-white/5 cursor-pointer shrink-0" 
                              alt="" 
                            />
                            <div className="flex-1 min-w-0">
                              <h4 
                                onClick={() => setSelectedProductDetail(p)}
                                className="text-xs font-bold text-white hover:text-indigo-400 truncate cursor-pointer leading-tight"
                              >
                                {p.name}
                              </h4>
                              <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{formatPrice(p.discountPrice || p.price)} • {p.storeName}</p>
                            </div>
                            <button 
                              onClick={() => handleToggleSaveItem(p.id, 'product')}
                              className={`p-2 rounded-xl bg-zinc-900 ${isSaved ? 'text-indigo-400' : 'text-zinc-650'}`}
                            >
                              <Bookmark size={12} fill={isSaved ? "currentColor" : "none"} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ----------------- TAB: STORES DIRECTORY ----------------- */}
              {activeTab === 'stores' && (
                <motion.div 
                  key="stores_panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 p-4"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 select-none text-left">SHOP OWNERS</p>
                    </div>
                    <button
                      onClick={() => setViewStoresMap(!viewStoresMap)}
                      className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-mono hover:bg-white/10 text-white cursor-pointer"
                    >
                      {viewStoresMap ? '📋 View Grid List' : '🗺️ View Locator Map'}
                    </button>
                  </div>
                  
                  {viewStoresMap ? (
                    <MarketplaceWorldMap 
                      stores={stores}
                      onSelectStore={(st) => setSelectedStorePage(st)}
                      onSetLocation={(loc) => setSelectedLocation(loc)}
                      activeLocation={selectedLocation}
                    />
                  ) : isLoading ? (
                    <RecommendedUserSkeleton />
                  ) : stores.length === 0 ? (
                    <EmptyState 
                      icon={<Store size={28} />}
                      title="No Shops Available"
                      description="There are no shops registered matching your location or category filter."
                      actionLabel="Open Shop"
                      onAction={() => setShowMerchantDesk(true)}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {stores.map((st) => {
                        const isSaved = savedItems.includes(st.id);
                        return (
                          <div 
                            key={st.id}
                            className="bg-zinc-950 border border-white/5 rounded-3xl overflow-hidden shadow"
                          >
                            <div className="h-20 bg-neutral-900 relative">
                              <img src={st.cover} className="w-full h-full object-cover brightness-[0.4]" alt="" />
                              <img src={getAvatarUrl(st.logo)} className="absolute -bottom-4 left-4 h-12 w-12 rounded-xl border-2 border-dashed border-black bg-neutral-900 object-cover" alt="" />
                            </div>
                            <div className="p-4 pt-5 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-left">
                                  <h3 className="text-xs font-black text-white flex items-center gap-1">
                                    {st.name}
                                    {st.isVerified && <ShieldCheck size={12} className="text-aeirmist-cyan shrink-0" />}
                                  </h3>
                                  <p className="text-[10px] text-zinc-400 font-mono mt-0.5">@{st.username}</p>
                                </div>
                                
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button 
                                    onClick={() => handleToggleSaveItem(st.id, 'store')}
                                    className={`p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 cursor-pointer transition ${isSaved ? 'text-indigo-400' : 'text-zinc-500'}`}
                                  >
                                    <Bookmark size={13} fill={isSaved ? "currentColor" : "none"} />
                                  </button>
                                  <button 
                                    onClick={() => setSelectedStorePage(st)}
                                    className="px-4 py-2 bg-white text-black text-[10px] uppercase tracking-wider font-extrabold rounded-xl transition cursor-pointer active:scale-95"
                                  >
                                    View Store
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-zinc-350 line-clamp-2 select-text leading-relaxed text-left">{st.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ----------------- TAB: SERVICES HUB ----------------- */}
              {activeTab === 'services' && (
                <motion.div 
                  key="services_panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 p-4 text-left"
                >
                  <div className="flex items-center justify-between select-none">
                    <p className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">CUSTOM SERVICES DIRECTORY</p>
                    {profile && (
                      <button 
                        onClick={() => setShowAddServiceModal(true)}
                        className="px-3 py-1.5 rounded-lg border border-indigo-500/10 bg-indigo-505/10 hover:bg-indigo-600 text-[9px] font-black uppercase text-indigo-300 flex items-center gap-1 cursor-pointer transition active:scale-95"
                      >
                        <Plus size={10} /> Add Service
                      </button>
                    )}
                  </div>

                  {filteredServices.length === 0 ? (
                    isLoading ? (
                      <ServiceSkeleton />
                    ) : (
                      <EmptyState 
                        icon={<Briefcase size={28} />}
                        title="No Services Listed"
                        description="No custom services have been published matching your criteria."
                        actionLabel="Add Service"
                        onAction={() => setShowAddServiceModal(true)}
                      />
                    )
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredServices.map((srv) => {
                        const isSaved = savedItems.includes(srv.id);
                        return (
                          <div 
                            key={srv.id}
                            className="p-4 rounded-3xl bg-zinc-950 border border-white/5 space-y-3 shadow-md"
                          >
                            <div className="flex items-start justify-between min-w-0">
                              <div>
                                <span className="text-[8px] font-mono tracking-widest bg-white/5 text-zinc-400 px-2.5 py-0.5 rounded uppercase">
                                  {srv.category}
                                </span>
                                <h4 className="text-xs font-extrabold text-white mt-1 leading-snug line-clamp-1 select-text">{srv.title}</h4>
                              </div>
                              <span className="text-[10px] font-mono font-black text-indigo-300 bg-indigo-500/10 border border-indigo-500/15 py-0.5 px-2 rounded shrink-0">
                                {srv.pricing}
                              </span>
                            </div>

                            <p className="text-[11px] text-zinc-350 line-clamp-2 select-text leading-relaxed font-semibold">{srv.description}</p>
                            
                            <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.03]">
                              <div className="flex items-center gap-2">
                                <img src={getAvatarUrl(srv.ownerAvatar)} className="h-6 w-6 rounded-lg object-cover bg-neutral-900" alt="" />
                                <span className="text-[9px] font-mono text-zinc-550 truncate">by {srv.ownerName}</span>
                              </div>
                              
                              <div className="flex items-center gap-1.5">
                                <button 
                                  onClick={() => handleToggleSaveItem(srv.id, 'service')}
                                  className={`p-2 rounded-xl bg-zinc-900 cursor-pointer ${isSaved ? 'text-indigo-400' : 'text-zinc-550'}`}
                                >
                                  <Bookmark size={12} fill={isSaved ? "currentColor" : "none"} />
                                </button>
                                <button 
                                  onClick={() => {
                                    // Start inquiry
                                    if (srv.ownerId === profile?.id) {
                                      addToast({ title: 'Self node error', message: 'You own this service node.', type: 'info' });
                                      return;
                                    }
                                    const serviceStoreMock = {
                                      id: srv.id,
                                      ownerId: srv.ownerId,
                                      name: `${srv.ownerName} Freelance`,
                                      username: srv.ownerName.toLowerCase().replace(/\s+/g, ''),
                                      logo: srv.ownerAvatar || '',
                                      cover: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80',
                                      description: srv.description,
                                      category: srv.category,
                                      contactInfo: srv.contactEmail || srv.contactPhone || ''
                                    };
                                    setActiveMessageDraftStore(serviceStoreMock);
                                    setMessageDraftText(`Greetings! I am inquiring regarding your listed service: "${srv.title}" (${srv.pricing}).`);
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-zinc-300 hover:text-white border border-white/5 font-mono text-[9px] uppercase tracking-wider font-extrabold cursor-pointer transition active:scale-95"
                                >
                                  Connect Provider
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ----------------- TAB: BENTO CATEGORIES GRID ----------------- */}
              {activeTab === 'categories' && (
                <motion.div 
                  key="categories_panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 p-4 text-left select-none"
                >
                  <p className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">BROWSE CATEGORIES GRID</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pb-6">
                    {finalCategoriesList.map((cat) => {
                      const isActive = selectedCategory === cat.id;
                      const iconNode = categoryIconsMap[cat.icon] || <Tag size={16} />;
                      
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(isActive ? null : cat.id);
                            setActiveTab('products'); // Switch directory tab to products with filtered active category
                          }}
                          className={`p-4 rounded-3xl border text-left flex flex-col justify-between h-28 cursor-pointer transition-all active:scale-95 duration-300 relative overflow-hidden ${
                            isActive 
                              ? 'border-indigo-400 bg-indigo-505/10 text-white' 
                              : 'bg-zinc-950 border-white/[0.04] hover:bg-zinc-900 text-zinc-300'
                          }`}
                        >
                          {/* Radial background aura */}
                          <div className="absolute -right-6 -bottom-6 h-16 w-16 rounded-full bg-gradient-to-tr from-indigo-550/15 via-transparent to-transparent pointer-events-none" />
                          
                          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center border ${
                            isActive ? 'bg-indigo-500/20 border-indigo-400 text-white' : 'bg-neutral-900 border-white/10 text-zinc-300'
                          }`}>
                            {iconNode}
                          </div>
                          <div>
                            <span className="text-[11px] font-black uppercase tracking-wider block leading-tight">{cat.label}</span>
                            <span className="text-[9px] font-mono text-zinc-500 mt-1 block">Inspect listings</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </main>

      {/* ----------------- SECTOR DRAWER PREVIEWS (SAVED CONTENT / INBOX / BUSINESS DESK) ----------------- */}
      
      {/* 1. SAVED CONTENT DRAWER */}
      <AnimatePresence>
        {showBookmarksDrawer && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="absolute inset-0 bg-black/98 border-l border-white/10 z-[100] p-4 flex flex-col justify-between"
          >
            <div className="space-y-4 overflow-y-auto no-scrollbar flex-1 pb-4">
              <div className="flex items-center justify-between select-none">
                <div className="flex items-center gap-1.5 text-zinc-450 text-xs font-mono font-bold uppercase tracking-wider">
                  <Bookmark size={15} className="text-zinc-400" /> Bookmarks Vault
                </div>
                <button 
                  onClick={() => setShowBookmarksDrawer(false)}
                  className="p-1 px-3 border border-white/10 rounded-xl bg-zinc-900 text-white text-[10px] uppercase font-mono cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Bookmarked lists groups */}
              <div className="space-y-6">
                <div>
                  <p className="text-[9px] font-mono tracking-widest text-zinc-650 uppercase mb-2">Bookmarked Products ({bookmarkedProducts.length})</p>
                  {bookmarkedProducts.length === 0 ? (
                    <p className="text-[10px] text-zinc-700 italic pl-2">None.</p>
                  ) : (
                    <div className="space-y-2">
                      {bookmarkedProducts.map((p) => (
                        <div 
                          key={p.id}
                          onClick={() => {
                            setSelectedProductDetail(p);
                            setSelectedStorePage(null);
                            setShowBookmarksDrawer(false);
                          }}
                          className="p-2 bg-zinc-950 border border-white/5 rounded-xl cursor-pointer flex gap-3 text-left hover:border-white/10"
                        >
                          <img src={p.mediaItems?.[0]?.url || ''} className="h-9 w-9 object-cover rounded-lg bg-neutral-900" alt="" />
                          <div className="text-xs truncate min-w-0 flex-1">
                            <p className="font-bold text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-zinc-400 font-mono">৳{p.price.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[9px] font-mono tracking-widest text-zinc-650 uppercase mb-2">Saved Store Users ({bookmarkedStores.length})</p>
                  {bookmarkedStores.length === 0 ? (
                    <p className="text-[10px] text-zinc-700 italic pl-2">None.</p>
                  ) : (
                    <div className="space-y-2">
                      {bookmarkedStores.map((st) => (
                        <div 
                          key={st.id}
                          onClick={() => {
                            setSelectedStorePage(st);
                            setSelectedProductDetail(null);
                            setShowBookmarksDrawer(false);
                          }}
                          className="p-2 bg-zinc-950 border border-white/5 rounded-xl cursor-pointer flex gap-3 text-left hover:border-white/10"
                        >
                          <img src={getAvatarUrl(st.logo)} className="h-9 w-9 object-cover rounded-lg bg-neutral-900" alt="" />
                          <div className="text-xs truncate min-w-0 flex-1">
                            <p className="font-bold text-white truncate">{st.name}</p>
                            <p className="text-[10px] text-zinc-400 font-mono">@{st.username}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. SECURE MULTI-STORE CART DRAWER */}
      <AnimatePresence>
        {showCartDrawer && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="absolute inset-y-0 right-0 w-full max-w-xl bg-black border-l border-white/10 z-[100] flex flex-col"
          >
            <MarketplaceCart 
              cart={cart}
              currency={currency}
              currencySymbol={currencySymbol}
              currencyRate={currencyRate}
              onUpdateQuantity={handleUpdateCartQuantity}
              onRemoveItem={handleRemoveCartItem}
              onClearCart={() => setCart([])}
              onClose={() => setShowCartDrawer(false)}
              onAddOrderToTracking={(newOrder) => {
                setSelectedOrderToTrack(newOrder);
              }}
              userProfile={profile}
              stores={stores}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refund Reason Modal */}
      <AnimatePresence>
        {refundModalOpen && (
          <div
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
            onClick={() => setRefundModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm p-6 rounded-3xl bg-zinc-950 border border-white/10"
            >
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-1">Request Refund</h3>
              <p className="text-[10px] text-white/40 mb-4">Tell the merchant why you're requesting a refund.</p>
              <textarea
                autoFocus
                value={refundReasonDraft}
                onChange={(e) => setRefundReasonDraft(e.target.value)}
                placeholder="Describe the issue..."
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-red-400/50 resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setRefundModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/50 text-[10px] font-black uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!refundReasonDraft.trim() || !db || !selectedOrderToTrack) return;
                    try {
                      await updateDoc(doc(db, 'orders', selectedOrderToTrack.id), {
                        refundStatus: 'requested',
                        refundReason: refundReasonDraft.trim()
                      });
                      addToast({ title: 'Refund requested', message: 'Your request has been submitted to the merchant.', type: 'success' });
                      setRefundModalOpen(false);
                    } catch (err) {
                      logger.error(err);
                      addToast({ title: 'Error', message: 'Failed to submit refund request.', type: 'warning' });
                    }
                  }}
                  disabled={!refundReasonDraft.trim()}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. ORDER TRACKING DISPATCH DRAWER */}
      <AnimatePresence>
        {selectedOrderToTrack && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="absolute inset-y-0 right-0 w-full max-w-xl bg-zinc-950 border-l border-white/10 z-[100] flex flex-col p-6 overflow-y-auto no-scrollbar"
          >
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-4 mb-5">
              <div className="flex items-center gap-2">
                <Truck className="text-aeirmist-cyan animate-bounce" size={18} />
                <div className="text-left">
                  <h3 className="text-sm font-black text-white font-mono uppercase tracking-wider">Secure Delivery Dispatch Tracker</h3>
                  <p className="text-[9px] text-zinc-500 font-mono">Real-time Node routing status</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedOrderToTrack(null)}
                className="p-1.5 px-3 border border-white/10 rounded-xl bg-zinc-900 text-white text-[10px] uppercase font-mono cursor-pointer"
              >
                Close Trace
              </button>
            </div>

            {/* List other orders dropdown if multiple exist */}
            {orderHistory.length > 1 && (
              <div className="mb-4 text-left">
                <label className="block text-[9px] font-mono text-zinc-500 uppercase mb-1">Select Dispatch node</label>
                <select
                  value={selectedOrderToTrack.id}
                  onChange={(e) => {
                    const matched = orderHistory.find(o => o.id === e.target.value);
                    if (matched) setSelectedOrderToTrack(matched);
                  }}
                  className="w-full text-xs text-white bg-zinc-900 border border-white/10 rounded-xl p-2.5 focus:outline-none cursor-pointer font-mono"
                >
                  {orderHistory.map(order => (
                    <option key={order.id} value={order.id} className="bg-zinc-950 text-neutral-300">
                      {order.id} - {new Date(order.createdAt).toLocaleDateString()} ({order.currentStatus.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Timelines list */}
            <div className="p-5 bg-zinc-900/60 rounded-3xl border border-white/5 space-y-6 text-left">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-zinc-500">Method:</span>
                <span className="text-aeirmist-cyan font-bold">{selectedOrderToTrack.deliveryMethod}</span>
              </div>

              {/* Graphical timeline with glowing connectors */}
              <div className="space-y-6 relative pt-3">
                {/* Connecting wireframe bar */}
                <div className="absolute left-2.5 top-5 bottom-5 w-0.5 bg-zinc-800" />

                {selectedOrderToTrack.trackingTimeline.map((item: any, idx: number) => {
                  // Determine status order
                  const statusPriority: Record<string, number> = { processing: 0, packed: 1, shipped: 2, delivered: 3 };
                  const currentLevel = statusPriority[selectedOrderToTrack.currentStatus] || 0;
                  const itemLevel = statusPriority[item.status] || 0;
                  const isDone = itemLevel <= currentLevel;
                  const isCurrent = itemLevel === currentLevel;

                  return (
                    <div key={idx} className="flex gap-4 items-start relative">
                      {/* Interactive radio icon node */}
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                        isDone 
                          ? 'bg-aeirmist-cyan text-black shadow-[0_0_12px_#06b6d4]' 
                          : 'bg-zinc-900 text-zinc-600 border border-white/5'
                      }`}>
                        {isDone ? (
                          <ShieldCheck size={12} />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                        )}
                      </div>

                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex justify-between items-baseline gap-2">
                          <h4 className={`text-xs font-bold font-mono ${isCurrent ? 'text-aeirmist-cyan font-black' : isDone ? 'text-white' : 'text-zinc-500'}`}>
                            {item.label}
                          </h4>
                          {isCurrent && (
                            <span className="text-[8px] font-mono uppercase bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-aeirmist-cyan px-1.5 py-0.5 rounded animate-pulse">Active Node</span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 select-text leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress upgrade trigger for demo/main characters */}
              <div className="pt-4 border-t border-white/[0.04] space-y-3">
                {(selectedOrderToTrack.currentStatus === 'shipped' || selectedOrderToTrack.currentStatus === 'delivered') && 
                 selectedOrderToTrack.refundStatus !== 'requested' && 
                 selectedOrderToTrack.refundStatus !== 'approved' && (
                  <button
                    onClick={() => { setRefundReasonDraft(''); setRefundModalOpen(true); }}
                    className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-mono text-red-400 hover:text-red-300 transition cursor-pointer font-bold"
                  >
                    Request Refund
                  </button>
                )}
                
                {selectedOrderToTrack.refundStatus === 'requested' && (
                  <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center">
                    <p className="text-[10px] font-mono text-orange-400 font-bold uppercase tracking-widest">Refund Status: Requested</p>
                    <p className="text-[9px] text-orange-500/70 mt-1">Awaiting merchant review.</p>
                  </div>
                )}
                
                {selectedOrderToTrack.refundStatus === 'approved' && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <p className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest">Refund Status: Approved</p>
                  </div>
                )}
                
                {selectedOrderToTrack.refundStatus === 'rejected' && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                    <p className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-widest">Refund Status: Rejected</p>
                  </div>
                )}


              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. BUSINESS CONVERSATIONS INBOX */}
      <AnimatePresence>
        {showBusinessInbox && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="absolute inset-0 bg-black z-[100] border-l border-white/10 flex flex-col overflow-hidden"
          >
            <MarketplaceBusinessInbox onBack={() => setShowBusinessInbox(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. MERCHANT DESK / ACTIVE STORE OWNER DASHBOARD */}
      <AnimatePresence>
        {showMerchantDesk && (
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="absolute inset-0 bg-black z-[100] border-l border-white/10 flex flex-col overflow-hidden p-2 sm:p-4"
          >
            {/* Header back */}
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3 mb-3 select-none">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-450">👑 SELLER HUB & MERCHANT DESK</span>
              <button 
                onClick={() => setShowMerchantDesk(false)}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-[10px] uppercase font-mono cursor-pointer"
              >
                Exit Desk
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <MarketplaceDashboard 
                onViewStore={(st) => {
                  setSelectedStorePage(st);
                  setShowMerchantDesk(false);
                }} 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. CONTEXTUAL MASSAGING DRAFT DIALOG PREFILL PANEL */}
      <AnimatePresence>
        {activeMessageDraftStore && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-end justify-center"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-zinc-950 border border-white/15 rounded-t-[2.5rem] w-full max-w-xl mx-auto p-5 space-y-4 shadow-2xl pb-8 text-left"
            >
              <div className="flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  <img src={getAvatarUrl(activeMessageDraftStore.logo)} className="h-8 w-8 rounded-lg object-cover" alt="" />
                  <div>
                    <h3 className="text-xs font-black text-white">Prefill Inquiry Link</h3>
                    <p className="text-[10px] text-zinc-500 font-mono">@{activeMessageDraftStore.username}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setActiveMessageDraftStore(null);
                    setActiveMessageDraftProduct(null);
                  }}
                  className="p-1 text-zinc-550 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {activeMessageDraftProduct && (
                <div className="p-2 bg-zinc-900 border border-white/5 rounded-2xl flex items-center gap-2 select-none">
                  <img src={activeMessageDraftProduct.mediaItems?.[0]?.url || ''} className="h-10 w-10 object-cover rounded-lg bg-neutral-900" alt="" />
                  <div className="text-xs">
                    <p className="font-bold text-white truncate">{activeMessageDraftProduct.name}</p>
                    <p className="text-[10px] text-indigo-300 font-mono">৳{activeMessageDraftProduct.price.toLocaleString()}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-[9px] uppercase font-mono tracking-widest text-zinc-500">Draft Content Message</span>
                <textarea
                  value={messageDraftText}
                  onChange={(e) => setMessageDraftText(e.target.value)}
                  rows={4}
                  className="w-full text-xs text-white placeholder:text-neutral-750 bg-neutral-900 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-white transitionresize-none select-text resize-none"
                />
              </div>

              <button
                onClick={handleSendInquiry}
                disabled={isSendingDraft || !messageDraftText.trim()}
                className="w-full cursor-pointer h-12 bg-white hover:bg-neutral-100 disabled:opacity-35 text-black font-mono font-black uppercase text-xs rounded-2xl flex items-center justify-center gap-2 transition"
              >
                {isSendingDraft ? 'TRANSMITTING...' : 'INITIATE Connection'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------- SEARCH FILTER DRAWER BOTTOM SHEET ----------------- */}
      <AnimatePresence>
        {showFilterDrawer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-end justify-center select-none"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-zinc-950 border border-white/15 rounded-t-[2.5rem] w-full max-w-xl mx-auto p-5 space-y-5 shadow-2xl pb-8"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black text-zinc-400 uppercase tracking-widest">Filters SPECIFICATIONS</span>
                <button 
                  onClick={() => setShowFilterDrawer(false)}
                  className="text-zinc-550 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Price range selector Taka currency */}
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>Price Constraint limit</span>
                  <span className="font-bold text-white">৳{priceFilter.toLocaleString()} Taka</span>
                </div>
                <input 
                  type="range" 
                  min={500} 
                  max={500000} 
                  step={500}
                  value={priceFilter}
                  onChange={(e) => setPriceFilter(Number(e.target.value))}
                  className="w-full accent-white h-1.5 bg-neutral-850 rounded-lg cursor-pointer"
                />
              </div>

              {/* Sorting filters */}
              <div className="space-y-2 text-left">
                <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Sort Broadcast criteria</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'newest', label: 'Newest listings' },
                    { id: 'oldest', label: 'Oldest listings' },
                    { id: 'price_low', label: 'Price: Low to High' },
                    { id: 'price_high', label: 'Price: High to Low' },
                    { id: 'rating', label: 'Rating merchant' }
                  ].map((sOption) => (
                    <button
                      key={sOption.id}
                      onClick={() => {
                        setActiveSort(sOption.id as any);
                      }}
                      className={`py-3.5 px-3 rounded-2xl border text-[10px] font-bold text-center transition-all ${
                        activeSort === sOption.id 
                          ? 'border-white bg-white text-black' 
                          : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {sOption.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply settings indicators */}
              <button
                onClick={() => setShowFilterDrawer(false)}
                className="w-full h-12 bg-white text-black text-xs font-black uppercase rounded-2xl font-mono tracking-widest"
              >
                APPLY CRITERIA
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A. FLOATING FORM MODAL: LIST PRODUCT */}
      <AnimatePresence>
        {showAddProductModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[155] flex items-center justify-center p-4 text-left select-text">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-white/15 p-5 rounded-3xl w-full max-w-xl mx-auto max-h-[85vh] overflow-y-auto no-scrollbar space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-mono font-black uppercase text-zinc-300 flex items-center gap-1">🛍️ List Product Item</span>
                <button onClick={() => setShowAddProductModal(false)} className="text-zinc-550 hover:text-white"><X size={16} /></button>
              </div>

              <form onSubmit={handleAddProductSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Product Title name</p>
                  <input type="text" value={newProdName} onChange={e=>setNewProdName(e.target.value)} required className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none focus:border-white" placeholder="e.g. Mechanical Keyboard" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-mono">Price (৳ Taka)</p>
                    <input type="number" value={newProdPrice} onChange={e=>setNewProdPrice(e.target.value)} required className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none focus:border-white" placeholder="5500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-mono">Discount Price (Optional)</p>
                    <input type="number" value={newProdDiscount} onChange={e=>setNewProdDiscount(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none focus:border-white" placeholder="4800" />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Photo URL link</p>
                  <input type="url" value={newProdMedia} onChange={e=>setNewProdMedia(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none" placeholder="https://unsplash..." />
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Category Directory</p>
                  <select value={newProdCategory} onChange={e=>setNewProdCategory(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white">
                    {finalCategoriesList.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Listing Description</p>
                  <textarea rows={3} value={newProdDesc} onChange={e=>setNewProdDesc(e.target.value)} required className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none focus:border-white resize-none" placeholder="Provide retail specifications..." />
                </div>

                <button type="submit" className="w-full py-3.5 bg-white text-black font-mono font-black uppercase text-xs rounded-xl hover:bg-neutral-100 transition-all select-none">
                  PUBLISH LISTING Broadcaster
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* B. FLOATING FORM MODAL: REGISTER SERVICE */}
      <AnimatePresence>
        {showAddServiceModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[155] flex items-center justify-center p-4 text-left select-text">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-white/10 p-5 rounded-3xl w-full max-w-xl mx-auto max-h-[85vh] overflow-y-auto no-scrollbar space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3 select-none">
                <span className="text-xs font-mono font-black uppercase text-zinc-300 flex items-center gap-1">🛠️ Register Custom Service</span>
                <button onClick={() => setShowAddServiceModal(false)} className="text-zinc-550 hover:text-white"><X size={16} /></button>
              </div>

              <form onSubmit={handleAddServiceSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Service Name</p>
                  <input type="text" value={srvTitle} onChange={e=>setSrvTitle(e.target.value)} required className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none" placeholder="e.g. UI/UX Design Consulting" />
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Pricing Label</p>
                  <input type="text" value={srvPricing} onChange={e=>setSrvPricing(e.target.value)} required className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none" placeholder="e.g. From ৳5,000 / Hr" />
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Service Category</p>
                  <select value={srvCategory} onChange={e=>setSrvCategory(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white">
                    <option value="Services">General Consultant Services</option>
                    <option value="Digital Products">Digital design & Software devs</option>
                    <option value="Beauty">Health & Wellness treatments</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-mono">Email contact</p>
                    <input type="email" value={srvContactEmail} onChange={e=>setSrvContactEmail(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none" placeholder="your@email.com" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-mono">Contact Phone number</p>
                    <input type="tel" value={srvContactPhone} onChange={e=>setSrvContactPhone(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none" placeholder="017xxxxxxxx" />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Service Spec Description</p>
                  <textarea rows={3} value={srvDesc} onChange={e=>setSrvDesc(e.target.value)} required className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none resize-none" placeholder="Describe consulting deliverables..." />
                </div>

                <button type="submit" className="w-full py-3.5 bg-white text-black font-mono font-black uppercase text-xs rounded-xl hover:bg-neutral-100 transition-all select-none">
                  PUBLISH SERVICE OFFER
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* C. FLOATING FORM MODAL: MERCHANT POST UPDATE */}
      <AnimatePresence>
        {showCreatePostModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[155] flex items-center justify-center p-4 text-left select-text">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-white/10 p-5 rounded-3xl w-full max-w-xl mx-auto max-h-[85vh] overflow-y-auto no-scrollbar space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3 select-none">
                <span className="text-xs font-mono font-black uppercase text-zinc-300 flex items-center gap-1">📝 Publish Merchant Post</span>
                <button onClick={() => setShowCreatePostModal(false)} className="text-zinc-550 hover:text-white"><X size={16} /></button>
              </div>

              <form onSubmit={handleCreatePostSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Post content</p>
                  <textarea rows={4} value={newPostContent} onChange={e=>setNewPostContent(e.target.value)} required className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-white resize-none" placeholder="Write merchant announcement or updates..." />
                </div>

                <div className="space-y-1 font-mono text-[9px] text-zinc-400">
                  <p className="text-[10px] text-zinc-500 font-mono">Attachment Photo URL (Optional)</p>
                  <input type="url" value={newPostMedia} onChange={e=>setNewPostMedia(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none" placeholder="https://unsplash..." />
                </div>

                <button type="submit" className="w-full py-3.5 bg-white text-black font-mono font-black uppercase text-xs rounded-xl hover:bg-neutral-100 transition-all select-none col-span-2">
                  SHARE UPDATE
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* D. FLOATING FORM MODAL: EDIT PRODUCT SPECIFICS */}
      <AnimatePresence>
        {showEditProductModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[160] flex items-center justify-center p-4 text-left select-text">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-white/15 p-5 rounded-3xl w-full max-w-xl mx-auto max-h-[85vh] overflow-y-auto no-scrollbar space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3 font-mono">
                <span className="text-xs font-black uppercase text-indigo-400">✏️ EDIT LISTING SPECIFICATIONS</span>
                <button onClick={() => setShowEditProductModal(false)} className="text-zinc-550 hover:text-white"><X size={16} /></button>
              </div>

              <form onSubmit={handleEditProductSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Product Name</p>
                  <input 
                    type="text" 
                    value={editProdData.name || ''} 
                    onChange={e=>setEditProdData(prev => ({ ...prev, name: e.target.value }))} 
                    required 
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none focus:border-white" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-mono">Retail Price (৳ Taka)</p>
                    <input 
                      type="number" 
                      value={editProdData.price || ''} 
                      onChange={e=>setEditProdData(prev => ({ ...prev, price: Number(e.target.value) }))} 
                      required 
                      className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none focus:border-white" 
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-mono">Discount Price</p>
                    <input 
                      type="number" 
                      value={editProdData.discountPrice || ''} 
                      onChange={e=>setEditProdData(prev => ({ ...prev, discountPrice: Number(e.target.value) }))} 
                      className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-mono">Stock Status</p>
                    <select 
                      value={editProdData.stockStatus || 'available'} 
                      onChange={e=>setEditProdData(prev => ({ ...prev, stockStatus: e.target.value as any }))}
                      className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white"
                    >
                      <option value="available">Available</option>
                      <option value="out_of_stock">Out of Stock</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 font-mono">Directory Category</p>
                    <select 
                      value={editProdData.category || 'Electronics'} 
                      onChange={e=>setEditProdData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white"
                    >
                      {finalCategoriesList.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Product Photo Link URL</p>
                  <input 
                    type="url" 
                    value={editProdData.mediaItems?.[0]?.url || ''} 
                    onChange={e=> {
                      const updatedItems = [...(editProdData.mediaItems || [])];
                      if (updatedItems.length === 0) {
                        updatedItems.push({ id: 'med_1', type: 'image', url: e.target.value });
                      } else {
                        updatedItems[0] = { ...updatedItems[0], url: e.target.value };
                      }
                      setEditProdData(prev => ({ ...prev, mediaItems: updatedItems }));
                    }} 
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none" 
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-mono">Description content specifications</p>
                  <textarea 
                    rows={3} 
                    value={editProdData.description || ''} 
                    onChange={e=>setEditProdData(prev => ({ ...prev, description: e.target.value }))} 
                    required 
                    className="w-full bg-zinc-900 border border-white/5 rounded-xl p-3 text-white focus:outline-none resize-none" 
                  />
                </div>

                <button type="submit" className="w-full py-3.5 bg-white text-black font-mono font-black uppercase text-xs rounded-xl hover:bg-neutral-100 transition-all select-none">
                  COMMIT MODIFICATIONS
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ----------------- MOBILE ONLY BOTTOM NAVIGATION ----------------- */}
      <nav 
        role="tablist"
        aria-label="Marketplace Navigation"
        className="md:hidden fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl px-2 py-1.5 flex items-center justify-between shadow-2xl z-40 select-none"
      >
        {[
          { id: 'foryou', label: 'For You', icon: <Sparkles size={14} /> },
          { id: 'products', label: 'Products', icon: <ShoppingBag size={14} /> },
          { id: 'stores', label: 'Stores', icon: <Store size={14} /> },
          { id: 'services', label: 'Services', icon: <Briefcase size={14} /> },
          { id: 'categories', label: 'Categories', icon: <Layers size={14} /> }
        ].map((tabObj) => {
          const isTabActive = activeTab === tabObj.id;
          return (
            <button
              key={tabObj.id}
              type="button"
              role="tab"
              aria-selected={isTabActive}
              aria-controls={`panel-${tabObj.id}`}
              aria-label={tabObj.label}
              onClick={() => {
                setActiveTab(tabObj.id as any);
                setSelectedStorePage(null);
                setSelectedProductDetail(null);
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl cursor-pointer transition-all duration-200 ${
                isTabActive 
                  ? 'bg-white/10 text-white font-bold' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className={isTabActive ? 'text-white' : 'text-zinc-500'} aria-hidden="true">
                {tabObj.icon}
              </div>
              <span className="text-[9px] font-medium tracking-wide">{tabObj.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
});

export default ExploreSystem;
