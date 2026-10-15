export interface MarketplaceAddress {
  id: string;
  label: string;
  recipientName?: string;
  phone?: string;
  streetAddress: string;
  apartment?: string;
  district?: string;
  city: string;
  postalCode?: string;
  isDefault?: boolean;
}

export interface MarketplaceProfile {
  displayName?: string;
  phone?: string;
  email?: string;
}

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  username: string;
  logo: string;
  cover: string;
  description: string;
  category: string;
  contactInfo: string;
  phone?: string;
  email?: string;
  contactPreference?: 'phone' | 'whatsapp' | 'email' | 'chat' | string;
  division?: string;
  district?: string;
  area?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  location?: string;
  openingHours?: string;
  deliveryAvailable?: boolean;
  pickupAvailable?: boolean;
  status?: 'draft' | 'active' | 'suspended' | 'archived';
  websiteUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  whatsappUrl?: string;
  telegramUrl?: string;
  youtubeUrl?: string;
  followers?: string[]; // Array of user profile IDs
  productsCount?: number;
  avgRating?: number;
  totalReviews?: number;
  isVerified?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface ProductMediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
}

export interface Product {
  id: string;
  storeId: string;
  storeName: string;
  storeLogo: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  category: string;
  stockStatus: 'available' | 'out_of_stock';
  variants?: string[]; // List of variants, e.g. ["128GB", "256GB"] or ["Red", "Blue"]
  tags?: string[];
  mediaItems: ProductMediaItem[];
  isVerified?: boolean;
  createdAt?: any;
}

export interface StorePost {
  id: string;
  storeId: string;
  storeName: string;
  storeLogo: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  likesCount?: number;
  likedBy?: string[];
  commentsCount?: number;
  isVerified?: boolean;
  createdAt?: any;
}

export interface Service {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar?: string;
  title: string;
  description: string;
  pricing: string; // e.g., "From ৳5,000"
  portfolioUrls: string[]; // Portfolio photos/videos
  contactEmail?: string;
  contactPhone?: string;
  whatsappUrl?: string;
  category: string;
  createdAt?: any;
}

export interface StoreReview {
  id: string;
  storeId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number; // 1-5
  comment: string;
  reply?: string; // owner response
  verified?: boolean;
  createdAt?: any;
}

export interface StoreChat {
  id: string;
  storeId: string;
  storeName: string;
  storeLogo?: string;
  customerId: string;
  customerName: string;
  customerAvatar: string;
  lastMessage: any;
  lastMessageAt: any;
  chatCategory: 'personal' | 'store' | 'support';
  productContext?: {
    id: string;
    name: string;
    price: number;
    thumb: string;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

export interface Order {
  id: string;
  buyerId: string;
  sellerUids: string[]; // owner UIDs of every store involved, denormalized at creation for security rules
  items: any[];
  subtotalBDT: number; 
  discountAmountBDT: number; 
  deliveryFeeBDT: number; 
  taxAmountBDT: number; 
  grandTotalBDT: number;
  currency: string; 
  currencySymbol: string; 
  currencyRate: number;
  shippingAddress: { 
    fullName: string; 
    addressLine: string; 
    phone: string; 
    city: string; 
    postalCode: string 
  };
  deliveryMethod: string;
  gateway: string;
  createdAt: any;
  trackingTimeline: { 
    status: string; 
    label: string; 
    date: string; 
    desc: string; 
    active: boolean 
  }[];
  currentStatus: 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  refundStatus?: 'none' | 'requested' | 'approved' | 'rejected';
  refundReason?: string;
}

// Global Categories Config
export const MARKETPLACE_CATEGORIES = [
  { id: 'Electronics', label: 'Electronics', icon: 'Laptop' },
  { id: 'Fashion', label: 'Fashion', icon: 'Shirt' },
  { id: 'Beauty', label: 'Beauty & Health', icon: 'Sparkles' },
  { id: 'Food', label: 'Food & Groceries', icon: 'Pizza' },
  { id: 'Furniture', label: 'Furniture & Decor', icon: 'Sofa' },
  { id: 'Automotive', label: 'Automotive', icon: 'Car' },
  { id: 'Digital Products', label: 'Digital Products', icon: 'FileCode' },
  { id: 'Services', label: 'Services', icon: 'Briefcase' },
  { id: 'Home & Living', label: 'Home & Living', icon: 'Home' },
  { id: 'Books', label: 'Books & Stationery', icon: 'BookOpen' },
  { id: 'Sports', label: 'Sports & Fitness', icon: 'Dumbbell' }
];

// Rich Seed Data to guarantee a gorgeous display when no records exist
export const SEED_STORES: Store[] = [
  {
    id: 'store_seed_1',
    ownerId: 'seed_user_1',
    name: 'Jim Electronics',
    username: 'jimelectronics',
    logo: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=150&q=80',
    cover: 'https://images.unsplash.com/photo-1468495244122-c300e423b47b?auto=format&fit=crop&w=1200&q=80',
    description: 'Premier retail and bulk destination for flagship electronics, verified hardware, and pristine smart devices. Elevating your tech arsenal.',
    category: 'Electronics',
    contactInfo: '01712-345678 | info@jimelectronics.com',
    location: 'Mirpur-10, Dhaka, Bangladesh',
    websiteUrl: 'https://jimelectronics.com',
    facebookUrl: 'https://facebook.com/jimelectronics',
    instagramUrl: 'https://instagram.com/jimelectronics',
    whatsappUrl: 'https://wa.me/8801712345678',
    telegramUrl: 'https://t.me/jimelectronics',
    followers: ['user_follower_1', 'user_follower_2']
  },
  {
    id: 'store_seed_2',
    ownerId: 'seed_user_2',
    name: 'Fashion Hub',
    username: 'fashionhub',
    logo: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=150&q=80',
    cover: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
    description: 'Minimalist contemporary aesthetics and comfortable premium materials. Designed for creators with a curated edge.',
    category: 'Fashion',
    contactInfo: '01811-987654 | sales@fashionhub.com',
    location: 'Banani, Road 11, Dhaka',
    instagramUrl: 'https://instagram.com/fashionhubhub',
    whatsappUrl: 'https://wa.me/8801811987654',
    followers: ['user_follower_3']
  }
];

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'prod_seed_1',
    storeId: 'store_seed_1',
    storeName: 'Jim Electronics',
    storeLogo: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=150&q=80',
    name: 'Apple iPhone 15 Pro Max 256GB',
    description: 'Prismatic titanium flagship featuring custom Dynamic Island, A17 Pro Bionic, 5x telephoto lens. Official factory unlocked with international warranty.',
    price: 142000,
    discountPrice: 136000,
    category: 'Electronics',
    stockStatus: 'available',
    variants: ['Natural Titanium', 'Blue Titanium', 'Black Titanium'],
    tags: ['Dhaka, Gulshan', 'iphone', 'mobile', 'apple'],
    isVerified: true,
    mediaItems: [
      { id: 'm1', type: 'image', url: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=600&q=80' },
      { id: 'm2', type: 'image', url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  {
    id: 'prod_seed_2',
    storeId: 'store_seed_2',
    storeName: 'Fashion Hub',
    storeLogo: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=150&q=80',
    name: 'Nike Air Jordan 1 Retro High OG',
    description: 'Iconic Chicago colorway crafted from premium leather, padded high-cut collar, and classic Air-Sole heel unit.',
    price: 16500,
    discountPrice: 14200,
    category: 'Fashion',
    stockStatus: 'available',
    variants: ['US 8.5', 'US 9', 'US 10', 'US 11'],
    tags: ['Banani, Dhaka', 'shoes', 'sneakers', 'nike'],
    isVerified: true,
    mediaItems: [
      { id: 'm3', type: 'image', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  {
    id: 'prod_seed_3',
    storeId: 'store_seed_3',
    storeName: 'MotoZone BD',
    storeLogo: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=150&q=80',
    name: 'Yamaha MT-15 V2 Dual ABS (2024)',
    description: '155cc liquid-cooled 4V SOHC engine, Variable Valve Actuation (VVA), inverted front forks and Bluetooth Y-Connect integration.',
    price: 435000,
    discountPrice: 420000,
    category: 'Automotive',
    stockStatus: 'available',
    variants: ['Cyan Storm', 'Metallic Black', 'Racing Blue'],
    tags: ['Mirpur, Dhaka', 'bike', 'motorcycle', 'yamaha'],
    isVerified: true,
    mediaItems: [
      { id: 'm4', type: 'image', url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  {
    id: 'prod_seed_4',
    storeId: 'store_seed_1',
    storeName: 'Jim Electronics',
    storeLogo: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=150&q=80',
    name: 'MacBook Pro 14" M3 Pro (18GB/512GB)',
    description: 'Stunning Liquid Retina XDR display, up to 22 hours of battery life, and powerful Pro-tier silicon for demanding creative workflows.',
    price: 215000,
    discountPrice: 198000,
    category: 'Electronics',
    stockStatus: 'available',
    variants: ['Space Black', 'Silver'],
    tags: ['Dhanmondi, Dhaka', 'macbook', 'laptop', 'apple'],
    isVerified: true,
    mediaItems: [
      { id: 'm5', type: 'image', url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  {
    id: 'prod_seed_5',
    storeId: 'store_seed_4',
    storeName: 'Optics Pro Studio',
    storeLogo: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=150&q=80',
    name: 'Sony Alpha A7 IV Mirrorless Camera (Body)',
    description: '33MP full-frame Exmor R CMOS sensor, 4K 60p 10-bit recording, and next-gen AI real-time autofocus for video and stills.',
    price: 235000,
    discountPrice: 220000,
    category: 'Electronics',
    stockStatus: 'available',
    variants: ['Body Only', 'With 28-70mm Lens'],
    tags: ['Uttara, Dhaka', 'camera', 'sony', 'photography'],
    isVerified: true,
    mediaItems: [
      { id: 'm6', type: 'image', url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  {
    id: 'prod_seed_6',
    storeId: 'store_seed_5',
    storeName: 'Nordic Living BD',
    storeLogo: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=150&q=80',
    name: 'Ergonomic Mesh Office Chair & Standing Desk',
    description: 'High-density breathable mesh backrest, adjustable 3D lumbar support, and dual-motor motorized height adjustment desk.',
    price: 32000,
    discountPrice: 27500,
    category: 'Furniture',
    stockStatus: 'available',
    variants: ['Matte Black', 'Minimal Gray'],
    tags: ['Chittagong', 'furniture', 'chair', 'desk'],
    isVerified: true,
    mediaItems: [
      { id: 'm7', type: 'image', url: 'https://images.unsplash.com/photo-1580481077197-0f81d1143899?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  {
    id: 'prod_seed_7',
    storeId: 'store_seed_2',
    storeName: 'Fashion Hub',
    storeLogo: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=150&q=80',
    name: 'Premium Italian Biker Leather Jacket',
    description: '100% genuine supple lambskin leather, asymmetric heavy-duty silver zip closures, and quilted thermal inner lining.',
    price: 14500,
    discountPrice: 11900,
    category: 'Fashion',
    stockStatus: 'available',
    variants: ['M', 'L', 'XL'],
    tags: ['Sylhet', 'jacket', 'leather', 'fashion'],
    isVerified: true,
    mediaItems: [
      { id: 'm8', type: 'image', url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  {
    id: 'prod_seed_8',
    storeId: 'store_seed_1',
    storeName: 'Jim Electronics',
    storeLogo: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=150&q=80',
    name: 'Keychron Q1 Pro Wireless Mechanical Keyboard',
    description: 'Full aluminum CNC body, custom Gateron Jupiter switches, double-shot PBT keycaps, and hot-swappable PCB.',
    price: 21000,
    discountPrice: 18500,
    category: 'Electronics',
    stockStatus: 'available',
    variants: ['Red Switches', 'Brown Switches'],
    tags: ['Dhaka, Banani', 'keyboard', 'keychron', 'tech'],
    isVerified: true,
    mediaItems: [
      { id: 'm9', type: 'image', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80' }
    ]
  }
];

export const SEED_SERVICES: Service[] = [
  {
    id: 'srv_seed_1',
    ownerId: 'seed_user_3',
    ownerName: 'Tanvir Rahman',
    ownerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    title: 'Minimal Brand Architecture & Identity Design',
    description: 'Transforming businesses with custom geometric logo sets, robust design systems, type rules, and vector guidelines for packaging.',
    pricing: 'From ৳25,000',
    portfolioUrls: [
      'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=500&q=80',
      'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=500&q=80'
    ],
    contactEmail: 'tanvir@fashiondesigns.com',
    contactPhone: '01912-112233',
    whatsappUrl: 'https://wa.me/8801912112233',
    category: 'Services'
  }
];

export const SEED_STORE_POSTS: StorePost[] = [
  {
    id: 'post_seed_1',
    storeId: 'store_seed_2',
    storeName: 'Fashion Hub',
    storeLogo: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=150&q=80',
    content: '🍂 New Autumn Drop launching tonight! Use code FASHION15 for early-bird reservation slots on our Sandstone Series. Limited run sizes.',
    mediaUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80',
    mediaType: 'image',
    likesCount: 34,
    commentsCount: 3
  }
];

export const SEED_STORE_REVIEWS: StoreReview[] = [
  {
    id: 'rev_seed_1',
    storeId: 'store_seed_1',
    userId: 'reviewer_1',
    userName: '@nabil_khan',
    userAvatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=100&q=80',
    rating: 5,
    comment: 'Authentic iPhone 15 Pro received. Verified the serial. Store owner Jim is highly cooperative and the warranty terms are super clear.',
    reply: 'Thank you Nabil! Pleased to deliver genuine service.',
    createdAt: new Date().toISOString()
  }
];
