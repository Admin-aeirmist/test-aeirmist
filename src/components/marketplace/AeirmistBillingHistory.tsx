import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
  History, 
  CreditCard, 
  ArrowUpRight, 
  ShieldCheck, 
  Sparkles,
  Download,
  ExternalLink
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


export const AeirmistBillingHistory: React.FC = () => {
  const { user, db } = useAeirmist();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) return;

    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', user.uid),
          orderBy('timestamp', 'desc')
        );
        const snap = await getDocs(q);
        setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        logger.error('Failed to sync billing history:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user, db]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 grayscale opacity-50">
        <div className="animate-spin text-aeirmist-cyan">
          <History size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <CreditCard size={18} className="text-white/40" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Billing History</h3>
        </div>
        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{transactions.length} records found</span>
      </div>

      <div className="space-y-3">
        {transactions.map((tx) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-5 rounded-2xl border-white/5 flex items-center justify-between group hover:border-white/10 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                tx.paymentType === 'premium' ? 'bg-aeirmist-magenta/10 text-aeirmist-magenta' : 'bg-aeirmist-cyan/10 text-aeirmist-cyan'
              }`}>
                {tx.paymentType === 'premium' ? <Sparkles size={18} /> : <ShieldCheck size={18} />}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-tight text-white group-hover:text-aeirmist-cyan transition-colors">
                  {tx.paymentType === 'premium' ? 'Premium Upgrade' : 'Identity Verification'}
                </p>
                <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">
                  {tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleDateString() : 'Syncing...'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-black text-white">${(tx.amount / 100).toFixed(2)}</p>
              <div className="flex items-center gap-2 mt-1 justify-end">
                <span className="text-[8px] font-black uppercase tracking-widest text-aeirmist-cyan opacity-60">Verified</span>
                <ArrowUpRight size={10} className="text-white/20" />
              </div>
            </div>
          </motion.div>
        ))}

        {transactions.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/10 italic">No synaptic transactions recorded</p>
          </div>
        )}
      </div>
    </div>
  );
};
