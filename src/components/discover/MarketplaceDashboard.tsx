import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Store, 
  Edit3, 
  ShoppingBag, 
  Trash2, 
  Image as ImageIcon, 
  Settings, 
  MessageSquare, 
  AlertCircle,
  Eye,
  CheckCircle,
  MapPin,
  Clock,
  Phone,
  Mail,
  Truck,
  Upload,
  Star,
  Search,
  Check,
  RefreshCw,
  Archive,
  ChevronRight,
  ShieldCheck,
  Layers,
  Inbox
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
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { getAvatarUrl } from '../../lib/avatar';
import { 
  Store as StoreType, 
  Product, 
  ProductMediaItem,
  MARKETPLACE_CATEGORIES 
} from './MarketplaceTypes';
import { MarketplaceCreateShopModal } from './MarketplaceCreateShopModal';
import { EmptyState } from '../ui/EmptyState';
import { logger } from '@/src/utils/logger';

interface DashboardProps {
  onViewStore: (store: StoreType) => void;
  onOpenCreateShop?: () => void;
}

const BANGLADESH_DIVISIONS = [
  'Dhaka',
  'Chattogram',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Rangpur',
  'Mymensingh'
];

export const MarketplaceDashboard: React.FC<DashboardProps> = ({ 
  onViewStore,
  onOpenCreateShop
}) => {
  const { db, profile, user, addToast, earnPoints, uploadMedia } = useAeirmist();

  // Screen level states
  const [myStores, setMyStores] = useState<StoreType[]>([]);
  const [activeStore, setActiveStore] = useState<StoreType | null>(null);
  const [loading, setLoading] = useState(true);

  // Active sub tab inside active store dashboard
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'reviews' | 'settings'>('overview');

  // Modals
  const [showCreateShopModal, setShowCreateShopModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDeleteShopModal, setShowDeleteShopModal] = useState(false);
  const [isDeletingShop, setIsDeletingShop] = useState(false);

  // Product Filter & Search
  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'published' | 'out_of_stock'>('all');
  const [productsList, setProductsList] = useState<Product[]>([]);

  // Reviews list & reply state
  const [storeReviews, setStoreReviews] = useState<any[]>([]);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<string | null>(null);

  // Product Form states
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodDiscount, setProdDiscount] = useState('');
  const [prodCategory, setProdCategory] = useState(MARKETPLACE_CATEGORIES[0].id);
  const [prodStock, setProdStock] = useState<'available' | 'out_of_stock'>('available');
  const [prodMediaItems, setProdMediaItems] = useState<ProductMediaItem[]>([]);
  const [uploadingProductMedia, setUploadingProductMedia] = useState(false);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Store Settings Form states
  const [settingsName, setSettingsName] = useState('');
  const [settingsDesc, setSettingsDesc] = useState('');
  const [settingsCategory, setSettingsCategory] = useState('');
  const [settingsPhone, setSettingsPhone] = useState('');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsDivision, setSettingsDivision] = useState('Dhaka');
  const [settingsDistrict, setSettingsDistrict] = useState('');
  const [settingsArea, setSettingsArea] = useState('');
  const [settingsAddress, setSettingsAddress] = useState('');
  const [settingsPostalCode, setSettingsPostalCode] = useState('');
  const [settingsOpeningHours, setSettingsOpeningHours] = useState('');
  const [settingsContactPref, setSettingsContactPref] = useState<'phone' | 'whatsapp' | 'email' | 'chat'>('phone');
  const [settingsDelivery, setSettingsDelivery] = useState(true);
  const [settingsPickup, setSettingsPickup] = useState(true);
  const [settingsStatus, setSettingsStatus] = useState<'active' | 'draft' | 'archived' | 'suspended'>('active');
  const [settingsLogo, setSettingsLogo] = useState('');
  const [settingsCover, setSettingsCover] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // 1. Subscribe to stores owned by current user UID
  useEffect(() => {
    if (!db || !profile?.id) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'stores'),
      where('ownerId', '==', profile.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const stores: StoreType[] = [];
      snapshot.forEach((docSnap) => {
        stores.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      setMyStores(stores);

      // Set active store if none selected or if active store changed
      if (stores.length > 0) {
        setActiveStore((prev) => {
          if (!prev) return stores[0];
          const found = stores.find((s) => s.id === prev.id);
          return found || stores[0];
        });
      } else {
        setActiveStore(null);
      }
      setLoading(false);
    }, (err) => {
      logger.error('Error fetching seller stores:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [db, profile?.id]);

  // 2. Populate Settings fields whenever activeStore changes
  useEffect(() => {
    if (activeStore) {
      setSettingsName(activeStore.name || '');
      setSettingsDesc(activeStore.description || '');
      setSettingsCategory(activeStore.category || MARKETPLACE_CATEGORIES[0].id);
      setSettingsPhone(activeStore.phone || '');
      setSettingsEmail(activeStore.email || '');
      setSettingsDivision(activeStore.division || 'Dhaka');
      setSettingsDistrict(activeStore.district || '');
      setSettingsArea(activeStore.area || '');
      setSettingsAddress(activeStore.address || '');
      setSettingsPostalCode(activeStore.postalCode || '');
      setSettingsOpeningHours(activeStore.openingHours || '');
      setSettingsContactPref((activeStore.contactPreference as any) || 'phone');
      setSettingsDelivery(activeStore.deliveryAvailable ?? true);
      setSettingsPickup(activeStore.pickupAvailable ?? true);
      setSettingsStatus(activeStore.status || 'active');
      setSettingsLogo(activeStore.logo || '');
      setSettingsCover(activeStore.cover || '');
    }
  }, [activeStore]);

  // 3. Subscribe to products for the active store
  useEffect(() => {
    if (!db || !activeStore?.id) {
      setProductsList([]);
      return;
    }

    const q = query(
      collection(db, 'products'),
      where('storeId', '==', activeStore.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((docSnap) => {
        prods.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      setProductsList(prods);
    }, (err) => {
      logger.error('Error fetching store products:', err);
    });

    return () => unsub();
  }, [db, activeStore?.id]);

  // 4. Subscribe to reviews for the active store
  useEffect(() => {
    if (!db || !activeStore?.id) {
      setStoreReviews([]);
      return;
    }

    const q = query(
      collection(db, 'store_reviews'),
      where('storeId', '==', activeStore.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const revs: any[] = [];
      snapshot.forEach((docSnap) => {
        revs.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      setStoreReviews(revs);
    }, (err) => {
      logger.error('Error fetching store reviews:', err);
    });

    return () => unsub();
  }, [db, activeStore?.id]);

  // Handle Logo Upload in Settings
  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadMedia(file, `users/${profile?.id}/stores/logos`);
      setSettingsLogo(url);
      addToast({ title: 'Logo updated', message: 'Shop logo staged. Save settings to apply.', type: 'success' });
    } catch (err) {
      logger.error(err);
      addToast({ title: 'Upload failed', message: 'Could not upload logo. Please retry.', type: 'warning' });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle Cover Upload in Settings
  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadMedia(file, `users/${profile?.id}/stores/covers`);
      setSettingsCover(url);
      addToast({ title: 'Banner updated', message: 'Shop banner staged. Save settings to apply.', type: 'success' });
    } catch (err) {
      logger.error(err);
      addToast({ title: 'Upload failed', message: 'Could not upload banner. Please retry.', type: 'warning' });
    } finally {
      setUploadingCover(false);
    }
  };

  // Save Store Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !activeStore?.id) return;
    if (!settingsName.trim()) {
      addToast({ title: 'Required field', message: 'Shop name is required.', type: 'warning' });
      return;
    }

    setIsSavingSettings(true);
    const combinedLocation = [settingsArea, settingsDistrict, settingsDivision].filter(Boolean).join(', ') || settingsAddress || '';
    const contactInfoString = [settingsPhone, settingsEmail].filter(Boolean).join(' | ');

    try {
      const storeRef = doc(db, 'stores', activeStore.id);
      await updateDoc(storeRef, {
        name: settingsName.trim(),
        description: settingsDesc.trim(),
        category: settingsCategory,
        phone: settingsPhone.trim(),
        email: settingsEmail.trim(),
        contactInfo: contactInfoString,
        contactPreference: settingsContactPref,
        division: settingsDivision,
        district: settingsDistrict.trim(),
        area: settingsArea.trim(),
        address: settingsAddress.trim(),
        postalCode: settingsPostalCode.trim(),
        location: combinedLocation,
        openingHours: settingsOpeningHours.trim(),
        deliveryAvailable: settingsDelivery,
        pickupAvailable: settingsPickup,
        status: settingsStatus,
        logo: settingsLogo || activeStore.logo,
        cover: settingsCover || activeStore.cover,
        updatedAt: serverTimestamp()
      });

      addToast({
        title: 'Settings saved',
        message: 'Shop information updated successfully.',
        type: 'success'
      });
    } catch (err) {
      logger.error('Failed to update shop settings:', err);
      addToast({
        title: 'Update failed',
        message: 'Could not save shop settings. Please try again.',
        type: 'warning'
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Soft-Delete / Archive Shop
  const handleDeleteShop = async () => {
    if (!db || !activeStore?.id) return;
    setIsDeletingShop(true);

    try {
      const storeRef = doc(db, 'stores', activeStore.id);
      await updateDoc(storeRef, {
        status: 'archived',
        updatedAt: serverTimestamp()
      });

      addToast({
        title: 'Shop archived',
        message: `${activeStore.name} has been archived and removed from public listings.`,
        type: 'success'
      });
      setShowDeleteShopModal(false);
    } catch (err) {
      logger.error('Failed to archive shop:', err);
      addToast({
        title: 'Archive failed',
        message: 'Could not archive shop. Please try again.',
        type: 'warning'
      });
    } finally {
      setIsDeletingShop(false);
    }
  };

  // Open Product Modal (Create or Edit)
  const handleOpenProductModal = (prod?: Product) => {
    if (prod) {
      setEditingProduct(prod);
      setProdName(prod.name);
      setProdDesc(prod.description);
      setProdPrice(prod.price.toString());
      setProdDiscount(prod.discountPrice ? prod.discountPrice.toString() : '');
      setProdCategory(prod.category);
      setProdStock(prod.stockStatus);
      setProdMediaItems(prod.mediaItems || []);
    } else {
      setEditingProduct(null);
      setProdName('');
      setProdDesc('');
      setProdPrice('');
      setProdDiscount('');
      setProdCategory(activeStore?.category || MARKETPLACE_CATEGORIES[0].id);
      setProdStock('available');
      setProdMediaItems([]);
    }
    setShowProductModal(true);
  };

  // Handle Product Media Upload
  const handleProductMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProductMedia(true);
    try {
      const url = await uploadMedia(file, `users/${profile?.id}/products/media`);
      const isVideo = file.type.startsWith('video/');
      const newItem: ProductMediaItem = {
        id: 'm_' + Date.now(),
        type: isVideo ? 'video' : 'image',
        url
      };
      setProdMediaItems((prev) => [...prev, newItem]);
      addToast({ title: 'Media added', message: 'Product media uploaded successfully.', type: 'success' });
    } catch (err) {
      logger.error(err);
      addToast({ title: 'Upload failed', message: 'Could not upload media item.', type: 'warning' });
    } finally {
      setUploadingProductMedia(false);
    }
  };

  // Submit Product Form (Create / Edit)
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !activeStore?.id) return;
    if (!prodName.trim() || !prodPrice) {
      addToast({ title: 'Required fields', message: 'Product title and price are required.', type: 'warning' });
      return;
    }

    setIsSubmittingProduct(true);
    const priceNum = parseFloat(prodPrice);
    const discountNum = prodDiscount ? parseFloat(prodDiscount) : undefined;

    const sellerUid = user?.uid || profile.uid || profile.ownerUid || profile.id;
    const payload = {
      storeId: activeStore.id,
      storeName: activeStore.name,
      storeLogo: activeStore.logo,
      sellerUid: sellerUid,
      sellerId: profile.id,
      ownerUid: sellerUid,
      name: prodName.trim(),
      description: prodDesc.trim(),
      price: priceNum,
      ...(discountNum !== undefined && { discountPrice: discountNum }),
      category: prodCategory,
      stockStatus: prodStock,
      mediaItems: prodMediaItems,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), payload);
        addToast({ title: 'Product updated', message: `${prodName} was updated successfully.`, type: 'success' });
      } else {
        const fullPayload = {
          ...payload,
          createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'products'), fullPayload);
        // Increment product count on store
        await updateDoc(doc(db, 'stores', activeStore.id), {
          productsCount: (activeStore.productsCount || 0) + 1,
          updatedAt: serverTimestamp()
        });
        if (earnPoints) earnPoints(20);
        addToast({ title: 'Product listed', message: `${prodName} is now in your shop catalog.`, type: 'success' });
      }
      setShowProductModal(false);
    } catch (err) {
      logger.error('Product submit error:', err);
      addToast({ title: 'Save failed', message: 'Could not save product. Please try again.', type: 'warning' });
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  // Toggle Stock Status
  const handleToggleStockStatus = async (prod: Product) => {
    if (!db) return;
    const nextStatus = prod.stockStatus === 'available' ? 'out_of_stock' : 'available';
    try {
      await updateDoc(doc(db, 'products', prod.id), {
        stockStatus: nextStatus,
        updatedAt: serverTimestamp()
      });
      addToast({
        title: 'Stock status updated',
        message: `${prod.name} is now ${nextStatus === 'available' ? 'in stock' : 'out of stock'}.`,
        type: 'success'
      });
    } catch (err) {
      logger.error(err);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (prod: Product) => {
    if (!db || !activeStore?.id) return;
    if (!confirm(`Are you sure you want to remove "${prod.name}" from your catalog?`)) return;

    try {
      await deleteDoc(doc(db, 'products', prod.id));
      await updateDoc(doc(db, 'stores', activeStore.id), {
        productsCount: Math.max(0, (activeStore.productsCount || 0) - 1),
        updatedAt: serverTimestamp()
      });
      addToast({ title: 'Product deleted', message: `${prod.name} has been removed.`, type: 'success' });
    } catch (err) {
      logger.error(err);
      addToast({ title: 'Delete failed', message: 'Could not delete product.', type: 'warning' });
    }
  };

  // Reply to Customer Review
  const handleReplyReview = async (reviewId: string) => {
    const text = replyTextMap[reviewId]?.trim();
    if (!text || !db) return;
    setSubmittingReply(reviewId);

    try {
      await updateDoc(doc(db, 'store_reviews', reviewId), {
        reply: text,
        replyAt: serverTimestamp()
      });
      addToast({ title: 'Response posted', message: 'Your reply has been saved.', type: 'success' });
      setReplyTextMap((prev) => ({ ...prev, [reviewId]: '' }));
    } catch (err) {
      logger.error(err);
      addToast({ title: 'Reply failed', message: 'Could not post response.', type: 'warning' });
    } finally {
      setSubmittingReply(null);
    }
  };

  // Filtered Products
  const filteredProducts = productsList.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          prod.description.toLowerCase().includes(productSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (productFilter === 'published') return prod.stockStatus === 'available';
    if (productFilter === 'out_of_stock') return prod.stockStatus === 'out_of_stock';
    return true;
  });

  // Render Skeleton while loading
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 animate-pulse">
        <div className="h-14 bg-zinc-900/60 rounded-2xl border border-white/5" />
        <div className="h-44 bg-zinc-900/40 rounded-3xl border border-white/5" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-28 bg-zinc-900/30 rounded-2xl border border-white/5" />
          <div className="h-28 bg-zinc-900/30 rounded-2xl border border-white/5" />
          <div className="h-28 bg-zinc-900/30 rounded-2xl border border-white/5" />
        </div>
      </div>
    );
  }

  // If user owns no shops, show clean "Become a Seller" state
  if (myStores.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="h-20 w-20 rounded-3xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 flex items-center justify-center text-aeirmist-cyan mx-auto shadow-lg shadow-aeirmist-cyan/5">
          <Store size={36} />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Become a Seller</h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            Create a shop and start listing products on Aeirmist Marketplace. Reach local customers, manage your catalog, and grow your business.
          </p>
        </div>
        <div>
          <button
            id="seller-onboarding-create-btn"
            type="button"
            onClick={() => setShowCreateShopModal(true)}
            className="px-6 py-3 rounded-2xl bg-aeirmist-cyan hover:bg-cyan-400 text-black text-sm font-bold transition shadow-lg shadow-aeirmist-cyan/20 cursor-pointer active:scale-95 inline-flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Create a Shop</span>
          </button>
        </div>

        <MarketplaceCreateShopModal
          isOpen={showCreateShopModal}
          onClose={() => setShowCreateShopModal(false)}
          onShopCreated={(newShop) => {
            setActiveStore(newShop);
            setActiveTab('overview');
          }}
        />
      </div>
    );
  }

  return (
    <div id="marketplace-seller-dashboard" className="max-w-6xl mx-auto space-y-6 text-left pb-16">
      {/* Top Header & Store Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-zinc-950/80 border border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0">
            <img
              src={getAvatarUrl(activeStore?.logo)}
              alt={activeStore?.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">{activeStore?.name}</h1>
              {activeStore?.isVerified && (
                <ShieldCheck size={16} className="text-aeirmist-cyan shrink-0" />
              )}
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                activeStore?.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : activeStore?.status === 'draft'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                {activeStore?.status || 'active'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">@{activeStore?.username} • {activeStore?.category}</p>
          </div>
        </div>

        {/* Action Controls & Store Switcher */}
        <div className="flex items-center flex-wrap gap-2.5">
          {myStores.length > 1 && (
            <select
              value={activeStore?.id}
              onChange={(e) => {
                const found = myStores.find((s) => s.id === e.target.value);
                if (found) setActiveStore(found);
              }}
              className="bg-zinc-900 border border-white/10 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-aeirmist-cyan cursor-pointer"
            >
              {myStores.map((s) => (
                <option key={s.id} value={s.id} className="bg-zinc-950 text-white">
                  {s.name} ({s.status || 'active'})
                </option>
              ))}
            </select>
          )}

          <button
            id="seller-add-another-shop-btn"
            type="button"
            onClick={() => setShowCreateShopModal(true)}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold border border-white/10 transition cursor-pointer flex items-center gap-1.5"
            title="Create another shop"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New Shop</span>
          </button>

          {activeStore && (
            <button
              id="seller-view-public-shop-btn"
              type="button"
              onClick={() => onViewStore(activeStore)}
              className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Eye size={14} />
              <span>View Public Shop</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 pb-px gap-1 overflow-x-auto no-scrollbar scroll-smooth">
        {[
          { id: 'overview', label: 'Overview', icon: <Layers size={14} /> },
          { id: 'products', label: `Products (${productsList.length})`, icon: <ShoppingBag size={14} /> },
          { id: 'orders', label: 'Orders', icon: <Inbox size={14} /> },
          { id: 'reviews', label: `Reviews (${storeReviews.length})`, icon: <Star size={14} /> },
          { id: 'settings', label: 'Shop Settings', icon: <Settings size={14} /> }
        ].map((tab) => (
          <button
            key={tab.id}
            id={`seller-tab-${tab.id}`}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 rounded-t-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 border-b-2 ${
              activeTab === tab.id
                ? 'border-aeirmist-cyan text-white bg-zinc-900/40'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB CONTENT PANELS */}
      <div className="space-y-6">
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && activeStore && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Shop Summary Header Card */}
            <div className="rounded-3xl border border-white/5 bg-zinc-950/70 p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-white">Welcome back, {activeStore.name}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {activeStore.description || 'No description provided. Add your shop story in Shop Settings.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenProductModal()}
                    className="px-4 py-2.5 rounded-xl bg-aeirmist-cyan hover:bg-cyan-400 text-black text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-md shadow-aeirmist-cyan/10"
                  >
                    <Plus size={14} />
                    <span>Add Product</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold border border-white/10 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Settings size={14} />
                    <span>Edit Settings</span>
                  </button>
                </div>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-white/5 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-zinc-500 shrink-0" />
                  <span className="truncate">{activeStore.location || 'Location not set'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-zinc-500 shrink-0" />
                  <span className="truncate">{activeStore.openingHours || 'Hours not set'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-zinc-500 shrink-0" />
                  <span className="truncate">{activeStore.phone || activeStore.email || 'No contact specified'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-zinc-500 shrink-0" />
                  <span>
                    {activeStore.deliveryAvailable ? 'Delivery active' : 'Pickup only'}
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-white/5 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Total Products</p>
                <p className="text-2xl font-black text-white">{productsList.length}</p>
                <p className="text-[10px] text-zinc-500">
                  {productsList.filter((p) => p.stockStatus === 'available').length} in stock
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-white/5 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Customer Reviews</p>
                <p className="text-2xl font-black text-white">{storeReviews.length}</p>
                <p className="text-[10px] text-zinc-500">
                  {storeReviews.length > 0 
                    ? `Average rating: ${(storeReviews.reduce((acc, r) => acc + (r.rating || 5), 0) / storeReviews.length).toFixed(1)} / 5.0`
                    : 'No customer reviews yet'}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-950/60 border border-white/5 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Shop Status</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${activeStore.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="text-base font-bold text-white capitalize">{activeStore.status || 'active'}</span>
                </div>
                <p className="text-[10px] text-zinc-500">
                  {activeStore.status === 'active' ? 'Visible in marketplace search' : 'Draft / Private'}
                </p>
              </div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setActiveTab('products')}
                className="p-5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/70 border border-white/5 hover:border-white/10 transition cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-white">
                    <ShoppingBag size={18} />
                  </div>
                  <ChevronRight size={16} className="text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition" />
                </div>
                <h4 className="text-sm font-bold text-white">Manage Products</h4>
                <p className="text-xs text-zinc-400">Add new items, update prices, discounts, stock levels, and upload product photos.</p>
              </div>

              <div
                onClick={() => setActiveTab('settings')}
                className="p-5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/70 border border-white/5 hover:border-white/10 transition cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-white">
                    <Settings size={18} />
                  </div>
                  <ChevronRight size={16} className="text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition" />
                </div>
                <h4 className="text-sm font-bold text-white">Edit Shop Details</h4>
                <p className="text-xs text-zinc-400">Update branding logo, cover banner, location address, hours, delivery options, and contact preferences.</p>
              </div>
            </div>
          </div>
        )}

        {/* 2. PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Filter & Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-950/60 border border-white/5">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search your products..."
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-zinc-900 p-1 rounded-xl border border-white/5">
                  {(['all', 'published', 'out_of_stock'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setProductFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                        productFilter === filter
                          ? 'bg-white text-black shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {filter.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <button
                  id="seller-add-product-btn"
                  type="button"
                  onClick={() => handleOpenProductModal()}
                  className="px-4 py-2 rounded-xl bg-aeirmist-cyan hover:bg-cyan-400 text-black text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm shadow-aeirmist-cyan/10"
                >
                  <Plus size={14} />
                  <span>Add Product</span>
                </button>
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag size={28} />}
                title={productSearch ? "No matching products found" : "No products in catalog"}
                description={productSearch ? "Try adjusting your search terms" : "Start listing products for customers on Aeirmist Marketplace."}
                actionLabel={productSearch ? undefined : "Add Your First Product"}
                onAction={productSearch ? undefined : () => handleOpenProductModal()}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((prod) => {
                  const hasDiscount = prod.discountPrice && prod.discountPrice < prod.price;
                  return (
                    <div
                      key={prod.id}
                      className="rounded-2xl bg-zinc-950/70 border border-white/5 overflow-hidden flex flex-col hover:border-white/10 transition group shadow-md"
                    >
                      {/* Product Thumbnail */}
                      <div className="aspect-square bg-zinc-900 relative overflow-hidden">
                        {prod.mediaItems && prod.mediaItems.length > 0 ? (
                          prod.mediaItems[0].type === 'video' ? (
                            <video src={prod.mediaItems[0].url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={prod.mediaItems[0].url} alt={prod.name} className="w-full h-full object-cover" />
                          )
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-700">
                            <ShoppingBag size={36} />
                          </div>
                        )}

                        {/* Stock Badge */}
                        <div className="absolute top-2.5 left-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStockStatus(prod)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition cursor-pointer border ${
                              prod.stockStatus === 'available'
                                ? 'bg-emerald-500/90 text-white border-emerald-400'
                                : 'bg-red-500/90 text-white border-red-400'
                            }`}
                            title="Click to toggle stock status"
                          >
                            {prod.stockStatus === 'available' ? 'In Stock' : 'Out of Stock'}
                          </button>
                        </div>

                        {hasDiscount && (
                          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-aeirmist-cyan text-black font-black text-[9px] uppercase">
                            Sale
                          </div>
                        )}
                      </div>

                      {/* Info & Price */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-zinc-500 font-mono">{prod.category}</p>
                          <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1 mt-0.5">{prod.name}</h4>
                          <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">{prod.description}</p>
                        </div>

                        <div className="space-y-3 pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-1.5">
                              {hasDiscount ? (
                                <>
                                  <span className="text-sm font-black text-white">৳{prod.discountPrice?.toLocaleString()}</span>
                                  <span className="text-xs text-zinc-500 line-through">৳{prod.price?.toLocaleString()}</span>
                                </>
                              ) : (
                                <span className="text-sm font-black text-white">৳{prod.price?.toLocaleString()}</span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenProductModal(prod)}
                              className="flex-1 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold border border-white/10 transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Edit3 size={12} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod)}
                              className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs border border-red-500/20 transition cursor-pointer"
                              title="Delete product"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. ORDERS TAB (CLEAN PLACEHOLDER PER SPEC) */}
        {activeTab === 'orders' && (
          <div className="p-8 sm:p-12 rounded-3xl bg-zinc-950/60 border border-white/5 text-center space-y-4 animate-in fade-in duration-200">
            <div className="h-16 w-16 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-500 mx-auto">
              <Inbox size={28} />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-base font-bold text-white">Order Management</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Orders management will be available in the next phase. Real customer orders will appear here once commerce sales begin.
              </p>
            </div>
          </div>
        )}

        {/* 4. REVIEWS TAB */}
        {activeTab === 'reviews' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Customer Reviews</h3>
                <p className="text-xs text-zinc-400">View feedback and respond to customers who reviewed your shop.</p>
              </div>
              <span className="text-xs font-mono text-zinc-500">{storeReviews.length} reviews</span>
            </div>

            {storeReviews.length === 0 ? (
              <EmptyState
                icon={<Star size={28} />}
                title="No customer reviews yet"
                description="When customers review your shop, their feedback and ratings will appear here."
              />
            ) : (
              <div className="space-y-4">
                {storeReviews.map((rev) => (
                  <div key={rev.id} className="p-5 rounded-2xl bg-zinc-950/70 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={getAvatarUrl(rev.userAvatar)}
                          alt={rev.userName}
                          className="h-8 w-8 rounded-xl object-cover"
                        />
                        <div>
                          <p className="text-xs font-bold text-white">{rev.userName || 'Anonymous User'}</p>
                          <div className="flex items-center gap-1 text-amber-400 mt-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={12}
                                fill={star <= (rev.rating || 5) ? 'currentColor' : 'none'}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed select-text">{rev.comment}</p>

                    {/* Existing Owner Reply */}
                    {rev.reply && (
                      <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5 space-y-1">
                        <p className="text-[10px] font-bold text-aeirmist-cyan uppercase tracking-wider">Shop Response</p>
                        <p className="text-xs text-zinc-300 leading-relaxed">{rev.reply}</p>
                      </div>
                    )}

                    {/* Compose Reply Form */}
                    {!rev.reply && (
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={replyTextMap[rev.id] || ''}
                          onChange={(e) => setReplyTextMap({ ...replyTextMap, [rev.id]: e.target.value })}
                          placeholder="Reply to customer feedback..."
                          className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-aeirmist-cyan transition"
                        />
                        <button
                          type="button"
                          onClick={() => handleReplyReview(rev.id)}
                          disabled={submittingReply === rev.id || !replyTextMap[rev.id]?.trim()}
                          className="px-3.5 py-1.5 rounded-xl bg-aeirmist-cyan text-black font-bold text-xs hover:bg-cyan-400 transition cursor-pointer disabled:opacity-50"
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
        )}

        {/* 5. SHOP SETTINGS TAB */}
        {activeTab === 'settings' && activeStore && (
          <form onSubmit={handleSaveSettings} className="space-y-6 animate-in fade-in duration-200">
            {/* Basic Information */}
            <div className="p-5 sm:p-6 rounded-3xl bg-zinc-950/70 border border-white/5 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Shop Information</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Shop Name *</label>
                  <input
                    type="text"
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    required
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Category *</label>
                  <select
                    value={settingsCategory}
                    onChange={(e) => setSettingsCategory(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition cursor-pointer"
                  >
                    {MARKETPLACE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-zinc-950 text-white">
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Description</label>
                <textarea
                  value={settingsDesc}
                  onChange={(e) => setSettingsDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Phone</label>
                  <input
                    type="tel"
                    value={settingsPhone}
                    onChange={(e) => setSettingsPhone(e.target.value)}
                    placeholder="017xxxxxxxx"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Email</label>
                  <input
                    type="email"
                    value={settingsEmail}
                    onChange={(e) => setSettingsEmail(e.target.value)}
                    placeholder="shop@example.com"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>
              </div>
            </div>

            {/* Branding Section */}
            <div className="p-5 sm:p-6 rounded-3xl bg-zinc-950/70 border border-white/5 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Branding Assets</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Logo */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">Shop Logo</label>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden shrink-0">
                      <img src={getAvatarUrl(settingsLogo)} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-white/10 transition flex items-center gap-1.5">
                      <Upload size={14} />
                      <span>{uploadingLogo ? 'Uploading...' : 'Change Logo'}</span>
                      <input type="file" accept="image/*" onChange={handleUploadLogo} disabled={uploadingLogo} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Banner */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">Cover Banner</label>
                  <div className="space-y-2">
                    <div className="h-16 w-full rounded-2xl bg-zinc-900 border border-white/10 overflow-hidden">
                      <img src={settingsCover || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80'} alt="Cover" className="w-full h-full object-cover" />
                    </div>
                    <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-white/10 transition flex items-center gap-1.5 w-fit">
                      <Upload size={14} />
                      <span>{uploadingCover ? 'Uploading...' : 'Change Banner'}</span>
                      <input type="file" accept="image/*" onChange={handleUploadCover} disabled={uploadingCover} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Location Section */}
            <div className="p-5 sm:p-6 rounded-3xl bg-zinc-950/70 border border-white/5 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Location & Address</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Division</label>
                  <select
                    value={settingsDivision}
                    onChange={(e) => setSettingsDivision(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition cursor-pointer"
                  >
                    {BANGLADESH_DIVISIONS.map((div) => (
                      <option key={div} value={div} className="bg-zinc-950 text-white">
                        {div}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">District</label>
                  <input
                    type="text"
                    value={settingsDistrict}
                    onChange={(e) => setSettingsDistrict(e.target.value)}
                    placeholder="e.g. Dhaka, Gazipur"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Area</label>
                  <input
                    type="text"
                    value={settingsArea}
                    onChange={(e) => setSettingsArea(e.target.value)}
                    placeholder="e.g. Dhanmondi, Banani"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Postal Code</label>
                  <input
                    type="text"
                    value={settingsPostalCode}
                    onChange={(e) => setSettingsPostalCode(e.target.value)}
                    placeholder="e.g. 1205"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Full Street Address</label>
                <input
                  type="text"
                  value={settingsAddress}
                  onChange={(e) => setSettingsAddress(e.target.value)}
                  placeholder="e.g. House 24, Road 8/A"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition"
                />
              </div>
            </div>

            {/* Details & Status */}
            <div className="p-5 sm:p-6 rounded-3xl bg-zinc-950/70 border border-white/5 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2">Hours & Fulfillment</h3>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Opening Hours</label>
                <input
                  type="text"
                  value={settingsOpeningHours}
                  onChange={(e) => setSettingsOpeningHours(e.target.value)}
                  placeholder="e.g. Mon - Sat: 9:00 AM - 8:00 PM"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Truck size={16} className="text-aeirmist-cyan" />
                    <span className="text-xs font-semibold text-white">Delivery Available</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsDelivery}
                    onChange={(e) => setSettingsDelivery(e.target.checked)}
                    className="h-4 w-4 rounded bg-zinc-800 border-zinc-700 text-aeirmist-cyan accent-aeirmist-cyan cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={16} className="text-aeirmist-cyan" />
                    <span className="text-xs font-semibold text-white">Pickup Available</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsPickup}
                    onChange={(e) => setSettingsPickup(e.target.checked)}
                    className="h-4 w-4 rounded bg-zinc-800 border-zinc-700 text-aeirmist-cyan accent-aeirmist-cyan cursor-pointer"
                  />
                </label>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-zinc-300">Shop Visibility Status</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'active', label: 'Active (Public)' },
                    { id: 'draft', label: 'Draft (Private)' }
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSettingsStatus(st.id as any)}
                      className={`p-3 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        settingsStatus === st.id
                          ? 'border-aeirmist-cyan bg-aeirmist-cyan/10 text-white font-bold'
                          : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {settingsStatus === st.id && <Check size={12} className="text-aeirmist-cyan" />}
                      <span>{st.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save Settings Action Button */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-white/10">
              <button
                id="seller-delete-shop-trigger-btn"
                type="button"
                onClick={() => setShowDeleteShopModal(true)}
                className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Archive size={14} />
                <span>Delete / Archive Shop</span>
              </button>

              <button
                id="seller-save-settings-btn"
                type="submit"
                disabled={isSavingSettings}
                className="px-6 py-2.5 rounded-xl bg-aeirmist-cyan hover:bg-cyan-400 text-black text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-md shadow-aeirmist-cyan/20 disabled:opacity-50"
              >
                {isSavingSettings ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* PRODUCT CREATION / EDIT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[210] flex items-center justify-center p-3 sm:p-5 text-left">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
              <h3 className="text-sm sm:text-base font-bold text-white">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Product Title *</label>
                <input
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Wireless Noise-Cancelling Headphones"
                  required
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Regular Price (৳) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Discount Price (৳) (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodDiscount}
                    onChange={(e) => setProdDiscount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Category *</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition cursor-pointer"
                  >
                    {MARKETPLACE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id} className="bg-zinc-950 text-white">
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Stock Availability</label>
                  <select
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition cursor-pointer"
                  >
                    <option value="available" className="bg-zinc-950 text-white">In Stock (Available)</option>
                    <option value="out_of_stock" className="bg-zinc-950 text-white">Out of Stock</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Description</label>
                <textarea
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="Describe your product specifications, features, warranty, and return policy..."
                  rows={3}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-aeirmist-cyan transition resize-none"
                />
              </div>

              {/* Product Media Upload */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Product Images</label>
                <div className="flex flex-wrap gap-2.5">
                  {prodMediaItems.map((item, idx) => (
                    <div key={item.id} className="relative h-16 w-16 rounded-xl bg-zinc-900 border border-white/10 overflow-hidden group">
                      {item.type === 'video' ? (
                        <video src={item.url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={item.url} alt={`Media ${idx}`} className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => setProdMediaItems(prodMediaItems.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <label className="h-16 w-16 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-dashed border-white/20 flex flex-col items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition">
                    <Upload size={16} />
                    <span className="text-[9px] mt-1">{uploadingProductMedia ? '...' : '+ Upload'}</span>
                    <input type="file" accept="image/*,video/*" onChange={handleProductMediaUpload} disabled={uploadingProductMedia} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProduct}
                  className="px-5 py-2 rounded-xl bg-aeirmist-cyan hover:bg-cyan-400 text-black text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingProduct ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>{editingProduct ? 'Update Product' : 'List Product'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DELETE SHOP CONFIRMATION MODAL */}
      {showDeleteShopModal && activeStore && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[220] flex items-center justify-center p-4 text-left">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-zinc-950 border border-red-500/20 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl"
          >
            <div className="h-12 w-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertCircle size={24} />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white">Delete this shop?</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                This action will remove <span className="font-semibold text-white">{activeStore.name}</span> from Aeirmist Marketplace listings. Existing records will be safely archived and not destroyed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteShopModal(false)}
                disabled={isDeletingShop}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteShop}
                disabled={isDeletingShop}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {isDeletingShop ? 'Archiving...' : 'Confirm Archive'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* CREATE SHOP MODAL */}
      <MarketplaceCreateShopModal
        isOpen={showCreateShopModal}
        onClose={() => setShowCreateShopModal(false)}
        onShopCreated={(newShop) => {
          setActiveStore(newShop);
          setActiveTab('overview');
        }}
      />
    </div>
  );
};
