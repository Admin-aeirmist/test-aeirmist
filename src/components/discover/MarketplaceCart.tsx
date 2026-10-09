import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  Tag, 
  Truck, 
  CreditCard, 
  CheckCircle2, 
  ShieldCheck, 
  Info, 
  X, 
  Sparkles, 
  MapPin, 
  ArrowRight, 
  Printer, 
  Smartphone,
  ChevronDown
} from 'lucide-react';
import { Product, Store, MarketplaceAddress, MarketplaceProfile } from './MarketplaceTypes';
import { useAeirmist } from '../../context/AeirmistContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant?: string;
}

interface MarketplaceCartProps {
  cart: CartItem[];
  currency: string;
  currencySymbol: string;
  currencyRate: number;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onClose: () => void;
  onAddOrderToTracking: (order: any) => void;
  userProfile?: any;
  marketplaceProfile?: MarketplaceProfile | null;
  addresses?: MarketplaceAddress[];
  stores: Store[];
}

const DELIVERIES = [
  { id: 'standard', name: 'Standard Secure Ground', desc: 'Arrives in 3-5 days', fee: 150 },
  { id: 'express', name: 'Node-Express Air Routing', desc: 'Arrives in 1-2 days', fee: 350 },
  { id: 'drone', name: 'Hyper-Drone Teleport Express', desc: 'Guaranteed under 2 hours', fee: 950 }
];

export const MarketplaceCart: React.FC<MarketplaceCartProps> = ({
  cart,
  currency,
  currencySymbol,
  currencyRate,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onClose,
  onAddOrderToTracking,
  userProfile,
  marketplaceProfile,
  addresses = [],
  stores
}) => {
  const { db, user, addToast } = useAeirmist();
  // Stepper state: 'cart' | 'shipping' | 'payment' | 'success'
  const [step, setStep] = useState<'cart' | 'shipping' | 'payment' | 'success'>('cart');
  
  // Default address
  const defaultAddress = useMemo(() => {
    return addresses.find(a => a.isDefault) || (addresses.length > 0 ? addresses[0] : null);
  }, [addresses]);

  // Checkout Shipping Form State
  const [fullName, setFullName] = useState(() => {
    return defaultAddress?.recipientName || marketplaceProfile?.displayName || userProfile?.name || '';
  });
  const [addressLine, setAddressLine] = useState(() => {
    return defaultAddress ? `${defaultAddress.streetAddress}${defaultAddress.apartment ? `, ${defaultAddress.apartment}` : ''}` : '';
  });
  const [phone, setPhone] = useState(() => {
    return defaultAddress?.phone || marketplaceProfile?.phone || '';
  });
  const [city, setCity] = useState(() => {
    return defaultAddress?.city || defaultAddress?.district || '';
  });
  const [postalCode, setPostalCode] = useState(() => {
    return defaultAddress?.postalCode || '';
  });
  const [deliveryType, setDeliveryType] = useState('standard');

  // If addresses load after mount, populate if empty
  React.useEffect(() => {
    if (defaultAddress && !addressLine) {
      setFullName(defaultAddress.recipientName || marketplaceProfile?.displayName || userProfile?.name || '');
      setPhone(defaultAddress.phone || marketplaceProfile?.phone || '');
      setAddressLine(`${defaultAddress.streetAddress}${defaultAddress.apartment ? `, ${defaultAddress.apartment}` : ''}`);
      setCity(defaultAddress.city || defaultAddress.district || '');
      setPostalCode(defaultAddress.postalCode || '');
    }
  }, [defaultAddress]);

  const handleSelectSavedAddress = (addr: MarketplaceAddress) => {
    setFullName(addr.recipientName || marketplaceProfile?.displayName || '');
    setPhone(addr.phone || marketplaceProfile?.phone || '');
    setAddressLine(`${addr.streetAddress}${addr.apartment ? `, ${addr.apartment}` : ''}`);
    setCity(addr.city || addr.district || '');
    setPostalCode(addr.postalCode || '');
  };

  // Promo Coupon Code Code states
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percent: number } | null>(null);
  const [couponError, setCouponError] = useState('');

  // Payment states
  const [selectedGateway, setSelectedGateway] = useState<'stripe' | 'bkash' | 'nagad' | 'paypal' | 'gpay' | 'cod'>('stripe');
  const [simulatedCardNumber, setSimulatedCardNumber] = useState('');
  const [simulatedExpiry, setSimulatedExpiry] = useState('');
  const [simulatedCvv, setSimulatedCvv] = useState('');
  const [simulatedBkashNumber, setSimulatedBkashNumber] = useState('');
  const [simulatedBkashPin, setSimulatedBkashPin] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [placedOrderInfo, setPlacedOrderInfo] = useState<any>(null);

  // Group items by seller node for Amazon style shipping logic
  const itemsByStore = useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    cart.forEach(item => {
      const storeName = item.product.storeName || 'Independent Merchant';
      if (!groups[storeName]) {
        groups[storeName] = [];
      }
      groups[storeName].push(item);
    });
    return groups;
  }, [cart]);

  // Pricing computations (Prices are stored in BDT internally)
  const formatPrice = (bdtAmount: number) => {
    const converted = bdtAmount * currencyRate;
    return `${currencySymbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const getPriceNum = (bdtAmount: number) => {
    return parseFloat((bdtAmount * currencyRate).toFixed(2));
  };

  // Totals calculations
  const subtotalBDT = useMemo(() => {
    return cart.reduce((acc, item) => {
      const price = item.product.discountPrice || item.product.price;
      return acc + (price * item.quantity);
    }, 0);
  }, [cart]);

  const discountAmountBDT = useMemo(() => {
    if (!appliedDiscount) return 0;
    return (subtotalBDT * appliedDiscount.percent) / 100;
  }, [subtotalBDT, appliedDiscount]);

  const deliveryFeeBDT = useMemo(() => {
    if (cart.length === 0) return 0;
    // Deliveries fee depends on type selected
    const delMatch = DELIVERIES.find(d => d.id === deliveryType);
    const baseFee = delMatch ? delMatch.fee : 150;
    
    // Free shipping code override
    if (appliedDiscount?.code === 'FREESHIP') return 0;

    // Multiply somewhat for multiple store sources to make it realistic
    const uniqueStores = Object.keys(itemsByStore).length;
    return baseFee + ((uniqueStores - 1) * 100);
  }, [deliveryType, itemsByStore, cart.length, appliedDiscount]);

  const taxAmountBDT = useMemo(() => {
    // 5% VAT rate
    return (subtotalBDT - discountAmountBDT) * 0.05;
  }, [subtotalBDT, discountAmountBDT]);

  const grandTotalBDT = useMemo(() => {
    return Math.max(0, subtotalBDT - discountAmountBDT + deliveryFeeBDT + taxAmountBDT);
  }, [subtotalBDT, discountAmountBDT, deliveryFeeBDT, taxAmountBDT]);

  // Coupon submissions
  const handleApplyCoupon = () => {
    setCouponError('');
    const codeClean = couponCode.trim().toUpperCase();
    if (codeClean === 'AEIRMIST25') {
      setAppliedDiscount({ code: 'AEIRMIST25', percent: 25 });
    } else if (codeClean === 'LAUNCH10') {
      setAppliedDiscount({ code: 'LAUNCH10', percent: 10 });
    } else if (codeClean === 'FREESHIP') {
      setAppliedDiscount({ code: 'FREESHIP', percent: 0 }); // Handles shipping to 0
    } else {
      setCouponError('Invalid promotion index or coupon expired.');
    }
  };

  // Payment execution simulation
  const handlePayAndCheckout = async () => {
    if (!fullName || !addressLine || !phone || !city) {
      setStep('shipping');
      return;
    }
    
    if (!db || !userProfile) {
      logger.error("Database or profile not available");
      return;
    }

    setPaymentLoading(true);

    try {
      // Compute sellerUids (unique list of each cart item's store owner UID)
      const sellerUidsSet = new Set<string>();
      cart.forEach(item => {
        const storeId = item.product.storeId;
        const matchingStore = stores.find(s => s.id === storeId);
        if (matchingStore?.ownerId) {
          sellerUidsSet.add(matchingStore.ownerId);
        }
      });
      const sellerUids = Array.from(sellerUidsSet);

      const generatedOrder: any = {
        items: [...cart],
        subtotalBDT,
        discountAmountBDT,
        deliveryFeeBDT,
        taxAmountBDT,
        grandTotalBDT,
        currency,
        currencySymbol,
        currencyRate,
        shippingAddress: {
          fullName,
          addressLine,
          phone,
          city,
          postalCode
        },
        deliveryMethod: DELIVERIES.find(d => d.id === deliveryType)?.name || 'Standard Ground',
        gateway: selectedGateway,
        createdAt: serverTimestamp(),
        trackingTimeline: [
          { status: 'processing', label: 'Order Processing', date: new Date().toISOString(), desc: 'Verifying payment and routing node parameters.', active: true },
          { status: 'packed', label: 'Staged & Packed', date: '', desc: 'Inventory certified at merchant warehouse.', active: false },
          { status: 'shipped', label: 'Shipped Out', date: '', desc: 'Enroute via air cargo transit node.', active: false },
          { status: 'delivered', label: 'Delivered', date: '', desc: 'Handed over securely to destination receiver.', active: false }
        ],
        currentStatus: 'processing',
        buyerUid: user?.uid || userProfile?.uid || userProfile?.ownerUid || userProfile?.id,
        buyerId: userProfile?.id || user?.uid,
        sellerUid: sellerUids[0] || '',
        sellerUids,
        refundStatus: 'none'
      };

      const orderRef = await addDoc(collection(db, 'orders'), generatedOrder);
      
      // Update with the ID for local state
      const finalOrder = { ...generatedOrder, id: orderRef.id, createdAt: new Date().toISOString() };

      setPlacedOrderInfo(finalOrder);
      onAddOrderToTracking(finalOrder);
      setStep('success');
      onClearCart();
    } catch (error: any) {
      logger.error("Checkout error:", error);
      addToast?.({
        title: "Order Failed",
        message: error?.message || "Could not complete transaction. Please try again.",
        type: "warning"
      });
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
      {/* Header bar */}
      <div className="p-5 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <ShoppingBag className="text-aeirmist-cyan" size={18} />
          <div>
            <h2 className="text-sm font-black font-mono uppercase tracking-wider">Aeirmist Secure Checkout</h2>
            <p className="text-[10px] text-zinc-500 font-mono">End-to-end commerce matrix</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      {/* Checkout Stepper Progress */}
      {step !== 'success' && (
        <div className="bg-zinc-950/60 border-b border-white/[0.03] px-5 py-2.5 flex justify-between text-[10px] font-mono select-none">
          <button 
            onClick={() => setStep('cart')}
            className={`flex items-center gap-1 font-bold ${step === 'cart' ? 'text-aeirmist-cyan' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <span>01. CART SUMMARY</span>
          </button>
          <span className="text-zinc-800">→</span>
          <button 
            onClick={() => { if(cart.length > 0) setStep('shipping'); }}
            className={`flex items-center gap-1 font-bold ${step === 'shipping' ? 'text-aeirmist-cyan' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <span>02. SHIPPING NODE</span>
          </button>
          <span className="text-zinc-800">→</span>
          <button 
            onClick={() => { if(fullName && addressLine) setStep('payment'); }}
            className={`flex items-center gap-1 font-bold ${step === 'payment' ? 'text-aeirmist-cyan' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <span>03. PAYMENT HUB</span>
          </button>
        </div>
      )}

      {/* Body Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {paymentLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-t-2 border-r-2 border-aeirmist-cyan animate-spin" />
              <CreditCard size={24} className="absolute inset-0 m-auto text-aeirmist-cyan animate-pulse" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-bold font-mono text-zinc-300 uppercase tracking-widest">Routing Gateway Transaction</p>
              <p className="text-[10px] text-zinc-500 font-mono">Securing network handshake, please stand by...</p>
            </div>
          </div>
        ) : step === 'cart' ? (
          /* ================= STEP 1: CART LISTING ================= */
          <div className="space-y-6">
            {cart.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <ShoppingBag className="mx-auto text-zinc-800 animate-bounce" size={48} />
                <div className="space-y-1">
                  <p className="text-xs font-mono text-zinc-500">Your secure multi-store cart is currently empty.</p>
                  <p className="text-[10px] text-zinc-650">Select items from the catalog to build your order dispatch.</p>
                </div>
                <button 
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-white/5 text-xs font-bold hover:bg-zinc-850 transition"
                >
                  Return Marketplace
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Store Wise Cart items */}
                {Object.entries(itemsByStore).map(([storeName, items]) => {
                  const store = stores.find(s => s.name === storeName);
                  return (
                    <div key={storeName} className="p-4 bg-zinc-900/40 rounded-2xl border border-white/5 space-y-3.5">
                      <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2">
                        {store?.isVerified && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />}
                        <span className="text-[10px] font-black font-mono tracking-wider text-zinc-300 uppercase">STORE NODE: {storeName}</span>
                      </div>

                    <div className="space-y-3">
                      {items.map(item => {
                        const originalPrice = item.product.price;
                        const finalPrice = item.product.discountPrice || item.product.price;
                        return (
                          <div key={item.product.id} className="flex gap-3 text-xs">
                            <img 
                              src={item.product.mediaItems?.[0]?.url || ''} 
                              className="h-12 w-12 object-cover rounded-xl bg-zinc-950 border border-white/5 shrink-0" 
                              alt="" 
                            />
                            <div className="flex-1 text-left min-w-0">
                              <h4 className="font-extrabold text-white truncate">{item.product.name}</h4>
                              {item.selectedVariant && (
                                <p className="text-[9px] font-mono text-zinc-500 mt-0.5">SPEC: {item.selectedVariant}</p>
                              )}
                              <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-[11px] font-bold text-white">{formatPrice(finalPrice)}</span>
                                {item.product.discountPrice && (
                                  <span className="text-[9px] text-zinc-500 line-through">{formatPrice(originalPrice)}</span>
                                )}
                              </div>
                            </div>

                            {/* Quantity Controllers */}
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center bg-zinc-950 border border-white/5 rounded-xl p-0.5">
                                <button 
                                  onClick={() => onUpdateQuantity(item.product.id, -1)}
                                  className="p-1 text-zinc-500 hover:text-white rounded"
                                >
                                  <Minus size={10} />
                                </button>
                                <span className="px-2 text-[10px] font-mono font-bold w-5 text-center">{item.quantity}</span>
                                <button 
                                  onClick={() => onUpdateQuantity(item.product.id, 1)}
                                  className="p-1 text-zinc-500 hover:text-white rounded"
                                >
                                  <Plus size={10} />
                                </button>
                              </div>
                              <button 
                                onClick={() => onRemoveItem(item.product.id)}
                                className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

                {/* Promotional Coupon Entry */}
                <div className="p-4 bg-zinc-900/20 rounded-2xl border border-white/5 space-y-2">
                  <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Apply Marketplace Promo / Coupon</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                      <input 
                        type="text" 
                        value={couponCode}
                        onChange={e => { setCouponCode(e.target.value); setCouponError(''); }}
                        placeholder="e.g. AEIRMIST25, FREESHIP"
                        className="w-full bg-zinc-950 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-650 focus:outline-none focus:border-white select-text font-mono uppercase"
                      />
                    </div>
                    <button 
                      onClick={handleApplyCoupon}
                      className="px-4 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold font-mono rounded-xl transition cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                  {appliedDiscount && (
                    <p className="text-[10px] text-aeirmist-cyan font-mono flex items-center gap-1">
                      ✓ Active code: <span className="font-bold uppercase underline">{appliedDiscount.code}</span> ({appliedDiscount.percent}% discount applied!)
                    </p>
                  )}
                  {couponError && <p className="text-[10px] text-red-400 font-mono">✗ {couponError}</p>}
                  <div className="pt-1 flex flex-wrap gap-1.5 select-none text-[8.5px] font-mono text-zinc-500">
                    <span>Try:</span>
                    <button onClick={() => setCouponCode('AEIRMIST25')} className="underline hover:text-white">AEIRMIST25 (25% off)</button>
                    <span>•</span>
                    <button onClick={() => setCouponCode('FREESHIP')} className="underline hover:text-white">FREESHIP (Free delivery)</button>
                  </div>
                </div>

                {/* Sub Total Summaries Card */}
                <div className="p-4 bg-zinc-950 border border-white/[0.04] rounded-2xl space-y-3 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Cart Subtotal:</span>
                    <span>{formatPrice(subtotalBDT)}</span>
                  </div>
                  {appliedDiscount && appliedDiscount.percent > 0 && (
                    <div className="flex justify-between text-aeirmist-cyan">
                      <span>Promo Discount ({appliedDiscount.percent}%):</span>
                      <span>-{formatPrice(discountAmountBDT)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-500">
                    <span>Shipping Fee:</span>
                    <span>{deliveryFeeBDT === 0 ? 'FREE' : formatPrice(deliveryFeeBDT)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Taxes &amp; VAT (5%):</span>
                    <span>{formatPrice(taxAmountBDT)}</span>
                  </div>
                  <hr className="border-white/[0.04]" />
                  <div className="flex justify-between text-sm font-extrabold text-white">
                    <span>Est. Grand Total:</span>
                    <span className="text-aeirmist-cyan">{formatPrice(grandTotalBDT)}</span>
                  </div>
                </div>

                <button 
                  onClick={() => setStep('shipping')}
                  className="cursor-pointer w-full py-3.5 bg-white hover:bg-neutral-200 text-black text-xs font-black uppercase rounded-2xl flex items-center justify-center gap-1.5 transition active:scale-98 font-mono tracking-widest shadow-lg shadow-white/5"
                >
                  Proceed to Delivery <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        ) : step === 'shipping' ? (
          <div className="space-y-6 text-left">
            {/* ================= STEP 2: SHIPPING AND DELIVERY ================= */}
            {/* Saved Addresses quick-selector if available */}
            {addresses && addresses.length > 0 && (
              <div className="p-3.5 bg-zinc-900/80 border border-white/10 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={12} className="text-aeirmist-cyan" />
                    Saved Addresses ({addresses.length})
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">Tap to auto-fill</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {addresses.map((addr) => {
                    const isSelected = addressLine.includes(addr.streetAddress);
                    return (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr)}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                          isSelected
                            ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-white'
                            : 'bg-zinc-950/60 border-white/5 text-zinc-300 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-white capitalize">{addr.label}</span>
                          {addr.isDefault && (
                            <span className="text-[8px] font-mono bg-aeirmist-cyan/20 text-aeirmist-cyan px-1.5 py-0.2 rounded font-bold">DEFAULT</span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 truncate">{addr.recipientName || fullName} • {addr.phone || phone}</p>
                        <p className="text-[9px] text-zinc-500 truncate">{addr.streetAddress}, {addr.city}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-3">01. RECIPIENT DETAILS</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-mono text-zinc-400 mb-1">Full Name *</label>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Tasnim Rahman"
                    className="w-full text-xs text-white bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-white select-text"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-zinc-400 mb-1">Contact Phone Number *</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. +880 1712-XXXXXX"
                    className="w-full text-xs text-white bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-white select-text"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[9px] font-mono text-zinc-400">Delivery Address *</label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text" 
                  value={addressLine}
                  onChange={e => setAddressLine(e.target.value)}
                  placeholder="Street details, floor, apartment number..."
                  className="w-full text-xs text-white bg-zinc-900/60 border border-white/10 rounded-xl pl-9 pr-3 py-3 focus:outline-none focus:border-white select-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-mono text-zinc-400 mb-1">City / District *</label>
                  <input 
                    type="text" 
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Dhaka, Chittagong, Sylhet, etc."
                    className="w-full text-xs text-white bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-white select-text"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-zinc-400 mb-1">Postal Zip Code</label>
                  <input 
                    type="text" 
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    placeholder="e.g. 1216"
                    className="w-full text-xs text-white bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-white select-text"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-3 flex items-center gap-1">
                <Truck size={12} /> 02. DELIVERY METHOD
              </p>
              <div className="space-y-2.5 select-none">
                {DELIVERIES.map(option => (
                  <div 
                    key={option.id}
                    onClick={() => setDeliveryType(option.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      deliveryType === option.id 
                        ? 'bg-zinc-900 border-aeirmist-cyan text-white' 
                        : 'bg-zinc-900/30 border-white/5 text-zinc-400 hover:border-white/10'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="h-4 w-4 rounded-full border-2 border-white/20 flex items-center justify-center shrink-0 mt-0.5">
                        {deliveryType === option.id && <div className="h-2 w-2 rounded-full bg-aeirmist-cyan" />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{option.name}</h4>
                        <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{option.desc}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-white">
                      {appliedDiscount?.code === 'FREESHIP' ? 'FREE' : formatPrice(option.fee)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Preview sticky */}
            <div className="flex justify-between items-center p-4 bg-zinc-950 rounded-2xl border border-white/5">
              <div className="text-left font-mono">
                <p className="text-[9px] text-zinc-500">ESTIMATED TOTAL WITH LOGISTICS</p>
                <p className="text-sm font-extrabold text-white">{formatPrice(grandTotalBDT)}</p>
              </div>
              <button 
                onClick={() => {
                  if (fullName.trim() && addressLine.trim() && phone.trim() && city.trim()) {
                    setStep('payment');
                  }
                }}
                disabled={!fullName.trim() || !addressLine.trim() || !phone.trim() || !city.trim()}
                className="px-5 py-3.5 bg-white hover:bg-zinc-200 text-black text-xs font-black uppercase rounded-xl transition font-mono tracking-wider cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
              >
                Choose Payment Method
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 text-left">
            {/* ================= STEP 3: PAYMENT ROUTE HUB ================= */}
            <div>
              <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-3">01. SECURED PAYMENT PROCESSOR</p>
              <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
                {[
                  { id: 'stripe', label: 'Stripe Network' },
                  { id: 'bkash', label: 'bKash Node' },
                  { id: 'nagad', label: 'Nagad Wallet' },
                  { id: 'paypal', label: 'PayPal Global' },
                  { id: 'gpay', label: 'Apple/Google Pay' },
                  { id: 'cod', label: 'Cash on Node' }
                ].map(gw => (
                  <button 
                    key={gw.id}
                    onClick={() => setSelectedGateway(gw.id as any)}
                    className={`py-3 px-2 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      selectedGateway === gw.id 
                        ? 'bg-zinc-900 border-aeirmist-cyan text-white shadow-md' 
                        : 'bg-zinc-900/30 border-white/5 text-zinc-400 hover:border-white/10'
                    }`}
                  >
                    <div className="font-mono text-[10px] uppercase font-black">{gw.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Gateway Forms */}
            <div className="p-4 bg-zinc-900/40 rounded-2xl border border-white/5 space-y-4">
              {selectedGateway === 'stripe' ? (
                <div className="space-y-4 font-mono text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] uppercase font-black text-zinc-400">🔒 SECURE STRIPE CREDIT MODULE</span>
                    <span className="text-[9px] text-zinc-500">PCI-DSS Compliant</span>
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-zinc-400 mb-1">Card Number *</label>
                    <input 
                      type="text" 
                      value={simulatedCardNumber}
                      onChange={e => setSimulatedCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                      placeholder="4111 2222 3333 4444"
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-white select-text font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9.5px] text-zinc-400 mb-1">Expiry Date *</label>
                      <input 
                        type="text" 
                        value={simulatedExpiry}
                        onChange={e => setSimulatedExpiry(e.target.value.slice(0, 5))}
                        placeholder="MM/YY"
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-white select-text font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] text-zinc-400 mb-1">CVV Security Code *</label>
                      <input 
                        type="password" 
                        value={simulatedCvv}
                        onChange={e => setSimulatedCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                        placeholder="***"
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-white select-text font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : selectedGateway === 'bkash' || selectedGateway === 'nagad' ? (
                <div className="space-y-4 font-mono text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] uppercase font-black text-zinc-400">🇧🇩 MOBILE FINANCIAL WALLET</span>
                    <span className="text-[9px] text-zinc-500">Instant API Handshake</span>
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-zinc-400 mb-1">{selectedGateway === 'bkash' ? 'bKash Wallet Number *' : 'Nagad Wallet Number *'}</label>
                    <input 
                      type="text" 
                      value={simulatedBkashNumber}
                      onChange={e => setSimulatedBkashNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="017XXXXXXXX"
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-white select-text font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] text-zinc-400 mb-1">Wallet Verification PIN *</label>
                    <input 
                      type="password" 
                      value={simulatedBkashPin}
                      onChange={e => setSimulatedBkashPin(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      placeholder="*****"
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-white select-text font-mono"
                    />
                  </div>
                </div>
              ) : selectedGateway === 'paypal' ? (
                <div className="py-4 text-center font-mono text-xs text-zinc-400">
                  <p className="font-extrabold uppercase text-white mb-2">PayPal Checkout Gateway</p>
                  <p className="text-[10px] leading-relaxed max-w-sm mx-auto">Clicking &quot;Authorize Order&quot; will authorize a secure sandbox transaction under your connected PayPal billing email.</p>
                </div>
              ) : selectedGateway === 'gpay' ? (
                <div className="py-4 text-center font-mono text-xs text-zinc-400">
                  <p className="font-extrabold uppercase text-white mb-2">Google/Apple Pay Checkout</p>
                  <p className="text-[10px] leading-relaxed max-w-sm mx-auto">Automatically retrieves secure device tokens from system keys upon confirming.</p>
                </div>
              ) : (
                <div className="py-4 text-center font-mono text-xs text-zinc-400">
                  <p className="font-extrabold uppercase text-white mb-2">Cash on Delivery / Node Collection</p>
                  <p className="text-[10px] leading-relaxed max-w-sm mx-auto">Pay locally at your shipping coordinate address when courier completes verification routing.</p>
                </div>
              )}
            </div>

            {/* Verification and Pay CTA */}
            <div className="p-4 bg-zinc-950 border border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="font-mono text-left">
                <p className="text-[9px] text-zinc-500">SECURE PAYMENT DISPATCH TOTAL</p>
                <p className="text-sm font-extrabold text-white">{formatPrice(grandTotalBDT)}</p>
              </div>
              <button 
                onClick={handlePayAndCheckout}
                className="px-5 py-3.5 bg-gradient-to-r from-aeirmist-cyan to-indigo-500 hover:from-white hover:to-white hover:text-black text-white text-xs font-black uppercase rounded-xl transition font-mono tracking-wider cursor-pointer active:scale-95 shadow-lg shadow-indigo-500/10 shrink-0"
              >
                🔒 Authorize Secure Order
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= STEP 4: SUCCESS RECEIPT MODAL ================= */}
      <AnimatePresence>
        {step === 'success' && placedOrderInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-zinc-950 z-50 flex flex-col overflow-y-auto no-scrollbar"
          >
            <div className="p-6 text-center space-y-6 max-w-lg mx-auto my-auto">
              <div className="h-16 w-16 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-center mx-auto text-aeirmist-cyan animate-bounce">
                <CheckCircle2 size={32} />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-white font-mono uppercase tracking-wide">Order Placed Successfully</h3>
                <p className="text-[10px] text-aeirmist-cyan font-mono">Your order has been sent to the seller!</p>
              </div>

              {/* Printable High Fidelity Digital Receipt */}
              <div className="bg-zinc-900/60 rounded-3xl border border-white/5 p-5 text-left font-mono text-[10.5px] text-zinc-350 space-y-4 shadow-inner relative">
                <div className="flex justify-between items-start border-b border-white/[0.04] pb-3">
                  <div>
                    <h4 className="text-white font-black uppercase">AEIRMIST COMMERCE INVOICE</h4>
                    <p className="text-[8.5px] text-zinc-500 mt-0.5">EST. TRANSACTION DATE: {new Date(placedOrderInfo.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="text-xs text-white font-black bg-white/5 py-1 px-2.5 rounded-lg border border-white/5">{placedOrderInfo.id}</span>
                </div>

                <div className="space-y-1.5 border-b border-white/[0.04] pb-3">
                  <p className="text-[9px] text-zinc-500 uppercase font-black">Receiver Address Dispatch</p>
                  <p className="text-white font-bold">{placedOrderInfo.shippingAddress.fullName}</p>
                  <p className="text-zinc-400">{placedOrderInfo.shippingAddress.addressLine}</p>
                  <p className="text-zinc-400">{placedOrderInfo.shippingAddress.city}, {placedOrderInfo.shippingAddress.postalCode}</p>
                  <p className="text-zinc-400">PHONE: {placedOrderInfo.shippingAddress.phone}</p>
                </div>

                <div className="space-y-2 border-b border-white/[0.04] pb-3">
                  <p className="text-[9px] text-zinc-500 uppercase font-black">Dispensation Items Summary</p>
                  {placedOrderInfo.items.map((item: any) => (
                    <div key={item.product.id} className="flex justify-between text-zinc-300">
                      <span className="truncate max-w-[250px]">{item.product.name} (x{item.quantity})</span>
                      <span>{formatPrice(item.product.discountPrice || item.product.price)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 text-zinc-400">
                  <div className="flex justify-between">
                    <span>Base Subtotal:</span>
                    <span>{formatPrice(placedOrderInfo.subtotalBDT)}</span>
                  </div>
                  {placedOrderInfo.discountAmountBDT > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Promo Discount Coupon:</span>
                      <span>-{formatPrice(placedOrderInfo.discountAmountBDT)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Shipping fee:</span>
                    <span>{placedOrderInfo.deliveryFeeBDT === 0 ? 'FREE' : formatPrice(placedOrderInfo.deliveryFeeBDT)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT (5%):</span>
                    <span>{formatPrice(placedOrderInfo.taxAmountBDT)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-black text-white pt-1.5 border-t border-white/[0.03]">
                    <span className="text-zinc-300">Final Charged Matrix:</span>
                    <span className="text-aeirmist-cyan">{formatPrice(placedOrderInfo.grandTotalBDT)}</span>
                  </div>
                </div>

                <div className="flex justify-between text-[8px] text-zinc-500 pt-1">
                  <span>METHOD: {placedOrderInfo.gateway.toUpperCase()} GATEWAY</span>
                  <span>DELIVERY: {placedOrderInfo.deliveryMethod.toUpperCase()}</span>
                </div>

                {/* Decorative cut details */}
                <div className="absolute -bottom-1 left-4 right-4 h-1 border-t-2 border-dashed border-zinc-800" />
              </div>

              {/* Action utilities */}
              <div className="flex flex-col sm:flex-row gap-2 select-none font-mono">
                <button 
                  onClick={() => window.print()}
                  className="flex-1 py-3 border border-white/5 bg-zinc-900 hover:bg-zinc-850 rounded-xl text-xs font-bold text-zinc-350 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer size={13} /> Print Invoice
                </button>
                <button 
                  onClick={() => {
                    setStep('cart');
                    onClose();
                  }}
                  className="flex-1 py-3 bg-white text-black hover:bg-neutral-200 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Return Node <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
