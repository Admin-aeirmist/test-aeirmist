import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, MessageSquare, Phone, Video, User, Crown, ShieldCheck, Shield,
  Edit3, VolumeX, Volume2, UserMinus, ArrowRightLeft, Ban, AlertTriangle,
  Check, Loader2, Calendar, Users, Sparkles
} from 'lucide-react';
import { getAvatarUrl } from '../../lib/avatar';
import { useAeirmist } from '../../context/AeirmistContext';
import { logger } from '@/src/utils/logger';


interface MemberDetailsSheetProps {
  member: any;
  chat: any;
  currentUserId: string;
  onClose: () => void;
  onSetNickname: (memberId: string, currentNickname: string) => void;
  onToggleMute: (memberId: string, isMuted: boolean) => void;
  onPromoteDemoteRole: (memberId: string, currentRole: string, targetRole: 'owner' | 'admin' | 'moderator' | 'member') => void;
  onRemoveMember: (memberId: string, memberName: string, reason?: string) => void;
  onTransferOwnership: (memberId: string, memberName: string) => void;
  onDirectMessage: (member: any) => void;
  onInitiateCall: (type: 'audio' | 'video', member: any) => void;
  onViewFullProfile?: (member: any) => void;
}

export const MemberDetailsSheet: React.FC<MemberDetailsSheetProps> = ({
  member,
  chat,
  currentUserId,
  onClose,
  onSetNickname,
  onToggleMute,
  onPromoteDemoteRole,
  onRemoveMember,
  onTransferOwnership,
  onDirectMessage,
  onInitiateCall,
  onViewFullProfile
}) => {
  const { onlineUsers } = useAeirmist();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removeReason, setRemoveReason] = useState('');
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const memberId = member.id || member.uid || member.username;
  const isSelf = memberId === currentUserId;
  const isMemOnline = isSelf || (!!onlineUsers && (
    !!onlineUsers?.has?.(memberId) ||
    (!!member.uid && !!onlineUsers?.has?.(member.uid)) ||
    (!!member.id && !!onlineUsers?.has?.(member.id))
  ));

  // Determine permissions
  const ownerId = chat.owner || chat.createdBy || chat.ownerId;
  const admins: string[] = chat.admins || [];
  const memberRoles: Record<string, string> = chat.memberRoles || {};
  const nicknames: Record<string, string> = chat.nicknames || {};
  const mutedMembers: Record<string, boolean> = chat.mutedMembers || {};

  const isCurrentOwner = currentUserId === ownerId;
  const isCurrentAdmin = isCurrentOwner || admins.includes(currentUserId);
  const currentRole = isCurrentOwner ? 'owner' : isCurrentAdmin ? 'admin' : (memberRoles[currentUserId] || 'member');

  // Member's role
  const targetIsOwner = memberId === ownerId;
  const targetIsAdmin = targetIsOwner || admins.includes(memberId) || memberRoles[memberId] === 'admin';
  const targetIsMod = memberRoles[memberId] === 'moderator';
  const targetRole = targetIsOwner ? 'owner' : targetIsAdmin ? 'admin' : targetIsMod ? 'moderator' : 'member';

  const isMuted = !!mutedMembers[memberId];
  const nickname = nicknames[memberId] || '';
  const displayName = member.displayName || member.name || 'Aeirmist Member';
  const username = member.username || memberId;
  const photoURL = getAvatarUrl(member.photoURL);
  const isVerified = Boolean(member.isVerified === true || member.verified === true || member.badge === 'verified' || member.badge === 'admin' || member.isAdmin === true);

  // Role permissions checks
  const canSetNickname = isCurrentAdmin || isSelf;
  const canMute = isCurrentAdmin && !targetIsOwner && (!targetIsAdmin || isCurrentOwner);
  const canPromoteAdmin = isCurrentOwner || (isCurrentAdmin && !targetIsAdmin);
  const canPromoteMod = isCurrentAdmin && !targetIsOwner;
  const canRemove = !isSelf && !targetIsOwner && (isCurrentOwner || (isCurrentAdmin && !targetIsAdmin));
  const canTransferOwnership = isCurrentOwner && !isSelf;

  const handleConfirmRemove = async () => {
    setIsProcessing(true);
    try {
      await onRemoveMember(memberId, displayName, removeReason || undefined);
      setShowRemoveConfirm(false);
      onClose();
    } catch (e) {
      logger.error("Failed to remove member:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmTransfer = async () => {
    setIsProcessing(true);
    try {
      await onTransferOwnership(memberId, displayName);
      setShowTransferConfirm(false);
      onClose();
    } catch (e) {
      logger.error("Failed to transfer ownership:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        className="w-full max-w-lg bg-[#121820] sm:rounded-3xl rounded-t-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Indicator */}
        <div className="w-full flex justify-center py-2.5 sm:hidden border-b border-white/5">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <span className="text-xs font-black uppercase tracking-widest text-aeirmist-cyan">Member Details</span>
          <button 
            onClick={onClose}
            className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* HERO PROFILE SECTION */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3 group">
              <img 
                src={photoURL} 
                className="w-24 h-24 rounded-3xl object-cover border-2 border-aeirmist-cyan/40 shadow-xl"
                alt="" 
              />
              {/* Active Indicator Ring */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#121820] p-1 flex items-center justify-center">
                <div className={`w-full h-full rounded-full transition-all ${isMemOnline ? 'bg-aeirmist-lime ring-2 ring-aeirmist-lime/30 animate-pulse' : 'bg-zinc-600 border border-white/10'}`} />
              </div>
            </div>

            {/* Names & Badges */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-tight">{nickname || displayName}</h2>
              {isVerified && <ShieldCheck className="text-aeirmist-cyan shrink-0 w-5 h-5" />}
            </div>

            {nickname && (
              <p className="text-xs font-medium text-white/60 mt-0.5">Real name: {displayName}</p>
            )}

            <p className="text-xs text-white/40 font-mono mt-0.5">@{username}</p>

            {/* Role & State Badges Row */}
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              {targetIsOwner && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold">
                  <Crown size={12} className="text-amber-400 shrink-0" />
                  Owner
                </span>
              )}
              {targetIsAdmin && !targetIsOwner && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold">
                  <ShieldCheck size={12} className="text-cyan-300 shrink-0" />
                  Admin
                </span>
              )}
              {targetIsMod && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold">
                  <Shield size={12} className="text-purple-300 shrink-0" />
                  Moderator
                </span>
              )}
              {!targetIsAdmin && !targetIsMod && (
                <span className="px-3 py-1 rounded-full bg-white/5 text-white/60 border border-white/10 text-[11px] font-medium">
                  Member
                </span>
              )}
              {isSelf && (
                <span className="px-2.5 py-0.5 rounded-full bg-aeirmist-cyan/20 text-aeirmist-cyan text-[10px] font-black uppercase">
                  YOU
                </span>
              )}
              {isMuted && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                  <VolumeX size={10} /> Muted
                </span>
              )}
              {isMemOnline ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-aeirmist-lime/20 text-aeirmist-lime border border-aeirmist-lime/30 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-aeirmist-lime animate-pulse" /> Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" /> Offline
                </span>
              )}
            </div>
          </div>

          {/* QUICK ACTIONS ROW */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {!isSelf && (
              <>
                <button
                  onClick={() => {
                    onClose();
                    onDirectMessage(member);
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-aeirmist-cyan/20 hover:border-aeirmist-cyan/40 border border-white/5 transition-all text-white group"
                >
                  <MessageSquare size={18} className="text-aeirmist-cyan group-hover:scale-110 transition-transform mb-1" />
                  <span className="text-[10px] font-semibold text-white/80">Message</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onInitiateCall('audio', member);
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-emerald-500/20 hover:border-emerald-500/40 border border-white/5 transition-all text-white group"
                >
                  <Phone size={18} className="text-emerald-400 group-hover:scale-110 transition-transform mb-1" />
                  <span className="text-[10px] font-semibold text-white/80">Audio</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onInitiateCall('video', member);
                  }}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-purple-500/20 hover:border-purple-500/40 border border-white/5 transition-all text-white group"
                >
                  <Video size={18} className="text-purple-400 group-hover:scale-110 transition-transform mb-1" />
                  <span className="text-[10px] font-semibold text-white/80">Video</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                onClose();
                if (onViewFullProfile) onViewFullProfile(member);
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-white group ${isSelf ? 'col-span-4' : ''}`}
            >
              <User size={18} className="text-white/70 group-hover:scale-110 transition-transform mb-1" />
              <span className="text-[10px] font-semibold text-white/80">Profile</span>
            </button>
          </div>

          {/* MANAGEMENT OPTIONS */}
          <div className="space-y-2 pt-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/40 px-1">Group Permissions & Management</span>
            
            <div className="bg-white/5 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
              {/* Set Nickname */}
              {canSetNickname && (
                <button
                  onClick={() => {
                    onSetNickname(memberId, nickname);
                    onClose();
                  }}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors text-xs font-semibold text-white"
                >
                  <div className="flex items-center gap-3">
                    <Edit3 size={16} className="text-amber-400 shrink-0" />
                    <div>
                      <div>Change Nickname</div>
                      <div className="text-[10px] text-white/40 font-normal">
                        {nickname ? `Current: "${nickname}"` : 'Set a custom nickname in this group'}
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Mute Member */}
              {canMute && (
                <button
                  onClick={() => {
                    onToggleMute(memberId, !isMuted);
                    onClose();
                  }}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors text-xs font-semibold text-white"
                >
                  <div className="flex items-center gap-3">
                    {isMuted ? (
                      <Volume2 size={16} className="text-emerald-400 shrink-0" />
                    ) : (
                      <VolumeX size={16} className="text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div>{isMuted ? 'Unmute Member' : 'Mute Member'}</div>
                      <div className="text-[10px] text-white/40 font-normal">
                        {isMuted ? 'Allow member to post messages again' : 'Restrict member from sending messages'}
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Promote / Demote Admin */}
              {canPromoteAdmin && (
                <button
                  onClick={() => {
                    onPromoteDemoteRole(memberId, targetRole, targetIsAdmin ? 'member' : 'admin');
                    onClose();
                  }}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors text-xs font-semibold text-white"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={16} className="text-cyan-400 shrink-0" />
                    <div>
                      <div>{targetIsAdmin ? 'Dismiss as Admin' : 'Make Group Admin'}</div>
                      <div className="text-[10px] text-white/40 font-normal">
                        {targetIsAdmin ? 'Revoke admin permissions' : 'Grant permissions to manage members & info'}
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Promote / Demote Moderator */}
              {canPromoteMod && !targetIsAdmin && (
                <button
                  onClick={() => {
                    onPromoteDemoteRole(memberId, targetRole, targetIsMod ? 'member' : 'moderator');
                    onClose();
                  }}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors text-xs font-semibold text-white"
                >
                  <div className="flex items-center gap-3">
                    <Shield size={16} className="text-purple-400 shrink-0" />
                    <div>
                      <div>{targetIsMod ? 'Dismiss as Moderator' : 'Make Moderator'}</div>
                      <div className="text-[10px] text-white/40 font-normal">
                        {targetIsMod ? 'Remove moderator privileges' : 'Allow muting & warning users'}
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Transfer Ownership */}
              {canTransferOwnership && (
                <button
                  onClick={() => setShowTransferConfirm(true)}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors text-xs font-semibold text-amber-300"
                >
                  <div className="flex items-center gap-3">
                    <ArrowRightLeft size={16} className="text-amber-400 shrink-0" />
                    <div>
                      <div>Transfer Group Ownership</div>
                      <div className="text-[10px] text-amber-400/60 font-normal">
                        Make this member the new owner of this group
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* Remove Member */}
              {canRemove && (
                <button
                  onClick={() => setShowRemoveConfirm(true)}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-rose-500/10 transition-colors text-xs font-semibold text-rose-400"
                >
                  <div className="flex items-center gap-3">
                    <UserMinus size={16} className="text-rose-400 shrink-0" />
                    <div>
                      <div>Remove from Group</div>
                      <div className="text-[10px] text-rose-400/60 font-normal">
                        Kick this user out of conversation
                      </div>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* REMOVE CONFIRMATION MODAL OVERLAY */}
        {showRemoveConfirm && (
          <div className="absolute inset-0 z-20 bg-[#121820]/95 backdrop-blur-md p-6 flex flex-col justify-center items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3 border border-rose-500/30">
              <UserMinus size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Remove {displayName}?</h3>
            <p className="text-xs text-white/60 mb-4 max-w-xs">
              This member will be removed from the group conversation. A system message will be logged.
            </p>

            <div className="w-full max-w-xs mb-4 text-left">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1">Reason (Optional)</label>
              <select
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
              >
                <option value="" className="bg-[#121820]">Select a reason...</option>
                <option value="Inappropriate behavior" className="bg-[#121820]">Inappropriate behavior</option>
                <option value="Spamming message feed" className="bg-[#121820]">Spamming message feed</option>
                <option value="Left organization" className="bg-[#121820]">Left organization/team</option>
                <option value="Requested removal" className="bg-[#121820]">Requested removal</option>
              </select>
            </div>

            <div className="flex items-center gap-3 w-full max-w-xs">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-500 text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing && <Loader2 size={14} className="animate-spin" />}
                Confirm Remove
              </button>
            </div>
          </div>
        )}

        {/* TRANSFER OWNERSHIP CONFIRMATION OVERLAY */}
        {showTransferConfirm && (
          <div className="absolute inset-0 z-20 bg-[#121820]/95 backdrop-blur-md p-6 flex flex-col justify-center items-center text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3 border border-amber-500/30">
              <Crown size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Transfer Ownership to {displayName}?</h3>
            <p className="text-xs text-white/60 mb-6 max-w-xs">
              {displayName} will become the primary owner with full authority over this group. You will become an Admin.
            </p>

            <div className="flex items-center gap-3 w-full max-w-xs">
              <button
                onClick={() => setShowTransferConfirm(false)}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTransfer}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing && <Loader2 size={14} className="animate-spin" />}
                Transfer Now
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
