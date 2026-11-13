import { Router, Response } from 'express';
import { z } from 'zod';
import { BondsDAL } from '../dal/bonds.dal';
import { authenticateToken, AuthenticatedRequest, optionalAuthToken, requireAdmin } from '../middleware/auth';
import { io } from '../index';

const router = Router();

const CreateEntitySchema = z.object({
  type: z.enum(['group', 'community', 'team']),
  name: z.string().min(2).max(128),
  description: z.string().min(5).max(5000),
  category: z.string().min(2).max(64),
  coverUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  privacy: z.enum(['public', 'private']).default('public'),
  membershipPolicy: z.enum(['open', 'approval_required', 'invite_only']).default('open'),
  tags: z.array(z.string()).optional(),
  rules: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })).optional(),
  settings: z.record(z.any()).optional(),
});

const JoinRequestSchema = z.object({
  introduction: z.string().max(1000).optional(),
  answers: z.record(z.any()).optional(),
});

// 1. List entities with filters
router.get('/entities', optionalAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const filter = req.query.filter as 'all' | 'my_memberships' | 'popular' | 'recent' | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 60);
    const offset = parseInt(req.query.offset as string) || 0;

    // Cryptographically verified user ID from auth middleware
    const userId = req.user?.userId;

    const entities = await BondsDAL.getEntities({
      type,
      category,
      search,
      filter,
      userId,
      limit,
      offset,
    });

    res.json({ entities });
  } catch (err) {
    console.error('[Bonds Entities Error]', err);
    res.status(500).json({ error: 'Failed to fetch bonds entities' });
  }
});

// 2. Get single entity
router.get('/entities/:id', optionalAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const entity = await BondsDAL.getById(req.params.id, userId);
    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    res.json({ entity });
  } catch (err) {
    console.error('[Bonds Detail Error]', err);
    res.status(500).json({ error: 'Failed to fetch entity details' });
  }
});

// 3. Get entity members (Restricted for private entities)
router.get('/entities/:id/members', optionalAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const entity = await BondsDAL.getById(req.params.id, userId);
    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    // Privacy authorization: if private, only active members or platform admins can inspect member directory
    const isPlatformAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (entity.privacy === 'private' && !entity.isMember && !isPlatformAdmin) {
      return res.status(403).json({ error: 'Access denied: Private entity member list is restricted to members' });
    }

    const members = await BondsDAL.getEntityMembers(req.params.id);
    res.json({ members });
  } catch (err) {
    console.error('[Bonds Members Error]', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// 4. Create new entity (Group, Community, Team)
router.post('/entities', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CreateEntitySchema.parse(req.body);
    const ownerId = req.user!.userId;

    const entity = await BondsDAL.createEntity({
      ...data,
      ownerId,
    });

    res.status(201).json({ entity });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Bonds Create Error]', err);
    res.status(500).json({ error: err?.message || 'Failed to create bonds entity' });
  }
});

// 5. Join or request to join entity
router.post('/entities/:id/join', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = JoinRequestSchema.parse(req.body || {});
    const userId = req.user!.userId;

    const result = await BondsDAL.joinOrRequest(
      req.params.id,
      userId,
      body.introduction,
      body.answers
    );

    if (result.status === 'joined' && result.conversationId) {
      try {
        io.to(`user:${userId}`).emit('conversation_joined', {
          conversationId: result.conversationId,
        });
        io.to(`user:${userId}`).emit('conversation_created', {
          conversation: { id: result.conversationId },
        });
        io.to(`conversation:${result.conversationId}`).emit('conversation_updated', {
          conversationId: result.conversationId,
          type: 'member_joined',
          userId,
        });
        io.to(`conversation:${result.conversationId}`).emit('group_member_added', {
          conversationId: result.conversationId,
          addedUserIds: [userId],
        });
      } catch {}
    }

    res.json({ result });
  } catch (err: any) {
    console.error('[Bonds Join Error]', err);
    res.status(400).json({ error: err?.message || 'Failed to join or request membership' });
  }
});

// 6. Admin: Get received pending membership requests
router.get('/requests/received', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requests = await BondsDAL.getReceivedRequests(req.user!.userId);
    res.json({ requests });
  } catch (err) {
    console.error('[Bonds Received Requests Error]', err);
    res.status(500).json({ error: 'Failed to fetch membership requests' });
  }
});

// 7. User: Get sent requests
router.get('/requests/sent', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requests = await BondsDAL.getSentRequests(req.user!.userId);
    res.json({ requests });
  } catch (err) {
    console.error('[Bonds Sent Requests Error]', err);
    res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
});

// 8. Admin: Approve membership request
router.post('/requests/:id/approve', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await BondsDAL.approveRequest(req.params.id, req.user!.userId);

    // Broadcast real-time Socket.IO event to unblock messaging immediately
    if (result.approvedUserId) {
      io.to(`user:${result.approvedUserId}`).emit('bonds_membership_approved', {
        entityId: result.entityId,
        conversationId: result.conversationId,
      });
      if (result.conversationId) {
        io.to(`user:${result.approvedUserId}`).emit('conversation_joined', {
          conversationId: result.conversationId,
        });
        io.to(`user:${result.approvedUserId}`).emit('conversation_created', {
          conversation: { id: result.conversationId },
        });
        io.to(`conversation:${result.conversationId}`).emit('conversation_updated', {
          conversationId: result.conversationId,
          type: 'member_joined',
          userId: result.approvedUserId,
        });
        io.to(`conversation:${result.conversationId}`).emit('group_member_added', {
          conversationId: result.conversationId,
          addedUserIds: [result.approvedUserId],
        });
      }
    }

    res.json({ success: true, result });
  } catch (err: any) {
    console.error('[Bonds Approve Error]', err);
    res.status(400).json({ error: err?.message || 'Failed to approve request' });
  }
});

// 9. Admin: Reject membership request
router.post('/requests/:id/reject', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await BondsDAL.rejectRequest(req.params.id, req.user!.userId);
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('[Bonds Reject Error]', err);
    res.status(400).json({ error: err?.message || 'Failed to reject request' });
  }
});

// 10. User: Apply to Team
const TeamApplicationSchema = z.object({
  roleApplied: z.string().min(2).max(64),
  portfolioUrl: z.string().url().or(z.string().length(0)).optional(),
  answers: z.record(z.any()).optional(),
});

router.post('/entities/:id/apply', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = TeamApplicationSchema.parse(req.body);
    const result = await BondsDAL.applyToTeam(req.params.id, req.user!.userId, data);
    res.json({ result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Team Apply Error]', err);
    res.status(400).json({ error: err?.message || 'Failed to submit application' });
  }
});

// 11. Admin: Get Team Applications
router.get('/entities/:id/applications', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const applications = await BondsDAL.getTeamApplications(req.params.id, req.user!.userId);
    res.json({ applications });
  } catch (err: any) {
    console.error('[Get Team Applications Error]', err);
    res.status(400).json({ error: err?.message || 'Failed to fetch team applications' });
  }
});

// 12. Admin: Review Team Application
const ReviewApplicationSchema = z.object({
  status: z.enum(['under_review', 'accepted', 'rejected']),
});

router.patch('/applications/:id/review', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = ReviewApplicationSchema.parse(req.body);
    const result = await BondsDAL.reviewTeamApplication(req.params.id, req.user!.userId, status);

    if (result.applicantUserId && status === 'accepted') {
      io.to(`user:${result.applicantUserId}`).emit('bonds_membership_approved', {
        entityId: result.entityId,
      });
    }

    res.json({ success: true, result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: err.errors });
    }
    console.error('[Review Application Error]', err);
    res.status(400).json({ error: err?.message || 'Failed to review application' });
  }
});


// 13. Create Entity Post
const CreatePostSchema = z.object({
  content: z.string().min(1).max(5000),
  mediaUrls: z.array(z.string()).optional(),
  postAs: z.enum(['member', 'entity']).default('member'),
  isAnonymous: z.boolean().optional(),
});

router.post('/entities/:id/posts', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = CreatePostSchema.parse(req.body);
    const result = await BondsDAL.createPost({
      entityId: req.params.id,
      authorId: req.user!.userId,
      content: data.content,
      mediaUrls: data.mediaUrls,
      postAs: data.postAs,
      isAnonymous: data.isAnonymous,
    });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create post' });
  }
});

// 13.5 Get Bonds Ecosystem Feed Posts
router.get('/feed', optionalAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const limit = parseInt(req.query.limit as string) || 30;
    const offset = parseInt(req.query.offset as string) || 0;
    const posts = await BondsDAL.getFeedPosts(userId, { limit, offset });
    res.json({ posts });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch bonds feed' });
  }
});

// 14. Get Entity Posts (Enforces entity privacy & moderation visibility)
router.get('/entities/:id/posts', optionalAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const entity = await BondsDAL.getById(req.params.id, userId);
    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    const isPlatformAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (entity.privacy === 'private' && !entity.isMember && !isPlatformAdmin) {
      return res.status(403).json({ error: 'Access denied: Private entity posts are restricted to members' });
    }

    const status = (req.query.status as any) || 'published';
    if (status === 'pending_approval') {
      const isLeader = entity.membershipRole && ['owner', 'admin', 'moderator'].includes(entity.membershipRole);
      if (!isLeader && !isPlatformAdmin) {
        return res.status(403).json({ error: 'Access denied: Moderation queue restricted to entity admins' });
      }
    }

    const search = req.query.search as string | undefined;
    const limit = parseInt(req.query.limit as string) || 30;
    const offset = parseInt(req.query.offset as string) || 0;

    const posts = await BondsDAL.getEntityPosts(req.params.id, {
      status,
      search,
      limit,
      offset,
    });
    res.json({ posts });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// 15. Like Entity Post
router.post('/posts/:id/like', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await BondsDAL.toggleLikePost(req.params.id, req.user!.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to toggle like' });
  }
});

// 16. Comments on Entity Post
router.get('/posts/:id/comments', optionalAuthToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const comments = await BondsDAL.getPostComments(req.params.id, req.user?.userId);
    res.json({ comments });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/posts/:id/comments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const content = (req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Comment content is required' });
    const comment = await BondsDAL.createComment(req.params.id, req.user!.userId, content);
    res.status(201).json({ comment });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create comment' });
  }
});

// 17. Approve / Reject Pending Post
router.post('/posts/:id/approve', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await BondsDAL.approvePost(req.params.id, req.user!.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to approve post' });
  }
});

router.post('/posts/:id/reject', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await BondsDAL.rejectPost(req.params.id, req.user!.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to reject post' });
  }
});

// 18. Update Member Role (Admin / Moderator)
router.patch('/entities/:id/members/:userId/role', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role } = req.body;
    if (!['admin', 'moderator', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const result = await BondsDAL.updateMemberRole(req.params.id, req.params.userId, role, req.user!.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update member role' });
  }
});

// ---------------- Admin Control Center Routes (Strict Admin Role Required) ----------------

// Get Bonds ecosystem stats (counts of groups, communities, teams, members, posts)
router.get('/admin/stats', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await BondsDAL.getAdminStats();
    res.json(stats);
  } catch (err: any) {
    console.error('[Admin Bonds Stats Error]', err);
    res.status(500).json({ error: 'Failed to fetch bonds admin stats' });
  }
});

// List all entities with search, type filter, status, pagination, and live stats
router.get('/admin/entities', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const entities = await BondsDAL.getAdminEntities({
      type,
      status,
      search,
      limit,
      offset,
    });
    res.json({ entities });
  } catch (err: any) {
    console.error('[Admin Bonds Entities Error]', err);
    res.status(500).json({ error: 'Failed to fetch bonds entities for admin' });
  }
});

// Update entity status (active / suspended)
router.patch('/admin/entities/:id/status', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be active or suspended.' });
    }
    const result = await BondsDAL.updateEntityStatusAdmin(req.params.id, status);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update entity status' });
  }
});

// Toggle entity verified badge
router.patch('/admin/entities/:id/verify', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isVerified } = req.body;
    const result = await BondsDAL.toggleEntityVerifiedAdmin(req.params.id, Boolean(isVerified));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to toggle verification' });
  }
});

// Regenerate 11-digit canonical URL
router.post('/admin/entities/:id/regenerate-url', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await BondsDAL.regenerateEntityUrlAdmin(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to regenerate URL' });
  }
});

// Delete entity
router.delete('/admin/entities/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await BondsDAL.deleteEntityAdmin(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to delete entity' });
  }
});

// Get entity members with roles
router.get('/admin/entities/:id/members', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const members = await BondsDAL.getEntityMembersAdmin(req.params.id);
    res.json({ members });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Update member role (Owner / Admin / Moderator / Member)
router.patch('/admin/entities/:id/members/:userId/role', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role } = req.body;
    if (!['owner', 'admin', 'moderator', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const result = await BondsDAL.updateMemberRoleAdmin(req.params.id, req.params.userId, role);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update member role' });
  }
});

// Remove member
router.delete('/admin/entities/:id/members/:userId', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await BondsDAL.removeMemberAdmin(req.params.id, req.params.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to remove member' });
  }
});

// Get entity posts for moderation
router.get('/admin/entities/:id/posts', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const posts = await BondsDAL.getEntityPostsAdmin(req.params.id);
    res.json({ posts });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch entity posts' });
  }
});

// Delete post
router.delete('/admin/posts/:postId', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await BondsDAL.deletePostAdmin(req.params.postId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to delete post' });
  }
});

export default router;
