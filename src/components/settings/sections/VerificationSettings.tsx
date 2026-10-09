import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Check, AlertCircle, Loader2, ArrowRight, X, UserX, CreditCard, Wallet, Fingerprint, Smartphone, KeyRound, Globe, Lock, Calendar, Clock, Sparkles } from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { useAppearance } from '../../../context/AppearanceContext';
import { useTheme } from '../../../context/ThemeContext';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, writeBatch, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


export const VerificationSettings = () => {
  const { user, profile, db, addToast } = useAeirmist();
  const { settings: appearance } = useAppearance();
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  const [loading, setLoading] = useState(true);
  const [verificationData, setVerificationData] = useState<any>(null);
  const [step, setStep] = useState<'plans' | 'eligibility' | 'identity' | 'payment' | 'submitted' | 'approved' | 'rejected' | 'suspended'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<'essential' | 'creator' | 'business' | null>(null);
  const [identityData, setIdentityData] = useState({
    fullName: '',
    country: '',
    idDocument: '',
    website: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [gatewayMethod, setGatewayMethod] = useState<string | null>(null);
  const [gatewayStep, setGatewayStep] = useState<'input' | 'processing' | 'success'>('input');
  const [gatewayFormData, setGatewayFormData] = useState({ 
    cardNumber: '', 
    expiry: '', 
    cvc: '', 
    mobileNumber: '', 
    pin: '', 
    otp: '' 
  });

  useEffect(() => {
    const fetchVerificationStatus = async () => {
      if (!user || !db) return;
      try {
        const docRef = doc(db, 'verificationApplications', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setVerificationData(data);
          
          if (profile?.suspended) {
            setStep('suspended');
          } else if (profile?.verified) {
            setStep('approved');
          } else if (data.status === 'pending') {
            setStep('submitted');
          } else if (data.status === 'rejected') {
            setStep('rejected');
          }
        } else {
          if (profile?.suspended) {
            setStep('suspended');
          }
        }
      } catch (e) {
        logger.error('Error fetching verification status', e);
      } finally {
        setLoading(false);
      }
    };
    fetchVerificationStatus();
  }, [user, db, profile]);

  const handlePlanSelect = (plan: 'essential' | 'creator' | 'business') => {
    setSelectedPlan(plan);
    setStep('eligibility');
  };

  const isEligible = Boolean(
    profile?.username && 
    profile?.photoURL && 
    profile?.bio &&
    !profile?.suspended
  );

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identityData.fullName || !identityData.country) {
      addToast({ title: 'Required Fields', message: 'Please complete all required fields.', type: 'warning' });
      return;
    }
    setShowPaymentModal(true);
  };

  const handlePayment = (method: string) => {
    setGatewayMethod(method);
    setGatewayStep('input');
    setGatewayFormData({ cardNumber: '', expiry: '', cvc: '', mobileNumber: '', pin: '', otp: '' });
  };

  const processGatewayPayment = async () => {
    setIsProcessing(true);
    setGatewayStep('processing');
    
    // Simulate gateway handshakes
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setGatewayStep('success');
    await new Promise(resolve => setTimeout(resolve, 800));
    
    await submitApplication(gatewayMethod || 'Stripe');
  };

  const submitApplication = async (method: string) => {
    try {
      if (!db || !user) return;
      
      const appId = `VER-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
      
      const appData = {
        applicationId: appId,
        userId: user.uid,
        username: profile?.username,
        plan: selectedPlan,
        amount: selectedPlan === 'essential' ? 3.69 : selectedPlan === 'creator' ? 9.69 : 12.69,
        currency: 'USD',
        paymentStatus: 'paid',
        paymentProvider: method,
        createdAt: serverTimestamp(),
        status: 'pending',
        identity: identityData
      };

      await setDoc(doc(db, 'verificationApplications', user.uid), appData);
      
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid), { 
        verificationStatus: 'pending',
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      if (profile?.id) {
        batch.set(doc(db, 'profiles', profile.id), {
          verificationStatus: 'pending',
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      
      await batch.commit();

      // Notify Administrators in real time about new verification application
      try {
        const adminProfilesQuery = query(collection(db, 'profiles'), where('role', 'in', ['admin', 'Administrator', 'Super Admin', 'Owner']));
        const adminSnap = await getDocs(adminProfilesQuery);
        const adminUids = new Set<string>();
        adminSnap.forEach(d => {
          const dt = d.data();
          if (dt.ownerUid) adminUids.add(dt.ownerUid);
          if (dt.uid) adminUids.add(dt.uid);
          adminUids.add(d.id);
        });

        // Add a general system notification for admin dashboard
        adminUids.add('ADMIN_BROADCAST');

        const notifPromises = Array.from(adminUids).map(admUid => 
          addDoc(collection(db, 'notifications'), {
            userId: admUid,
            fromUserId: user.uid,
            fromUserUid: user.uid,
            user: {
              name: profile?.displayName || profile?.username || 'User',
              avatar: profile?.photoURL || '',
              username: profile?.username || 'user',
              isVerified: false
            },
            type: 'admin_verification_request',
            message: `@${profile?.username || 'user'} applied for Meta-style Verification (${selectedPlan?.toUpperCase()} Plan, $${appData.amount}). Review in Enterprise Control Center.`,
            metadata: {
              applicationId: appId,
              applicantUid: user.uid,
              applicantProfileId: profile?.id || user.uid,
              username: profile?.username,
              plan: selectedPlan,
              amount: appData.amount,
              targetTab: 'verification'
            },
            read: false,
            createdAt: serverTimestamp()
          }).catch(() => {})
        );
        await Promise.allSettled(notifPromises);
      } catch (notifErr) {
        logger.warn('Failed to notify admins of verification request:', notifErr);
      }

      setVerificationData(appData);
      setShowPaymentModal(false);
      setGatewayMethod(null);
      setStep('submitted');
      
      addToast({ title: 'Application Filed', message: 'Your payment was successful and verified. Review in progress.', type: 'success' });
    } catch (e) {
      logger.error('Submission failed', e);
      addToast({ title: 'System Error', message: 'Could not finalize application.', type: 'warning' });
      setGatewayMethod(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsProcessing(true);
    try {
      if (!db || !user) return;
      await updateDoc(doc(db, 'verificationApplications', user.uid), {
        autoRenewal: false
      });
      setVerificationData((prev: any) => ({ ...prev, autoRenewal: false }));
      addToast({ title: 'Subscription Cancelled', message: 'Auto-renewal has been turned off.', type: 'info' });
    } catch (e) {
      logger.error('Cancellation failed', e);
      addToast({ title: 'Cancellation Failed', message: 'Could not update subscription.', type: 'warning' });
    } finally {
      setIsProcessing(false);
    }
  };

  const submitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (!db || !user) return;
      await setDoc(doc(db, 'appeals', user.uid), {
        userId: user.uid,
        username: profile?.username,
        timestamp: serverTimestamp(),
        status: 'pending',
        reason: 'Appealing account suspension from Verification page'
      });
      addToast({ title: 'Appeal Submitted', message: 'Your appeal is under review.', type: 'success' });
      // Usually would transition to a "Pending Appeal" state, we'll just show success
    } catch (e) {
      logger.error('Appeal failed', e);
      addToast({ title: 'Appeal Failed', message: 'Could not submit appeal.', type: 'warning' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-aeirmist-cyan" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header */}
      <div className="text-center space-y-4 mb-12">
        <div className="w-16 h-16 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
          <ShieldCheck size={32} className="text-aeirmist-cyan" />
        </div>
        <h2 className="text-3xl font-display font-black bg-gradient-to-r from-aeirmist-cyan to-blue-500 bg-clip-text text-transparent uppercase tracking-wider">
          Verification
        </h2>
        <p className="text-sm font-mono text-white/60 max-w-xl mx-auto leading-relaxed">
          Build trust, protect your identity, and unlock premium features. Choose the plan that fits you.
        </p>
      </div>

      {step === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Essential Plan */}
          <div className="relative rounded-[2rem] p-6 bg-white/[0.02] border border-white/10 hover:border-blue-500/50 transition-all group flex flex-col hover:-translate-y-2 duration-300">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 rounded-[2rem] transition-opacity pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="text-blue-400" size={20} />
              <h3 className="text-lg font-bold text-white">Essential</h3>
            </div>
            <div className="mb-4">
              <span className="text-3xl font-black text-white">$3.69</span>
              <span className="text-xs text-white/40 font-mono ml-1">/ month</span>
            </div>
            <p className="text-xs text-white/60 mb-6 h-8">Best for everyday users</p>
            
            <div className="space-y-3 mb-8 flex-1">
              {[
                'Identity Verification',
                'Blue Verified Badge',
                'Impersonation Protection',
                'Verified Search Label',
                'Priority Support'
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-white/80">
                  <Check size={14} className="text-blue-400 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/5 pt-4 mb-6 text-center">
              <p className="text-[10px] text-white/40 font-mono">Review Time: 24-72 Hours</p>
            </div>
            
            <button
              onClick={() => handlePlanSelect('essential')}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-500/20 hover:border-blue-500/50 hover:text-blue-400 transition-all"
            >
              Start Verification
            </button>
          </div>

          {/* Creator Plan */}
          <div className="relative rounded-[2rem] p-6 bg-gradient-to-b from-aeirmist-cyan/10 to-aeirmist-magenta/5 border border-aeirmist-cyan/30 hover:border-aeirmist-cyan transition-all group flex flex-col hover:-translate-y-2 duration-300 transform md:scale-105 z-10 shadow-[0_0_40px_rgba(0,242,255,0.1)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-aeirmist-cyan text-[#06080c] text-[10px] font-black uppercase tracking-widest whitespace-nowrap shadow-[0_0_20px_rgba(0,242,255,0.4)]">
              Most Popular
            </div>
            
            <div className="flex items-center gap-2 mb-2 mt-2">
              <ShieldCheck className="text-aeirmist-cyan" size={20} />
              <h3 className="text-lg font-bold text-white">Creator</h3>
            </div>
            <div className="mb-4">
              <span className="text-3xl font-black text-white">$9.69</span>
              <span className="text-xs text-white/40 font-mono ml-1">/ month</span>
            </div>
            <p className="text-xs text-white/60 mb-6 h-8">Perfect for creators</p>
            
            <div className="space-y-3 mb-8 flex-1">
              <div className="text-[10px] font-bold text-aeirmist-cyan uppercase tracking-wider mb-2">Everything in Essential, plus:</div>
              {[
                'Priority Review',
                'Creator Insights',
                'Premium Creator Badge',
                'Featured Creator Eligibility',
                'Higher Marketplace Visibility'
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-white/90">
                  <Check size={14} className="text-aeirmist-cyan shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/5 pt-4 mb-6 text-center">
              <p className="text-[10px] text-white/40 font-mono">Review Time: 12-48 Hours</p>
            </div>
            
            <button
              onClick={() => handlePlanSelect('creator')}
              className="w-full py-3 rounded-xl bg-aeirmist-cyan text-[#06080c] text-xs font-bold uppercase tracking-wider hover:shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all"
            >
              Start Verification
            </button>
          </div>

          {/* Business Plan */}
          <div className="relative rounded-[2rem] p-6 bg-white/[0.02] border border-white/10 hover:border-amber-500/50 transition-all group flex flex-col hover:-translate-y-2 duration-300">
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 rounded-[2rem] transition-opacity pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="text-amber-400" size={20} />
              <h3 className="text-lg font-bold text-white">Business</h3>
            </div>
            <div className="mb-4">
              <span className="text-3xl font-black text-white">$12.69</span>
              <span className="text-xs text-white/40 font-mono ml-1">/ month</span>
            </div>
            <p className="text-xs text-white/60 mb-6 h-8">Best for brands & businesses</p>
            
            <div className="space-y-3 mb-8 flex-1">
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2">Everything in Creator, plus:</div>
              {[
                'Business Verification Badge',
                'Verified Seller Badge',
                'Brand Protection',
                'Priority Marketplace Ranking',
                'Business Analytics'
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-white/80">
                  <Check size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/5 pt-4 mb-6 text-center">
              <p className="text-[10px] text-white/40 font-mono">Review Time: Within 24 Hours</p>
            </div>
            
            <button
              onClick={() => handlePlanSelect('business')}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider text-white hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-400 transition-all"
            >
              Start Verification
            </button>
          </div>
        </div>
      )}

      {step === 'eligibility' && (
        <div className="max-w-md mx-auto">
          <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 shadow-2xl backdrop-blur-xl">
            <h3 className="text-xl font-bold text-white mb-6 text-center">Eligibility Check</h3>
            
            <div className="space-y-4 mb-8">
              <div className={`flex items-center justify-between p-3 rounded-xl border ${profile?.username ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <span className="text-sm font-medium text-white">Username</span>
                {profile?.username ? <Check size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
              </div>
              <div className={`flex items-center justify-between p-3 rounded-xl border ${profile?.photoURL ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <span className="text-sm font-medium text-white">Profile Photo</span>
                {profile?.photoURL ? <Check size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
              </div>
              <div className={`flex items-center justify-between p-3 rounded-xl border ${profile?.bio ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <span className="text-sm font-medium text-white">Bio</span>
                {profile?.bio ? <Check size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setStep('plans')}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-all text-white"
              >
                Back
              </button>
              <button 
                onClick={() => setStep('identity')}
                disabled={!isEligible}
                className="flex-1 py-3 rounded-xl bg-aeirmist-cyan text-[#06080c] text-xs font-bold uppercase tracking-wider hover:shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm & Proceed
              </button>
            </div>
            
            {!isEligible && (
              <p className="text-center text-[10px] text-red-400 mt-4 font-mono">
                Please complete your profile to proceed.
              </p>
            )}
          </div>
        </div>
      )}

      {step === 'identity' && (
        <div className="max-w-md mx-auto">
          <form onSubmit={handleIdentitySubmit} className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 shadow-2xl backdrop-blur-xl">
            <h3 className="text-xl font-bold text-white mb-2 text-center">Identity Information</h3>
            <p className="text-[10px] text-white/50 text-center font-mono mb-8 uppercase tracking-widest">Secure & Encrypted</p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1.5">Full Legal Name *</label>
                <input 
                  type="text" 
                  required
                  value={identityData.fullName}
                  onChange={e => setIdentityData({...identityData, fullName: e.target.value})}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-aeirmist-cyan outline-none transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1.5">Country *</label>
                <input 
                  type="text" 
                  required
                  value={identityData.country}
                  onChange={e => setIdentityData({...identityData, country: e.target.value})}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-aeirmist-cyan outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1.5">ID Document Number</label>
                <input 
                  type="text" 
                  value={identityData.idDocument}
                  onChange={e => setIdentityData({...identityData, idDocument: e.target.value})}
                  placeholder="Optional for preview"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-aeirmist-cyan outline-none transition-colors"
                />
              </div>

              {selectedPlan === 'business' && (
                <div>
                  <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1.5">Website (Optional)</label>
                  <input 
                    type="url" 
                    value={identityData.website}
                    onChange={e => setIdentityData({...identityData, website: e.target.value})}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-aeirmist-cyan outline-none transition-colors"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => setStep('eligibility')}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-all text-white"
              >
                Back
              </button>
              <button 
                type="submit"
                className="flex-1 py-3 rounded-xl bg-aeirmist-cyan text-[#06080c] text-xs font-bold uppercase tracking-wider hover:shadow-[0_0_20px_rgba(0,242,255,0.4)] transition-all"
              >
                Go to Payment
              </button>
            </div>
            
            <p className="text-[10px] text-white/40 text-center mt-6 font-mono leading-relaxed">
              Verification is granted only after successful identity and eligibility review. Payment covers the review and subscription service and does not guarantee approval.
            </p>
          </form>
        </div>
      )}

      {/* Submitted Status */}
      {step === 'submitted' && verificationData && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`max-w-md mx-auto p-10 rounded-[2.5rem] ${isLight ? 'bg-white border-slate-100' : 'bg-white/[0.02] border-blue-500/20'} border shadow-2xl text-center relative overflow-hidden`}
        >
          {/* Decorative Glow */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-aeirmist-cyan/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10">
            <div className={`w-20 h-20 mx-auto rounded-3xl ${isLight ? 'bg-blue-50' : 'bg-blue-500/10'} flex items-center justify-center mb-8 relative`}>
              <Loader2 className="animate-spin text-blue-400" size={36} />
              <div className="absolute inset-0 rounded-3xl border-2 border-blue-500/20 animate-pulse" />
            </div>
            
            <h3 className={`text-2xl font-black uppercase tracking-widest mb-3 ${isLight ? 'text-slate-900' : 'text-white'}`}>Application Filed</h3>
            <p className={`text-sm mb-8 px-4 ${isLight ? 'text-slate-500' : 'text-white/60'}`}>
              Your premium verification request has been successfully transmitted to our security nodes.
            </p>
            
            <div className={`rounded-2xl p-5 mb-8 text-left ${isLight ? 'bg-slate-50 border-slate-100' : 'bg-black/40 border-white/5'} border`}>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Reference ID</span>
                  <span className={`text-xs font-bold font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{verificationData.applicationId}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Tier Level</span>
                  <span className="text-xs font-bold text-aeirmist-cyan capitalize">{verificationData.plan} Verified</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>ETA Phase</span>
                  <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>24 — 72 Nodes</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full ${isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/10 text-blue-400'} text-[10px] font-black uppercase tracking-widest mb-4`}>
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Status: Encrypted Review
              </div>

              <button
                onClick={() => setStep('plans')}
                className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                  isLight 
                  ? 'bg-slate-900 text-white hover:bg-slate-800' 
                  : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                Close & Return
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Approved Status */}
      {step === 'approved' && (() => {
        const plan = verificationData?.plan || profile?.verificationPlan || 'creator';
        const planName = plan === 'essential' ? 'Essential' : plan === 'business' ? 'Business' : 'Creator';
        const planPrice = plan === 'essential' ? '$3.69 / month' : plan === 'business' ? '$12.69 / month' : '$9.69 / month';
        const badgeColor = plan === 'essential' ? 'text-blue-400' : plan === 'business' ? 'text-amber-400' : 'text-aeirmist-cyan';
        const badgeBg = plan === 'essential' ? 'bg-blue-500/10 border-blue-500/30' : plan === 'business' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-cyan-500/10 border-cyan-500/30';
        
        // Date parsing
        const rawApproved = profile?.verificationApprovedAt || profile?.verifiedAt || verificationData?.approvedAt || verificationData?.createdAt;
        let verifiedSinceStr = 'Active';
        try {
          if (rawApproved?.toDate) verifiedSinceStr = rawApproved.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          else if (rawApproved) verifiedSinceStr = new Date(rawApproved).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {}

        const rawExpires = profile?.verificationExpiresAt || profile?.monthlyDeadline || verificationData?.expiresAt || verificationData?.monthlyDeadline;
        let deadlineMs = Date.now() + 30 * 86400 * 1000;
        let deadlineStr = 'In 30 days';
        try {
          if (rawExpires?.toMillis) {
            deadlineMs = rawExpires.toMillis();
            deadlineStr = new Date(deadlineMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          } else if (rawExpires?.toDate) {
            deadlineMs = rawExpires.toDate().getTime();
            deadlineStr = rawExpires.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          } else if (rawExpires) {
            deadlineMs = new Date(rawExpires).getTime();
            deadlineStr = new Date(rawExpires).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          }
        } catch {}

        const diffDays = Math.max(0, Math.ceil((deadlineMs - Date.now()) / (1000 * 60 * 60 * 24)));
        const progressPct = Math.min(100, Math.max(5, Math.round((diffDays / 30) * 100)));

        return (
          <div className="max-w-md mx-auto space-y-6">
            <div className={`p-8 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border ${badgeBg} text-center relative overflow-hidden shadow-2xl`}>
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck size={120} className={badgeColor} />
              </div>
              <div className="relative z-10">
                <div className={`w-16 h-16 mx-auto rounded-full ${badgeBg} flex items-center justify-center mb-5 shadow-lg`}>
                  <ShieldCheck size={32} className={badgeColor} />
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">Aeirmist Verified</h3>
                <p className="text-xs text-white/60 mb-4 font-mono">Meta-Style Verified Identity Active</p>
                
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${badgeBg} border ${badgeColor} text-xs font-black uppercase tracking-wider`}>
                  <Check size={14} /> {planName} Badge Active
                </div>
              </div>
            </div>
            
            {/* Meta-Style Subscription & Deadline Card */}
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/50 flex items-center gap-1.5">
                  <Sparkles size={12} className={badgeColor} /> Meta Plan Details
                </h4>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded font-mono ${badgeBg}`}>
                  {planName}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <span className="text-[9px] uppercase font-mono text-white/40 block mb-1">Billing Rate</span>
                  <span className="font-bold text-white">{planPrice}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <span className="text-[9px] uppercase font-mono text-white/40 block mb-1">Verified Since</span>
                  <span className="font-bold text-white/90">{verifiedSinceStr}</span>
                </div>
              </div>

              {/* Monthly Renewal Deadline & Progress */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/60 flex items-center gap-1.5 font-mono text-[11px]">
                    <Clock size={13} className={badgeColor} /> Monthly Deadline
                  </span>
                  <span className="font-mono font-bold text-white">{deadlineStr}</span>
                </div>

                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      diffDays <= 3 ? 'bg-red-400' : diffDays <= 7 ? 'bg-amber-400' : 'bg-aeirmist-cyan'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] font-mono text-white/40 pt-1">
                  <span>{diffDays} Day{diffDays === 1 ? '' : 's'} Remaining in Cycle</span>
                  <span>{verificationData?.autoRenewal !== false ? 'Auto-Renew: ON' : 'Auto-Renew: OFF'}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                {verificationData?.autoRenewal !== false ? (
                  <button 
                    onClick={handleCancelSubscription}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Turn Off Auto-Renewal'}
                  </button>
                ) : (
                  <button 
                    onClick={() => setStep('plans')}
                    className="w-full py-3 rounded-xl bg-aeirmist-cyan text-black text-xs font-bold uppercase tracking-wider hover:bg-white transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
                  >
                    Renew Subscription Now
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Rejected Status */}
      {step === 'rejected' && (
        <div className="max-w-md mx-auto p-8 rounded-3xl bg-red-500/5 border border-red-500/20 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-6">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Verification Not Approved</h3>
          <p className="text-sm text-white/60 mb-6">Your application was reviewed but could not be approved at this time.</p>
          
          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 mb-6 text-left">
            <span className="block text-[10px] text-white/40 font-mono uppercase mb-1">Reason</span>
            <span className="text-sm text-red-300 font-medium">Identity document could not be verified or is incomplete.</span>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={() => setStep('plans')}
              className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider hover:bg-white/20 transition-all"
            >
              Reapply
            </button>
          </div>
        </div>
      )}

      {/* Suspended Appeal Status */}
      {step === 'suspended' && (
        <div className="max-w-md mx-auto p-8 rounded-3xl bg-amber-500/5 border border-amber-500/20 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-6">
            <UserX size={32} className="text-amber-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Account Suspended</h3>
          <p className="text-sm text-white/60 mb-6">Your account has been suspended for violating our terms of service. Verification is unavailable.</p>
          
          <form onSubmit={submitAppeal} className="text-left space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1.5">Appeal Explanation</label>
              <textarea 
                required
                rows={4}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-amber-400 outline-none transition-colors"
                placeholder="Explain why your account should be restored..."
              />
            </div>
            <button 
              type="submit"
              disabled={isProcessing}
              className="w-full py-3 rounded-xl bg-amber-400 text-black text-xs font-bold uppercase tracking-wider hover:bg-amber-300 transition-all flex justify-center items-center gap-2"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'Submit Appeal'}
            </button>
          </form>
        </div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`w-full max-w-sm ${isLight ? 'bg-white' : 'bg-[#0a0a0a]'} border ${isLight ? 'border-black/5' : 'border-white/10'} rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden relative`}
            >
              {/* Dynamic Theme Glow */}
              <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[80px] opacity-30 pointer-events-none ${
                selectedPlan === 'essential' ? 'bg-blue-500' :
                selectedPlan === 'creator' ? 'bg-aeirmist-cyan' :
                'bg-amber-500'
              }`} />
              <div className={`absolute -bottom-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none ${
                selectedPlan === 'essential' ? 'bg-blue-600' :
                selectedPlan === 'creator' ? 'bg-aeirmist-magenta' :
                'bg-amber-600'
              }`} />

              <div className={`p-5 border-b ${isLight ? 'border-black/5 bg-black/[0.02]' : 'border-white/5 bg-white/[0.02]'} flex justify-between items-center relative z-10`}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    selectedPlan === 'essential' ? 'bg-blue-500/20 text-blue-400' :
                    selectedPlan === 'creator' ? 'bg-aeirmist-cyan/20 text-aeirmist-cyan' :
                    'bg-amber-500/20 text-amber-400'
                  }`}>
                    {gatewayMethod ? <Lock size={18} /> : <ShieldCheck size={18} />}
                  </div>
                  <h3 className={`text-sm font-black uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {gatewayMethod ? `Gateway: ${gatewayMethod}` : 'Select Payment'}
                  </h3>
                </div>
                <button 
                  onClick={() => {
                    if (gatewayMethod) {
                      setGatewayMethod(null);
                    } else {
                      setShowPaymentModal(false);
                    }
                  }} 
                  className={`p-2 rounded-full transition-colors ${isLight ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-900' : 'text-white/40 hover:bg-white/10 hover:text-white'}`}
                >
                  {gatewayMethod ? <ArrowRight size={18} className="rotate-180" /> : <X size={18} />}
                </button>
              </div>
              
              <div className="p-7 relative z-10">
                {!gatewayMethod ? (
                  <>
                    <div className="space-y-2.5 mb-8">
                      {[
                        { id: 'stripe', name: 'Card Payment (Secure)', icon: <CreditCard size={14} /> },
                        { id: 'paypal', name: 'PayPal Checkout', icon: <Globe size={14} /> },
                        { id: 'apple', name: 'Apple Pay (Fast)', icon: <Fingerprint size={14} /> },
                        { id: 'google', name: 'Google Pay (Fast)', icon: <Smartphone size={14} /> },
                        { id: 'bkash', name: 'bKash Mobile Wallet', icon: <Wallet size={14} /> },
                        { id: 'nagad', name: 'Nagad Wallet', icon: <Wallet size={14} /> },
                        { id: 'rocket', name: 'Rocket Banking', icon: <Wallet size={14} /> }
                      ].map(method => (
                        <button 
                          key={method.id}
                          onClick={() => handlePayment(method.name)}
                          disabled={isProcessing}
                          className={`w-full p-3.5 rounded-2xl border transition-all flex justify-between items-center group relative overflow-hidden ${
                            isLight 
                            ? 'bg-slate-50 border-slate-200 hover:border-slate-400 hover:bg-slate-100' 
                            : 'bg-white/[0.03] border-white/5 hover:border-white/20 hover:bg-white/[0.06]'
                          }`}
                        >
                          {/* Hover Accent Glow */}
                          <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none ${
                            selectedPlan === 'essential' ? 'bg-blue-500' :
                            selectedPlan === 'creator' ? 'bg-aeirmist-cyan' :
                            'bg-amber-500'
                          }`} />
                          
                          <div className="flex items-center gap-3">
                            <span className={isLight ? 'text-slate-400' : 'text-white/30'}>{method.icon}</span>
                            <span className={`text-sm font-bold tracking-tight transition-colors ${isLight ? 'text-slate-700 group-hover:text-slate-900' : 'text-white/80 group-hover:text-white'}`}>
                              {method.name}
                            </span>
                          </div>
                          <ArrowRight size={14} className={`transition-all transform group-hover:translate-x-1 ${
                            isLight ? 'text-slate-300 group-hover:text-slate-900' : 'text-white/20 group-hover:text-white'
                          }`} />
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="min-h-[300px] flex flex-col">
                    {gatewayStep === 'input' && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                        {['Stripe', 'PayPal'].includes(gatewayMethod) ? (
                          <>
                            <div className="space-y-2">
                              <label className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Card Number</label>
                              <div className="relative">
                                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                                <input 
                                  type="text" 
                                  placeholder="0000 0000 0000 0000"
                                  className={`w-full h-12 pl-11 pr-4 rounded-xl border text-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10 text-white'}`}
                                  value={gatewayFormData.cardNumber}
                                  onChange={(e) => setGatewayFormData({...gatewayFormData, cardNumber: e.target.value})}
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Expiry</label>
                                <input 
                                  type="text" 
                                  placeholder="MM/YY"
                                  className={`w-full h-12 px-4 rounded-xl border text-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10 text-white'}`}
                                  value={gatewayFormData.expiry}
                                  onChange={(e) => setGatewayFormData({...gatewayFormData, expiry: e.target.value})}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>CVC</label>
                                <input 
                                  type="password" 
                                  placeholder="***"
                                  className={`w-full h-12 px-4 rounded-xl border text-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10 text-white'}`}
                                  value={gatewayFormData.cvc}
                                  onChange={(e) => setGatewayFormData({...gatewayFormData, cvc: e.target.value})}
                                />
                              </div>
                            </div>
                          </>
                        ) : ['bKash', 'Nagad', 'Rocket'].includes(gatewayMethod) ? (
                          <>
                            <div className="space-y-2 text-center pb-4">
                              <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                                <Smartphone size={24} className="text-aeirmist-magenta" />
                              </div>
                              <p className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/40'}`}>Mobile Wallet Gateway</p>
                            </div>
                            <div className="space-y-2">
                              <label className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Account Number</label>
                              <input 
                                type="tel" 
                                placeholder="01XXXXXXXXX"
                                className={`w-full h-12 px-4 rounded-xl border text-sm ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10 text-white'}`}
                                value={gatewayFormData.mobileNumber}
                                onChange={(e) => setGatewayFormData({...gatewayFormData, mobileNumber: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Wallet PIN</label>
                              <input 
                                type="password" 
                                placeholder="•••••"
                                className={`w-full h-12 px-4 rounded-xl border text-sm text-center tracking-[0.5em] ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10 text-white'}`}
                                value={gatewayFormData.pin}
                                onChange={(e) => setGatewayFormData({...gatewayFormData, pin: e.target.value})}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 space-y-6">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                              <Fingerprint size={40} className="text-aeirmist-cyan" />
                            </div>
                            <div className="text-center">
                              <p className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Waiting for Biometric Auth</p>
                              <p className={`text-[10px] uppercase tracking-widest mt-1 ${isLight ? 'text-slate-400' : 'text-white/40'}`}>Confirm on your device</p>
                            </div>
                          </div>
                        )}

                        <button 
                          onClick={processGatewayPayment}
                          className={`w-full py-4 mt-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                            selectedPlan === 'essential' ? 'bg-blue-500 hover:bg-blue-600' :
                            selectedPlan === 'creator' ? 'bg-aeirmist-cyan hover:bg-aeirmist-cyan/80' :
                            'bg-amber-500 hover:bg-amber-600'
                          } text-black`}
                        >
                          Confirm & Authorize
                        </button>
                      </motion.div>
                    )}

                    {gatewayStep === 'processing' && (
                      <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                        <div className="relative">
                          <Loader2 size={48} className="animate-spin text-aeirmist-cyan" />
                          <div className="absolute inset-0 blur-xl bg-aeirmist-cyan/20 animate-pulse" />
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-black uppercase tracking-tighter ${isLight ? 'text-slate-900' : 'text-white'}`}>Securing Connection</p>
                          <p className={`text-[9px] font-mono mt-1 ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Handshaking with {gatewayMethod} node...</p>
                        </div>
                      </div>
                    )}

                    {gatewayStep === 'success' && (
                      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center border-2 border-green-500/30"
                        >
                          <Check size={40} className="text-green-500" />
                        </motion.div>
                        <p className={`text-sm font-black uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>Authorized</p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className={`mt-auto pt-5 border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Total Amount</span>
                    <span className={`text-lg font-black font-mono ${
                      selectedPlan === 'essential' ? 'text-blue-400' :
                      selectedPlan === 'creator' ? 'text-aeirmist-cyan' :
                      'text-amber-400'
                    }`}>
                      ${selectedPlan === 'essential' ? '3.69' : selectedPlan === 'creator' ? '9.69' : '12.69'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-[9px] font-medium uppercase tracking-tighter ${isLight ? 'text-slate-400' : 'text-white/20'}`}>VAT / Transaction Fee</span>
                    <span className={`text-[9px] font-medium uppercase tracking-tighter ${isLight ? 'text-slate-400' : 'text-white/20'}`}>Calculated at gateway</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
