import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Camera, ImageIcon, Video, Palette, Sparkles, Music, 
  RefreshCw, Settings, Search, Check, Plus, Trash, Undo, Redo,
  Sliders, Crop, Type, Smile, Paintbrush, Play, Pause, Download,
  AlignLeft, AlignCenter, AlignRight, Eraser, Circle,
  Layers, ZoomIn, ZoomOut, Eye, Volume2, VolumeX, Maximize2, Minimize2, Flashlight, Save, FolderHeart, 
  Image as LucideImage, UploadCloud, Info, Sparkle, Timer, Loader2, Ghost,
  MapPin, HelpCircle, Clock, Link as LucideLink, Heart, LayoutGrid, ImagePlus, Hash,
  Send, AtSign, MoreHorizontal, ChevronLeft, ChevronRight, ChevronDown,
  Globe, Users, Shield
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';
import { analytics } from '../../services/AnalyticsService';
import { MediaQuality } from '../../services/MediaService';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import { MusicSearchModal } from '../music/MusicSearchModal';
import { logger } from '@/src/utils/logger';


// Mock songs
const SOUNDTRACKS = [
  { id: '1', title: 'Solar Wind', artist: 'Aeirmist Connections', duration: '2:14' },
  { id: '2', title: 'Night Drift', artist: 'Night Stream', duration: '3:05' },
  { id: '3', title: 'Luminous Void', artist: 'Message Engine', duration: '1:58' },
  { id: '4', title: 'Neon Horizon', artist: 'Tokyo Voyager', duration: '2:40' },
  { id: '5', title: 'Atmosphere Zero', artist: 'Suborbital Echo', duration: '3:12' }
];

// Stickers data
const STICKERS = [
  { id: 'mention_tool', type: 'mention', content: 'Mention User', category: 'Mention' },
  { id: 'hashtag_tool', type: 'hashtag', content: 'Add Hashtag', category: 'Hashtag' },
  { id: 'quiz_tool', type: 'quiz', content: 'Add Quiz', category: 'Quiz' },
  { id: 'qbox_tool', type: 'question', content: 'Question Box', category: 'Questions' },
  { id: 'countdown_tool', type: 'countdown', content: 'Countdown', category: 'Time' },
  { id: 'slider_tool', type: 'slider', content: 'Emoji Slider', category: 'Engagement' },
  { id: 'link_tool', type: 'link', content: 'Link', category: 'Utility' },
  { id: 'location_tool', type: 'location', content: 'Add Location', category: 'Location' },
  { id: 'poll1', type: 'poll', content: 'Simulation active?', category: 'Poll' },
  { id: 'giphy_tool', type: 'gif', content: 'Search GIFs', category: 'GIF' },
  { id: 'music_sticker_tool', type: 'music', content: 'Add Music', category: 'Music' },
  { id: 'q1', type: 'question', content: 'Ask me anything...', category: 'Questions' },
  { id: 'gif2', type: 'gif', content: '✨', category: 'GIF' },
  { id: 'gif3', type: 'gif', content: '⚡', category: 'GIF' },
  { id: 'gif4', type: 'gif', content: '💖', category: 'GIF' },
  { id: 'gif5', type: 'gif', content: '💯', category: 'GIF' },
  { id: 'emoji1', type: 'emoji', content: '👾', category: 'Emoji' },
  { id: 'emoji2', type: 'emoji', content: '🚀', category: 'Emoji' },
  { id: 'emoji3', type: 'emoji', content: '😎', category: 'Emoji' },
  { id: 'emoji4', type: 'emoji', content: '🌙', category: 'Emoji' },
  { id: 'emoji5', type: 'emoji', content: '🎨', category: 'Emoji' },
  { id: 'cd1', type: 'countdown', content: 'Next Connections', category: 'Countdown' },
  { id: 'lnk1', type: 'link', content: 'aeirmist.com', category: 'Link' }
];

const BG_GRADIENTS = [
  'bg-gradient-to-tr from-[#01050a] to-[#0b1623]',
  'bg-gradient-to-tr from-[#3a0ca3] to-[#c77dff]',
  'bg-gradient-to-tr from-[#121330] to-[#ff007f]',
  'bg-gradient-to-tr from-[#f72585] to-[#7209b7]',
  'bg-gradient-to-tr from-[#03001e] via-[#7303c0] to-[#ec38bc]',
  'bg-[#080808]',
  'bg-[#1e1e24]',
  'bg-gradient-to-tr from-emerald-500 to-teal-900'
];

const SIMULATION_ASSETS = {
  all: {
    images: [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1080&q=80'
    ],
    videos: [
      'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4',
      'https://assets.mixkit.co/videos/preview/mixkit-futuristic-subway-station-with-neon-lights-44246-large.mp4'
    ]
  },
  cosmos: {
    images: [
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1080&q=80'
    ],
    videos: [
      'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-background-1611-large.mp4'
    ]
  },
  cyberpunk: {
    images: [
      'https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1080&q=80'
    ],
    videos: [
      'https://assets.mixkit.co/videos/preview/mixkit-futuristic-subway-station-with-neon-lights-44246-large.mp4'
    ]
  },
  nature: {
    images: [
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=1080&q=80'
    ],
    videos: [
      'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4'
    ]
  },
  retro: {
    images: [
      'https://images.unsplash.com/photo-1533158326339-7f3cf2404354?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1520038410233-7141be7e6f97?auto=format&fit=crop&w=1080&q=80',
      'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1080&q=80'
    ],
    videos: [
      'https://assets.mixkit.co/videos/preview/mixkit-damaged-vhs-tape-playing-41604-large.mp4'
    ]
  }
};

const ALBUM_IMAGES = {
  recents: [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=600&q=85'
  ],
  camera: [
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?auto=format&fit=crop&w=600&q=85'
  ],
  downloads: [
    'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1515462277126-270d878326e5?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=85',
    'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=600&q=85'
  ]
};

const STORY_TEMPLATES_DATA = [
  {
    id: 'aura_horizon',
    label: 'Neon Horizon',
    bg: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=600&q=85',
    textLayers: [
      {
        id: 'tmpl_txt_1',
        text: 'Connections',
        x: 60,
        y: 120,
        font: 'serif' as const,
        color: '#c77dff',
        align: 'center' as const,
        bg: 'none' as const,
        size: 32,
        opacity: 1,
        shadow: true,
        animation: 'fade' as const
      }
    ],
    stickerLayers: [
      {
        id: 'tmpl_stk_1',
        type: 'location',
        content: 'Metropolitan Area',
        x: 110,
        y: 220,
        scale: 1,
        rotation: 0,
        zIndex: 1
      },
      {
        id: 'tmpl_stk_2',
        type: 'poll',
        content: 'Simulation active?',
        x: 100,
        y: 350,
        scale: 1,
        rotation: 0,
        zIndex: 2,
        extraData: { option1: 'Yes', option2: 'No' }
      }
    ]
  },
  {
    id: 'solar_drift',
    label: 'Solar Drift',
    bg: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=85',
    textLayers: [
      {
        id: 'tmpl_txt_2',
        text: 'SOLAR WIND',
        x: 80,
        y: 150,
        font: 'condensed' as const,
        color: '#ffb703',
        align: 'center' as const,
        bg: 'solid' as const,
        size: 36,
        opacity: 0.9,
        shadow: true,
        animation: 'slide' as const
      }
    ],
    stickerLayers: [
      {
        id: 'tmpl_stk_3',
        type: 'countdown',
        content: 'System Launch',
        x: 80,
        y: 300,
        scale: 1,
        rotation: 0,
        zIndex: 1,
        extraData: { date: new Date(Date.now() + 86400000 * 3).toISOString() }
      }
    ]
  },
  {
    id: 'cyberpunk_pulse',
    label: 'Night Drift',
    bg: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=85',
    textLayers: [
      {
        id: 'tmpl_txt_3',
        text: 'SYNCED',
        x: 50,
        y: 140,
        font: 'mono' as const,
        color: '#00f2ff',
        align: 'center' as const,
        bg: 'highlight' as const,
        size: 28,
        opacity: 1,
        shadow: true,
        animation: 'typewriter' as const
      }
    ],
    stickerLayers: [
      {
        id: 'tmpl_stk_4',
        type: 'hashtag',
        content: 'cyberpunk',
        x: 130,
        y: 250,
        scale: 1.1,
        rotation: -4,
        zIndex: 1
      },
      {
        id: 'tmpl_stk_5',
        type: 'slider',
        content: 'Vibe check?',
        x: 80,
        y: 400,
        scale: 1,
        rotation: 0,
        zIndex: 2,
        extraData: { emoji: '⚡' }
      }
    ]
  },
  {
    id: 'cozy_mornings',
    label: 'Daily Message',
    bg: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=85',
    textLayers: [
      {
        id: 'tmpl_txt_4',
        text: 'COZY MORNINGS',
        x: 60,
        y: 130,
        font: 'sans' as const,
        color: '#ffffff',
        align: 'center' as const,
        bg: 'none' as const,
        size: 30,
        opacity: 1,
        shadow: true,
        animation: 'none' as const
      }
    ],
    stickerLayers: [
      {
        id: 'tmpl_stk_6',
        type: 'question',
        content: 'Ask me anything...',
        x: 80,
        y: 280,
        scale: 1,
        rotation: 2,
        zIndex: 1
      }
    ]
  }
];

interface PhotoLayer {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  zIndex: number;
  aspectRatio: number;
  file?: File;
}

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  font: 'sans' | 'serif' | 'script' | 'mono' | 'condensed';
  color: string;
  align: 'left' | 'center' | 'right';
  bg: 'none' | 'solid' | 'highlight';
  size: number;
  opacity: number;
  shadow: boolean;
  animation: 'none' | 'fade' | 'slide' | 'typewriter';
}

const STORY_FONTS = [
  { id: 'sans', name: 'Bold Sans', family: "'Inter', sans-serif", weight: '900' },
  { id: 'serif', name: 'Elegant Serif', family: "'Playfair Display', serif", weight: '700' },
  { id: 'script', name: 'Handwritten', family: "'Dancing Script', cursive", weight: '700' },
  { id: 'mono', name: 'Typewriter', family: "'Courier Prime', monospace", weight: '400' },
  { id: 'condensed', name: 'Condensed', family: "'Bebas Neue', sans-serif", weight: '400' }
];

const STORY_ANIMATIONS = [
  { id: 'none', name: 'Static' },
  { id: 'fade', name: 'Fade In' },
  { id: 'slide', name: 'Slide Up' },
  { id: 'typewriter', name: 'Typewriter' }
];

const STORY_FILTERS = [
  { id: 'none', name: 'Normal', filter: 'none' },
  { id: 'vivid', name: 'Vivid', filter: 'saturate(1.4) contrast(1.1) brightness(1.05)' },
  { id: 'noir', name: 'B&W', filter: 'grayscale(1) contrast(1.2) brightness(0.9)' },
  { id: 'warm', name: 'Warm', filter: 'sepia(0.3) saturate(1.2) hue-rotate(-10deg) brightness(1.05)' },
  { id: 'cool', name: 'Cool', filter: 'hue-rotate(180deg) saturate(0.8) contrast(1.1) brightness(1.1)' },
  { id: 'vintage', name: 'Vintage', filter: 'sepia(0.5) contrast(0.9) brightness(1.1) saturate(0.8)' },
  { id: 'high-contrast', name: 'High Contrast', filter: 'contrast(1.5) saturate(1.2) brightness(0.9)' },
  { id: 'soft-glow', name: 'Soft Glow', filter: 'brightness(1.1) contrast(0.9) saturate(0.8) blur(0.5px)' }
];

interface StickerLayer {
  id: string;
  type: string;
  content: string;
  x: number;
  y: number;
  scale: number;
  mentionId?: string;
  pollData?: {
    question: string;
    options: { label: string; votes: string[] }[];
  };
  quizData?: {
    question: string;
    options: string[];
    correctIndex: number;
    responses: { [uid: string]: number };
  };
  questionBoxData?: {
    prompt: string;
    showAttribution: boolean;
  };
  countdownData?: {
    title: string;
    targetDate: string;
  };
  sliderData?: {
    prompt: string;
    emoji: string;
    responses: { [uid: string]: number };
  };
  linkData?: {
    url: string;
    label: string;
  };
  musicData?: {
    song: any;
    startTime: number;
    duration: number;
  };
}

type LayoutTemplate = 'split-v' | 'split-h' | 'l-shape' | 'grid-4' | 'large-2-small';

interface LayoutSlot {
  id: string;
  media: { url: string; type: 'image' | 'video'; file?: File } | null;
}

interface DrawingPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  brushSize: number;
  brushType: 'marker' | 'neon' | 'highlighter' | 'eraser';
}

interface GiphyResult {
  id: string;
  url: string;
  title: string;
}

const BoomerangPlayer = ({ frames }: { frames: string[] }) => {
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    if (frames.length === 0) return;
    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, 60);
    return () => clearInterval(interval);
  }, [frames]);

  return (
    <img 
      src={frames[currentFrame]} 
      className="w-full h-full object-cover" 
      alt="Boomerang" 
    />
  );
};

interface PhotoLayerComponentProps {
  layer: PhotoLayer;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  updatePhotoLayer: (id: string, updates: Partial<PhotoLayer>) => void;
  deletePhotoLayer: (id: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  setIsDraggingAny: (val: boolean) => void;
  setIsOverTrash: (val: boolean) => void;
  checkIfOverTrash: (x: number, y: number) => boolean;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

const PhotoLayerComponent: React.FC<PhotoLayerComponentProps> = ({
  layer,
  selectedLayerId,
  setSelectedLayerId,
  updatePhotoLayer,
  deletePhotoLayer,
  containerRef,
  setIsDraggingAny,
  setIsOverTrash,
  checkIfOverTrash,
  onContextMenu
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const isSelected = selectedLayerId === layer.id;
  const [isDragging, setIsDragging] = useState(false);

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startScale = layer.scale;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const dx = currentX - startX;
      const dy = currentY - startY;

      const delta = (dx + dy) / 150;
      const newScale = Math.max(0.15, Math.min(6, startScale + delta));
      updatePhotoLayer(layer.id, { scale: newScale });
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  const handleRotateStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!elementRef.current) return;
    const rect = elementRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const dx = currentX - centerX;
      const dy = currentY - centerY;

      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      angle = angle + 90;
      updatePhotoLayer(layer.id, { rotation: angle });
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.stopPropagation();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const initialDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const initialScale = layer.scale;

      const initialAngle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX) * (180 / Math.PI);
      const initialRotation = layer.rotation;

      const handleTouchMove = (moveEvent: TouchEvent) => {
        if (moveEvent.touches.length === 2) {
          moveEvent.preventDefault();
          const t1 = moveEvent.touches[0];
          const t2 = moveEvent.touches[1];

          const currentDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          const scaleFactor = currentDistance / initialDistance;
          const newScale = Math.max(0.15, Math.min(6, initialScale * scaleFactor));

          const currentAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
          const angleDiff = currentAngle - initialAngle;
          const newRotation = initialRotation + angleDiff;

          updatePhotoLayer(layer.id, { scale: newScale, rotation: newRotation });
        }
      };

      const handleTouchEnd = () => {
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };

      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isSelected) return;
    e.preventDefault();
    const scaleDelta = e.deltaY < 0 ? 0.05 : -0.05;
    const newScale = Math.max(0.15, Math.min(6, layer.scale + scaleDelta));
    updatePhotoLayer(layer.id, { scale: newScale });
  };

  return (
    <motion.div
      ref={elementRef}
      drag
      dragMomentum={false}
      dragConstraints={containerRef}
      dragElastic={0.1}
      onDragStart={() => {
        setSelectedLayerId(layer.id);
        setIsDraggingAny(true);
        setIsDragging(true);
      }}
      onDrag={(e, info) => {
        const over = checkIfOverTrash(info.point.x, info.point.y);
        setIsOverTrash(over);
      }}
      onDragEnd={(e, info) => {
        setIsDraggingAny(false);
        setIsDragging(false);
        const over = checkIfOverTrash(info.point.x, info.point.y);
        setIsOverTrash(false);

        if (over) {
          deletePhotoLayer(layer.id);
        } else {
          updatePhotoLayer(layer.id, {
            x: layer.x + info.offset.x,
            y: layer.y + info.offset.y
          });
        }
      }}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
      onContextMenu={(e) => onContextMenu(e, layer.id)}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedLayerId(layer.id);
      }}
      animate={isDragging ? undefined : { x: layer.x, y: layer.y }}
      transition={{ x: { duration: 0 }, y: { duration: 0 } }}
      style={{
        left: 0,
        top: 0,
        width: `${layer.width}px`,
        height: `${layer.height}px`,
        scale: layer.scale,
        rotate: `${layer.rotation}deg`,
        zIndex: layer.zIndex
      }}
      className={`absolute select-none cursor-grab active:cursor-grabbing rounded-lg overflow-visible ${
        isSelected ? 'ring-2 ring-aeirmist-cyan ring-offset-2 ring-offset-black/20' : ''
      }`}
    >
      <img
        src={layer.url}
        alt="Photo Layer"
        className="w-full h-full object-cover pointer-events-none rounded-lg"
        referrerPolicy="no-referrer"
      />

      {isSelected && (
        <>
          <div 
            onMouseDown={handleRotateStart}
            onTouchStart={handleRotateStart}
            className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-alias z-50 group"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-aeirmist-cyan shadow-md group-hover:scale-125 transition-transform" />
            <div className="w-0.5 h-6 bg-aeirmist-cyan/80" />
          </div>

          <div
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
            className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-aeirmist-cyan border-2 border-white shadow-lg flex items-center justify-center cursor-se-resize z-50 hover:scale-110 active:scale-95 transition-all"
          >
            <RefreshCw size={10} className="text-black animate-pulse" />
          </div>
        </>
      )}
    </motion.div>
  );
};

interface TextLayerComponentProps {
  layer: TextLayer;
  containerRef: React.RefObject<HTMLDivElement>;
  setIsDraggingAny: (val: boolean) => void;
  checkIfOverTrash: (x: number, y: number) => boolean;
  setIsOverTrash: (val: boolean) => void;
  setTextLayers: React.Dispatch<React.SetStateAction<TextLayer[]>>;
  deleteAnyLayer: (id: string) => void;
  editExistingText: (layer: TextLayer) => void;
}

const TextLayerComponent: React.FC<TextLayerComponentProps> = ({
  layer,
  containerRef,
  setIsDraggingAny,
  checkIfOverTrash,
  setIsOverTrash,
  setTextLayers,
  deleteAnyLayer,
  editExistingText,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fontData = STORY_FONTS.find(f => f.id === layer.font) || STORY_FONTS[0];

  const animationProps = layer.animation === 'fade' ? {
    initial: { opacity: 0, scale: 0.9 },
    animate: isDragging ? undefined : { opacity: 1, scale: 1, x: layer.x, y: layer.y },
    transition: { duration: 0.5 }
  } : layer.animation === 'slide' ? {
    initial: { opacity: 0, y: layer.y + 50, x: layer.x },
    animate: isDragging ? undefined : { opacity: 1, y: layer.y, x: layer.x },
    transition: { duration: 0.6, type: 'spring' as const, damping: 12 }
  } : layer.animation === 'typewriter' ? {
    initial: { clipPath: "inset(0 100% 0 0)", opacity: 0 },
    animate: isDragging ? undefined : { clipPath: "inset(0 0 0 0)", opacity: 1, x: layer.x, y: layer.y },
    transition: { duration: 1.5, ease: "easeInOut" as const }
  } : {
    initial: { x: layer.x, y: layer.y },
    animate: isDragging ? undefined : { x: layer.x, y: layer.y }
  };

  const bgStyles = layer.bg === 'solid' ? {
    backgroundColor: layer.color,
    color: layer.color === '#ffffff' || layer.color === '#00f2ff' || layer.color === '#39ff14' ? '#000000' : '#ffffff',
  } : layer.bg === 'highlight' ? {
    backgroundColor: `${layer.color}33`,
    color: layer.color,
    backdropFilter: 'blur(8px)',
    border: `1px solid ${layer.color}44`
  } : {
    color: layer.color,
    backgroundColor: 'transparent'
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragConstraints={containerRef}
      dragElastic={0.1}
      onDoubleClick={() => editExistingText(layer)}
      onDragStart={() => {
        setIsDraggingAny(true);
        setIsDragging(true);
      }}
      onDrag={(e, info) => {
        const over = checkIfOverTrash(info.point.x, info.point.y);
        setIsOverTrash(over);
      }}
      onDragEnd={(e, info) => {
        setIsDraggingAny(false);
        setIsDragging(false);
        const over = checkIfOverTrash(info.point.x, info.point.y);
        setIsOverTrash(false);

        if (over) {
          deleteAnyLayer(layer.id);
        } else {
          setTextLayers(prev => prev.map(l => l.id === layer.id ? {
            ...l,
            x: l.x + info.offset.x,
            y: l.y + info.offset.y
          } : l));
        }
      }}
      {...animationProps}
      transition={{ x: { duration: 0 }, y: { duration: 0 } }}
      style={{ 
        left: 0, 
        top: 0, 
        fontSize: `${layer.size}px`,
        opacity: layer.opacity,
        fontFamily: fontData.family,
        fontWeight: fontData.weight,
        textAlign: layer.align,
        ...bgStyles
      }}
      className={`absolute z-30 px-4 py-2 rounded-2xl cursor-grab active:cursor-grabbing select-none whitespace-pre-wrap max-w-[80%] ${layer.shadow && layer.bg === 'none' ? 'drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]' : ''}`}
    >
      {layer.text}
    </motion.div>
  );
};

interface StickerLayerComponentProps {
  sticker: StickerLayer;
  containerRef: React.RefObject<HTMLDivElement>;
  setIsDraggingAny: (val: boolean) => void;
  checkIfOverTrash: (x: number, y: number) => boolean;
  setIsOverTrash: (val: boolean) => void;
  setStickerLayers: React.Dispatch<React.SetStateAction<StickerLayer[]>>;
  deleteAnyLayer: (id: string) => void;
  deleteStickerLayer: (id: string) => void;
}

const StickerLayerComponent: React.FC<StickerLayerComponentProps> = ({
  sticker,
  containerRef,
  setIsDraggingAny,
  checkIfOverTrash,
  setIsOverTrash,
  setStickerLayers,
  deleteAnyLayer,
  deleteStickerLayer
}) => {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragConstraints={containerRef}
      dragElastic={0.1}
      onDragStart={() => {
        setIsDraggingAny(true);
        setIsDragging(true);
      }}
      onDrag={(e, info) => {
        const over = checkIfOverTrash(info.point.x, info.point.y);
        setIsOverTrash(over);
      }}
      onDragEnd={(e, info) => {
        setIsDraggingAny(false);
        setIsDragging(false);
        const over = checkIfOverTrash(info.point.x, info.point.y);
        setIsOverTrash(false);

        if (over) {
          deleteAnyLayer(sticker.id);
        } else {
          setStickerLayers(prev => prev.map(s => s.id === sticker.id ? {
            ...s,
            x: s.x + info.offset.x,
            y: s.y + info.offset.y
          } : s));
        }
      }}
      animate={isDragging ? undefined : { x: sticker.x, y: sticker.y }}
      transition={{ x: { duration: 0 }, y: { duration: 0 } }}
      style={{ 
        left: 0, 
        top: 0, 
        scale: sticker.scale 
      }}
      className="absolute z-30 cursor-grab active:cursor-grabbing"
    >
      <div className="relative group/stick">
        {sticker.type === 'location' && (
          <div className="px-4 py-2 rounded-full bg-aeirmist-cyan text-black font-black text-sm shadow-xl flex items-center gap-2 border border-white/20">
            <MapPin size={14} />
            {sticker.content}
          </div>
        )}
        {sticker.type === 'mention' && (
          <div className="px-4 py-2 rounded-full bg-aeirmist-cyan text-black font-black text-sm shadow-xl flex items-center gap-1.5 border border-white/20">
            <span className="opacity-60 text-xs">@</span>
            {sticker.content.replace('@', '')}
          </div>
        )}
        {sticker.type === 'hashtag' && (
          <div className="px-4 py-2 rounded-full bg-aeirmist-magenta text-white font-black text-sm shadow-xl flex items-center gap-1.5 border border-white/20">
            <span className="opacity-60 text-xs">#</span>
            {sticker.content.replace('#', '')}
          </div>
        )}
        {sticker.type === 'poll' && (
          <div className="p-4 rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl min-w-48 text-center pointer-events-none">
            <p className="text-sm font-bold text-white mb-4">{sticker.pollData?.question || 'Simulation active?'}</p>
            <div className="space-y-2">
              <div className="w-full py-2.5 rounded-xl bg-aeirmist-cyan/20 border border-aeirmist-cyan/40 text-aeirmist-cyan text-[10px] font-black uppercase tracking-widest">
                {sticker.pollData?.options[0].label}
              </div>
              <div className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest">
                {sticker.pollData?.options[1].label}
              </div>
            </div>
          </div>
        )}
        {sticker.type === 'quiz' && (
          <div className="p-5 rounded-[2rem] bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl min-w-56 pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-aeirmist-magenta/20 flex items-center justify-center mb-4 border border-aeirmist-magenta/30">
               <HelpCircle size={16} className="text-aeirmist-magenta" />
            </div>
            <p className="text-sm font-bold text-white mb-4">{sticker.quizData?.question}</p>
            <div className="space-y-2">
              {sticker.quizData?.options.map((opt, idx) => (
                <div 
                  key={idx}
                  className={`w-full py-3 px-4 rounded-2xl border flex items-center justify-between ${idx === sticker.quizData?.correctIndex ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/40' : 'bg-white/5 border-white/10'}`}
                >
                  <span className={`text-[10px] font-black uppercase tracking-widest ${idx === sticker.quizData?.correctIndex ? 'text-aeirmist-cyan' : 'text-white/40'}`}>
                    {opt}
                  </span>
                  {idx === sticker.quizData?.correctIndex && <Check size={12} className="text-aeirmist-cyan" />}
                </div>
              ))}
            </div>
          </div>
        )}
        {sticker.type === 'question' && (
          <div className="p-6 rounded-[2.5rem] bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl min-w-56 text-center pointer-events-none overflow-hidden relative">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta" />
            <p className="text-sm font-bold text-white mb-6 leading-relaxed italic">"{sticker.questionBoxData?.prompt}"</p>
            <div className="py-4 bg-white/5 rounded-2xl border border-white/5 text-[9px] font-black uppercase tracking-[0.3em] text-white/20">
              Tap to message...
            </div>
          </div>
        )}
        {sticker.type === 'countdown' && (
          <div className="p-5 rounded-3xl bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl min-w-56 text-center pointer-events-none">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-aeirmist-cyan mb-3">{sticker.countdownData?.title || 'Event'}</p>
            <div className="flex justify-center gap-3 font-mono text-white">
              {['00', '00', '00', '00'].map((val, i) => (
                <div key={i} className="flex flex-col items-center">
                  <span className="text-xl font-bold">{val}</span>
                  <span className="text-[7px] uppercase tracking-tighter opacity-40">{['Days', 'Hrs', 'Min', 'Sec'][i]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {sticker.type === 'slider' && (
          <div className="p-5 rounded-[2rem] bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl min-w-56 text-center pointer-events-none">
            <p className="text-sm font-bold text-white mb-6">"{sticker.sliderData?.prompt}"</p>
            <div className="relative h-2 w-full bg-white/10 rounded-full">
              <div className="absolute top-1/2 left-0 -translate-y-1/2 text-3xl">
                {sticker.sliderData?.emoji}
              </div>
            </div>
          </div>
        )}
        {sticker.type === 'link' && (
          <div className="px-5 py-3 rounded-full bg-aeirmist-cyan text-black font-black text-sm shadow-xl flex items-center gap-2 border border-white/20">
            <LucideLink size={14} />
            {sticker.linkData?.label || 'Link'}
          </div>
        )}
        {sticker.type === 'music' && (
          <div className={`p-3 rounded-2xl bg-black/60 backdrop-blur-xl border shadow-2xl flex items-center gap-3 min-w-[200px] max-w-[260px] pointer-events-none transition-all ${
            sticker.musicData?.song?.spotifyURL ? 'border-[#1DB954]/30' : 'border-white/10'
          }`}>
            <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden shadow-lg flex-shrink-0 relative border border-white/10">
              {sticker.musicData?.song?.albumArtUrl || sticker.musicData?.song?.albumArtURL ? (
                <img src={sticker.musicData.song.albumArtUrl || sticker.musicData.song.albumArtURL} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Music size={12} className="text-white" />
                </div>
              )}
            </div>
            <div className="overflow-hidden flex-1">
              <div className="font-bold text-[10px] text-white whitespace-nowrap overflow-hidden">
                <span className="inline-block animate-pulse">
                  {sticker.musicData?.song?.title || sticker.musicData?.song?.name || sticker.content}
                </span>
              </div>
              <div className="text-[8px] text-white/40 uppercase tracking-tighter truncate">
                {sticker.musicData?.song?.artist || 'Unknown Artist'}
              </div>
            </div>
            {sticker.musicData?.song?.spotifyURL ? (
              <div className="text-[6px] font-black tracking-widest text-[#1DB954] bg-[#1DB954]/10 border border-[#1DB954]/20 rounded px-1 py-0.5 uppercase shrink-0">
                Spotify
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center shrink-0">
                <Sparkles size={8} className="text-aeirmist-cyan" />
              </div>
            )}
          </div>
        )}
        {sticker.type === 'gif' && (
          <img 
            src={sticker.content} 
            alt="GIF Sticker"
            className="w-32 h-auto object-contain pointer-events-none drop-shadow-xl"
          />
        )}
        {sticker.type === 'emoji' && (
          <span className="text-4xl filter drop-shadow-md">{sticker.content}</span>
        )}
        
        {/* Delete sticker layer */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            deleteStickerLayer(sticker.id);
          }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover/stick:opacity-100 transition-all shadow-lg"
          title="Remove Sticker"
        >
          <X size={10} />
        </button>
      </div>
    </motion.div>
  );
};

export const StoryStudio = ({ onClose }: { onClose: () => void }) => {
  const { db, user, profile, uploadMedia, canWrite, addToast, publishStory, analytics, storyUpload, searchUsers } = useAeirmist();
  
  // Media states
  const [mode, setMode] = useState<'story' | 'reel' | 'text' | 'music' | 'layout' | 'boomerang'>('story');
  const [audience, setAudience] = useState<'public' | 'followers' | 'closeFriends'>('public');
  
  // Mention search state
  const [mentionSearchOpen, setMentionSearchOpen] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [mentionSearchResults, setMentionSearchResults] = useState<any[]>([]);
  const [isSearchingMentions, setIsSearchingMentions] = useState(false);

  // Poll creation state
  const [pollEditorOpen, setPollEditorOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOption1, setPollOption1] = useState('Yes');
  const [pollOption2, setPollOption2] = useState('No');

  // Quiz creation state
  const [quizEditorOpen, setQuizEditorOpen] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState('');
  const [quizOptions, setQuizOptions] = useState(['', '', '', '']);
  const [quizCorrectIndex, setQuizCorrectIndex] = useState(0);

  // Question Box creation state
  const [qBoxEditorOpen, setQBoxEditorOpen] = useState(false);
  const [qBoxPrompt, setQBoxPrompt] = useState('Ask me anything...');
  const [qBoxShowAttribution, setQBoxShowAttribution] = useState(false);

  // Location creation state
  const [locationEditorOpen, setLocationEditorOpen] = useState(false);
  const [locationValue, setLocationValue] = useState('');

  // Countdown creation state
  const [countdownEditorOpen, setCountdownEditorOpen] = useState(false);
  const [countdownTitle, setCountdownTitle] = useState('');
  const [countdownDate, setCountdownDate] = useState('');

  // Slider creation state
  const [sliderEditorOpen, setSliderEditorOpen] = useState(false);
  const [sliderPrompt, setSliderPrompt] = useState('How excited are you?');
  const [sliderEmoji, setSliderEmoji] = useState('😍');

  // Link creation state
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [hashtagEditorOpen, setHashtagEditorOpen] = useState(false);
  const [hashtagDraft, setHashtagDraft] = useState('');

  // GIF creation state
  const [giphyOpen, setGiphyOpen] = useState(false);
  const [giphySearch, setGiphySearch] = useState('');
  const [giphyResults, setGiphyResults] = useState<GiphyResult[]>([]);
  const [isSearchingGiphy, setIsSearchingGiphy] = useState(false);
  const [giphyTab, setGiphyTab] = useState<'trending' | 'search'>('trending');

  const [capturedMedia, setCapturedMedia] = useState<{ url: string; type: 'image' | 'video'; file?: File; isSolidBackground?: boolean } | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [flash, setFlash] = useState(false);
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [showDraftsList, setShowDraftsList] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  
  // Real-time Background uploading state
  const [uploadState, setUploadState] = useState<{
    isUploading: boolean;
    progress: number;
    error: boolean;
    mediaUrl: string | null;
  }>({
    isUploading: false,
    progress: 0,
    error: false,
    mediaUrl: null
  });
  const [isPublishing, setIsPublishing] = useState(false);

  // Suggestion Chip state
  const [suggestion, setSuggestion] = useState<{ text: string, action: () => void } | null>(null);
  const [autoOpenPoll, setAutoOpenPoll] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    if (capturedMedia) return;
    const timer = setTimeout(() => {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday

      if (hour >= 21 || hour < 5) {
        setSuggestion({
          text: "🌙 Try Night filter",
          action: () => {
            setCurrentFilter(STORY_FILTERS.find(f => f.id === 'noir')?.filter || 'none');
            setSuggestion(null);
          }
        });
      } else if (day === 0 || day === 5 || day === 6) {
        setSuggestion({
          text: "✨ Add a Poll sticker",
          action: () => {
            setAutoOpenPoll(true);
            setSuggestion(null);
            addToast({ title: "Smart Suggestion", message: "Poll flow will activate after capture.", type: "info" });
          }
        });
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [capturedMedia]);

  // Handle auto-open poll after capture
  useEffect(() => {
    if (capturedMedia && autoOpenPoll) {
      setPollEditorOpen(true);
      setAutoOpenPoll(false);
    }
  }, [capturedMedia, autoOpenPoll]);

  // Editor layers
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [stickerLayers, setStickerLayers] = useState<StickerLayer[]>([]);
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[] | null>(null);
  
  // Free-form Photo layers state & refs
  const [photoLayers, setPhotoLayers] = useState<PhotoLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [contextMenuLayerId, setContextMenuLayerId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedLayoutForUpload, setSelectedLayoutForUpload] = useState<LayoutTemplate | null>(null);

  const insertPhotoInputRef = useRef<HTMLInputElement>(null);
  const layoutFileInputRef = useRef<HTMLInputElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  
  // Active tool settings
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawToolsOpen, setDrawToolsOpen] = useState(false);
  const [brushColor, setBrushColor] = useState('#00f2ff');
  const [brushSize, setBrushSize] = useState(10);
  const [brushType, setBrushType] = useState<'marker' | 'neon' | 'highlighter' | 'eraser'>('marker');
  
  const [currentFilter, setCurrentFilter] = useState('none');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeMusic, setActiveMusic] = useState<any>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  
  // Music Sticker state
  const [musicStickerEditorOpen, setMusicStickerEditorOpen] = useState(false);
  const [selectedMusicSticker, setSelectedMusicSticker] = useState<any>(null);
  const [musicStartTime, setMusicStartTime] = useState(0);

  // Layout state
  const [layoutModeOpen, setLayoutModeOpen] = useState(false);
  const [currentLayout, setCurrentLayout] = useState<LayoutTemplate | null>(null);
  const [layoutSlots, setLayoutSlots] = useState<LayoutSlot[]>([]);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  // Boomerang state
  const [isBoomerang, setIsBoomerang] = useState(false);
  const [isBoomerangProcessing, setIsBoomerangProcessing] = useState(false);
  const [boomerangFrames, setBoomerangFrames] = useState<string[]>([]);
  
  // Custom text editor overlay
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textFont, setTextFont] = useState<'sans' | 'serif' | 'script' | 'mono' | 'condensed'>('sans');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [textBgStyle, setTextBgStyle] = useState<'none' | 'solid' | 'highlight'>('none');
  const [textSize, setTextSize] = useState(24);
  const [textOpacity, setTextOpacity] = useState(1);
  const [textShadow, setTextShadow] = useState(true);
  const [textAnimation, setTextAnimation] = useState<'none' | 'fade' | 'slide' | 'typewriter'>('none');

  // Sticker Panel states
  const [stickersOpen, setStickersOpen] = useState(false);
  const [stickerSearch, setStickerSearch] = useState('');
  const [activeStickerCategory, setActiveStickerCategory] = useState('All');
  
  // Solid/Gradient Text background selection
  const [textModeBgIdx, setTextModeBgIdx] = useState(0);

  // Filter Carousel scrolling state
  const filterCarouselRef = useRef<HTMLDivElement>(null);

  // Desktop Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (textEditorOpen || mentionSearchOpen || pollEditorOpen || quizEditorOpen || qBoxEditorOpen || locationEditorOpen || countdownEditorOpen || sliderEditorOpen || linkEditorOpen || giphyOpen || musicOpen || musicStickerEditorOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        if (!capturedMedia) handleCaptureTrigger();
      } else if (e.key === 'ArrowLeft' && !capturedMedia) {
        const currentIndex = STORY_FILTERS.findIndex(f => f.filter === currentFilter);
        const nextIndex = (currentIndex - 1 + STORY_FILTERS.length) % STORY_FILTERS.length;
        setCurrentFilter(STORY_FILTERS[nextIndex].filter);
      } else if (e.key === 'ArrowRight' && !capturedMedia) {
        const currentIndex = STORY_FILTERS.findIndex(f => f.filter === currentFilter);
        const nextIndex = (currentIndex + 1) % STORY_FILTERS.length;
        setCurrentFilter(STORY_FILTERS[nextIndex].filter);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [textEditorOpen, mentionSearchOpen, pollEditorOpen, quizEditorOpen, qBoxEditorOpen, locationEditorOpen, countdownEditorOpen, sliderEditorOpen, linkEditorOpen, giphyOpen, musicOpen, musicStickerEditorOpen, currentFilter, capturedMedia, onClose]);

  // Premium Camera Config & Effects states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [countdownVal, setCountdownVal] = useState<number | null>(null);
  const [timerSetting, setTimerSetting] = useState<number>(0);
  const [gridSetting, setGridSetting] = useState<'none' | 'thirds' | 'golden'>('none');
  const [resolutionSetting, setResolutionSetting] = useState<'SD' | 'HD' | '4K'>('HD');
  const [simulationCategory, setSimulationCategory] = useState<'all' | 'cosmos' | 'cyberpunk' | 'nature' | 'retro'>('all');
  const [selectedEffect, setSelectedEffect] = useState<'none' | 'cyberpunk' | 'vhs' | 'vintage' | 'bloom' | 'matrix'>('none');
  
  // Media transformations
  const [mediaRotation, setMediaRotation] = useState(0);
  const [mediaFlipX, setMediaFlipX] = useState(false);
  const [mediaScale, setMediaScale] = useState(1);
  const [mediaBrightness, setMediaBrightness] = useState(100);
  const [mediaContrast, setMediaContrast] = useState(100);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [mediaFit, setMediaFit] = useState<'cover' | 'contain'>('cover');
  const [transformOpen, setTransformOpen] = useState(false);

  // Post-capture story editor states
  const [storyCaption, setStoryCaption] = useState('');
  const [captionInputOpen, setCaptionInputOpen] = useState(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);

  // Gallery Selection Screen states
  const [isGallerySelectorOpen, setIsGallerySelectorOpen] = useState(false);
  const [isMusicFirstFlow, setIsMusicFirstFlow] = useState(false);
  const [showMusicBackgroundPrompt, setShowMusicBackgroundPrompt] = useState(false);
  const [selectedGalleryItems, setSelectedGalleryItems] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [activeAlbum, setActiveAlbum] = useState<'recents' | 'camera' | 'downloads'>('recents');
  const [showAlbumDropdown, setShowAlbumDropdown] = useState(false);
  const [showLayoutSelectorForMultiSelect, setShowLayoutSelectorForMultiSelect] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showQuickSettingsMenu, setShowQuickSettingsMenu] = useState(false);

  // Multi-story sequence states
  const [multiStoryItems, setMultiStoryItems] = useState<Array<{
    url: string;
    type: 'image' | 'video';
    textLayers: TextLayer[];
    stickerLayers: StickerLayer[];
    photoLayers: PhotoLayer[];
    currentFilter: string;
    activeMusic: any;
    storyCaption: string;
  }>>([]);
  const [currentMultiStoryIndex, setCurrentMultiStoryIndex] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStart = useRef({ x: 0, y: 0 });
  const lastTap = useRef<number>(0);

  // Mock Capture if camera unavailable
  const simulateCapture = (type: 'image' | 'video') => {
    const category = simulationCategory || 'all';
    const assets = SIMULATION_ASSETS[category as keyof typeof SIMULATION_ASSETS] || SIMULATION_ASSETS.all;
    const urls = type === 'image' ? assets.images : assets.videos;
    const randomUrl = urls[Math.floor(Math.random() * urls.length)];
    setCapturedMedia({
      url: randomUrl,
      type
    });
  };

  // Sync Camera Stream
  useEffect(() => {
    if (isCameraActive && !capturedMedia && mode !== 'text') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isCameraActive, facingMode, capturedMedia, mode]);

  // Video recording timer
  useEffect(() => {
    if (isRecording) {
      recordTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [isRecording]);

  // Load Drafts on Mount
  useEffect(() => {
    const stored = localStorage.getItem('aeirmist_story_drafts');
    if (stored) {
      try {
        setDrafts(JSON.parse(stored));
      } catch (e) {
        logger.error("Failed to load drafts from cache", e);
      }
    }
  }, []);

  // Reset upload state on media change
  useEffect(() => {
    if (!capturedMedia) {
      setUploadState({ isUploading: false, progress: 0, error: false, mediaUrl: null });
    }
  }, [capturedMedia]);

  const performBackgroundUpload = async (file: File) => {
    if (!user || !uploadMedia) return;
    setUploadState({
      isUploading: true,
      progress: 0,
      error: false,
      mediaUrl: null
    });

    try {
      const url = await uploadMedia(
        file, 
        `users/${user.uid}/stories`, 
        (progress, status) => {
          setUploadState(prev => ({
            ...prev,
            progress: Math.floor(progress)
          }));
        }, 
        MediaQuality.STORY
      );
      
      setUploadState({
        isUploading: false,
        progress: 100,
        error: false,
        mediaUrl: url
      });
    } catch (err) {
      logger.error("Background story upload failed:", err);
      setUploadState({
        isUploading: false,
        progress: 0,
        error: true,
        mediaUrl: null
      });
      addToast({
        title: "Upload failed",
        message: "Story media upload failed. Tap to retry.",
        type: "warning"
      });
    }
  };

  const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'CbArMsjxxOdoz9wdPmY5hh8BBc0Oiwmt';

  const fetchGiphyTrending = async () => {
    setIsSearchingGiphy(true);
    try {
      let response;
      try {
        response = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=g`);
      } catch {
        response = await fetch('/api/giphy/trending');
      }
      const data = await response.json();
      const results = (data.data || []).map((gif: any) => ({
        id: gif.id,
        url: gif.images?.fixed_height?.url || gif.images?.original?.url || '',
        title: gif.title || 'GIF'
      }));
      setGiphyResults(results);
    } catch (e) {
      logger.error("Giphy trending fetch failed", e);
    } finally {
      setIsSearchingGiphy(false);
    }
  };

  const fetchGiphySearch = async (query: string) => {
    if (!query.trim()) {
      fetchGiphyTrending();
      return;
    }
    setIsSearchingGiphy(true);
    try {
      let response;
      try {
        response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=24&rating=g`);
      } catch {
        response = await fetch(`/api/giphy/search?q=${encodeURIComponent(query)}`);
      }
      const data = await response.json();
      const results = (data.data || []).map((gif: any) => ({
        id: gif.id,
        url: gif.images?.fixed_height?.url || gif.images?.original?.url || '',
        title: gif.title || 'GIF'
      }));
      setGiphyResults(results);
    } catch (e) {
      logger.error("Giphy search failed", e);
    } finally {
      setIsSearchingGiphy(false);
    }
  };

  useEffect(() => {
    if (giphyOpen && giphyTab === 'trending') {
      fetchGiphyTrending();
    }
  }, [giphyOpen, giphyTab]);

  const selectGiphy = (gif: GiphyResult) => {
    const newLayer: StickerLayer = {
      id: Date.now().toString(),
      type: 'gif',
      content: gif.url,
      x: 100,
      y: 280,
      scale: 1
    };
    setStickerLayers(prev => [...prev, newLayer]);
    setGiphyOpen(false);
    setStickersOpen(false);
  };

  const openSlotMediaPicker = (slotId: string) => {
    setActiveSlotId(slotId);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('video') ? 'video' : 'image';
        setLayoutSlots(prev => prev.map(s => s.id === slotId ? { ...s, media: { url, type, file } } : s));
      }
    };
    input.click();
  };

  const removeSlotMedia = (slotId: string) => {
    setLayoutSlots(prev => prev.map(s => s.id === slotId ? { ...s, media: null } : s));
  };

  const startBoomerangCapture = async () => {
    if (!videoRef.current || !streamRef.current) return;
    
    setIsBoomerangProcessing(true);
    const frames: string[] = [];
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 854;
    const ctx = canvas.getContext('2d')!;
    
    // Capture 30 frames over ~1.5s
    for (let i = 0; i < 30; i++) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', 0.6));
      await new Promise(r => setTimeout(r, 50));
    }

    // Create forward + backward sequence
    const loop = [...frames, ...frames.slice().reverse()];
    setBoomerangFrames(loop);
    
    // Simulate a video file for the rest of the studio logic
    // In a real app, we'd use a library like whammy.js or ffmpeg.wasm to encode
    // For now, we'll just set a placeholder and use the frames for rendering
    setCapturedMedia({
      url: frames[0],
      type: 'image',
    });
    setIsBoomerangProcessing(false);
  };

  const startCamera = async () => {
    try {
      stopCamera();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true
        });
      } catch (audioErr) {
        // Fallback to video-only stream if mic is absent or denied
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraError(false);
    } catch (err) {
      logger.warn("Webcam access unavailable. Using mock simulation mode.", err);
      setCameraError(true);
    }
  };

  const stopCamera = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        logger.warn("[StoryStudio] Error stopping media recorder:", e);
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Capture Photo
  const capturePhoto = () => {
    if (flash) {
      setIsFlashActive(true);
      setTimeout(() => setIsFlashActive(false), 200);
    }

    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1080;
      canvas.height = videoRef.current.videoHeight || 1920;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1); // mirror if facing user
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const objectUrl = URL.createObjectURL(blob);
            setCapturedMedia({
              url: objectUrl,
              type: 'image',
              file
            });
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                setCapturedMedia(prev => {
                  if (prev && prev.file === file) {
                    return { ...prev, url: reader.result as string };
                  }
                  return prev;
                });
              }
            };
            reader.readAsDataURL(blob);
          }
        }, 'image/jpeg', 0.95);
      }
    } else {
      simulateCapture('image');
    }
  };

  // Start Video Recording
  const startRecording = () => {
    if (flash) {
      setIsFlashActive(true);
      setTimeout(() => setIsFlashActive(false), 200);
    }

    recordedChunksRef.current = [];
    if (streamRef.current) {
      const options = { mimeType: 'video/webm;codecs=vp9' };
      let recorder;
      try {
        recorder = new MediaRecorder(streamRef.current, options);
      } catch (e) {
        recorder = new MediaRecorder(streamRef.current);
      }
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `vlog_${Date.now()}.webm`, { type: 'video/webm' });
        const objectUrl = URL.createObjectURL(blob);
        setCapturedMedia({
          url: objectUrl,
          type: 'video',
          file
        });
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setCapturedMedia(prev => {
              if (prev && prev.file === file) {
                return { ...prev, url: reader.result as string };
              }
              return prev;
            });
          }
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setIsRecording(true);
    } else {
      setIsRecording(true);
    }
  };

  // Stop Video Recording
  const stopRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else {
        simulateCapture('video');
      }
      setIsRecording(false);
    }
  };

  // Self-Timer Triggers
  const handleCaptureTrigger = () => {
    if (timerSetting > 0) {
      setCountdownVal(timerSetting);
      const timer = setInterval(() => {
        setCountdownVal(prev => {
          if (prev === null) {
            clearInterval(timer);
            return null;
          }
          if (prev <= 1) {
            clearInterval(timer);
            capturePhoto();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      capturePhoto();
    }
  };

  const handleRecordTrigger = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    if (timerSetting > 0) {
      setCountdownVal(timerSetting);
      const timer = setInterval(() => {
        setCountdownVal(prev => {
          if (prev === null) {
            clearInterval(timer);
            return null;
          }
          if (prev <= 1) {
            clearInterval(timer);
            startRecording();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      startRecording();
    }
  };

  // File selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (files.length === 1) {
        handleLoadedFiles(Array.from(files));
        setIsGallerySelectorOpen(false);
      } else {
        const objectUrls = Array.from(files).map(file => URL.createObjectURL(file));
        setSelectedGalleryItems(objectUrls);
        setIsMultiSelectMode(true);
        setIsGallerySelectorOpen(true);
        addToast({
          title: "Multi-Photos Selected",
          message: "Choose Layout or Separate to proceed with your selected files.",
          type: "info"
        });
      }
    }
  };

  const handleLoadedFiles = (files: File[]) => {
    const file = files[0];
    if (file && file.size > 45 * 1024 * 1024) {
      addToast({
        title: "File Too Large",
        message: "Story media limit is 45 MB. Please select a smaller file.",
        type: "warning"
      });
      return;
    }
    const type = file.type.startsWith('video') ? 'video' : 'image';
    const objectUrl = URL.createObjectURL(file);
    
    setCapturedMedia({
      url: objectUrl,
      type: type as 'image' | 'video',
      file
    });

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCapturedMedia(prev => {
          if (prev && prev.file === file) {
            return {
              ...prev,
              url: reader.result as string
            };
          }
          return prev;
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInsertPhotoLayers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file, index) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const aspect = img.width / img.height;
          const width = 160;
          const height = width / aspect;
          const offset = index * 25;
          const x = 120 + offset;
          const y = 200 + offset;

          const newLayer: PhotoLayer = {
            id: `photo_${Date.now()}_${index}`,
            url,
            x,
            y,
            width,
            height,
            scale: 1,
            rotation: 0,
            zIndex: photoLayers.length + index + 1,
            aspectRatio: aspect,
            file
          };
          setPhotoLayers(prev => [...prev, newLayer]);
        };
        img.src = url;
      });

      if (!capturedMedia) {
        setCapturedMedia({
          url: '',
          type: 'image',
          isSolidBackground: true
        });
      }
    }
  };

  const applyTemplateLayout = (layoutId: LayoutTemplate, files: File[]) => {
    const layouts: Record<LayoutTemplate, Array<{ x: number, y: number, w: number, h: number }>> = {
      'split-v': [
        { w: 180, h: 620, x: 10, y: 50 },
        { w: 180, h: 620, x: 210, y: 50 }
      ],
      'split-h': [
        { w: 380, h: 295, x: 10, y: 50 },
        { w: 380, h: 295, x: 10, y: 365 }
      ],
      'grid-4': [
        { w: 180, h: 295, x: 10, y: 50 },
        { w: 180, h: 295, x: 210, y: 50 },
        { w: 180, h: 295, x: 10, y: 365 },
        { w: 180, h: 295, x: 210, y: 365 }
      ],
      'l-shape': [
        { w: 380, h: 350, x: 10, y: 50 },
        { w: 180, h: 250, x: 10, y: 410 },
        { w: 180, h: 250, x: 210, y: 410 }
      ],
      'large-2-small': [
        { w: 250, h: 610, x: 10, y: 50 },
        { w: 120, h: 295, x: 270, y: 50 },
        { w: 120, h: 295, x: 270, y: 365 }
      ]
    };

    const currentCoords = layouts[layoutId];
    if (!currentCoords) return;

    const newLayers: PhotoLayer[] = [];
    
    files.forEach((file, index) => {
      if (index >= currentCoords.length) return;
      const coord = currentCoords[index];
      const url = URL.createObjectURL(file);
      
      newLayers.push({
        id: `photo_${Date.now()}_${index}`,
        url,
        x: coord.x,
        y: coord.y,
        width: coord.w,
        height: coord.h,
        scale: 1,
        rotation: 0,
        zIndex: index + 1,
        aspectRatio: coord.w / coord.h,
        file
      });
    });

    setPhotoLayers(prev => [...prev, ...newLayers]);
    setLayoutModeOpen(false);
    
    if (!capturedMedia) {
      setCapturedMedia({
        url: '',
        type: 'image',
        isSolidBackground: true
      });
    }
  };

  const applyUrlsToTemplateLayout = (layoutId: LayoutTemplate, urls: string[]) => {
    const layouts: Record<LayoutTemplate, Array<{ x: number, y: number, w: number, h: number }>> = {
      'split-v': [
        { w: 180, h: 620, x: 10, y: 50 },
        { w: 180, h: 620, x: 210, y: 50 }
      ],
      'split-h': [
        { w: 380, h: 295, x: 10, y: 50 },
        { w: 380, h: 295, x: 10, y: 365 }
      ],
      'grid-4': [
        { w: 180, h: 295, x: 10, y: 50 },
        { w: 180, h: 295, x: 210, y: 50 },
        { w: 180, h: 295, x: 10, y: 365 },
        { w: 180, h: 295, x: 210, y: 365 }
      ],
      'l-shape': [
        { w: 380, h: 350, x: 10, y: 50 },
        { w: 180, h: 250, x: 10, y: 410 },
        { w: 180, h: 250, x: 210, y: 410 }
      ],
      'large-2-small': [
        { w: 250, h: 610, x: 10, y: 50 },
        { w: 120, h: 295, x: 270, y: 50 },
        { w: 120, h: 295, x: 270, y: 365 }
      ]
    };

    const currentCoords = layouts[layoutId];
    if (!currentCoords) return;

    const newLayers: PhotoLayer[] = [];
    
    urls.forEach((url, index) => {
      if (index >= currentCoords.length) return;
      const coord = currentCoords[index];
      
      newLayers.push({
        id: `photo_url_${Date.now()}_${index}`,
        url,
        x: coord.x,
        y: coord.y,
        width: coord.w,
        height: coord.h,
        scale: 1,
        rotation: 0,
        zIndex: index + 1,
        aspectRatio: coord.w / coord.h
      });
    });

    setPhotoLayers(newLayers);
    setCapturedMedia({
      url: '',
      type: 'image',
      isSolidBackground: true
    });
    setIsGallerySelectorOpen(false);
  };

  const handleLayoutFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && selectedLayoutForUpload) {
      applyTemplateLayout(selectedLayoutForUpload, Array.from(files));
      setSelectedLayoutForUpload(null);
    }
  };

  const updatePhotoLayer = (id: string, updates: Partial<PhotoLayer>) => {
    setPhotoLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const deletePhotoLayer = (id: string) => {
    setPhotoLayers(prev => prev.filter(l => l.id !== id));
  };

  const deleteAnyLayer = (id: string) => {
    setTextLayers(prev => prev.filter(l => l.id !== id));
    setStickerLayers(prev => prev.filter(s => s.id !== id));
    setPhotoLayers(prev => prev.filter(p => p.id !== id));
    
    addToast({
      title: "Layer Deleted",
      message: "Layer removed from story.",
      type: "info"
    });
  };

  const checkIfOverTrash = (x: number, y: number) => {
    if (!trashRef.current) return false;
    const rect = trashRef.current.getBoundingClientRect();
    const padding = 20;
    return (
      x >= rect.left - padding &&
      x <= rect.right + padding &&
      y >= rect.top - padding &&
      y <= rect.bottom + padding
    );
  };

  const bringToFront = (id: string) => {
    const maxZ = photoLayers.reduce((max, l) => l.zIndex > max ? l.zIndex : max, 0);
    updatePhotoLayer(id, { zIndex: maxZ + 1 });
    setContextMenuLayerId(null);
  };

  const sendToBack = (id: string) => {
    const minZ = photoLayers.reduce((min, l) => l.zIndex < min ? l.zIndex : min, 0);
    updatePhotoLayer(id, { zIndex: minZ - 1 });
    setContextMenuLayerId(null);
  };

  const handlePhotoContextMenu = (e: React.MouseEvent, layerId: string) => {
    e.preventDefault();
    setSelectedLayerId(layerId);
    setContextMenuLayerId(layerId);
    
    const container = document.getElementById('story_canvas_body');
    if (container) {
      const rect = container.getBoundingClientRect();
      const x = Math.max(10, Math.min(rect.width - 150, e.clientX - rect.left));
      const y = Math.max(10, Math.min(rect.height - 150, e.clientY - rect.top));
      setContextMenuPos({ x, y });
    }
  };

  // Touch & tap listeners
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = e.changedTouches[0].clientX - touchStart.current.x;
    const diffY = e.changedTouches[0].clientY - touchStart.current.y;
    
    if (Math.abs(diffX) > 80 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        if (mode === 'music') setMode('text');
        else if (mode === 'text') setMode('reel');
        else if (mode === 'reel') setMode('story');
      } else {
        if (mode === 'story') setMode('reel');
        else if (mode === 'reel') setMode('text');
        else if (mode === 'text') setMode('music');
      }
    } else if (diffY < -80 && Math.abs(diffY) > Math.abs(diffX)) {
      setIsGallerySelectorOpen(true);
    }
  };

  const handlePreviewDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      toggleCameraFacing();
    }
    lastTap.current = now;
  };

  // Text layers handlers
  const addTextLayer = () => {
    const newLayer: TextLayer = {
      id: Date.now().toString(),
      text: 'Double tap to edit',
      x: 60,
      y: 180,
      font: 'sans',
      color: '#ffffff',
      align: 'center',
      bg: 'none',
      size: 24,
      opacity: 1,
      shadow: true,
      animation: 'none'
    };
    setTextLayers(prev => [...prev, newLayer]);
    editExistingText(newLayer);
  };

  const editExistingText = (layer: TextLayer) => {
    setActiveTextId(layer.id);
    setTextInput(layer.text);
    setTextFont(layer.font);
    setTextColor(layer.color);
    setTextAlign(layer.align);
    setTextBgStyle(layer.bg);
    setTextSize(layer.size);
    setTextOpacity(layer.opacity);
    setTextShadow(layer.shadow);
    setTextAnimation(layer.animation);
    setTextEditorOpen(true);
  };

  const saveTextChanges = () => {
    if (activeTextId) {
      setTextLayers(prev => prev.map(l => l.id === activeTextId ? {
        ...l,
        text: textInput,
        font: textFont,
        color: textColor,
        align: textAlign,
        bg: textBgStyle,
        size: textSize,
        opacity: textOpacity,
        shadow: textShadow,
        animation: textAnimation
      } : l));
    }
    setTextEditorOpen(false);
    setActiveTextId(null);
  };

  const deleteTextLayer = (id: string) => {
    setTextLayers(prev => prev.filter(l => l.id !== id));
    setTextEditorOpen(false);
    setActiveTextId(null);
  };

  const handleSequentialBack = () => {
    if (currentMultiStoryIndex > 0) {
      // Save current state first
      const updatedItems = [...multiStoryItems];
      updatedItems[currentMultiStoryIndex] = {
        url: capturedMedia?.url || '',
        type: 'image' as const,
        textLayers,
        stickerLayers,
        photoLayers,
        currentFilter,
        activeMusic,
        storyCaption
      };
      setMultiStoryItems(updatedItems);

      const prevIdx = currentMultiStoryIndex - 1;
      setCurrentMultiStoryIndex(prevIdx);

      // Load prev state
      const prevItem = updatedItems[prevIdx];
      setCapturedMedia({ url: prevItem.url, type: 'image' });
      setTextLayers(prevItem.textLayers);
      setStickerLayers(prevItem.stickerLayers);
      setPhotoLayers(prevItem.photoLayers);
      setCurrentFilter(prevItem.currentFilter);
      setActiveMusic(prevItem.activeMusic);
      setStoryCaption(prevItem.storyCaption);
    } else {
      // If we're at index 0, we clear sequence and go back to the gallery selector
      setMultiStoryItems([]);
      setCapturedMedia(null);
      setIsGallerySelectorOpen(true);
    }
  };

  const handleSequentialNext = () => {
    if (currentMultiStoryIndex < multiStoryItems.length - 1) {
      const updatedItems = [...multiStoryItems];
      updatedItems[currentMultiStoryIndex] = {
        url: capturedMedia?.url || '',
        type: 'image' as const,
        textLayers,
        stickerLayers,
        photoLayers,
        currentFilter,
        activeMusic,
        storyCaption
      };
      setMultiStoryItems(updatedItems);

      const nextIdx = currentMultiStoryIndex + 1;
      setCurrentMultiStoryIndex(nextIdx);

      // Load next item's state
      const nextItem = updatedItems[nextIdx];
      setCapturedMedia({ url: nextItem.url, type: 'image' });
      setTextLayers(nextItem.textLayers);
      setStickerLayers(nextItem.stickerLayers);
      setPhotoLayers(nextItem.photoLayers);
      setCurrentFilter(nextItem.currentFilter);
      setActiveMusic(nextItem.activeMusic);
      setStoryCaption(nextItem.storyCaption);
    }
  };

  const handleBackPress = () => {
    if (multiStoryItems.length > 0) {
      handleSequentialBack();
      return;
    }
    const hasEdits = textLayers.length > 0 || stickerLayers.length > 0 || drawingPaths.length > 0 || photoLayers.length > 0 || currentFilter !== 'none' || activeMusic !== null || storyCaption.trim().length > 0;
    if (hasEdits) {
      setShowDiscardConfirmation(true);
    } else {
      setCapturedMedia(null);
    }
  };

  const saveStoryFrame = async () => {
    addToast({
      title: "Generating Frame",
      message: "Compositing your high-resolution story masterpiece...",
      type: "info"
    });

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;

      const drawRoundedRect = (c: CanvasRenderingContext2D, rx: number, ry: number, rw: number, rh: number, rr: number) => {
        c.beginPath();
        c.moveTo(rx + rr, ry);
        c.lineTo(rx + rw - rr, ry);
        c.quadraticCurveTo(rx + rw, ry, rx + rw, ry + rr);
        c.lineTo(rx + rw, ry + rh - rr);
        c.quadraticCurveTo(rx + rw, ry + rh, rx + rw - rr, ry + rh);
        c.lineTo(rx + rr, ry + rh);
        c.quadraticCurveTo(rx, ry + rh, rx, ry + rh - rr);
        c.lineTo(rx, ry + rr);
        c.quadraticCurveTo(rx, ry, rx + rr, ry);
        c.closePath();
      };

      // 1. Draw base background (Image / Blurred color-matched bg / Gradient fallback)
      if (capturedMedia && !capturedMedia.isSolidBackground && capturedMedia.url) {
        const bgImg = new Image();
        bgImg.crossOrigin = 'anonymous';
        bgImg.src = capturedMedia.url;
        await new Promise((resolve) => {
          bgImg.onload = resolve;
          bgImg.onerror = () => resolve(null);
        });
        
        ctx.save();
        ctx.filter = currentFilter !== 'none' ? currentFilter : 'none';
        ctx.translate(canvas.width / 2, canvas.height / 2);
        if (mediaFlipX) ctx.scale(-1, 1);
        ctx.rotate((mediaRotation * Math.PI) / 180);
        ctx.scale(mediaScale, mediaScale);
        ctx.drawImage(bgImg, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        ctx.restore();
      } else {
        const bottomPhoto = photoLayers.length > 0 ? [...photoLayers].sort((a, b) => a.zIndex - b.zIndex)[0] : null;
        if (bottomPhoto && bottomPhoto.url) {
          try {
            const bgImg = new Image();
            bgImg.crossOrigin = 'anonymous';
            bgImg.src = bottomPhoto.url;
            await new Promise((resolve, reject) => {
              bgImg.onload = resolve;
              bgImg.onerror = reject;
            });
            
            ctx.save();
            ctx.filter = 'blur(40px) brightness(0.7)';
            const canvasAspect = canvas.width / canvas.height;
            const imgAspect = bgImg.width / bgImg.height;
            let drawWidth = canvas.width;
            let drawHeight = canvas.height;
            if (imgAspect > canvasAspect) {
              drawWidth = canvas.height * imgAspect;
            } else {
              drawHeight = canvas.width / imgAspect;
            }
            const scaleFactor = 1.25;
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(scaleFactor, scaleFactor);
            ctx.drawImage(bgImg, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            ctx.restore();
          } catch (err) {
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, '#0f111a');
            grad.addColorStop(0.5, '#050609');
            grad.addColorStop(1, '#010102');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        } else {
          const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          grad.addColorStop(0, '#0f111a');
          grad.addColorStop(0.5, '#050609');
          grad.addColorStop(1, '#010102');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }

      // 2. Draw photo layers
      const sortedPhotos = [...photoLayers].sort((a, b) => a.zIndex - b.zIndex);
      const viewport = document.getElementById('story_canvas_body');
      const viewportWidth = viewport ? viewport.clientWidth : 420;
      const viewportHeight = viewport ? viewport.clientHeight : 746;
      const scaleX = 1080 / viewportWidth;
      const scaleY = 1920 / viewportHeight;

      for (const photo of sortedPhotos) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = photo.url;
        await new Promise((resolve) => { img.onload = resolve; });

        ctx.save();
        const w = photo.width * photo.scale * scaleX;
        const h = photo.height * photo.scale * scaleY;
        const x = photo.x * scaleX;
        const y = photo.y * scaleY;
        const cx = x + w / 2;
        const cy = y + h / 2;
        ctx.translate(cx, cy);
        ctx.rotate((photo.rotation * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }

      // 3. Draw drawings
      if (drawingCanvasRef.current) {
        ctx.drawImage(drawingCanvasRef.current, 0, 0, 1080, 1920);
      }

      // 4. Draw text layers
      for (const layer of textLayers) {
        ctx.save();
        const fontData = STORY_FONTS.find(f => f.id === layer.font) || STORY_FONTS[0];
        const fontSize = layer.size * scaleX;
        ctx.font = `${layer.bg === 'solid' ? '900' : (fontData.weight || 'bold')} ${fontSize}px ${fontData.family || 'sans-serif'}`;
        ctx.textBaseline = 'top';
        ctx.globalAlpha = layer.opacity || 1;

        const x = layer.x * scaleX;
        const y = layer.y * scaleY;

        const lines = layer.text.split('\n');
        const lineHeight = fontSize * 1.2;

        let maxWidth = 0;
        lines.forEach(line => {
          const w = ctx.measureText(line).width;
          if (w > maxWidth) maxWidth = w;
        });

        const rectPaddingX = 20;
        const rectPaddingY = 10;
        const rectW = maxWidth + rectPaddingX * 2;
        const rectH = (lineHeight * lines.length) + rectPaddingY * 2;

        if (layer.bg === 'solid') {
          ctx.fillStyle = layer.color;
          drawRoundedRect(ctx, x - rectPaddingX, y - rectPaddingY, rectW, rectH, 16);
          ctx.fill();
          ctx.fillStyle = (layer.color === '#ffffff' || layer.color === '#00f2ff' || layer.color === '#39ff14') ? '#000000' : '#ffffff';
        } else if (layer.bg === 'highlight') {
          ctx.fillStyle = `${layer.color}33`;
          drawRoundedRect(ctx, x - rectPaddingX, y - rectPaddingY, rectW, rectH, 16);
          ctx.fill();
          ctx.strokeStyle = `${layer.color}44`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = layer.color;
        } else {
          if (layer.shadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;
          }
          ctx.fillStyle = layer.color;
        }

        lines.forEach((line, idx) => {
          const textX = x;
          const textY = y + idx * lineHeight;
          ctx.fillText(line, textX, textY);
        });

        ctx.restore();
      }

      // 5. Draw stickers
      for (const sticker of stickerLayers) {
        ctx.save();
        const sx = sticker.x * scaleX;
        const sy = sticker.y * scaleY;
        const stScale = (sticker.scale || 1) * scaleX;

        ctx.translate(sx, sy);
        ctx.scale(stScale, stScale);

        if (sticker.type === 'location' || sticker.type === 'mention' || sticker.type === 'hashtag' || sticker.type === 'link') {
          const isMagenta = sticker.type === 'hashtag';
          const capsuleBg = isMagenta ? '#ff007f' : '#00f2ff';
          const capsuleTextColor = isMagenta ? '#ffffff' : '#000000';
          
          ctx.font = 'bold 14px Inter, sans-serif';
          const label = sticker.type === 'mention' ? `@${sticker.content.replace('@', '')}` :
                        sticker.type === 'hashtag' ? `#${sticker.content.replace('#', '')}` :
                        sticker.linkData?.label || sticker.content;

          const textW = ctx.measureText(label).width;
          const padX = 20;
          const padY = 10;
          const capW = textW + padX * 2 + 15;
          const capH = 34;

          ctx.fillStyle = capsuleBg;
          drawRoundedRect(ctx, -capW / 2, -capH / 2, capW, capH, 17);
          ctx.fill();

          ctx.fillStyle = capsuleTextColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 13px Inter, sans-serif';
          ctx.fillText(label, 5, 0);
        } else if (sticker.type === 'emoji') {
          ctx.font = '48px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sticker.content, 0, 0);
        } else if (sticker.type === 'gif') {
          const gifImg = new Image();
          gifImg.crossOrigin = 'anonymous';
          gifImg.src = sticker.content;
          await new Promise((resolve) => {
            gifImg.onload = resolve;
            gifImg.onerror = resolve;
          });
          if (gifImg.complete && gifImg.naturalWidth) {
            const gw = 120;
            const gh = (gifImg.naturalHeight / gifImg.naturalWidth) * gw;
            ctx.drawImage(gifImg, -gw / 2, -gh / 2, gw, gh);
          }
        } else if (sticker.type === 'poll') {
          const pollQ = sticker.pollData?.question || 'Simulation active?';
          const opt1 = sticker.pollData?.options[0].label || 'Yes';
          const opt2 = sticker.pollData?.options[1].label || 'No';

          const cardW = 200;
          const cardH = 120;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          drawRoundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 20);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.fillText(pollQ, 0, -cardH / 2 + 15);

          ctx.fillStyle = 'rgba(0, 242, 255, 0.2)';
          drawRoundedRect(ctx, -cardW / 2 + 15, -cardH / 2 + 45, cardW - 30, 26, 8);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 242, 255, 0.4)';
          ctx.stroke();

          ctx.fillStyle = '#00f2ff';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 10px Inter, sans-serif';
          ctx.fillText(opt1, 0, -cardH / 2 + 58);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          drawRoundedRect(ctx, -cardW / 2 + 15, -cardH / 2 + 78, cardW - 30, 26, 8);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillText(opt2, 0, -cardH / 2 + 91);
        } else if (sticker.type === 'quiz') {
          const quizQ = sticker.quizData?.question || 'Knowledge Test';
          const options = sticker.quizData?.options || [];

          const cardW = 220;
          const cardH = 160;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          drawRoundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 24);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.fillText(quizQ, 0, -cardH / 2 + 20);

          options.forEach((opt, idx) => {
            const isCorrect = idx === sticker.quizData?.correctIndex;
            ctx.fillStyle = isCorrect ? 'rgba(0, 242, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)';
            const optY = -cardH / 2 + 55 + idx * 24;
            drawRoundedRect(ctx, -cardW / 2 + 15, optY, cardW - 30, 20, 8);
            ctx.fill();
            ctx.strokeStyle = isCorrect ? 'rgba(0, 242, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
            ctx.stroke();

            ctx.fillStyle = isCorrect ? '#00f2ff' : 'rgba(255, 255, 255, 0.5)';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.fillText(opt, 0, optY + 10);
          });
        } else if (sticker.type === 'countdown') {
          const title = sticker.countdownData?.title || 'Countdown';
          const cardW = 220;
          const cardH = 100;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          drawRoundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 20);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.stroke();

          ctx.fillStyle = '#00f2ff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(title.toUpperCase(), 0, -cardH / 2 + 15);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px monospace';
          ctx.fillText('00 : 00 : 00 : 00', 0, -cardH / 2 + 40);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.font = '8px Inter, sans-serif';
          ctx.fillText('DAYS   HRS   MIN   SEC', 0, -cardH / 2 + 68);
        } else if (sticker.type === 'slider') {
          const promptText = sticker.sliderData?.prompt || 'Excited?';
          const emojiSym = sticker.sliderData?.emoji || '😍';

          const cardW = 220;
          const cardH = 90;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          drawRoundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 20);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.fillText(promptText, 0, -cardH / 2 + 15);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          drawRoundedRect(ctx, -cardW / 2 + 20, -cardH / 2 + 50, cardW - 40, 8, 4);
          ctx.fill();

          ctx.font = '24px Arial';
          ctx.fillText(emojiSym, -30, -cardH / 2 + 40);
        } else if (sticker.type === 'music') {
          const songName = sticker.musicData?.song?.title || sticker.musicData?.song?.name || sticker.content;
          const artistName = sticker.musicData?.song?.artist || 'Unknown Artist';

          const cardW = 200;
          const cardH = 64;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          drawRoundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 16);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(-cardW / 2 + 12, -cardH / 2 + 12, 40, 40);

          ctx.font = 'bold 10px Inter, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(songName.substring(0, 18), -cardW / 2 + 62, -cardH / 2 + 15);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.font = '8px Inter, sans-serif';
          ctx.fillText(artistName.substring(0, 20), -cardW / 2 + 62, -cardH / 2 + 32);
        }

        ctx.restore();
      }

      // 6. Draw Captions (if any exist!)
      if (storyCaption.trim()) {
        ctx.save();
        ctx.font = 'bold 18px Inter, sans-serif';
        const capText = storyCaption;
        const capW = ctx.measureText(capText).width;
        const padX = 20;
        const padY = 10;
        const boxW = Math.min(capW + padX * 2, 900);
        const boxH = 44;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        drawRoundedRect(ctx, (canvas.width - boxW) / 2, canvas.height - 300, boxW, boxH, 12);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(capText, canvas.width / 2, canvas.height - 300 + boxH / 2);
        ctx.restore();
      }

      const link = document.createElement('a');
      link.download = `story_frame_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      addToast({
        title: "Story Saved",
        message: "Your story composition has been successfully exported to your downloads folder.",
        type: "success"
      });
    } catch (err) {
      logger.error("Save frame failure:", err);
      addToast({
        title: "Export Failed",
        message: "Could not composite layers for local download.",
        type: "warning"
      });
    }
  };

  // Stickers handlers
  const selectSticker = (sticker: any) => {
    if (sticker.category === 'Mention') {
      setMentionSearchOpen(true);
      setStickersOpen(false);
      return;
    }

    if (sticker.type === 'poll') {
      setPollEditorOpen(true);
      setStickersOpen(false);
      return;
    }

    if (sticker.type === 'quiz') {
      setQuizEditorOpen(true);
      setStickersOpen(false);
      return;
    }

    if (sticker.type === 'question') {
      setQBoxEditorOpen(true);
      setStickersOpen(false);
      return;
    }

    if (sticker.type === 'location') {
      setLocationEditorOpen(true);
      setStickersOpen(false);
      return;
    }

    if (sticker.type === 'countdown') {
      setCountdownEditorOpen(true);
      setStickersOpen(false);
      return;
    }

    if (sticker.type === 'slider') {
      setSliderEditorOpen(true);
      setStickersOpen(false);
      return;
    }

    if (sticker.type === 'link') {
      setLinkEditorOpen(true);
      setStickersOpen(false);
      return;
    }

    if (sticker.type === 'hashtag') {
      setHashtagDraft('');
      setHashtagEditorOpen(true);
      setStickersOpen(false);
      return;
    }

    if (sticker.type === 'music') {
      setMusicStickerEditorOpen(true);
      setStickersOpen(false);
      return;
    }

    if (sticker.type === 'gif') {
      setGiphyOpen(true);
      setGiphyTab('trending');
      setStickersOpen(false);
      return;
    }

    const newLayer: StickerLayer = {
      id: Date.now().toString(),
      type: sticker.type,
      content: sticker.content,
      x: 100,
      y: 280,
      scale: 1
    };
    setStickerLayers(prev => [...prev, newLayer]);
    setStickersOpen(false);
  };

  const handleMentionSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMentionSearchQuery(val);
    if (!val.trim()) {
      setMentionSearchResults([]);
      return;
    }

    setIsSearchingMentions(true);
    try {
      const results = await searchUsers(val);
      setMentionSearchResults(results);
    } catch (e) {
      logger.error("Mention search failed", e);
    } finally {
      setIsSearchingMentions(false);
    }
  };

  const selectMentionUser = (targetUser: any) => {
    const username = targetUser.username || targetUser.displayName || 'user';
    const newLayer: StickerLayer = {
      id: Date.now().toString(),
      type: 'mention',
      content: `@${username}`,
      mentionId: targetUser.id,
      x: 100,
      y: 280,
      scale: 1
    };
    setStickerLayers(prev => [...prev, newLayer]);
    setMentionSearchOpen(false);
    setMentionSearchQuery('');
    setMentionSearchResults([]);
  };

  const createPollSticker = () => {
    if (!pollQuestion.trim()) {
      addToast({ title: "Inquiry Error", message: "Enter a question for the poll", type: "warning" });
      return;
    }
    const newLayer: StickerLayer = {
      id: Date.now().toString(),
      type: 'poll',
      content: pollQuestion,
      pollData: {
        question: pollQuestion,
        options: [
          { label: pollOption1 || 'Yes', votes: [] },
          { label: pollOption2 || 'No', votes: [] }
        ]
      },
      x: 100,
      y: 250,
      scale: 1
    };
    setStickerLayers(prev => [...prev, newLayer]);
    setPollEditorOpen(false);
    setPollQuestion('');
    setPollOption1('Yes');
    setPollOption2('No');
  };

  const createQuizSticker = () => {
    if (!quizQuestion.trim()) {
      addToast({ title: "Inquiry Error", message: "Enter a question for the quiz", type: "warning" });
      return;
    }
    const validOptions = quizOptions.filter(o => o.trim() !== '');
    if (validOptions.length < 2) {
      addToast({ title: "Option Error", message: "Enter at least 2 options", type: "warning" });
      return;
    }

    const newLayer: StickerLayer = {
      id: Date.now().toString(),
      type: 'quiz',
      content: quizQuestion,
      quizData: {
        question: quizQuestion,
        options: quizOptions.map(o => o.trim()).filter(o => o !== ''),
        correctIndex: quizCorrectIndex,
        responses: {}
      },
      x: 100,
      y: 250,
      scale: 1
    };
    setStickerLayers(prev => [...prev, newLayer]);
    setQuizEditorOpen(false);
    setQuizQuestion('');
    setQuizOptions(['', '', '', '']);
    setQuizCorrectIndex(0);
  };

  const createQuestionBoxSticker = () => {
    const newLayer: StickerLayer = {
      id: Date.now().toString(),
      type: 'question',
      content: qBoxPrompt || 'Ask me anything...',
      questionBoxData: {
        prompt: qBoxPrompt || 'Ask me anything...',
        showAttribution: qBoxShowAttribution
      },
      x: 100,
      y: 250,
      scale: 1
    };
    setStickerLayers(prev => [...prev, newLayer]);
    setQBoxEditorOpen(false);
    setQBoxPrompt('Ask me anything...');
    setQBoxShowAttribution(false);
  };

  const createLocationSticker = () => {
    if (!locationValue.trim()) {
      addToast({ title: "Location Error", message: "Enter a location name", type: "warning" });
      return;
    }
    const newLayer: StickerLayer = {
      id: Date.now().toString(),
      type: 'location',
      content: locationValue.trim(),
      x: 100,
      y: 250,
      scale: 1
    };
    setStickerLayers(prev => [...prev, newLayer]);
    setLocationEditorOpen(false);
    setLocationValue('');
  };

  const createCountdownSticker = () => {
    if (!countdownTitle.trim() || !countdownDate) {
      addToast({ title: "Configuration Error", message: "Enter title and target date", type: "warning" });
      return;
    }
    const newLayer: StickerLayer = {
      id: Date.now().toString(),
      type: 'countdown',
      content: countdownTitle,
      countdownData: {
        title: countdownTitle,
        targetDate: countdownDate
      },
      x: 100,
      y: 250,
      scale: 1
    };
    setStickerLayers(prev => [...prev, newLayer]);
    setCountdownEditorOpen(false);
    setCountdownTitle('');
    setCountdownDate('');
  };

  const createSliderSticker = () => {
    const newLayer: StickerLayer = {
      id: Date.now().toString(),
      type: 'slider',
      content: sliderPrompt,
      sliderData: {
        prompt: sliderPrompt,
        emoji: sliderEmoji,
        responses: {}
      },
      x: 100,
      y: 250,
      scale: 1
    };
    setStickerLayers(prev => [...prev, newLayer]);
    setSliderEditorOpen(false);
    setSliderPrompt('How excited are you?');
    setSliderEmoji('😍');
  };

  const createHashtagSticker = () => {
    if (!hashtagDraft.trim()) {
      addToast({ title: "Hashtag Error", message: "Enter a hashtag first", type: "warning" });
      return;
    }
    const newLayer: StickerLayer = {
      id: Date.now().toString(),
      type: 'hashtag',
      content: `#${hashtagDraft.trim().replace(/^#/, '')}`,
      x: 100,
      y: 200,
      scale: 1
    };
    setStickerLayers(prev => [...prev, newLayer]);
    setHashtagEditorOpen(false);
  };

  const createLinkSticker = () => {
    if (!linkUrl.trim()) {
      addToast({ title: "Link Error", message: "URL is required", type: "warning" });
      return;
    }
    try {
      new URL(linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`);
    } catch (e) {
      addToast({ title: "Invalid URL", message: "Please enter a valid URL", type: "warning" });
      return;
    }

    const newLayer: StickerLayer = {
      id: Date.now().toString(),
      type: 'link',
      content: linkLabel || linkUrl,
      linkData: {
        url: linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`,
        label: linkLabel || 'Visit Link'
      },
      x: 100,
      y: 250,
      scale: 1
    };
    setStickerLayers(prev => [...prev, newLayer]);
    setLinkEditorOpen(false);
    setLinkUrl('');
    setLinkLabel('');
  };

  const deleteStickerLayer = (id: string) => {
    setStickerLayers(prev => prev.filter(s => s.id !== id));
  };

  // Drawing Brush Engine
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    setCurrentPath([{ x, y }]);
  };

  const drawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !currentPath) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    const newPoints = [...currentPath, { x, y }];
    setCurrentPath(newPoints);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      
      if (brushType === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (brushType === 'neon') {
        ctx.shadowBlur = brushSize * 1.5;
        ctx.shadowColor = brushColor;
      } else if (brushType === 'highlighter') {
        ctx.globalAlpha = 0.5;
      }

      ctx.beginPath();
      ctx.moveTo(currentPath[currentPath.length - 1].x, currentPath[currentPath.length - 1].y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    }
  };

  const endDrawing = () => {
    if (currentPath) {
      const newPath: DrawingPath = {
        id: Date.now().toString(),
        points: currentPath,
        color: brushColor,
        brushSize,
        brushType
      };
      setDrawingPaths(prev => [...prev, newPath]);
      setCurrentPath(null);
    }
  };

  const clearDrawing = () => {
    setDrawingPaths([]);
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Repaint drawing layers
  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingPaths.forEach(path => {
      ctx.save();
      
      if (path.brushType === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (path.brushType === 'neon') {
        ctx.shadowBlur = path.brushSize * 1.5;
        ctx.shadowColor = path.color;
      } else if (path.brushType === 'highlighter') {
        ctx.globalAlpha = 0.5;
      }

      ctx.beginPath();
      path.points.forEach((point, idx) => {
        if (idx === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
      ctx.restore();
    });
  }, [drawingPaths]);

  // Draft Cache storage
  const saveAsDraft = () => {
    const newDraft = {
      id: Date.now().toString(),
      mode,
      capturedMedia,
      textLayers,
      stickerLayers,
      currentFilter,
      activeMusic,
      createdAt: new Date().toISOString()
    };
    const updated = [newDraft, ...drafts];
    setDrafts(updated);
    localStorage.setItem('aeirmist_story_drafts', JSON.stringify(updated));
    addToast({
      title: "Draft Saved",
      message: "Story draft successfully saved locally.",
      type: "success"
    });
  };

  const loadDraft = (draft: any) => {
    setMode(draft.mode || 'story');
    setCapturedMedia(draft.capturedMedia || null);
    setTextLayers(draft.textLayers || []);
    setStickerLayers(draft.stickerLayers || []);
    setCurrentFilter(draft.currentFilter || 'none');
    setActiveMusic(draft.activeMusic || null);
    setShowDraftsList(false);
  };

  const deleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = drafts.filter(d => d.id !== id);
    setDrafts(updated);
    localStorage.setItem('aeirmist_story_drafts', JSON.stringify(updated));
  };

  // Broadcast story
  const handlePublishStory = async () => {
    if (!user || !profile || isPublishing) return;
    setIsPublishing(true);

    try {
      let finalUrl = uploadState.mediaUrl || capturedMedia?.url;
      let finalFile = capturedMedia?.file;

      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;

      let needsCompositing = false;

      // Force compositing if it's a text-only story, has photo layers, text layers, or stickers
      if (mode === 'text' || photoLayers.length > 0 || textLayers.length > 0 || stickerLayers.length > 0 || drawingPaths.length > 0) {
        needsCompositing = true;
      }

      // 1. Handle Free-Form Photo Layers & Text/Sticker compositing
      if (needsCompositing && mode !== 'layout' && mode !== 'boomerang') {
        ctx.fillStyle = '#0a0b10';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // A. Draw base background (Image/Video frame or Color/Gradient)
        if (capturedMedia && !capturedMedia.isSolidBackground && capturedMedia.url) {
          try {
            const bgImg = new Image();
            bgImg.crossOrigin = 'anonymous';
            bgImg.src = capturedMedia.url;
            await new Promise((resolve, reject) => { 
              bgImg.onload = resolve; 
              bgImg.onerror = reject;
            });
            
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            if (mediaFlipX) ctx.scale(-1, 1);
            ctx.rotate((mediaRotation * Math.PI) / 180);
            ctx.scale(mediaScale, mediaScale);
            ctx.drawImage(bgImg, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
            ctx.restore();
          } catch (err) {
            logger.warn("Background image load failed during compositing", err);
          }
        } else if (mode === 'text') {
          // Render current gradient/background for text stories
          const activeBg = BG_GRADIENTS[textModeBgIdx];
          if (activeBg.includes('gradient')) {
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            // Rough mapping of Tailwind gradients to canvas gradients
            if (activeBg.includes('emerald')) {
              grad.addColorStop(0, '#10b981'); grad.addColorStop(1, '#064e3b');
            } else if (activeBg.includes('3a0ca3')) {
              grad.addColorStop(0, '#3a0ca3'); grad.addColorStop(1, '#c77dff');
            } else {
              grad.addColorStop(0, '#0f111a'); grad.addColorStop(1, '#010102');
            }
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = activeBg.includes('080808') ? '#080808' : '#1e1e24';
          }
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          // Instagram-style blurred background if we have any photos
          const bottomPhoto = photoLayers.length > 0 ? [...photoLayers].sort((a, b) => a.zIndex - b.zIndex)[0] : null;
          if (bottomPhoto && bottomPhoto.url) {
            try {
              const bgImg = new Image();
              bgImg.crossOrigin = 'anonymous';
              bgImg.src = bottomPhoto.url;
              await new Promise((resolve, reject) => {
                bgImg.onload = resolve;
                bgImg.onerror = reject;
              });
              
              ctx.save();
              ctx.filter = 'blur(40px) brightness(0.7)';
              const canvasAspect = canvas.width / canvas.height;
              const imgAspect = bgImg.width / bgImg.height;
              let drawWidth = canvas.width, drawHeight = canvas.height;
              if (imgAspect > canvasAspect) drawWidth = canvas.height * imgAspect;
              else drawHeight = canvas.width / imgAspect;
              
              ctx.translate(canvas.width / 2, canvas.height / 2);
              ctx.scale(1.25, 1.25);
              ctx.drawImage(bgImg, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
              ctx.restore();
            } catch (err) {
              const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
              grad.addColorStop(0, '#0f111a'); grad.addColorStop(1, '#010102');
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
          } else {
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, '#0f111a'); grad.addColorStop(1, '#010102');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }

        // B. Draw photo layers
        const sortedPhotos = [...photoLayers].sort((a, b) => a.zIndex - b.zIndex);
        const viewport = document.getElementById('story_canvas_body');
        const viewportWidth = viewport ? viewport.clientWidth : 420;
        const viewportHeight = viewport ? viewport.clientHeight : 746;
        const scaleX = 1080 / viewportWidth;
        const scaleY = 1920 / viewportHeight;

        for (const photo of sortedPhotos) {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = photo.url;
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });

            ctx.save();
            const w = photo.width * photo.scale * scaleX;
            const h = photo.height * photo.scale * scaleY;
            const x = photo.x * scaleX;
            const y = photo.y * scaleY;
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate((photo.rotation * Math.PI) / 180);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
          } catch (e) { logger.warn("Failed to composite photo layer", e); }
        }

        // C. Draw Drawings
        if (drawingCanvasRef.current) {
          ctx.drawImage(drawingCanvasRef.current, 0, 0, 1080, 1920);
        }
        
        // D. Render Text Layers to Canvas (High Fidelity)
        for (const text of textLayers) {
          ctx.save();
          const fontData = STORY_FONTS.find(f => f.id === text.font) || STORY_FONTS[0];
          ctx.font = `${text.size * scaleY}px ${fontData.family}`;
          ctx.fillStyle = text.color;
          ctx.textAlign = text.align;
          ctx.textBaseline = 'middle';
          
          const x = text.x * scaleX;
          const y = text.y * scaleY;
          
          if (text.bg !== 'none') {
            const metrics = ctx.measureText(text.text);
            const textWidth = metrics.width;
            const textHeight = text.size * scaleY;
            const padding = 20 * scaleX;
            
            ctx.fillStyle = text.bg === 'solid' ? text.color : `${text.color}33`;
            const rectX = text.align === 'center' ? x - textWidth/2 - padding : text.align === 'right' ? x - textWidth - padding*2 : x - padding;
            
            // Rounded rect for text bg
            const r = 20 * scaleX;
            ctx.beginPath();
            ctx.roundRect(rectX, y - textHeight/2 - padding, textWidth + padding*2, textHeight + padding*2, r);
            ctx.fill();
            
            ctx.fillStyle = text.bg === 'solid' ? (text.color === '#ffffff' ? '#000000' : '#ffffff') : text.color;
          }
          
          ctx.fillText(text.text, x, y);
          ctx.restore();
        }
      }
      // 2. Handle original Layout Mode (for backward compatibility if layoutSlots used, though now we prefer free-form templates)
      else if (mode === 'layout' && currentLayout) {
        needsCompositing = true;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < layoutSlots.length; i++) {
          const slot = layoutSlots[i];
          if (!slot.media) continue;

          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = slot.media.url;
          await new Promise((resolve) => { img.onload = resolve; });

          // Determine slot rect based on template
          let x = 0, y = 0, w = canvas.width, h = canvas.height;
          if (currentLayout === 'split-v') {
            w = canvas.width / 2;
            x = i === 0 ? 0 : w;
          } else if (currentLayout === 'split-h') {
            h = canvas.height / 2;
            y = i === 0 ? 0 : h;
          } else if (currentLayout === 'grid-4') {
            w = canvas.width / 2;
            h = canvas.height / 2;
            x = (i % 2) * w;
            y = Math.floor(i / 2) * h;
          } else if (currentLayout === 'l-shape') {
            if (i === 0) { h = canvas.height * (2/3); }
            else { 
              h = canvas.height / 3; 
              y = canvas.height * (2/3); 
              w = canvas.width / 2;
              x = (i - 1) * w;
            }
          } else if (currentLayout === 'large-2-small') {
            if (i === 0) { w = canvas.width * (2/3); }
            else {
              w = canvas.width / 3;
              x = canvas.width * (2/3);
              h = canvas.height / 2;
              y = (i - 1) * h;
            }
          }

          // Draw cropped & centered
          const imgAspect = img.width / img.height;
          const slotAspect = w / h;
          let sx, sy, sw, sh;
          if (imgAspect > slotAspect) {
            sh = img.height;
            sw = sh * slotAspect;
            sx = (img.width - sw) / 2;
            sy = 0;
          } else {
            sw = img.width;
            sh = sw / slotAspect;
            sx = 0;
            sy = (img.height - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        }
      } 
      // 3. Handle Drawing Compositing for single Image
      else if (capturedMedia?.type === 'image' && drawingPaths.length > 0 && drawingCanvasRef.current) {
        needsCompositing = true;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = capturedMedia.url;
        await new Promise((resolve) => { img.onload = resolve; });
        ctx.drawImage(img, 0, 0, 1080, 1920);
        ctx.drawImage(drawingCanvasRef.current, 0, 0);
      }

      if (needsCompositing) {
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
        finalFile = new File([blob], `story_composite_${Date.now()}.png`, { type: 'image/png' });
        finalUrl = URL.createObjectURL(blob);
      }

      publishStory({
        file: finalFile,
        url: finalUrl,
        type: (mode === 'text' || mode === 'layout') ? 'image' : (capturedMedia?.type || 'image'),
        mode,
        textLayers,
        stickerLayers,
        activeMusic,
        currentFilter,
        audience,
        caption: storyCaption.trim(),
        rotation: mediaRotation,
        scale: mediaScale,
        flipX: mediaFlipX,
        brightness: mediaBrightness,
        contrast: mediaContrast,
        isVideoMuted,
        fitMode: mediaFit,
        boomerangFrames: mode === 'boomerang' ? boomerangFrames : undefined
      });

      addToast({
        title: "Story shared",
        message: "Your story is being shared.",
        type: "success"
      });

      onClose();
    } catch (e) {
      logger.error("Publishing failure:", e);
      setIsPublishing(false);
      setUploadState(prev => ({ ...prev, isUploading: false, error: true }));
      addToast({
        title: "Couldn't Share Story",
        message: "Something went wrong while sharing your story. Please try again.",
        type: "warning"
      });
    }
  };

  const publishMultiStorySet = async () => {
    if (!user || !profile) return;
    
    if (uploadState.isUploading) {
      addToast({
        title: "Still Uploading",
        message: "Your stories are still uploading. Please wait a moment.",
        type: "warning"
      });
      return;
    }

    setUploadState({ isUploading: true, progress: 0, error: false, mediaUrl: null });

    try {
      // Save current state first
      const updatedItems = [...multiStoryItems];
      updatedItems[currentMultiStoryIndex] = {
        url: capturedMedia?.url || '',
        type: 'image' as const,
        textLayers,
        stickerLayers,
        photoLayers,
        currentFilter,
        activeMusic,
        storyCaption
      };

      addToast({
        title: "Sharing Stories",
        message: `Sharing ${updatedItems.length} stories...`,
        type: "info"
      });

      // Loop over each story item and publish it sequentially
      for (let i = 0; i < updatedItems.length; i++) {
        setUploadState(prev => ({ ...prev, progress: Math.round(((i + 1) / updatedItems.length) * 100) }));
        const item = updatedItems[i];

        // 1. Create a canvas to composite layers if they exist
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d')!;

        // Fill background
        ctx.fillStyle = '#0a0b10';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw base background image
        if (item.url) {
          const bgImg = new Image();
          bgImg.crossOrigin = 'anonymous';
          bgImg.src = item.url;
          await new Promise((resolve) => { bgImg.onload = resolve; });
          ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        }

        // Draw individual layers
        const sortedPhotos = [...item.photoLayers].sort((a, b) => a.zIndex - b.zIndex);
        for (const photo of sortedPhotos) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = photo.url;
          await new Promise((resolve) => { img.onload = resolve; });

          ctx.save();
          // Use standard viewport sizes for conversion
          const scaleX = 1080 / 420;
          const scaleY = 1920 / 746;
          const w = photo.width * photo.scale * scaleX;
          const h = photo.height * photo.scale * scaleY;
          const x = photo.x * scaleX;
          const y = photo.y * scaleY;

          const cx = x + w / 2;
          const cy = y + h / 2;
          ctx.translate(cx, cy);
          ctx.rotate((photo.rotation * Math.PI) / 180);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.restore();
        }

        // Since sequential is image-based mostly, let's convert the canvas to a blob
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
        const finalFile = new File([blob], `story_seq_${i}_${Date.now()}.png`, { type: 'image/png' });
        const finalUrl = await uploadMedia(finalFile, `users/${user.uid}/stories`, (p) => {}, MediaQuality.STORY);

        publishStory({
          file: finalFile,
          url: finalUrl,
          type: 'image',
          mode: 'story',
          textLayers: item.textLayers,
          stickerLayers: item.stickerLayers,
          activeMusic: item.activeMusic,
          currentFilter: item.currentFilter,
          audience,
          rotation: 0,
          scale: 1,
          flipX: false,
          brightness: 100,
          contrast: 100
        });
      }

      setUploadState({ isUploading: false, progress: 100, error: false, mediaUrl: null });
      addToast({
        title: "Published Successfully",
        message: `Successfully shared all ${updatedItems.length} stories!`,
        type: "success"
      });
      onClose();
    } catch (err) {
      logger.error("Failed to publish sequential stories:", err);
      setUploadState({ isUploading: false, progress: 0, error: true, mediaUrl: null });
      addToast({
        title: "Sharing Failed",
        message: "Failed to upload your story items. Please try again.",
        type: "warning"
      });
    }
  };

  const toolRailItems = [
    ...(capturedMedia?.type === 'video' ? [{
      id: 'sound',
      label: isVideoMuted ? 'Mute' : 'Audio On',
      icon: isVideoMuted ? VolumeX : Volume2,
      onClick: () => {
        setIsVideoMuted(prev => !prev);
        addToast({
          title: isVideoMuted ? "Video Sound On" : "Video Muted",
          message: isVideoMuted ? "Original audio enabled for story" : "Original audio muted",
          type: "info"
        });
      },
      isActive: !isVideoMuted
    }] : []),
    ...(capturedMedia ? [{
      id: 'fit',
      label: mediaFit === 'cover' ? 'Fill' : 'Fit Frame',
      icon: mediaFit === 'cover' ? Maximize2 : Minimize2,
      onClick: () => {
        const nextFit = mediaFit === 'cover' ? 'contain' : 'cover';
        setMediaFit(nextFit);
        addToast({
          title: nextFit === 'contain' ? "Fit Frame (Original Ratio)" : "Fill Screen (9:16)",
          message: nextFit === 'contain' ? "Original video aspect ratio preserved with background blur" : "Cropped to fill story screen",
          type: "info"
        });
      },
      isActive: mediaFit === 'contain'
    }] : []),
    {
      id: 'text',
      label: 'Text',
      icon: Type,
      onClick: addTextLayer,
      isActive: textEditorOpen
    },
    {
      id: 'stickers',
      label: 'Stickers',
      icon: Smile,
      onClick: () => setStickersOpen(true),
      isActive: stickersOpen
    },
    {
      id: 'music',
      label: 'Music',
      icon: Music,
      onClick: () => setMusicOpen(true),
      isActive: musicOpen
    },
    {
      id: 'effects',
      label: 'Effects',
      icon: Sparkles,
      onClick: () => setEffectsOpen(true),
      isActive: effectsOpen
    },
    {
      id: 'mention',
      label: 'Mention',
      icon: AtSign,
      onClick: () => setMentionSearchOpen(true),
      isActive: mentionSearchOpen
    },
    {
      id: 'draw',
      label: 'Draw',
      icon: Paintbrush,
      onClick: () => {
        setIsDrawingMode(true);
        setDrawToolsOpen(true);
      },
      isActive: drawToolsOpen
    },
    {
      id: 'insert_photo',
      label: 'Photo',
      icon: ImagePlus,
      onClick: () => insertPhotoInputRef.current?.click(),
      isActive: false
    },
    {
      id: 'save',
      label: 'Save',
      icon: Download,
      onClick: saveStoryFrame,
      isActive: false
    },
    {
      id: 'more',
      label: 'More',
      icon: MoreHorizontal,
      onClick: () => setIsMoreOpen(prev => !prev),
      isActive: isMoreOpen
    }
  ];

  const filteredStickers = STICKERS.filter(s => {
    const matchesSearch = s.content.toLowerCase().includes(stickerSearch.toLowerCase()) || 
                          s.category.toLowerCase().includes(stickerSearch.toLowerCase());
    const matchesCategory = activeStickerCategory === 'All' || s.category === activeStickerCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-2xl text-white select-none overflow-hidden font-sans flex items-center justify-center pointer-events-auto"
      ref={containerRef}
      onDragOver={(e) => { e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleLoadedFiles(files);
      }}
    >
      {/* Global Close Button for Desktop */}
      <button 
        onClick={capturedMedia ? handleBackPress : onClose} 
        className="hidden sm:flex fixed top-6 right-6 z-[2100] w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md items-center justify-center text-white hover:scale-105 transition-all cursor-pointer border border-white/10 shadow-lg"
        title="Exit Studio"
      >
        <X size={20} />
      </button>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        multiple 
        accept="image/*,video/*" 
        className="hidden" 
      />

      {/* Dynamic blurred ambient lighting background behind the centered card on desktop */}
      {capturedMedia && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-20 select-none hidden sm:block">
          <img 
            src={capturedMedia.url} 
            className="w-full h-full object-cover scale-110 blur-3xl saturate-150" 
            alt="" 
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* --- FLASH EFFECT GLOW --- */}
      <AnimatePresence>
        {isFlashActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-[100] pointer-events-none"
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>

      {/* --- CENTRALIZED 9:16 INSTAGRAM-LIKE CANVAS FRAME --- */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handlePreviewDoubleTap}
        id="story_studio_viewport"
        className="relative w-full h-full sm:h-[88vh] sm:w-auto sm:aspect-[9/16] sm:max-w-[430px] sm:max-h-[840px] sm:rounded-[36px] sm:border sm:border-white/10 sm:shadow-[0_24px_80px_rgba(0,0,0,0.95)] overflow-hidden bg-black flex flex-col z-10 transition-all duration-300"
      >
        {/* Sequential Story Progress Bar (Instagram style) */}
        {multiStoryItems.length > 0 && (
          <div className="absolute top-3 inset-x-0 px-3 z-[110] flex gap-1 pointer-events-none">
            {multiStoryItems.map((item, idx) => {
              const isCompleted = idx < currentMultiStoryIndex;
              const isActive = idx === currentMultiStoryIndex;
              return (
                <div key={idx} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden relative">
                  <div 
                    className={`h-full bg-white transition-all duration-300 ${
                      isCompleted ? 'w-full' : isActive ? 'w-full' : 'w-0'
                    }`} 
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* --- ADD TO STORY GALLERY SELECTOR OVERLAY --- */}
        {isGallerySelectorOpen && (
          <div className="absolute inset-0 bg-black z-[120] flex flex-col text-white pointer-events-auto overflow-y-auto no-scrollbar">
            
            {/* === TOP BAR === */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 bg-black/80 backdrop-blur-md sticky top-0 z-50">
              <button 
                onClick={() => {
                  setIsGallerySelectorOpen(false);
                  setSelectedGalleryItems([]);
                  setIsMultiSelectMode(false);
                }} 
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white border border-white/10 active:scale-95 transition-all"
                title="Cancel"
              >
                <X size={18} />
              </button>
              
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white">Add to Story</h2>
              
              <div className="relative">
                <button 
                  onClick={() => setShowQuickSettingsMenu(prev => !prev)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all active:scale-95 ${showQuickSettingsMenu ? 'bg-aeirmist-cyan border-aeirmist-cyan text-black shadow-[0_0_15px_rgba(0,242,255,0.4)]' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`}
                  title="Settings"
                >
                  <Settings size={18} />
                </button>
                
                {/* Quick Settings Dropdown */}
                {showQuickSettingsMenu && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0f111a] border border-white/10 shadow-2xl p-3.5 z-50 text-left">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/40 block mb-2.5">Studio Preferences</span>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider">High Fidelity</span>
                        <input type="checkbox" defaultChecked className="accent-aeirmist-cyan h-3.5 w-3.5" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider">Auto-Save Frame</span>
                        <input type="checkbox" defaultChecked className="accent-aeirmist-cyan h-3.5 w-3.5" />
                      </div>
                      <button 
                        onClick={() => {
                          addToast({ title: "Preferences Updated", message: "Studio cache cleared successfully.", type: "info" });
                          setShowQuickSettingsMenu(false);
                        }}
                        className="w-full mt-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-wider text-center border border-white/10 transition-all text-white/80 hover:text-white"
                      >
                        Clear Studio Cache
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* === QUICK-ACTION SHORTCUTS ROW (3 cards) === */}
            <div className="px-4 py-4 grid grid-cols-3 gap-3">
              {/* Card 1: Templates */}
              <button 
                onClick={() => {
                  setShowTemplateSelector(prev => !prev);
                  setShowLayoutSelectorForMultiSelect(false);
                }}
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${showTemplateSelector ? 'bg-aeirmist-cyan/15 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`}
              >
                <Sparkles size={18} className={showTemplateSelector ? "animate-pulse" : ""} />
                <span className="text-[9px] font-black uppercase tracking-wider">Templates</span>
              </button>

              {/* Card 2: Music */}
              <button 
                onClick={() => {
                  setIsMusicFirstFlow(true);
                  setMusicOpen(true);
                  setIsGallerySelectorOpen(false);
                }}
                className="aspect-square rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 text-white/80"
              >
                <Music size={18} />
                <span className="text-[9px] font-black uppercase tracking-wider">Music</span>
              </button>

              {/* Card 3: Collage */}
              <button 
                onClick={() => {
                  setCapturedMedia({ url: '', type: 'image', isSolidBackground: true });
                  setIsGallerySelectorOpen(false);
                  setTimeout(() => {
                    insertPhotoInputRef.current?.click();
                  }, 100);
                }}
                className="aspect-square rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 text-white/80"
              >
                <LayoutGrid size={18} />
                <span className="text-[9px] font-black uppercase tracking-wider">Collage</span>
              </button>
            </div>

            {/* === PRESET TEMPLATES DRAWER OVERLAY === */}
            {showTemplateSelector && (
              <div className="px-4 pb-4 bg-black border-b border-white/5">
                <span className="text-[8px] font-black uppercase tracking-widest text-aeirmist-cyan block mb-2.5">Choose Preset Template</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {STORY_TEMPLATES_DATA.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => {
                        setCapturedMedia({ url: tmpl.bg, type: 'image' });
                        setTextLayers(tmpl.textLayers);
                        setStickerLayers(tmpl.stickerLayers);
                        setPhotoLayers([]);
                        setCurrentFilter('none');
                        setActiveMusic(null);
                        setStoryCaption('');
                        setIsGallerySelectorOpen(false);
                        setShowTemplateSelector(false);
                        addToast({ title: "Template Applied", message: `Pre-placed elements loaded onto ${tmpl.label}.`, type: "info" });
                      }}
                      className="relative h-20 rounded-xl overflow-hidden border border-white/10 hover:border-aeirmist-cyan group text-left active:scale-95 transition-all"
                    >
                      <img src={tmpl.bg} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-105 transition-all" alt="" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex items-end p-2.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-white drop-shadow-md">{tmpl.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* === REAL DEVICE GALLERY FILE PICKER PORTAL === */}
            <div className="flex-1 px-4 pb-12 pt-6 flex flex-col items-center justify-center gap-6">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-sm aspect-[4/3] rounded-[2.5rem] bg-[#07090f] border-2 border-dashed border-white/10 hover:border-aeirmist-cyan hover:bg-white/[0.01] active:scale-98 flex flex-col items-center justify-center gap-5 transition-all text-center p-8 group relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              >
                {/* Visual Stack of Photos Animation */}
                <div className="relative w-20 h-16 flex items-center justify-center">
                  <motion.div 
                    animate={{ rotate: -12, x: -16, y: 2 }}
                    transition={{ type: "spring", stiffness: 100 }}
                    className="absolute w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 shadow-md"
                  >
                    <ImageIcon size={20} />
                  </motion.div>
                  <motion.div 
                    animate={{ rotate: 12, x: 16, y: 2 }}
                    transition={{ type: "spring", stiffness: 100 }}
                    className="absolute w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 shadow-md"
                  >
                    <ImageIcon size={20} />
                  </motion.div>
                  <motion.div 
                    className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-aeirmist-cyan to-aeirmist-magenta text-black flex items-center justify-center shadow-2xl z-10 border border-white/20"
                  >
                    <ImagePlus size={22} className="text-black" />
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white group-hover:text-aeirmist-cyan transition-colors">
                    Choose from Device
                  </h3>
                  <p className="text-[10px] text-white/40 font-semibold max-w-[220px] mx-auto leading-relaxed">
                    Select photos or videos from your library. Multi-select is fully supported natively!
                  </p>
                </div>

                {/* Subtle animated light indicator */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-aeirmist-cyan via-aeirmist-magenta to-aeirmist-cyan opacity-20 group-hover:opacity-60 transition-opacity duration-300" />
              </button>
            </div>

            {/* === SELECTED ITEMS REVIEW === */}
            {selectedGalleryItems.length > 0 && (
              <div className="mx-4 mb-32 p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-black uppercase tracking-wider text-aeirmist-cyan flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-aeirmist-cyan animate-pulse" />
                    Selected ({selectedGalleryItems.length})
                  </span>
                  <button 
                    onClick={() => {
                      setSelectedGalleryItems([]);
                      setIsMultiSelectMode(false);
                    }}
                    className="text-[9px] font-black uppercase tracking-wider text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {selectedGalleryItems.map((url, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-xl border border-white/10 overflow-hidden shrink-0 group shadow-md">
                      <img src={url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => {
                          const updated = selectedGalleryItems.filter(item => item !== url);
                          setSelectedGalleryItems(updated);
                          if (updated.length < 2) {
                            setIsMultiSelectMode(false);
                          }
                        }}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-lg"
                        title="Remove"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  ))}
                  
                  {/* Plus item button */}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 rounded-xl bg-white/5 border border-dashed border-white/15 flex flex-col items-center justify-center gap-1 text-white/40 hover:text-white/80 hover:border-white/30 transition-all shrink-0 active:scale-95"
                  >
                    <Plus size={14} />
                    <span className="text-[7px] font-black uppercase tracking-widest">More</span>
                  </button>
                </div>
              </div>
            )}

            {/* === BOTTOM SHEET === */}
            {isMultiSelectMode && selectedGalleryItems.length >= 2 && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/95 to-black/90 border-t border-white/10 px-4 pt-5 pb-8 rounded-t-[20px] flex flex-col gap-4 z-50 animate-in slide-in-from-bottom-20 duration-300 shadow-[0_-12px_40px_rgba(0,0,0,0.8)]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/50">
                    Selected <span className="text-aeirmist-cyan font-black text-xs">{selectedGalleryItems.length}</span> items
                  </span>
                  <button 
                    onClick={() => {
                      setSelectedGalleryItems([]);
                      setIsMultiSelectMode(false);
                    }}
                    className="text-[9px] font-black uppercase tracking-wider text-rose-400 hover:text-rose-300"
                  >
                    Clear All
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <button
                    onClick={() => {
                      setShowLayoutSelectorForMultiSelect(prev => !prev);
                    }}
                    className={`h-12 rounded-xl border flex items-center justify-center gap-2.5 transition-all text-xs font-black uppercase tracking-wider ${showLayoutSelectorForMultiSelect ? 'bg-aeirmist-cyan border-aeirmist-cyan text-black shadow-[0_0_15px_rgba(0,242,255,0.4)]' : 'bg-white/5 border-white/10 text-white/90 hover:bg-white/10'}`}
                  >
                    <LayoutGrid size={16} />
                    <span>Layout</span>
                  </button>

                  <button
                    onClick={() => {
                      const items = selectedGalleryItems.map(url => ({
                        url,
                        type: 'image' as const,
                        textLayers: [],
                        stickerLayers: [],
                        photoLayers: [],
                        currentFilter: 'none',
                        activeMusic: null,
                        storyCaption: ''
                      }));
                      setMultiStoryItems(items);
                      setCurrentMultiStoryIndex(0);

                      setCapturedMedia({ url: items[0].url, type: 'image' });
                      setTextLayers([]);
                      setStickerLayers([]);
                      setPhotoLayers([]);
                      setCurrentFilter('none');
                      setActiveMusic(null);
                      setStoryCaption('');

                      setIsGallerySelectorOpen(false);
                      setIsMultiSelectMode(false);
                      setSelectedGalleryItems([]);
                      addToast({ title: "Sequence Mode", message: `Sequenced ${items.length} individual story frames.`, type: "info" });
                    }}
                    className="h-12 rounded-xl bg-aeirmist-magenta border border-aeirmist-magenta hover:bg-aeirmist-magenta/90 text-white shadow-[0_0_20px_rgba(255,0,127,0.4)] flex items-center justify-center gap-2.5 transition-all text-xs font-black uppercase tracking-wider"
                  >
                    <Layers size={16} />
                    <span>Separate</span>
                  </button>
                </div>

                {showLayoutSelectorForMultiSelect && (
                  <div className="pt-3 border-t border-white/5 mt-1 grid grid-cols-5 gap-2.5">
                    {[
                      { id: 'split-v', label: 'Split V' },
                      { id: 'split-h', label: 'Split H' },
                      { id: 'grid-4', label: 'Grid 4' },
                      { id: 'l-shape', label: 'L-Shape' },
                      { id: 'large-2-small', label: 'Large 2' }
                    ].map((lay) => (
                      <button
                        key={lay.id}
                        onClick={() => {
                          applyUrlsToTemplateLayout(lay.id as LayoutTemplate, selectedGalleryItems);
                          setShowLayoutSelectorForMultiSelect(false);
                          setIsMultiSelectMode(false);
                          setSelectedGalleryItems([]);
                        }}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-aeirmist-cyan text-[8px] font-black uppercase tracking-wider text-center transition-all"
                      >
                        {lay.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Realtime background upload indicator */}
        {uploadState.isUploading && (
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/10 z-50">
            <div 
              className="h-full bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta transition-all duration-300"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
        )}

        {/* Realtime upload error quick retry HUD */}
        {uploadState.error && capturedMedia?.file && (
          <button 
            onClick={() => performBackgroundUpload(capturedMedia.file!)}
            className="absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-[10px] font-black uppercase tracking-wider text-white z-50 flex items-center gap-1.5 shadow-lg backdrop-blur-sm transition-all"
          >
            <RefreshCw size={10} className="animate-spin" />
            Upload Failed - Retry
          </button>
        )}

        {/* --- FLOATING TOP CONTROL PANEL --- */}
        <div className="absolute top-0 inset-x-0 h-16 z-[100] flex items-center justify-between px-3 pt-3 pointer-events-none">
          {/* Close / Back button */}
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={capturedMedia ? handleBackPress : onClose} 
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white transition-all pointer-events-auto border border-white/10 hover:bg-black/60 shadow-lg shrink-0"
            title={capturedMedia ? "Discard and Return" : "Exit Story Studio"}
            id="story_studio_close"
          >
            {capturedMedia ? <ChevronLeft size={20} /> : <X size={20} />}
          </motion.button>

          {/* Configuration tools */}
          {capturedMedia ? (
            <div className="flex items-center gap-1.5 pointer-events-auto overflow-x-auto no-scrollbar py-1">
              {/* Sound / Mute Toggle (if video or music active) */}
              {(capturedMedia.type === 'video' || activeMusic) && (
                <button
                  onClick={() => {
                    setIsVideoMuted(prev => !prev);
                    addToast({
                      title: isVideoMuted ? "Sound Unmuted" : "Sound Muted",
                      message: isVideoMuted ? "Audio enabled" : "Audio muted",
                      type: "info"
                    });
                  }}
                  className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-all border ${isVideoMuted ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-black/40 border-white/10 text-white hover:bg-black/60'}`}
                  title={isVideoMuted ? "Unmute" : "Mute"}
                >
                  {isVideoMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              )}

              {/* Fit / Fill Aspect Ratio Toggle */}
              <button
                onClick={() => {
                  const nextFit = mediaFit === 'cover' ? 'contain' : 'cover';
                  setMediaFit(nextFit);
                  addToast({
                    title: nextFit === 'contain' ? "Fit Frame" : "Fill Screen",
                    message: nextFit === 'contain' ? "Original aspect ratio preserved" : "Cropped to 9:16 screen",
                    type: "info"
                  });
                }}
                className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-all border ${mediaFit === 'contain' ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-black/40 border-white/10 text-white hover:bg-black/60'}`}
                title="Aspect Ratio"
              >
                {mediaFit === 'cover' ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>

              {/* Save / Download Frame */}
              <button
                onClick={saveStoryFrame}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:bg-black/60 transition-all shadow-md"
                title="Save to Device"
              >
                <Download size={16} />
              </button>

              {/* Effects / Filters */}
              <button
                onClick={() => setEffectsOpen(true)}
                className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-all border ${effectsOpen || currentFilter !== 'none' ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-black/40 border-white/10 text-white hover:bg-black/60'}`}
                title="Filters & Effects"
              >
                <Sparkles size={16} />
              </button>

              {/* Music */}
              <button
                onClick={() => setMusicOpen(true)}
                className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-all border ${activeMusic ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-black/40 border-white/10 text-white hover:bg-black/60'}`}
                title="Music"
              >
                <Music size={16} />
              </button>

              {/* Stickers */}
              <button
                onClick={() => setStickersOpen(true)}
                className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-all border ${stickersOpen ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-black/40 border-white/10 text-white hover:bg-black/60'}`}
                title="Stickers"
              >
                <Smile size={16} />
              </button>

              {/* Draw */}
              <button
                onClick={() => {
                  setIsDrawingMode(true);
                  setDrawToolsOpen(true);
                }}
                className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-all border ${drawToolsOpen ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-black/40 border-white/10 text-white hover:bg-black/60'}`}
                title="Draw"
              >
                <Paintbrush size={16} />
              </button>

              {/* Text tool ("Aa") */}
              <button
                onClick={addTextLayer}
                className={`w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition-all border font-serif font-black text-xs ${textEditorOpen ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-black/40 border-white/10 text-white hover:bg-black/60'}`}
                title="Text"
              >
                Aa
              </button>
            </div>
          ) : !cameraError ? (
            <div className="flex flex-row items-center gap-2 pointer-events-auto">
              {/* Flash button */}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFlash(!flash)}
                className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-all border border-white/10 ${flash ? 'bg-aeirmist-cyan text-black shadow-[0_0_15px_rgba(0,242,255,0.4)]' : 'bg-white/10 text-white/80'}`}
                title="Toggle Flash"
              >
                <Flashlight size={18} />
              </motion.button>

              {/* Delay/Timer trigger */}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const next = timerSetting === 0 ? 3 : timerSetting === 3 ? 5 : timerSetting === 5 ? 10 : 0;
                  setTimerSetting(next);
                }}
                className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-all border border-white/10 relative ${timerSetting > 0 ? 'bg-aeirmist-magenta text-white shadow-[0_0_15px_rgba(255,0,127,0.4)]' : 'bg-white/10 text-white/80'}`}
                title="Self-Timer"
              >
                <Timer size={18} />
                {timerSetting > 0 && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-black bg-white text-black px-1 rounded-full">{timerSetting}</span>
                )}
              </motion.button>

              {/* Grid Setting */}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setGridSetting(prev => prev === 'none' ? 'thirds' : prev === 'thirds' ? 'golden' : 'none')}
                className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-all border border-white/10 ${gridSetting !== 'none' ? 'bg-white/30 text-white' : 'bg-white/10 text-white/80'}`}
                title="Toggle Grid"
              >
                <Layers size={18} />
              </motion.button>

              {/* Gear Configuration Menu */}
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSettingsOpen(true)}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 text-white/80 hover:bg-white/20"
                title="Camera Settings"
              >
                <Settings size={18} />
              </motion.button>
            </div>
          ) : null}
        </div>

        {/* Contextual Suggestion Chip */}
        <AnimatePresence>
          {suggestion && !capturedMedia && (
            <div className="absolute top-20 inset-x-0 flex justify-center z-[110] pointer-events-none">
              <motion.button
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                onClick={suggestion.action}
                className="pointer-events-auto px-4 py-2.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center gap-3 group"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap">{suggestion.text}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSuggestion(null); }}
                  className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                  <X size={8} />
                </button>
              </motion.button>
            </div>
          )}
        </AnimatePresence>



        {/* Hidden inputs for free-form multi-photo layers and layout templates */}
        <input 
          type="file" 
          ref={insertPhotoInputRef} 
          onChange={handleInsertPhotoLayers} 
          multiple 
          accept="image/*" 
          className="hidden" 
        />
        <input 
          type="file" 
          ref={layoutFileInputRef} 
          onChange={handleLayoutFileSelect} 
          multiple 
          accept="image/*" 
          className="hidden" 
        />

        {/* --- FLOATING QUICK-TOOLS RAIL (IG/FB Style) --- */}
        {!capturedMedia ? (
          <div className="absolute right-4 top-24 z-[100] flex flex-col gap-3 pointer-events-auto">
            {[
              { 
                id: 'text', 
                icon: Type, 
                onClick: () => {
                  setCapturedMedia({ url: '', type: 'image', isSolidBackground: true });
                  addTextLayer();
                }, 
                label: 'Text' 
              },
              { 
                id: 'stickers', 
                icon: Smile, 
                onClick: () => {
                  setCapturedMedia({ url: '', type: 'image', isSolidBackground: true });
                  setStickersOpen(true);
                }, 
                label: 'Stickers' 
              },
              { 
                id: 'insert_photo', 
                icon: ImagePlus, 
                onClick: () => {
                  insertPhotoInputRef.current?.click();
                }, 
                label: 'Add Photo' 
              },
              { 
                id: 'draw', 
                icon: Paintbrush, 
                onClick: () => {
                  setCapturedMedia({ url: '', type: 'image', isSolidBackground: true });
                  setIsDrawingMode(true); 
                  setDrawToolsOpen(true); 
                }, 
                label: 'Draw' 
              },
              { 
                id: 'music', 
                icon: Music, 
                onClick: () => setMusicOpen(true), 
                label: 'Music' 
              },
              { 
                id: 'layout', 
                icon: LayoutGrid, 
                onClick: () => setLayoutModeOpen(true), 
                label: 'Layout' 
              }
            ].map((tool) => (
              <motion.button 
                key={tool.id}
                whileHover={{ scale: 1.1, x: -2 }}
                whileTap={{ scale: 0.9 }}
                onClick={tool.onClick}
                className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-lg group relative"
              >
                <tool.icon size={20} />
                <span className="absolute right-full mr-3 px-2 py-1 rounded bg-black/80 text-[8px] font-black uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  {tool.label}
                </span>
              </motion.button>
            ))}
          </div>
        ) : null}

        {/* --- DYNAMIC STORIES VISUAL CANVAS --- */}
        <div className="flex-1 w-full h-full relative overflow-hidden bg-[#090a0f]" id="story_canvas_body">
          
          {/* Rules/Guides lines */}
          {gridSetting !== 'none' && !capturedMedia && (
            <div className="absolute inset-0 pointer-events-none z-15">
              {gridSetting === 'thirds' ? (
                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-b border-white/15" />
                  <div className="border-r border-b border-white/15" />
                  <div className="border-b border-white/15" />
                  <div className="border-r border-b border-white/15" />
                  <div className="border-r border-b border-white/15" />
                  <div className="border-b border-white/15" />
                  <div className="border-r border-white/15" />
                  <div className="border-r border-white/15" />
                  <div className="" />
                </div>
              ) : (
                <div className="w-full h-full relative">
                  <div className="absolute inset-x-0 top-[38.2%] border-b border-white/15" />
                  <div className="absolute inset-x-0 top-[61.8%] border-b border-white/15" />
                  <div className="absolute inset-y-0 left-[38.2%] border-r border-white/15" />
                  <div className="absolute inset-y-0 left-[61.8%] border-r border-white/15" />
                </div>
              )}
            </div>
          )}

          {/* Custom Flash beam light */}
          {flash && !capturedMedia && (
            <div 
              className="absolute inset-0 pointer-events-none z-15 opacity-20 mix-blend-screen" 
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 70%)' }} 
            />
          )}

          {/* AR Lenses Filters overlays */}
          {selectedEffect !== 'none' && (
            <div className="absolute inset-0 pointer-events-none z-15 overflow-hidden">
              {selectedEffect === 'cyberpunk' && (
                <div className="w-full h-full bg-gradient-to-tr from-[#ff00ea]/20 via-transparent to-[#00f2ff]/20 mix-blend-color-dodge" />
              )}
              {selectedEffect === 'vhs' && (
                <div className="w-full h-full bg-black/15">
                  <div className="w-full h-[2px] bg-white/20 absolute left-0 animate-vhs-scanline shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  <div className="absolute top-16 left-4 flex items-center gap-1.5 bg-red-600/90 px-2 py-0.5 rounded text-[8px] font-mono font-black uppercase tracking-widest text-white animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    REC
                  </div>
                  <div className="absolute bottom-16 right-4 text-white/80 font-mono text-[8px] text-right tracking-widest uppercase leading-tight">
                    PLAY<br />
                    {new Date().toLocaleTimeString('en-US', { hour12: false })}<br />
                    SP
                  </div>
                </div>
              )}
              {selectedEffect === 'vintage' && (
                <div className="w-full h-full mix-blend-color-burn" style={{ background: 'radial-gradient(circle, transparent 40%, rgba(65,35,15,0.7) 100%)' }} />
              )}
              {selectedEffect === 'matrix' && (
                <div className="w-full h-full bg-emerald-500/10 mix-blend-color-dodge">
                  <div className="w-full h-[1px] bg-emerald-400/40 absolute left-0 animate-vhs-scanline" />
                  <div className="absolute top-16 left-4 text-emerald-400 font-mono text-[7px] uppercase tracking-wider animate-pulse">
                    SYS_SIMULATOR: ACTIVE_RES
                  </div>
                </div>
              )}
              {selectedEffect === 'bloom' && (
                <div className="w-full h-full bg-white/5 backdrop-brightness-110 backdrop-contrast-110 backdrop-saturate-150" />
              )}
            </div>
          )}

          {/* Delay Countdown Screen */}
          {countdownVal !== null && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-xs z-50 flex flex-col items-center justify-center pointer-events-none">
              <motion.div
                key={countdownVal}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1, 1.4, 1], opacity: [1, 1, 0] }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="text-8xl font-black text-aeirmist-cyan tracking-wider font-mono drop-shadow-[0_0_32px_rgba(0,242,255,0.6)]"
              >
                {countdownVal}
              </motion.div>
              <span className="text-[10px] font-mono font-black uppercase text-white/50 tracking-[0.3em] mt-4">
                Calibrating Lens...
              </span>
            </div>
          )}

          {/* Renders based on selection mode */}
          {mode === 'layout' && currentLayout ? (
            <div className="absolute inset-0 grid gap-1 p-1 bg-black overflow-hidden" style={{
              gridTemplateColumns: currentLayout === 'split-v' ? '1fr 1fr' : (currentLayout === 'split-h' ? '1fr' : (currentLayout === 'grid-4' ? '1fr 1fr' : (currentLayout === 'large-2-small' ? '2fr 1fr' : '1fr'))),
              gridTemplateRows: currentLayout === 'split-h' ? '1fr 1fr' : (currentLayout === 'grid-4' ? '1fr 1fr' : (currentLayout === 'l-shape' ? '2fr 1fr' : '1fr')),
            }}>
              {layoutSlots.map((slot, idx) => (
                <div 
                  key={slot.id} 
                  onClick={() => openSlotMediaPicker(slot.id)}
                  className={`relative overflow-hidden bg-white/5 border border-white/10 ${currentLayout === 'l-shape' && idx === 0 ? 'col-span-2' : ''}`}
                >
                  {slot.media ? (
                    <img src={slot.media.url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 gap-2">
                      <Plus size={24} />
                      <span className="text-[8px] font-black uppercase tracking-tighter">Slot {idx + 1}</span>
                    </div>
                  )}
                  {slot.media && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeSlotMedia(slot.id); }}
                      className="absolute top-2 right-2 p-1 bg-black/40 rounded-full text-white/60 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : mode === 'text' ? (
            <div className={`absolute inset-0 ${BG_GRADIENTS[textModeBgIdx]} flex items-center justify-center p-8 text-center`}>
              {textLayers.length === 0 && (
                <span className="text-sm text-white/40 animate-pulse font-mono uppercase tracking-widest cursor-pointer" onClick={addTextLayer}>
                  Tap to add Draggable Text overlay
                </span>
              )}
            </div>
          ) : capturedMedia ? (
            <div className="absolute inset-0 w-full h-full">
              {mode === 'boomerang' && boomerangFrames.length > 0 ? (
                <BoomerangPlayer frames={boomerangFrames} />
              ) : capturedMedia.type === 'video' ? (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
                  {mediaFit === 'contain' && (
                    <video
                      src={capturedMedia.url}
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-50 scale-125 select-none pointer-events-none"
                    />
                  )}
                  <video 
                    src={capturedMedia.url} 
                    style={{
                      transform: `rotate(${mediaRotation}deg) scale(${mediaScale}) scaleX(${mediaFlipX ? -1 : 1})`,
                      filter: `${currentFilter} brightness(${mediaBrightness}%) contrast(${mediaContrast}%)`,
                    }}
                    className={`w-full h-full ${mediaFit === 'contain' ? 'object-contain relative z-10' : 'object-cover'}`}
                    autoPlay 
                    loop 
                    muted={isVideoMuted} 
                    playsInline 
                  />
                </div>
              ) : capturedMedia.isSolidBackground ? (
                (() => {
                  const bottomPhoto = photoLayers.length > 0 ? [...photoLayers].sort((a, b) => a.zIndex - b.zIndex)[0] : null;
                  if (bottomPhoto) {
                    return (
                      <div className="absolute inset-0 overflow-hidden bg-[#0a0b10] pointer-events-none select-none z-0">
                        <img 
                          src={bottomPhoto.url} 
                          alt="Auto Color-matched Background"
                          className="w-full h-full object-cover scale-150 select-none pointer-events-none"
                          style={{ filter: 'blur(40px) brightness(0.7)' }}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    );
                  }
                  return (
                    <div className="w-full h-full bg-gradient-to-b from-[#0f111a] via-[#050609] to-[#010102]" />
                  );
                })()
              ) : (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
                  {mediaFit === 'contain' && (
                    <img
                      src={capturedMedia.url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-50 scale-125 select-none pointer-events-none"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <img 
                    src={capturedMedia.url} 
                    style={{
                      transform: `rotate(${mediaRotation}deg) scale(${mediaScale}) scaleX(${mediaFlipX ? -1 : 1})`,
                      filter: `${currentFilter} brightness(${mediaBrightness}%) contrast(${mediaContrast}%)`,
                    }}
                    alt="Preview" 
                    className={`w-full h-full ${mediaFit === 'contain' ? 'object-contain relative z-10' : 'object-cover'}`} 
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>
          ) : (
            // Live webcam element or simulated scene
            <div className="absolute inset-0 w-full h-full flex flex-col justify-between">
              {cameraError || !streamRef.current ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-[#0a0b10] z-20 pointer-events-auto">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50 mb-4 shadow-xl">
                    <ImageIcon size={28} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white mb-1.5">Add to your Story</h3>
                  <p className="text-xs text-white/40 max-w-xs mb-6">Select a photo or video from your device or create a text story</p>
                  
                  <div className="flex flex-col gap-2.5 w-full max-w-xs">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-11 rounded-full bg-white text-black font-black uppercase text-[11px] tracking-wider flex items-center justify-center gap-2 shadow-xl hover:bg-white/90 active:scale-95 transition-all"
                    >
                      <UploadCloud size={16} />
                      Choose Photo or Video
                    </button>
                    <button
                      onClick={() => {
                        setMode('text');
                        setCapturedMedia({ url: '', type: 'image', isSolidBackground: true });
                        addTextLayer();
                      }}
                      className="w-full h-11 rounded-full bg-white/10 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/20 active:scale-95 transition-all"
                    >
                      <Type size={16} />
                      Create Text Story
                    </button>
                  </div>
                </div>
              ) : (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                />
              )}
            </div>
          )}

          {/* Interactive painting canvas */}
          <canvas 
            ref={drawingCanvasRef} 
            onMouseDown={startDrawing}
            onMouseMove={drawMove}
            onMouseUp={endDrawing}
            onMouseLeave={endDrawing}
            onTouchStart={startDrawing}
            onTouchMove={drawMove}
            onTouchEnd={endDrawing}
            className={`absolute inset-0 w-full h-full z-20 ${isDrawingMode ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
            width={1080}
            height={1920}
          />

          {/* Draggable Photo layers */}
          {photoLayers.map(layer => (
            <PhotoLayerComponent
              key={layer.id}
              layer={layer}
              selectedLayerId={selectedLayerId}
              setSelectedLayerId={setSelectedLayerId}
              updatePhotoLayer={updatePhotoLayer}
              deletePhotoLayer={deletePhotoLayer}
              containerRef={containerRef}
              setIsDraggingAny={setIsDraggingAny}
              setIsOverTrash={setIsOverTrash}
              checkIfOverTrash={checkIfOverTrash}
              onContextMenu={handlePhotoContextMenu}
            />
          ))}

          {/* Draggable texts */}
          {textLayers.map(layer => (
            <TextLayerComponent
              key={layer.id}
              layer={layer}
              containerRef={containerRef}
              setIsDraggingAny={setIsDraggingAny}
              checkIfOverTrash={checkIfOverTrash}
              setIsOverTrash={setIsOverTrash}
              setTextLayers={setTextLayers}
              deleteAnyLayer={deleteAnyLayer}
              editExistingText={editExistingText}
            />
          ))}

          {/* Draggable stickers */}
          {stickerLayers.map(sticker => (
            <StickerLayerComponent
              key={sticker.id}
              sticker={sticker}
              containerRef={containerRef}
              setIsDraggingAny={setIsDraggingAny}
              checkIfOverTrash={checkIfOverTrash}
              setIsOverTrash={setIsOverTrash}
              setStickerLayers={setStickerLayers}
              deleteAnyLayer={deleteAnyLayer}
              deleteStickerLayer={deleteStickerLayer}
            />
          ))}

          {/* Soundtrack badge */}
          {activeMusic && (
            <div className="absolute top-20 left-4 z-40 bg-black/60 border border-white/15 backdrop-blur-md px-3.5 py-2 rounded-2xl flex items-center gap-2.5 max-w-[210px] shadow-lg">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                <Music size={13} className="text-aeirmist-cyan" />
              </div>
              <div className="min-w-0 pr-1">
                <p className="text-[11px] font-bold text-white truncate leading-tight">{activeMusic.title}</p>
                <p className="text-[9px] text-white/50 truncate leading-tight mt-0.5">{activeMusic.artist}</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveMusic(null); }}
                className="w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/40 hover:text-white shrink-0 ml-1"
                title="Remove Music"
              >
                <X size={10} />
              </button>
            </div>
          )}

          {/* Interactive Unified Drag-to-Delete Trash Overlay */}
          <AnimatePresence>
            {isDraggingAny && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  scale: isOverTrash ? 1.25 : 1,
                  backgroundColor: isOverTrash ? 'rgba(239, 68, 68, 0.95)' : 'rgba(0, 0, 0, 0.6)',
                  borderColor: isOverTrash ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)'
                }}
                exit={{ opacity: 0, y: 50, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                ref={trashRef}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[250] flex flex-col items-center justify-center w-16 h-16 rounded-full border border-white/15 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.5)] text-white transition-colors pointer-events-none"
              >
                <Trash size={20} className={`${isOverTrash ? 'text-white animate-bounce' : 'text-white/70'}`} />
                <span className="text-[6px] font-black uppercase tracking-widest mt-1 text-white/50">
                  Delete
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Photo layers right-click context menu */}
          {contextMenuLayerId && (
            <div 
              className="absolute z-[250] bg-[#0c0d14]/95 border border-white/10 rounded-2xl py-1.5 px-1 shadow-2xl min-w-[130px] flex flex-col pointer-events-auto backdrop-blur-xl"
              style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => bringToFront(contextMenuLayerId)}
                className="w-full text-left py-2 px-3 hover:bg-white/5 text-[9px] text-white/80 font-black uppercase tracking-widest rounded-xl transition-colors flex items-center justify-between"
              >
                <span>Bring Front</span>
                <span className="text-[8px] text-aeirmist-cyan font-bold">▲</span>
              </button>
              <button 
                onClick={() => sendToBack(contextMenuLayerId)}
                className="w-full text-left py-2 px-3 hover:bg-white/5 text-[9px] text-white/80 font-black uppercase tracking-widest rounded-xl transition-colors flex items-center justify-between"
              >
                <span>Send Back</span>
                <span className="text-[8px] text-white/30 font-bold">▼</span>
              </button>
              <div className="h-px bg-white/5 my-1 mx-2" />
              <button 
                onClick={() => {
                  deletePhotoLayer(contextMenuLayerId);
                  setContextMenuLayerId(null);
                  setSelectedLayerId(null);
                }}
                className="w-full text-left py-2 px-3 hover:bg-rose-500/20 text-[9px] text-rose-400 font-black uppercase tracking-widest rounded-xl transition-colors"
              >
                Delete Layer
              </button>
            </div>
          )}
        </div>

        {/* --- FLOATING BOTTOM ACTION PANEL --- */}
        {!(cameraError && !capturedMedia) && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent pt-32 pb-10 px-4 z-[100] flex flex-col items-center pointer-events-auto">
            
            {capturedMedia ? (
              <div className="w-full flex flex-col items-center max-w-xs px-4">
                {/* --- CAPTION ROW --- */}
                {captionInputOpen ? (
                  <div className="w-full mb-4 flex items-center gap-2 bg-black/80 backdrop-blur-md rounded-2xl border border-white/10 px-3 py-2 z-[110]">
                    <input 
                      type="text" 
                      placeholder="Write a caption..." 
                      value={storyCaption}
                      onChange={(e) => setStoryCaption(e.target.value)}
                      className="bg-transparent text-white text-xs outline-none flex-1 font-sans placeholder-white/30"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setCaptionInputOpen(false);
                        }
                      }}
                    />
                    <button 
                      onClick={() => setCaptionInputOpen(false)}
                      className="text-[10px] text-aeirmist-cyan font-black uppercase tracking-wider hover:text-white px-2 py-1"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setCaptionInputOpen(true)}
                    className="w-full mb-3 bg-black/50 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-full py-2.5 px-4 text-center text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white transition-all shadow-md"
                  >
                    {storyCaption.trim() ? `Caption: "${storyCaption}"` : "ADD A CAPTION..."}
                  </button>
                )}

                {/* --- AUDIENCE SELECTOR ROW --- */}
                <div className="w-full flex items-center justify-center gap-2 mb-3.5">
                  {[
                    { id: 'public', label: 'PUBLIC', icon: <Globe size={11} /> },
                    { id: 'followers', label: 'FOLLOWERS', icon: <Users size={11} /> },
                    { id: 'closeFriends', label: 'CLOSE FRIENDS', icon: <Sparkles size={11} /> }
                  ].map((aud) => {
                    const isSelected = audience === aud.id;
                    const isCloseFriends = aud.id === 'closeFriends';
                    return (
                      <button
                        key={aud.id}
                        onClick={() => setAudience(aud.id as any)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                          isSelected 
                            ? (isCloseFriends ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]' : 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,242,255,0.35)]') 
                            : 'bg-black/30 border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                        }`}
                      >
                        {aud.icon}
                        <span>{aud.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* --- PUBLISH ROW --- */}
                <div className="w-full flex items-center gap-3">
                  {/* Your Story Pill */}
                  <button
                    onClick={
                      multiStoryItems.length > 0
                        ? (currentMultiStoryIndex < multiStoryItems.length - 1 ? handleSequentialNext : publishMultiStorySet)
                        : handlePublishStory
                    }
                    disabled={isPublishing}
                    className="flex-1 h-12 rounded-full bg-white text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 hover:bg-white/95 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                  >
                    <img 
                      src={getAvatarUrl(user?.uid || '', profile?.avatarUrl || user?.photoURL)} 
                      className="w-6 h-6 rounded-full object-cover shrink-0 border border-black/10" 
                      alt="" 
                      referrerPolicy="no-referrer"
                    />
                    <span>
                      {isPublishing 
                        ? "Sharing..." 
                        : (multiStoryItems.length > 0 
                            ? (currentMultiStoryIndex < multiStoryItems.length - 1 ? `Next (${currentMultiStoryIndex + 1}/${multiStoryItems.length})` : "Publish Set")
                            : "YOUR STORY"
                          )}
                    </span>
                  </button>

                  {/* Circular Send Arrow Icon Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={
                      multiStoryItems.length > 0
                        ? (currentMultiStoryIndex < multiStoryItems.length - 1 ? handleSequentialNext : publishMultiStorySet)
                        : handlePublishStory
                    }
                    disabled={isPublishing}
                    className="w-12 h-12 rounded-full bg-aeirmist-cyan text-black flex items-center justify-center hover:bg-aeirmist-cyan/90 transition-all shadow-xl active:scale-95 disabled:opacity-50 shrink-0"
                    title={multiStoryItems.length > 0 ? "Next / Publish" : "Publish Story"}
                  >
                    <Send size={18} className="translate-x-[1px]" />
                  </motion.button>
                </div>
              </div>
            ) : (
              <>
                {/* Snapchat-inspired Filter Carousel */}
                <div className="w-full relative mb-12 flex flex-col items-center">
                  <div className="flex items-center justify-center w-full relative h-20 overflow-visible">
                    <div 
                      ref={filterCarouselRef}
                      className="flex items-center gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory px-[50%] h-full w-full"
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        const center = el.scrollLeft + el.offsetWidth / 2;
                        const items = el.querySelectorAll('.filter-thumb');
                        let closest: Element | null = null;
                        let minDiff = Infinity;
                        
                        items.forEach(item => {
                          const rect = item.getBoundingClientRect();
                          const itemCenter = rect.left + rect.width / 2;
                          const viewportCenter = window.innerWidth < 640 ? window.innerWidth / 2 : el.getBoundingClientRect().left + el.offsetWidth / 2;
                          const diff = Math.abs(itemCenter - viewportCenter);
                          if (diff < minDiff) {
                            minDiff = diff;
                            closest = item;
                          }
                        });

                        if (closest) {
                          const id = (closest as HTMLElement).getAttribute('data-filter-id');
                          const filter = STORY_FILTERS.find(f => f.id === id);
                          if (filter && filter.filter !== currentFilter) {
                            setCurrentFilter(filter.filter);
                          }
                        }
                      }}
                    >
                      {STORY_FILTERS.map((f) => {
                        const isSelected = currentFilter === f.filter;
                        return (
                          <button
                            key={f.id}
                            data-filter-id={f.id}
                            className="filter-thumb group relative flex-shrink-0 snap-center transition-all duration-300 flex flex-col items-center"
                            onClick={() => {
                              setCurrentFilter(f.filter);
                              const el = filterCarouselRef.current;
                              if (el) {
                               const btn = el.querySelector(`[data-filter-id="${f.id}"]`);
                               btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                              }
                            }}
                          >
                            <div className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all duration-300 relative ${isSelected ? 'scale-125 border-transparent shadow-[0_0_20px_rgba(0,242,255,0.4)]' : 'border-white/20 hover:border-white/40'}`}>
                              <div 
                                className="absolute inset-0 bg-[#1a1c24]" 
                                style={{ filter: f.filter }}
                              >
                                {streamRef.current && (
                                  <video 
                                    src="" 
                                    className="w-full h-full object-cover scale-x-[-1]"
                                    ref={(el) => { if(el) el.srcObject = streamRef.current; }}
                                    autoPlay
                                    muted
                                    playsInline
                                  />
                                )}
                              </div>
                              {isSelected && (
                                <div className="absolute inset-0 border-2 rounded-full border-aeirmist-cyan z-10" />
                              )}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-tighter mt-3 transition-opacity duration-300 ${isSelected ? 'opacity-100 text-aeirmist-cyan' : 'opacity-0'}`}>
                              {f.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Mode Switcher Tabs */}
                <div className="flex items-center gap-6 mb-8 px-5 py-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 shadow-lg">
                  {[
                    { id: 'story', label: 'Story' },
                    { id: 'reel', label: 'Reel' },
                    { id: 'text', label: 'Text' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id as any)}
                      className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${mode === m.id ? 'text-aeirmist-cyan' : 'text-white/40 hover:text-white'}`}
                    >
                      {m.label}
                      {mode === m.id && (
                        <motion.div layoutId="mode-dot" className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-aeirmist-cyan" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Core action button row */}
                <div className="w-full flex items-center justify-between gap-10 max-w-sm px-4">
                  
                  {/* Gallery Button */}
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsGallerySelectorOpen(true)}
                    className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-md"
                  >
                    <LucideImage size={20} />
                  </motion.button>

                  {/* Central Capture Trigger */}
                  <div className="relative flex items-center justify-center">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      {/* Breathing Signal Message Ring during recording */}
                      <AnimatePresence>
                        {isRecording && (
                          <motion.div key="recording-ring-wrapper">
                            <motion.div 
                              initial={{ scale: 1, opacity: 0.8 }}
                              animate={{ scale: [1, 1.4, 1.1], opacity: [0.8, 0, 0.4] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                              className="absolute inset-0 rounded-full border-2 border-aeirmist-magenta shadow-[0_0_20px_rgba(255,0,127,0.5)] z-0"
                            />
                            <motion.div 
                              initial={{ scale: 1, opacity: 0.8 }}
                              animate={{ scale: [1, 1.8, 1.2], opacity: [0.8, 0, 0.2] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
                              className="absolute inset-0 rounded-full border border-aeirmist-cyan shadow-[0_0_30px_rgba(0,242,255,0.3)] z-0"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.9 }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          const timer = setTimeout(() => {
                            startRecording();
                            (window as any)._isHold = true;
                          }, 400);
                          (window as any)._captureTimer = timer;
                        }}
                        onMouseUp={() => {
                          clearTimeout((window as any)._captureTimer);
                          if ((window as any)._isHold) {
                            stopRecording();
                            (window as any)._isHold = false;
                          } else {
                            capturePhoto();
                          }
                        }}
                        onTouchStart={() => {
                          const timer = setTimeout(() => {
                            startRecording();
                            (window as any)._isHold = true;
                          }, 400);
                          (window as any)._captureTimer = timer;
                        }}
                        onTouchEnd={() => {
                          clearTimeout((window as any)._captureTimer);
                          if ((window as any)._isHold) {
                            stopRecording();
                            (window as any)._isHold = false;
                          } else {
                            capturePhoto();
                          }
                        }}
                        className={`w-16 h-16 rounded-full border-4 transition-all duration-300 z-10 ${isRecording ? 'bg-aeirmist-magenta border-white' : 'bg-white border-white/30'}`}
                      />
                    </div>
                  </div>

                  {/* Flip Camera */}
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleCameraFacing}
                    className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-md"
                  >
                    <RefreshCw size={20} />
                  </motion.button>
                </div>
              </>
            )}

            {/* Recording time status */}
            {isRecording && (
              <div className="mt-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[10px] font-mono font-black uppercase text-rose-500 tracking-widest">
                  Acquiring Signal: 00:{recordingTime < 10 ? `0${recordingTime}` : recordingTime}
                </span>
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- ALL BOTTOM SHEETS & OVERLAYS SYSTEM --- */}

      {/* --- STICKERS DATABASE SHEET --- */}
      <AnimatePresence>
        {stickersOpen && (
          <div className="fixed inset-0 z-[2500] flex items-end justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-[#0d0e14] rounded-t-[24px] border-t border-white/10 p-6 flex flex-col max-h-[80vh] z-[2501]"
              id="stickers_bottom_sheet"
            >
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black uppercase tracking-widest text-white/50">Stickers</span>
                <button 
                  onClick={() => setStickersOpen(false)}
                  className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  type="text"
                  placeholder="Query stickers..."
                  value={stickerSearch}
                  onChange={(e) => setStickerSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white outline-none focus:border-aeirmist-cyan/30"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-3 mb-3 border-b border-white/5 max-w-full">
                {['All', 'Location', 'Mention', 'Poll', 'Questions', 'GIF', 'Emoji', 'Countdown', 'Link'].map((cat) => (
                  <button 
                    key={cat}
                    onClick={() => setActiveStickerCategory(cat)}
                    className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold whitespace-nowrap transition-all ${activeStickerCategory === cat ? 'bg-aeirmist-cyan text-black' : 'bg-white/5 text-white/50'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 overflow-y-auto flex-1 pb-6">
                {filteredStickers.map(sticker => (
                  <button 
                    key={sticker.id}
                    onClick={() => selectSticker(sticker)}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/5 flex flex-col items-center justify-center transition-all text-center min-h-[50px]"
                  >
                    {sticker.type === 'gif' || sticker.type === 'emoji' ? (
                      <span className="text-2xl">{sticker.content}</span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase truncate max-w-full">{sticker.content}</span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- QUIZ EDITOR MODAL --- */}
      <AnimatePresence>
        {quizEditorOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-white/10 rounded-3xl p-8 shadow-2xl relative"
            >
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-aeirmist-magenta mb-8 text-center">Knowledge Test</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Question</label>
                  <input 
                    type="text"
                    value={quizQuestion}
                    onChange={(e) => setQuizQuestion(e.target.value)}
                    placeholder="Ask a factual query..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:border-aeirmist-magenta/40"
                    autoFocus
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block">Options (Select correct one)</label>
                  {quizOptions.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                      <button 
                        onClick={() => setQuizCorrectIndex(idx)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${quizCorrectIndex === idx ? 'bg-aeirmist-cyan text-black' : 'bg-white/5 text-white/20 hover:bg-white/10'}`}
                      >
                        {quizCorrectIndex === idx ? <Check size={16} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                      </button>
                      <input 
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...quizOptions];
                          newOpts[idx] = e.target.value;
                          setQuizOptions(newOpts);
                        }}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-aeirmist-cyan/40"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setQuizEditorOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={createQuizSticker}
                    className="flex-1 py-4 rounded-2xl bg-aeirmist-magenta text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_8px_24px_rgba(255,0,127,0.2)]"
                  >
                    Deploy Quiz
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- QUESTION BOX EDITOR MODAL --- */}
      <AnimatePresence>
        {qBoxEditorOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl relative"
            >
              <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-tr from-aeirmist-cyan to-aeirmist-magenta p-0.5 mx-auto mb-8 shadow-xl">
                <div className="w-full h-full rounded-[1.4rem] bg-[#0a0b10] flex items-center justify-center">
                  <Ghost size={24} className="text-white" />
                </div>
              </div>

              <h3 className="text-lg font-bold text-white text-center mb-2">Anonymous Intake</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 text-center mb-8">Signal Receptor Configuration</p>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Prompt String</label>
                  <input 
                    type="text"
                    value={qBoxPrompt}
                    onChange={(e) => setQBoxPrompt(e.target.value)}
                    placeholder="Ask me anything..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none focus:border-aeirmist-cyan/40 italic"
                    autoFocus
                  />
                </div>

                <button 
                  onClick={() => setQBoxShowAttribution(!qBoxShowAttribution)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-aeirmist-cyan/30 transition-all"
                >
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Account Tag</p>
                    <p className="text-[9px] text-white/30 uppercase mt-1">Show who is asking the question</p>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-all relative ${qBoxShowAttribution ? 'bg-aeirmist-cyan' : 'bg-white/10'}`}>
                    <motion.div 
                      animate={{ x: qBoxShowAttribution ? 20 : 4 }}
                      className="absolute top-1 w-4 h-4 rounded-full bg-white"
                    />
                  </div>
                </button>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setQBoxEditorOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={createQuestionBoxSticker}
                    className="flex-1 py-4 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
                  >
                    Activate
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- LOCATION EDITOR MODAL --- */}
      <AnimatePresence>
        {locationEditorOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-white/10 rounded-3xl p-8 shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan mb-6 mx-auto">
                <MapPin size={24} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-aeirmist-cyan mb-8 text-center">Geographical Tagging</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Location Identifier</label>
                  <input 
                    type="text"
                    value={locationValue}
                    onChange={(e) => setLocationValue(e.target.value)}
                    placeholder="Where are you?"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:border-aeirmist-cyan/40"
                    autoFocus
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setLocationEditorOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={createLocationSticker}
                    className="flex-1 py-4 rounded-2xl bg-aeirmist-cyan text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_8px_24px_rgba(0,242,255,0.2)]"
                  >
                    Set Vector
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- COUNTDOWN EDITOR MODAL --- */}
      <AnimatePresence>
        {countdownEditorOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-white/10 rounded-3xl p-8 shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan mb-6 mx-auto">
                <Clock size={24} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-aeirmist-cyan mb-8 text-center">Temporal Marker</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Event Title</label>
                  <input 
                    type="text"
                    value={countdownTitle}
                    onChange={(e) => setCountdownTitle(e.target.value)}
                    placeholder="Approaching Event..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:border-aeirmist-cyan/40"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Target Moment</label>
                  <input 
                    type="datetime-local"
                    value={countdownDate}
                    onChange={(e) => setCountdownDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:border-aeirmist-cyan/40 [color-scheme:dark]"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setCountdownEditorOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]"
                  >
                    Abort
                  </button>
                  <button 
                    onClick={createCountdownSticker}
                    className="flex-1 py-4 rounded-2xl bg-aeirmist-cyan text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_8px_24px_rgba(0,242,255,0.2)]"
                  >
                    Sync
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- SLIDER EDITOR MODAL --- */}
      <AnimatePresence>
        {sliderEditorOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-white/10 rounded-3xl p-8 shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-aeirmist-magenta/10 flex items-center justify-center text-aeirmist-magenta mb-6 mx-auto">
                <Heart size={24} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-aeirmist-magenta mb-8 text-center">Sentience Connections</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Inquiry Prompt</label>
                  <input 
                    type="text"
                    value={sliderPrompt}
                    onChange={(e) => setSliderPrompt(e.target.value)}
                    placeholder="Connections level?"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:border-aeirmist-magenta/40"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Handle Emoji</label>
                  <div className="flex gap-2 flex-wrap">
                    {['😍', '🔥', '💀', '👽', '🫠', '💯'].map(e => (
                      <button 
                        key={e}
                        onClick={() => setSliderEmoji(e)}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all ${sliderEmoji === e ? 'bg-aeirmist-magenta/20 border-aeirmist-magenta/40 border scale-110' : 'bg-white/5 hover:bg-white/10'}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setSliderEditorOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={createSliderSticker}
                    className="flex-1 py-4 rounded-2xl bg-aeirmist-magenta text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_8px_24px_rgba(255,0,127,0.2)]"
                  >
                    Initialize
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MUSIC STICKER EDITOR MODAL --- */}
      <AnimatePresence>
        {musicStickerEditorOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-white/10 rounded-3xl p-8 shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan mb-6 mx-auto">
                <Music size={24} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-aeirmist-cyan mb-8 text-center">Connections Sync</h3>
              
              {!selectedMusicSticker ? (
                <div className="space-y-4">
                  <p className="text-center text-white/60 text-sm mb-6">Select a track for your story.</p>
                  <button 
                    onClick={() => setMusicOpen(true)}
                    className="w-full py-4 rounded-2xl bg-aeirmist-cyan text-black text-[10px] font-black uppercase tracking-[0.2em]"
                  >
                    Browse Library
                  </button>
                  <button 
                    onClick={() => setMusicStickerEditorOpen(false)}
                    className="w-full py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                    <img src={selectedMusicSticker.albumArtUrl} className="w-16 h-16 rounded-xl shadow-xl" alt="" />
                    <div className="overflow-hidden">
                      <div className="font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{selectedMusicSticker.title}</div>
                      <div className="text-xs text-white/40">{selectedMusicSticker.artist}</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">
                      <span>Temporal Trim (15s)</span>
                      <span>{Math.floor(musicStartTime)}s</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="45"
                      step="1"
                      value={musicStartTime}
                      onChange={(e) => setMusicStartTime(parseInt(e.target.value))}
                      className="w-full accent-aeirmist-cyan h-1 bg-white/10 rounded-lg appearance-none"
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setSelectedMusicSticker(null)}
                      className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]"
                    >
                      Change
                    </button>
                    <button 
                      onClick={() => {
                        const newLayer: StickerLayer = {
                          id: Date.now().toString(),
                          type: 'music',
                          content: selectedMusicSticker.title,
                          x: 100,
                          y: 350,
                          scale: 1,
                          musicData: {
                            song: selectedMusicSticker,
                            startTime: musicStartTime,
                            duration: 15
                          }
                        };
                        setStickerLayers(prev => [...prev, newLayer]);
                        setMusicStickerEditorOpen(false);
                        setSelectedMusicSticker(null);
                      }}
                      className="flex-1 py-4 rounded-2xl bg-aeirmist-cyan text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_8px_24px_rgba(0,242,255,0.2)]"
                    >
                      Embed
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- LAYOUT PICKER MODAL --- */}
      <AnimatePresence>
        {layoutModeOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-white/10 rounded-3xl p-8 shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan mb-6 mx-auto">
                <Layers size={24} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-aeirmist-cyan mb-8 text-center">Structural Matrices</h3>
              
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { id: 'split-v', label: 'Split V', icon: <div className="w-full h-full border border-white/20 flex"><div className="w-1/2 border-r border-white/20"></div></div> },
                  { id: 'split-h', label: 'Split H', icon: <div className="w-full h-full border border-white/20 flex flex-col"><div className="h-1/2 border-b border-white/20"></div></div> },
                  { id: 'grid-4', label: 'Grid 4', icon: <div className="w-full h-full border border-white/20 grid grid-cols-2 grid-rows-2"><div className="border border-white/10"></div><div className="border border-white/10"></div><div className="border border-white/10"></div><div className="border border-white/10"></div></div> },
                  { id: 'l-shape', label: 'L-Shape', icon: <div className="w-full h-full border border-white/20 flex flex-wrap"><div className="w-2/3 h-2/3 border border-white/10"></div><div className="w-1/3 h-2/3 border border-white/10"></div><div className="w-full h-1/3 border border-white/10"></div></div> },
                  { id: 'large-2-small', label: '1L 2S', icon: <div className="w-full h-full border border-white/20 flex"><div className="w-2/3 h-full border-r border-white/20"></div><div className="w-1/3 h-full flex flex-col"><div className="h-1/2 border-b border-white/20"></div></div></div> }
                ].map(tmpl => (
                  <button 
                    key={tmpl.id}
                    onClick={() => {
                      setCurrentLayout(tmpl.id as LayoutTemplate);
                      // Initialize slots
                      const count = tmpl.id === 'grid-4' ? 4 : (tmpl.id === 'l-shape' || tmpl.id === 'large-2-small' ? 3 : 2);
                      setLayoutSlots(Array.from({ length: count }, (_, i) => ({ id: `slot-${i}`, media: null })));
                    }}
                    className={`aspect-square rounded-xl bg-white/5 border transition-all p-3 flex flex-col items-center justify-between gap-2 ${currentLayout === tmpl.id ? 'border-aeirmist-cyan bg-aeirmist-cyan/10' : 'border-white/10 hover:border-white/20'}`}
                  >
                    <div className="w-full flex-1 rounded-sm bg-white/5 overflow-hidden">
                      {tmpl.icon}
                    </div>
                    <span className="text-[7px] font-black uppercase tracking-tighter text-white/40">{tmpl.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setLayoutModeOpen(false)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]"
                >
                  Cancel
                </button>
                <button 
                  disabled={!currentLayout}
                  onClick={() => setLayoutModeOpen(false)}
                  className="flex-1 py-4 rounded-2xl bg-aeirmist-cyan text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_8px_24px_rgba(0,242,255,0.2)] disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- LINK EDITOR MODAL --- */}
      <AnimatePresence>
        {hashtagEditorOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-white/10 rounded-3xl p-8 shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white mb-6 mx-auto">
                <Hash size={24} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-8 text-center">Add Hashtag</h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Hashtag</label>
                  <input 
                    type="text"
                    value={hashtagDraft}
                    onChange={(e) => setHashtagDraft(e.target.value.replace(/\s/g, ''))}
                    placeholder="trending"
                    onKeyDown={(e) => { if (e.key === 'Enter') createHashtagSticker(); }}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:border-white/20"
                    autoFocus
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setHashtagEditorOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={createHashtagSticker}
                    className="flex-1 py-4 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
                  >
                    Add
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {linkEditorOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-white/10 rounded-3xl p-8 shadow-2xl relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white mb-6 mx-auto">
                <LucideLink size={24} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-8 text-center">Hyperlink Portal</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Portal Destination (URL)</label>
                  <input 
                    type="text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:border-white/20"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Portal Label (Optional)</label>
                  <input 
                    type="text"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="Access Data..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:border-white/20"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setLinkEditorOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={createLinkSticker}
                    className="flex-1 py-4 rounded-2xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
                  >
                    Add Link
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DISCARD STORY CONFIRMATION MODAL --- */}
      <AnimatePresence>
        {showDiscardConfirmation && (
          <div className="fixed inset-0 z-[4000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 pointer-events-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-rose-500/10 rounded-[2.5rem] p-8 shadow-2xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 to-rose-700" />
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6 mx-auto">
                <Trash size={24} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 mb-2">Discard Changes?</h3>
              <p className="text-xs text-white/50 mb-8 max-w-[240px] mx-auto leading-relaxed">
                Tapping discard will clear all layers, filters, and media elements added to this story canvas. This action cannot be undone.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    // Reset all layers and captured media
                    setTextLayers([]);
                    setStickerLayers([]);
                    setPhotoLayers([]);
                    setDrawingPaths([]);
                    setCurrentFilter('none');
                    setActiveMusic(null);
                    setStoryCaption('');
                    setCapturedMedia(null);
                    setShowDiscardConfirmation(false);
                    addToast({
                      title: "Story Cleared",
                      message: "The canvas has been reset successfully.",
                      type: "info"
                    });
                  }}
                  className="w-full py-4 rounded-2xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_8px_24px_rgba(239,68,68,0.2)] hover:bg-rose-600 transition-colors"
                >
                  Discard Edits
                </button>
                <button 
                  onClick={() => setShowDiscardConfirmation(false)}
                  className="w-full py-4 rounded-2xl bg-white/5 text-white/80 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-colors"
                >
                  Keep Editing
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- POLL EDITOR MODAL --- --- */}
      <AnimatePresence>
        {pollEditorOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#0a0b10] border border-white/10 rounded-3xl p-8 shadow-2xl relative"
            >
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-aeirmist-cyan mb-8 text-center">Construct Social Inquiry</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Query String</label>
                  <input 
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="What is your directive?"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm outline-none focus:border-aeirmist-cyan/40"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Branch Alpha</label>
                    <input 
                      type="text"
                      value={pollOption1}
                      onChange={(e) => setPollOption1(e.target.value)}
                      placeholder="Option 1"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-aeirmist-cyan/40"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-2">Branch Beta</label>
                    <input 
                      type="text"
                      value={pollOption2}
                      onChange={(e) => setPollOption2(e.target.value)}
                      placeholder="Option 2"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-aeirmist-cyan/40"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setPollEditorOpen(false)}
                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={createPollSticker}
                    className="flex-1 py-4 rounded-2xl bg-aeirmist-cyan text-black text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_8px_24px_rgba(0,242,255,0.2)]"
                  >
                    Deploy Poll
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MENTION USER SEARCH OVERLAY --- */}
      <AnimatePresence>
        {mentionSearchOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col p-6 pointer-events-auto">
            <div className="flex items-center gap-4 mb-6">
              <button 
                onClick={() => setMentionSearchOpen(false)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50"
              >
                <X size={20} />
              </button>
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  autoFocus
                  type="text"
                  placeholder="Search users to mention..."
                  value={mentionSearchQuery}
                  onChange={handleMentionSearch}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white text-base outline-none focus:border-aeirmist-cyan/40 transition-all shadow-[0_0_20px_rgba(0,242,255,0.05)]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {isSearchingMentions ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                  <Loader2 className="w-8 h-8 animate-spin text-aeirmist-cyan" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Searching for people...</p>
                </div>
              ) : mentionSearchResults.length > 0 ? (
                mentionSearchResults.map((u) => (
                  <button 
                    key={u.id}
                    onClick={() => selectMentionUser(u)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-2xl border-2 border-aeirmist-cyan/30 p-0.5">
                      <img src={getAvatarUrl(u.id, u.photoURL)} className="w-full h-full rounded-xl object-cover" alt="" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-white flex items-center gap-1.5">
                        {u.displayName || u.username}
                        {u.isVerified && <Sparkle size={10} className="text-aeirmist-cyan fill-aeirmist-cyan" />}
                      </p>
                      <p className="text-xs text-white/40">@{u.username || ' voyager'}</p>
                    </div>
                    <Plus size={18} className="text-aeirmist-cyan opacity-40" />
                  </button>
                ))
              ) : mentionSearchQuery.length > 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30 text-center px-10">
                  <Ghost className="w-12 h-12" />
                  <p className="text-xs font-bold uppercase tracking-widest">No results found</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30 text-center px-10">
                  <Search className="w-12 h-12" />
                  <p className="text-xs font-bold uppercase tracking-widest">Type to search Aeirmist</p>
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {musicOpen && (
          <MusicSearchModal 
            onClose={() => setMusicOpen(false)}
            onSelect={(song) => {
              if (musicStickerEditorOpen) {
                setSelectedMusicSticker(song);
              } else {
                setActiveMusic(song);
              }
              setMusicOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* --- DRAFTS LIBRARY SHEET --- */}
      <AnimatePresence>
        {showDraftsList && (
          <div className="fixed inset-0 z-[2500] flex items-end justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-[#0d0e14] rounded-t-[24px] border border-white/10 p-6 flex flex-col max-h-[80vh] z-[2501]"
              id="drafts_bottom_sheet"
            >
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-black uppercase tracking-widest text-white/50">Stored Drafts</span>
                <button 
                  onClick={() => setShowDraftsList(false)}
                  className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-2 overflow-y-auto flex-1 pb-6">
                {drafts.map((draft, idx) => (
                  <div 
                    key={draft.id || idx}
                    onClick={() => loadDraft(draft)}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-4 cursor-pointer transition-all hover:bg-white/5"
                  >
                    <div className="w-10 h-10 rounded-lg bg-black/40 overflow-hidden shrink-0 flex items-center justify-center">
                      {draft.capturedMedia ? (
                        <img src={draft.capturedMedia.url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <Type size={16} className="text-aeirmist-cyan" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold uppercase truncate">Draft {draft.mode}</p>
                      <p className="text-[9px] text-white/40">{new Date(draft.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button 
                      onClick={(e) => deleteDraft(draft.id, e)}
                      className="w-8 h-8 rounded-lg bg-white/5 text-rose-400 flex items-center justify-center hover:bg-rose-500/10"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                ))}
                {drafts.length === 0 && (
                  <div className="p-8 text-center text-xs text-white/30 italic border border-dashed border-white/10 rounded-2xl">
                    No active drafts stored
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- INLINE TEXT COMPOSER MODAL (DOUBLE TAP ELEMENT) --- */}
      <AnimatePresence>
        {textEditorOpen && (
          <div className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 pointer-events-auto">
            <div className="w-full max-w-md bg-[#0a0b10]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative" id="text_composer_modal">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-aeirmist-cyan">Text Settings Configuration</h3>
                <button 
                  onClick={() => setTextEditorOpen(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-white/40 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              
              <textarea 
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                style={{ 
                  fontFamily: STORY_FONTS.find(f => f.id === textFont)?.family,
                  textAlign: textAlign,
                  color: textColor,
                  fontSize: `${Math.min(textSize, 48)}px`,
                  lineHeight: 1.2
                }}
                className="w-full p-6 rounded-2xl bg-white/[0.03] border border-white/5 text-white placeholder-white/20 outline-none focus:border-aeirmist-cyan/30 h-32 mb-6 resize-none font-bold shadow-inner"
                placeholder="Save your message..."
                autoFocus
              />

              <div className="space-y-6 mb-8 max-h-[50vh] overflow-y-auto no-scrollbar pr-1">
                {/* Font selector chips */}
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-3">Typography Engine</span>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {STORY_FONTS.map((f) => (
                      <button 
                        key={f.id}
                        onClick={() => setTextFont(f.id as any)}
                        style={{ fontFamily: f.family }}
                        className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm border transition-all ${textFont === f.id ? 'bg-aeirmist-cyan border-aeirmist-cyan text-black' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}`}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alignment & Animation Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-3">Layout Grid</span>
                    <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                      {[
                        { id: 'left', icon: <AlignLeft size={14} /> },
                        { id: 'center', icon: <AlignCenter size={14} /> },
                        { id: 'right', icon: <AlignRight size={14} /> }
                      ].map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setTextAlign(a.id as any)}
                          className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all ${textAlign === a.id ? 'bg-white/10 text-aeirmist-cyan shadow-lg' : 'text-white/30 hover:text-white/60'}`}
                        >
                          {a.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-3">Entrance Vector</span>
                    <div className="relative">
                      <select 
                        value={textAnimation}
                        onChange={(e) => setTextAnimation(e.target.value as any)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider appearance-none focus:outline-none focus:border-aeirmist-cyan/40"
                      >
                        {STORY_ANIMATIONS.map(anim => (
                          <option key={anim.id} value={anim.id} className="bg-[#0a0b10]">{anim.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Background style toggle */}
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-3">Backgrounds</span>
                  <div className="flex gap-2">
                    {[
                      { id: 'none', label: 'Clean' },
                      { id: 'solid', label: 'Solid Pill' },
                      { id: 'highlight', label: 'Vivid Glow' }
                    ].map((style) => (
                      <button 
                        key={style.id}
                        onClick={() => setTextBgStyle(style.id as any)}
                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${textBgStyle === style.id ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-white/5 border-white/5 text-white/30 hover:bg-white/10'}`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color choices */}
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/30 block mb-3">Pigment Selection</span>
                  <div className="flex gap-3 justify-between">
                    {['#ffffff', '#00f2ff', '#ff00ea', '#39ff14', '#ffd166', '#000000'].map((color) => (
                      <button 
                        key={color}
                        onClick={() => setTextColor(color)}
                        style={{ backgroundColor: color }}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${textColor === color ? 'border-white scale-125 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Size & Opacity */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">
                      <span>Amplitude (Size)</span>
                      <span className="text-aeirmist-cyan">{textSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="12" 
                      max="100" 
                      value={textSize}
                      onChange={(e) => setTextSize(parseInt(e.target.value))}
                      className="w-full accent-aeirmist-cyan bg-white/5 appearance-none h-1.5 rounded-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">
                      <span>Opacity</span>
                      <span className="text-aeirmist-cyan">{Math.round(textOpacity * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="1" 
                      step="0.1"
                      value={textOpacity}
                      onChange={(e) => setTextOpacity(parseFloat(e.target.value))}
                      className="w-full accent-aeirmist-cyan bg-white/5 appearance-none h-1.5 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-white/5">
                {activeTextId && (
                  <button 
                    onClick={() => deleteTextLayer(activeTextId)}
                    className="flex-1 py-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-rose-500/20"
                  >
                    Purge Text
                  </button>
                )}
                <button 
                  onClick={saveTextChanges}
                  className="flex-1 py-4 rounded-2xl bg-aeirmist-cyan text-black hover:bg-aeirmist-cyan/90 text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_8px_24px_rgba(0,242,255,0.25)]"
                >
                  Save
                </button>
              </div>

            </div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DRAWING OPTIONS PANEL SHEET --- */}
      <AnimatePresence>
        {drawToolsOpen && (
          <div className="fixed inset-0 z-[2500] flex items-end justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-[#0d0e14] rounded-t-[24px] border-t border-white/10 p-6 flex flex-col z-[2501]"
              id="draw_tools_bottom_sheet"
            >
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black uppercase tracking-widest text-white/50">Brush Customization</span>
                <button 
                  onClick={() => {
                    setDrawToolsOpen(false);
                  }}
                  className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center animate-pulse"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-5 pb-6">
                {/* Active Draw status */}
                <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                  <span className="text-xs font-bold uppercase text-white/70">Canvas Draw Mode</span>
                  <button 
                    onClick={() => setIsDrawingMode(!isDrawingMode)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${isDrawingMode ? 'bg-aeirmist-cyan text-black border-aeirmist-cyan' : 'bg-transparent text-white/50 border-white/10'}`}
                  >
                    {isDrawingMode ? 'Drawing Active' : 'Drawing Off'}
                  </button>
                </div>

                {/* Colors list */}
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-2">Color Pigment</span>
                  <div className="flex gap-2.5">
                    {['#00f2ff', '#ff00ea', '#39ff14', '#ffffff', '#ffb703'].map(color => (
                      <button 
                        key={color}
                        onClick={() => setBrushColor(color)}
                        style={{ backgroundColor: color }}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${brushColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Diameter choice */}
                <div>
                  <div className="flex justify-between text-[10px] text-white/40 mb-1">
                    <span className="uppercase tracking-wider">Thickness</span>
                    <span>{brushSize}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="2" 
                    max="20" 
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-full accent-aeirmist-cyan bg-white/10 rounded-lg appearance-none h-1" 
                  />
                </div>

                {/* Quick operations */}
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={clearDrawing}
                    className="flex-1 py-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-black uppercase tracking-widest border border-rose-500/20 transition-all"
                  >
                    Wipe Canvas
                  </button>
                  <button 
                    onClick={() => setDrawToolsOpen(false)}
                    className="flex-1 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Close Panel
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- EFFECTS & FILTERS MATRIX SHEET --- */}
      <AnimatePresence>
        {effectsOpen && (
          <div className="fixed inset-0 z-[2500] flex items-end justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-[#0d0e14] rounded-t-[24px] border-t border-white/10 p-6 flex flex-col max-h-[85vh] overflow-y-auto z-[2501]"
              id="effects_bottom_sheet"
            >
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-aeirmist-cyan animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-widest text-white/50">AR Lenses & Color Filters</span>
                </div>
                <button 
                  onClick={() => setEffectsOpen(false)}
                  className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-6 pb-6">
                {/* AR Lenses Selection */}
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-3">AR Lenses</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'none', label: 'Clear Telemetry', desc: 'No active lens' },
                      { id: 'cyberpunk', label: 'Neon Night', desc: 'Saturated magenta & cyan color dodge grade' },
                      { id: 'vhs', label: 'VHS Retro Analog', desc: 'Scanlines, recording stamp & classic overlay' },
                      { id: 'vintage', label: 'Sepia Vintage', desc: 'Warm vignette shadow frame with old-school sepia tone' },
                      { id: 'matrix', label: 'Emerald Code', desc: 'Emerald green HUD with scrolling metadata lines' },
                      { id: 'bloom', label: 'Cosmic Bloom', desc: 'Soft dream lighting with high contrast saturation' }
                    ].map((eff) => (
                      <button
                        key={eff.id}
                        onClick={() => setSelectedEffect(eff.id as any)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between h-20 transition-all ${selectedEffect === eff.id ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-white/[0.01] border-white/5 hover:border-white/10 text-white'}`}
                      >
                        <span className="text-[11px] font-black uppercase tracking-wider block truncate">{eff.label}</span>
                        <span className="text-[8px] text-white/40 mt-1 block leading-tight line-clamp-2">{eff.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Filters list */}
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-3">Cinema Presets</span>
                  <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-1 px-1">
                    {STORY_FILTERS.map((f) => (
                      <button 
                        key={f.id}
                        onClick={() => setCurrentFilter(f.filter)}
                        className="flex-shrink-0 flex flex-col items-center gap-2 group"
                      >
                        <div 
                          className={`w-16 h-24 rounded-xl border-2 transition-all overflow-hidden relative ${currentFilter === f.filter ? 'border-aeirmist-cyan scale-105 shadow-[0_0_15px_rgba(0,242,255,0.3)]' : 'border-white/10 group-hover:border-white/30'}`}
                        >
                          {capturedMedia ? (
                            <img 
                              src={capturedMedia.url} 
                              className="w-full h-full object-cover" 
                              style={{ filter: f.filter }}
                              alt=""
                            />
                          ) : (
                            <div 
                              className="w-full h-full bg-gradient-to-br from-aeirmist-cyan to-aeirmist-magenta opacity-40"
                              style={{ filter: f.filter }}
                            />
                          )}
                          {currentFilter === f.filter && (
                            <div className="absolute inset-0 bg-aeirmist-cyan/10 flex items-center justify-center">
                              <Check size={16} className="text-white" />
                            </div>
                          )}
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${currentFilter === f.filter ? 'text-aeirmist-cyan' : 'text-white/40'}`}>
                          {f.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transform slider settings */}
                <div className="border-t border-white/5 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Visual Adjustments</span>
                    <button 
                      onClick={() => setTransformOpen(!transformOpen)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${transformOpen ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-transparent text-white/50 border-white/10'}`}
                    >
                      {transformOpen ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {transformOpen && (
                    <div className="space-y-4 mb-4 p-3 rounded-xl bg-white/[0.01] border border-white/5">
                      <div>
                        <div className="flex justify-between text-[9px] text-white/40 mb-1">
                          <span>Rotation</span>
                          <span>{mediaRotation}°</span>
                        </div>
                        <div className="flex gap-1">
                          {[0, 90, 180, 270].map(r => (
                            <button 
                              key={r}
                              onClick={() => setMediaRotation(r)}
                              className={`flex-1 py-1 rounded-md text-[8px] font-bold border transition-all ${mediaRotation === r ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-white/5 border-transparent text-white/30'}`}
                            >
                              {r}°
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[9px] text-white/40 mb-1">
                          <span>Scale</span>
                          <span>{mediaScale.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.5" max="2" step="0.1" 
                          value={mediaScale} onChange={(e) => setMediaScale(parseFloat(e.target.value))}
                          className="w-full accent-aeirmist-cyan bg-white/10 rounded-lg h-1"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => setMediaFlipX(!mediaFlipX)}
                          className={`flex-1 py-1.5 rounded-xl text-[9px] font-bold uppercase border transition-all ${mediaFlipX ? 'bg-aeirmist-cyan/20 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-white/5 border-transparent text-white/40'}`}
                        >
                          Flip Horizontal
                        </button>
                      </div>

                      <div>
                        <div className="flex justify-between text-[9px] text-white/40 mb-1">
                          <span>Brightness</span>
                          <span>{mediaBrightness}%</span>
                        </div>
                        <input 
                          type="range" min="50" max="150" 
                          value={mediaBrightness} onChange={(e) => setMediaBrightness(parseInt(e.target.value))}
                          className="w-full accent-aeirmist-cyan bg-white/10 rounded-lg h-1"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[9px] text-white/40 mb-1">
                          <span>Contrast</span>
                          <span>{mediaContrast}%</span>
                        </div>
                        <input 
                          type="range" min="50" max="150" 
                          value={mediaContrast} onChange={(e) => setMediaContrast(parseInt(e.target.value))}
                          className="w-full accent-aeirmist-cyan bg-white/10 rounded-lg h-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setSelectedEffect('none');
                      setCurrentFilter('none');
                      setMediaRotation(0);
                      setMediaScale(1);
                      setMediaFlipX(false);
                      setMediaBrightness(100);
                      setMediaContrast(100);
                    }}
                    className="flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl bg-white/5 hover:bg-white/10 text-white/60 transition-all"
                  >
                    Reset Visuals
                  </button>
                  <button
                    onClick={() => setEffectsOpen(false)}
                    className="flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl bg-aeirmist-cyan text-black hover:bg-aeirmist-cyan/90 transition-all"
                  >
                    Close Sheet
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- SETTINGS DRAWER SHEET --- */}
      <AnimatePresence>
        {settingsOpen && (
          <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/80 backdrop-blur-sm pointer-events-auto">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-[#0c0d12] border-t border-white/10 rounded-t-[24px] p-6 flex flex-col max-h-[85vh] overflow-y-auto z-[3001]"
              id="camera_settings_bottom_sheet"
            >
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5" />
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Settings size={16} className="text-aeirmist-cyan animate-spin" style={{ animationDuration: '6s' }} />
                  <span className="text-xs font-black uppercase tracking-widest text-white">Camera Configuration</span>
                </div>
                <button 
                  onClick={() => setSettingsOpen(false)}
                  className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-5 pb-6">
                {/* Timer selection */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-2">Self-Timer Delay</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 3, 5, 10].map((val) => (
                      <button
                        key={val}
                        onClick={() => setTimerSetting(val)}
                        className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all ${timerSetting === val ? 'bg-aeirmist-cyan/15 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10'}`}
                      >
                        {val === 0 ? 'Off' : `${val}s`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid setting */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-2">Composition Overlay Grid</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'none', label: 'None' },
                      { id: 'thirds', label: 'Rule of Thirds' },
                      { id: 'golden', label: 'Golden Spiral' }
                    ].map((grid) => (
                      <button
                        key={grid.id}
                        onClick={() => setGridSetting(grid.id as any)}
                        className={`py-2 rounded-xl text-[10px] font-bold border transition-all ${gridSetting === grid.id ? 'bg-aeirmist-cyan/15 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10'}`}
                      >
                        {grid.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SD HD 4K setting */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-2">Capture Quality</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['SD', 'HD', '4K'].map((res) => (
                      <button
                        key={res}
                        onClick={() => setResolutionSetting(res as any)}
                        className={`py-2 rounded-xl text-[10px] font-mono font-bold border transition-all ${resolutionSetting === res ? 'bg-aeirmist-cyan/15 border-aeirmist-cyan text-aeirmist-cyan' : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10'}`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Environment simulator theme list */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-2">Simulator Environment Pack</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['all', 'cosmos', 'cyberpunk', 'nature', 'retro'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSimulationCategory(cat as any)}
                        className={`py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all ${simulationCategory === cat ? 'bg-aeirmist-cyan/15 border-aeirmist-cyan text-aeirmist-cyan font-black' : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setTimerSetting(0);
                    setGridSetting('none');
                    setResolutionSetting('HD');
                    setSimulationCategory('all');
                  }}
                  className="flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl bg-white/5 hover:bg-white/10 text-white/60 transition-all"
                >
                  Reset Config
                </button>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl bg-aeirmist-cyan text-black hover:bg-aeirmist-cyan/90 transition-all shadow-lg shadow-aeirmist-cyan/10"
                >
                  Apply Config
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- GIPHY SEARCH MODAL --- */}
      <AnimatePresence>
        {giphyOpen && (
          <div className="fixed inset-0 z-[4000] bg-black/90 backdrop-blur-xl flex flex-col pointer-events-auto">
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <div className="flex-1 max-w-md relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input 
                  type="text"
                  placeholder="Search GIPHY..."
                  value={giphySearch}
                  onChange={(e) => {
                    setGiphySearch(e.target.value);
                    fetchGiphySearch(e.target.value);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-aeirmist-cyan/30"
                  autoFocus
                />
              </div>
              <button onClick={() => setGiphyOpen(false)} className="ml-4 p-2 text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex gap-4 p-4 border-b border-white/5">
              <button 
                onClick={() => setGiphyTab('trending')}
                className={`text-[10px] font-black uppercase tracking-widest pb-2 transition-all ${giphyTab === 'trending' ? 'text-aeirmist-cyan border-b-2 border-aeirmist-cyan' : 'text-white/40'}`}
              >
                Trending
              </button>
              <button 
                onClick={() => setGiphyTab('search')}
                className={`text-[10px] font-black uppercase tracking-widest pb-2 transition-all ${giphyTab === 'search' ? 'text-aeirmist-cyan border-b-2 border-aeirmist-cyan' : 'text-white/40'}`}
              >
                Recent
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isSearchingGiphy ? (
                <div className="flex flex-col items-center justify-center h-48 opacity-40">
                  <Loader2 size={24} className="animate-spin mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Loading GIFs...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {giphyResults.map(gif => (
                    <button 
                      key={gif.id}
                      onClick={() => selectGiphy(gif)}
                      className="aspect-square bg-white/5 rounded-2xl overflow-hidden hover:opacity-80 transition-all group relative"
                    >
                      <img src={gif.url} alt={gif.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* --- ENHANCED DRAWING TOOLBAR --- */}
      <AnimatePresence>
        {isDrawingMode && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-6 inset-x-6 z-[100] flex flex-col gap-4 pointer-events-auto"
          >
            <div className="flex items-center justify-between bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl">
              <div className="flex items-center gap-1">
                {[
                  { id: 'marker', icon: <Paintbrush size={14} />, label: 'Marker' },
                  { id: 'neon', icon: <Sparkles size={14} />, label: 'Neon' },
                  { id: 'highlighter', icon: <Palette size={14} />, label: 'Highlighter' },
                  { id: 'eraser', icon: <Eraser size={14} />, label: 'Eraser' }
                ].map(tool => (
                  <button
                    key={tool.id}
                    onClick={() => setBrushType(tool.id as any)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${brushType === tool.id ? 'bg-aeirmist-cyan text-black shadow-[0_0_12px_rgba(0,242,255,0.4)]' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                    title={tool.label}
                  >
                    {tool.icon}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={clearDrawing}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-widest border border-rose-500/20"
                >
                  Clear All
                </button>
                <button 
                  onClick={() => setIsDrawingMode(false)}
                  className="w-9 h-9 rounded-xl bg-aeirmist-cyan text-black flex items-center justify-center"
                >
                  <Check size={16} />
                </button>
              </div>
            </div>

            {brushType !== 'eraser' && (
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10">
                    <Circle size={Math.min(brushSize, 24)} className="text-white shrink-0" />
                  </div>
                  <input 
                    type="range" min="2" max="50" value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="flex-1 accent-aeirmist-cyan h-1 bg-white/10 rounded-lg"
                  />
                </div>
                
                <div className="flex justify-between gap-1 overflow-x-auto pb-1 no-scrollbar">
                  {['#ffffff', '#00f2ff', '#39ff14', '#ff00ea', '#fffd00', '#ff3131', '#ff9300', '#7b2cbf'].map(color => (
                    <button
                      key={color}
                      onClick={() => setBrushColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all shrink-0 ${brushColor === color ? 'border-white scale-125' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};
