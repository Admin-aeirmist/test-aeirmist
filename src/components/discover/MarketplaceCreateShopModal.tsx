import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Store, 
  Upload, 
  MapPin, 
  Clock, 
  Phone, 
  Mail, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle, 
  Truck, 
  ShoppingBag, 
  Image as ImageIcon,
  ShieldCheck,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAvatarUrl } from '../../lib/avatar';
import { Store as StoreType, MARKETPLACE_CATEGORIES } from './MarketplaceTypes';
import { logger } from '@/src/utils/logger';

interface CreateShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShopCreated: (shop: StoreType) => void;
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

export const MarketplaceCreateShopModal: React.FC<CreateShopModalProps> = ({
  isOpen,
  onClose,
  onShopCreated
}) => {
  const { db, profile, user, addToast, uploadMedia, earnPoints } = useAeirmist();

  // Current Step: 1 to 5
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Shop Information
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(MARKETPLACE_CATEGORIES[0].id);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Step 2: Branding
  const [logo, setLogo] = useState('');
  const [cover, setCover] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);

  // Step 3: Location
  const [division, setDivision] = useState('Dhaka');
  const [district, setDistrict] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Step 4: Details
  const [openingHours, setOpeningHours] = useState('');
  const [contactPreference, setContactPreference] = useState<'phone' | 'whatsapp' | 'email' | 'chat'>('phone');
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);
  const [pickupAvailable, setPickupAvailable] = useState(true);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Logo Upload
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoUploadError(null);

    setUploadingLogo(true);
    try {
      const url = await uploadMedia(file, `users/${profile?.id}/stores/logos`);
      setLogo(url);
      addToast({ title: 'Logo uploaded', message: 'Shop logo staged successfully.', type: 'success' });
    } catch (err: any) {
      logger.error('Failed to upload logo:', err);
      setLogoUploadError('Failed to upload logo. Please check connection and retry.');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle Cover Upload
  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setCoverUploadError(null);

    setUploadingCover(true);
    try {
      const url = await uploadMedia(file, `users/${profile?.id}/stores/covers`);
      setCover(url);
      addToast({ title: 'Cover uploaded', message: 'Shop banner staged successfully.', type: 'success' });
    } catch (err: any) {
      logger.error('Failed to upload cover:', err);
      setCoverUploadError('Failed to upload cover banner. Please retry.');
    } finally {
      setUploadingCover(false);
    }
  };

  // Validation
  const validateStep1 = () => {
    if (!name.trim()) {
      addToast({ title: 'Required field', message: 'Please enter a shop name.', type: 'warning' });
      return false;
    }
    if (!category) {
      addToast({ title: 'Required field', message: 'Please select a shop category.', type: 'warning' });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
    }
    setCreationError(null);
    setCurrentStep((prev) => Math.min(5, prev + 1));
  };

  const handleBack = () => {
    setCreationError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  // Compile combined location string
  const compileLocation = () => {
    const parts = [area, district, division].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    return address || division || '';
  };

  // Final Shop Submission
  const handleCreateShop = async () => {
    if (!db || !profile) {
      setCreationError('Authentication required. Please sign in to create a shop.');
      return;
    }

    if (!name.trim() || !category) {
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);
    setCreationError(null);

    const generatedUsername = name.toLowerCase().replace(/[^a-z0-9_]/g, '') + '_' + Math.floor(100 + Math.random() * 900);
    const combinedLocation = compileLocation();
    const contactInfoString = [phone, email].filter(Boolean).join(' | ');

    const ownerUid = user?.uid || profile.uid || profile.ownerUid || profile.id;
    const newShopData: any = {
      ownerId: profile.id,
      ownerUid: ownerUid,
      name: name.trim(),
      username: generatedUsername,
      description: description.trim(),
      category: category,
      logo: logo || logoPreview || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=150&q=80',
      cover: cover || coverPreview || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
      phone: phone.trim(),
      email: email.trim(),
      contactInfo: contactInfoString,
      contactPreference: contactPreference,
      division: division,
      district: district.trim(),
      area: area.trim(),
      address: address.trim(),
      postalCode: postalCode.trim(),
      location: combinedLocation,
      openingHours: openingHours.trim(),
      deliveryAvailable: deliveryAvailable,
      pickupAvailable: pickupAvailable,
      status: 'active',
      isVerified: false,
      followers: [],
      productsCount: 0,
      avgRating: 0,
      totalReviews: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'stores'), newShopData);
      const createdShop: StoreType = {
        id: docRef.id,
        ...newShopData
      };

      if (earnPoints) {
        earnPoints(50);
      }

      addToast({
        title: 'Shop created successfully',
        message: `${name} is now live on Aeirmist Marketplace!`,
        type: 'success'
      });

      onShopCreated(createdShop);
      onClose();
    } catch (err: any) {
      logger.error('Failed to create shop:', err);
      setCreationError("Couldn't create your shop. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Information' },
    { num: 2, label: 'Branding' },
    { num: 3, label: 'Location' },
    { num: 4, label: 'Details' },
    { num: 5, label: 'Preview' }
  ];

  return (
    <div 
      id="create-shop-modal"
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-3 sm:p-5 text-left"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 flex items-center justify-center text-aeirmist-cyan">
              <Store size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">Create a Shop</h2>
              <p className="text-[11px] text-zinc-400">Step {currentStep} of 5: {stepsList[currentStep - 1].label}</p>
            </div>
          </div>
          <button
            id="close-create-shop-modal-btn"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Multi-step progress bar */}
        <div className="px-4 sm:px-6 pt-4 shrink-0">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {stepsList.map((step) => {
              const isDone = currentStep > step.num;
              const isCurrent = currentStep === step.num;
              return (
                <div key={step.num} className="space-y-1">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isDone 
                        ? 'bg-aeirmist-cyan' 
                        : isCurrent 
                        ? 'bg-aeirmist-cyan shadow-[0_0_8px_#00f0ff]' 
                        : 'bg-zinc-800'
                    }`} 
                  />
                  <p className={`text-[10px] font-medium truncate hidden sm:block ${isCurrent ? 'text-aeirmist-cyan font-bold' : isDone ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* STEP 1: SHOP INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1">
                  Shop Name <span className="text-aeirmist-cyan">*</span>
                </label>
                <input
                  id="shop-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apex Electronics, Dhaka Studio"
                  required
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-aeirmist-cyan transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1">
                  Shop Category <span className="text-aeirmist-cyan">*</span>
                </label>
                <select
                  id="shop-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
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
                <label className="text-xs font-semibold text-zinc-200">
                  Shop Description
                </label>
                <textarea
                  id="shop-description-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell buyers what makes your shop unique, what you sell, and your story..."
                  rows={3}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-aeirmist-cyan transition resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-200">Phone</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      id="shop-phone-input"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="017xxxxxxxx"
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-aeirmist-cyan transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-200">Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      id="shop-email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="shop@example.com"
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-aeirmist-cyan transition"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BRANDING */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Logo Section */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-200">Shop Logo</label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-white/5">
                  <div className="h-20 w-20 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {logoPreview || logo ? (
                      <img src={logoPreview || logo} alt="Logo preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={24} className="text-zinc-600" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-white/10 transition flex items-center gap-1.5">
                        <Upload size={14} />
                        <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoSelect}
                          disabled={uploadingLogo}
                          className="hidden"
                        />
                      </label>
                      {(logo || logoPreview) && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogo('');
                            setLogoPreview('');
                            setLogoFile(null);
                          }}
                          className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/20 transition cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500">Recommended: Square format 500x500px, PNG or JPG.</p>
                    {logoUploadError && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                        <AlertCircle size={14} />
                        <span>{logoUploadError}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cover Banner Section */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-200">Shop Cover / Banner</label>
                <div className="space-y-3 p-4 rounded-2xl bg-zinc-900/50 border border-white/5">
                  <div className="h-32 w-full rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center overflow-hidden">
                    {coverPreview || cover ? (
                      <img src={coverPreview || cover} alt="Cover preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-zinc-600 space-y-1">
                        <ImageIcon size={28} className="mx-auto opacity-50" />
                        <p className="text-[11px]">No cover banner uploaded</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-white/10 transition flex items-center gap-1.5">
                      <Upload size={14} />
                      <span>{uploadingCover ? 'Uploading...' : 'Upload Cover Banner'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverSelect}
                        disabled={uploadingCover}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-zinc-500">Wide banner 1200x400px recommended.</p>
                  </div>
                  {coverUploadError && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      <AlertCircle size={14} />
                      <span>{coverUploadError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: LOCATION */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-200">Division</label>
                  <select
                    id="shop-division-select"
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
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
                  <label className="text-xs font-semibold text-zinc-200">District</label>
                  <input
                    id="shop-district-input"
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Dhaka, Gazipur, Chattogram"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-200">Area</label>
                  <input
                    id="shop-area-input"
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Mirpur, Banani, Dhanmondi"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-200">Postal Code</label>
                  <input
                    id="shop-postal-code-input"
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="e.g. 1216"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-aeirmist-cyan transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-200">Full Street Address</label>
                <input
                  id="shop-address-input"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. House 14, Road 7, Block B"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-aeirmist-cyan transition"
                />
              </div>
            </div>
          )}

          {/* STEP 4: SHOP DETAILS */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Clock size={14} className="text-zinc-400" />
                  Opening Hours
                </label>
                <input
                  id="shop-opening-hours-input"
                  type="text"
                  value={openingHours}
                  onChange={(e) => setOpeningHours(e.target.value)}
                  placeholder="e.g. Mon - Sat: 9:00 AM - 9:00 PM (Closed on Friday)"
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-aeirmist-cyan transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-200">Contact Preference</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'phone', label: 'Phone' },
                    { id: 'whatsapp', label: 'WhatsApp' },
                    { id: 'email', label: 'Email' },
                    { id: 'chat', label: 'In-app Chat' }
                  ].map((pref) => (
                    <button
                      key={pref.id}
                      type="button"
                      onClick={() => setContactPreference(pref.id as any)}
                      className={`p-3 rounded-xl border text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        contactPreference === pref.id
                          ? 'border-aeirmist-cyan bg-aeirmist-cyan/10 text-white font-bold'
                          : 'border-white/5 bg-zinc-900/60 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {contactPreference === pref.id && <Check size={12} className="text-aeirmist-cyan" />}
                      <span>{pref.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-xs font-semibold text-zinc-200">Order & Fulfillment Options</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 cursor-pointer hover:bg-zinc-900 transition">
                    <div className="flex items-center gap-2.5">
                      <Truck size={16} className="text-aeirmist-cyan" />
                      <div>
                        <p className="text-xs font-semibold text-white">Delivery Available</p>
                        <p className="text-[10px] text-zinc-500">Shop provides delivery service</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={deliveryAvailable}
                      onChange={(e) => setDeliveryAvailable(e.target.checked)}
                      className="h-4 w-4 rounded bg-zinc-800 border-zinc-700 text-aeirmist-cyan focus:ring-0 cursor-pointer accent-aeirmist-cyan"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 cursor-pointer hover:bg-zinc-900 transition">
                    <div className="flex items-center gap-2.5">
                      <ShoppingBag size={16} className="text-aeirmist-cyan" />
                      <div>
                        <p className="text-xs font-semibold text-white">Pickup Available</p>
                        <p className="text-[10px] text-zinc-500">Buyers can collect in person</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={pickupAvailable}
                      onChange={(e) => setPickupAvailable(e.target.checked)}
                      className="h-4 w-4 rounded bg-zinc-800 border-zinc-700 text-aeirmist-cyan focus:ring-0 cursor-pointer accent-aeirmist-cyan"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: PREVIEW */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3 bg-zinc-900/40 border border-white/5 rounded-2xl">
                <p className="text-[11px] text-zinc-400">
                  This preview reflects how your shop profile will appear to buyers across Aeirmist Marketplace.
                </p>
              </div>

              {/* Realistic Shop Card Preview */}
              <div className="rounded-3xl border border-white/10 bg-zinc-950 overflow-hidden shadow-2xl">
                {/* Banner */}
                <div className="h-32 sm:h-40 w-full relative bg-zinc-900">
                  <img
                    src={coverPreview || cover || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80'}
                    alt="Cover preview"
                    className="w-full h-full object-cover brightness-85"
                  />
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-zinc-300 font-medium border border-white/10">
                    Preview
                  </div>
                </div>

                {/* Info Bar */}
                <div className="p-4 sm:p-5 pt-0 relative">
                  <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 -mt-10 sm:-mt-12 mb-3">
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-zinc-950 p-1 border-2 border-zinc-950 shadow-xl overflow-hidden shrink-0">
                      <img
                        src={logoPreview || logo || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=150&q=80'}
                        alt="Logo preview"
                        className="w-full h-full object-cover rounded-xl"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base sm:text-lg font-black text-white">{name || 'Your Shop Name'}</h3>
                      </div>
                      <p className="text-xs text-aeirmist-cyan font-semibold">{category}</p>
                    </div>
                  </div>

                  {description && (
                    <p className="text-xs text-zinc-300 leading-relaxed mt-2 mb-3 font-normal">
                      {description}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-white/5 text-xs text-zinc-400">
                    {compileLocation() && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-zinc-500 shrink-0" />
                        <span className="truncate">{compileLocation()}</span>
                      </div>
                    )}
                    {openingHours && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-zinc-500 shrink-0" />
                        <span className="truncate">{openingHours}</span>
                      </div>
                    )}
                    {(phone || email) && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} className="text-zinc-500 shrink-0" />
                        <span className="truncate">{[phone, email].filter(Boolean).join(' • ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3">
                    {deliveryAvailable && (
                      <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-medium text-zinc-300 flex items-center gap-1">
                        <Truck size={12} className="text-aeirmist-cyan" /> Delivery Available
                      </span>
                    )}
                    {pickupAvailable && (
                      <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-medium text-zinc-300 flex items-center gap-1">
                        <ShoppingBag size={12} className="text-aeirmist-cyan" /> Pickup Available
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Message if Creation Failed */}
              {creationError && (
                <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{creationError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateShop}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 rounded-xl bg-red-500 text-white font-bold text-[11px] hover:bg-red-600 transition shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={isSubmitting ? 'animate-spin' : ''} />
                    <span>Retry</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-zinc-900/50 flex items-center justify-between shrink-0">
          {currentStep > 1 ? (
            <button
              id="create-shop-back-btn"
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-white/10 transition cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <ChevronLeft size={14} />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
          )}

          {currentStep < 5 ? (
            <button
              id="create-shop-next-btn"
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-aeirmist-cyan hover:bg-cyan-400 text-black text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-md shadow-aeirmist-cyan/10"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              id="create-shop-submit-btn"
              type="button"
              onClick={handleCreateShop}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-aeirmist-cyan hover:bg-cyan-400 text-black text-xs font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-lg shadow-aeirmist-cyan/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Creating Shop...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Create Shop</span>
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
