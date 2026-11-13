import { eq, and, desc, sql, or, ilike, inArray } from 'drizzle-orm';
import { db } from '../db';
import { 
  bondsEntities, 
  bondsMemberships, 
  bondsMembershipRequests, 
  bondsInvitations, 
  bondsTeamApplications,
  bondsPosts,
  bondsPostComments,
  bondsPostLikes,
  conversations, 
  conversationMembers, 
  users, 
  profiles 
} from '../db/schema';

export class BondsDAL {
  // ---------------- ID and URL Generation Utilities ----------------
  static generate11DigitId(): string {
    const first = Math.floor(Math.random() * 9) + 1; // 1-9
    const rest = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
    return `${first}${rest}`;
  }

  static generateRandomToken(length = 22): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let res = '';
    for (let i = 0; i < length; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  static generateEntitySlugAndUrl(type: 'group' | 'community' | 'team', name: string) {
    const entityNum = this.generate11DigitId(); // 11-digit group/community/team number
    const token = this.generateRandomToken(22); // secure unique token hash
    const sanitized = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || type;
    const slug = `${entityNum}-${sanitized}-${token}`;
    const typePlural = type === 'community' ? 'communities' : `${type}s`;
    const canonicalUrl = `/bonds/${typePlural}/${slug}`;
    return { entityNum, token, slug, canonicalUrl };
  }

  // ---------------- Entities ----------------
  static async createEntity(data: {
    type: 'group' | 'community' | 'team';
    name: string;
    description: string;
    category: string;
    coverUrl?: string;
    logoUrl?: string;
    privacy?: 'public' | 'private';
    membershipPolicy?: 'open' | 'approval_required' | 'invite_only';
    ownerId: string;
    tags?: string[];
    rules?: Array<{ title: string; description: string }>;
    settings?: Record<string, any>;
  }) {
    return await db.transaction(async (tx) => {
      // 1. Mandatory Auto-Generated 11-digit Number + Slug + Token + Canonical URL
      const { entityNum, token, slug: generatedSlug, canonicalUrl } = BondsDAL.generateEntitySlugAndUrl(data.type, data.name);
      let finalSlug = generatedSlug;
      let counter = 1;
      while (true) {
        const [existing] = await tx
          .select({ id: bondsEntities.id })
          .from(bondsEntities)
          .where(eq(bondsEntities.slug, finalSlug))
          .limit(1);
        if (!existing) break;
        finalSlug = `${generatedSlug}-${counter++}`;
      }

      const entitySettings = {
        ...(data.settings || {}),
        entityNumber: entityNum,
        entityToken: token,
        canonicalUrl,
        status: 'active',
        isVerified: false,
      };

      // 2. Create the single persistent conversation for this entity
      const [conv] = await tx
        .insert(conversations)
        .values({
          type: 'bond_entity',
          title: data.name,
          avatarKey: data.logoUrl || null,
          themeSettings: { entityType: data.type, slug: finalSlug, entityNumber: entityNum },
          lastMessagePreview: `Welcome to ${data.name}! Conversation created.`,
          lastMessageAt: new Date(),
        })
        .returning();

      // 3. Create the Bonds Entity linked to this conversation
      const [entity] = await tx
        .insert(bondsEntities)
        .values({
          type: data.type,
          name: data.name,
          slug: finalSlug,
          description: data.description,
          category: data.category,
          coverUrl: data.coverUrl || null,
          logoUrl: data.logoUrl || null,
          privacy: data.privacy || 'public',
          membershipPolicy: data.membershipPolicy || 'open',
          ownerId: data.ownerId,
          conversationId: conv.id,
          memberCount: 1,
          activityScore: 10,
          tags: data.tags || [],
          rules: data.rules || [],
          settings: entitySettings,
        })
        .returning();

      // 4. Add Creator as Owner in bonds_memberships
      await tx
        .insert(bondsMemberships)
        .values({
          entityId: entity.id,
          userId: data.ownerId,
          role: 'owner',
          status: 'active',
        });

      // 5. Add Creator as Admin in conversation_members
      await tx
        .insert(conversationMembers)
        .values({
          conversationId: conv.id,
          userId: data.ownerId,
          role: 'admin',
          unreadCount: 0,
        });

      return {
        ...entity,
        canonicalUrl,
        entityNumber: entityNum,
      };
    });
  }

  static async getEntities(options: {
    type?: string;
    category?: string;
    search?: string;
    filter?: 'all' | 'my_memberships' | 'popular' | 'recent';
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(options.limit || 30, 60);
    const offset = options.offset || 0;

    const conditions = [];

    if (options.type && options.type !== 'all') {
      conditions.push(eq(bondsEntities.type, options.type));
    }

    if (options.category && options.category !== 'all') {
      conditions.push(eq(bondsEntities.category, options.category));
    }

    if (options.search && options.search.trim().length > 0) {
      const q = `%${options.search.trim()}%`;
      conditions.push(or(
        ilike(bondsEntities.name, q),
        ilike(bondsEntities.description, q),
        ilike(bondsEntities.category, q)
      ));
    }

    if (options.filter === 'my_memberships' && options.userId) {
      const myMemberships = await db
        .select({ entityId: bondsMemberships.entityId })
        .from(bondsMemberships)
        .where(and(eq(bondsMemberships.userId, options.userId), eq(bondsMemberships.status, 'active')));
      
      const ids = myMemberships.map(m => m.entityId);
      if (ids.length === 0) return [];
      conditions.push(inArray(bondsEntities.id, ids));
    }

    const rows = await db
      .select({
        entity: bondsEntities,
        owner: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(bondsEntities)
      .innerJoin(users, eq(bondsEntities.ownerId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bondsEntities.createdAt))
      .limit(limit)
      .offset(offset);

    // If userId provided, hydrate with membership status
    if (options.userId) {
      const entityIds = rows.map(r => r.entity.id);
      if (entityIds.length > 0) {
        const memberships = await db
          .select()
          .from(bondsMemberships)
          .where(and(
            inArray(bondsMemberships.entityId, entityIds),
            eq(bondsMemberships.userId, options.userId)
          ));

        const pendingRequests = await db
          .select()
          .from(bondsMembershipRequests)
          .where(and(
            inArray(bondsMembershipRequests.entityId, entityIds),
            eq(bondsMembershipRequests.userId, options.userId),
            eq(bondsMembershipRequests.status, 'pending')
          ));

        const memberMap = new Map(memberships.map(m => [m.entityId, m]));
        const requestMap = new Map(pendingRequests.map(r => [r.entityId, r]));

        return rows.map(r => {
          const m = memberMap.get(r.entity.id);
          const req = requestMap.get(r.entity.id);
          return {
            ...r.entity,
            owner: r.owner,
            isMember: Boolean(m && m.status === 'active'),
            membershipRole: m ? m.role : null,
            membershipStatus: m ? m.status : (req ? 'pending' : 'not_member'),
          };
        });
      }
    }

    return rows.map(r => ({
      ...r.entity,
      owner: r.owner,
      isMember: false,
      membershipStatus: 'not_member',
    }));
  }

  static async getById(idOrSlug: string, userId?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const [row] = await db
      .select({
        entity: bondsEntities,
        owner: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(bondsEntities)
      .innerJoin(users, eq(bondsEntities.ownerId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(
        isUuid 
          ? eq(bondsEntities.id, idOrSlug) 
          : or(
              eq(bondsEntities.slug, idOrSlug.toLowerCase()),
              ilike(bondsEntities.slug, `${idOrSlug.toLowerCase()}%`)
            )
      )
      .limit(1);

    if (!row) return null;

    let isMember = false;
    let membershipRole = null;
    let membershipStatus = 'not_member';

    if (userId) {
      const [m] = await db
        .select()
        .from(bondsMemberships)
        .where(and(eq(bondsMemberships.entityId, row.entity.id), eq(bondsMemberships.userId, userId)))
        .limit(1);

      if (m) {
        isMember = m.status === 'active';
        membershipRole = m.role;
        membershipStatus = m.status;
      } else {
        const [req] = await db
          .select()
          .from(bondsMembershipRequests)
          .where(and(
            eq(bondsMembershipRequests.entityId, row.entity.id),
            eq(bondsMembershipRequests.userId, userId),
            eq(bondsMembershipRequests.status, 'pending')
          ))
          .limit(1);
        if (req) {
          membershipStatus = 'pending';
        }
      }
    }

    const e = row.entity;
    const settings = (e.settings as any) || {};
    const typePlural = e.type === 'community' ? 'communities' : `${e.type}s`;
    const canonicalUrl = settings.canonicalUrl || `/bonds/${typePlural}/${e.slug}`;
    const entityNumber = settings.entityNumber || e.slug.split('-')[0] || '';

    return {
      ...row.entity,
      canonicalUrl,
      entityNumber,
      status: settings.status || 'active',
      isVerified: settings.isVerified || false,
      owner: row.owner,
      isMember,
      membershipRole,
      membershipStatus,
    };
  }

  // ---------------- Membership & Requests ----------------
  static async joinOrRequest(entityId: string, userId: string, introduction?: string, answers?: Record<string, any>) {
    const entity = await db
      .select()
      .from(bondsEntities)
      .where(eq(bondsEntities.id, entityId))
      .limit(1)
      .then(rows => rows[0]);

    if (!entity) throw new Error('Bonds entity not found');

    // Check existing membership
    const [existingMember] = await db
      .select()
      .from(bondsMemberships)
      .where(and(eq(bondsMemberships.entityId, entityId), eq(bondsMemberships.userId, userId)))
      .limit(1);

    if (existingMember) {
      if (existingMember.status === 'active') {
        return { status: 'already_member', isMember: true, conversationId: entity.conversationId };
      }
      if (existingMember.status === 'banned') {
        throw new Error('You have been restricted from this entity');
      }
    }

    // 1. Open Membership: Instant Join (Atomic member count guard)
    if (entity.membershipPolicy === 'open') {
      let isNewlyJoined = false;
      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(bondsMemberships)
          .values({
            entityId,
            userId,
            role: 'member',
            status: 'active',
          })
          .onConflictDoNothing()
          .returning();

        if (inserted.length > 0) {
          isNewlyJoined = true;
          if (entity.conversationId) {
            await tx
              .insert(conversationMembers)
              .values({
                conversationId: entity.conversationId,
                userId,
                role: 'member',
                unreadCount: 0,
              })
              .onConflictDoNothing();
          }

          await tx.execute(sql`
            UPDATE bonds_entities 
            SET member_count = member_count + 1, updated_at = NOW() 
            WHERE id = ${entityId}
          `);
        }
      });

      return { status: isNewlyJoined ? 'joined' : 'already_member', isMember: true, conversationId: entity.conversationId };
    }

    // 2. Approval Required: Submit Request
    if (entity.membershipPolicy === 'approval_required') {
      const [existingRequest] = await db
        .select()
        .from(bondsMembershipRequests)
        .where(and(
          eq(bondsMembershipRequests.entityId, entityId),
          eq(bondsMembershipRequests.userId, userId),
          eq(bondsMembershipRequests.status, 'pending')
        ))
        .limit(1);

      if (existingRequest) {
        return { status: 'request_pending', isMember: false, pending: true, conversationId: entity.conversationId };
      }

      await db
        .insert(bondsMembershipRequests)
        .values({
          entityId,
          userId,
          status: 'pending',
          introduction: introduction || null,
          answers: answers || {},
        });

      return { status: 'request_submitted', isMember: false, pending: true, conversationId: entity.conversationId };
    }

    // 3. Invite Only
    throw new Error('This entity is invite-only. You must be invited by an admin or member.');
  }

  static async approveRequest(requestId: string, adminUserId: string) {
    return await db.transaction(async (tx) => {
      const [req] = await tx
        .select()
        .from(bondsMembershipRequests)
        .where(eq(bondsMembershipRequests.id, requestId))
        .limit(1);

      if (!req || req.status !== 'pending') {
        throw new Error('Request not found or already processed');
      }

      // Check admin authorization
      const [adminRole] = await tx
        .select()
        .from(bondsMemberships)
        .where(and(
          eq(bondsMemberships.entityId, req.entityId),
          eq(bondsMemberships.userId, adminUserId)
        ))
        .limit(1);

      const isAuthorized = adminRole && ['owner', 'admin', 'moderator'].includes(adminRole.role);
      if (!isAuthorized) {
        throw new Error('Unauthorized: Only administrators can approve membership requests');
      }

      const [entity] = await tx
        .select()
        .from(bondsEntities)
        .where(eq(bondsEntities.id, req.entityId))
        .limit(1);

      // Update request status
      await tx
        .update(bondsMembershipRequests)
        .set({
          status: 'approved',
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bondsMembershipRequests.id, requestId));

      // Add to memberships (Atomic member count guard)
      const inserted = await tx
        .insert(bondsMemberships)
        .values({
          entityId: req.entityId,
          userId: req.userId,
          role: 'member',
          status: 'active',
        })
        .onConflictDoNothing()
        .returning();

      // Grant conversation access
      if (entity && entity.conversationId) {
        await tx
          .insert(conversationMembers)
          .values({
            conversationId: entity.conversationId,
            userId: req.userId,
            role: 'member',
            unreadCount: 0,
          })
          .onConflictDoNothing();
      }

      // Increment member count only if newly inserted
      if (inserted.length > 0) {
        await tx.execute(sql`
          UPDATE bonds_entities 
          SET member_count = member_count + 1, updated_at = NOW() 
          WHERE id = ${req.entityId}
        `);
      }

      return {
        success: true,
        entityId: req.entityId,
        approvedUserId: req.userId,
        conversationId: entity?.conversationId,
      };
    });
  }

  static async rejectRequest(requestId: string, adminUserId: string) {
    const [req] = await db
      .select()
      .from(bondsMembershipRequests)
      .where(eq(bondsMembershipRequests.id, requestId))
      .limit(1);

    if (!req) throw new Error('Request not found');

    const [adminRole] = await db
      .select()
      .from(bondsMemberships)
      .where(and(
        eq(bondsMemberships.entityId, req.entityId),
        eq(bondsMemberships.userId, adminUserId)
      ))
      .limit(1);

    if (!adminRole || !['owner', 'admin', 'moderator'].includes(adminRole.role)) {
      throw new Error('Unauthorized: Only administrators can reject membership requests');
    }

    await db
      .update(bondsMembershipRequests)
      .set({
        status: 'rejected',
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bondsMembershipRequests.id, requestId));

    return { success: true };
  }

  static async getReceivedRequests(adminUserId: string) {
    // 1. Find entities where current user is admin/owner
    const adminEntities = await db
      .select({ entityId: bondsMemberships.entityId })
      .from(bondsMemberships)
      .where(and(
        eq(bondsMemberships.userId, adminUserId),
        inArray(bondsMemberships.role, ['owner', 'admin', 'moderator'])
      ));

    const entityIds = adminEntities.map(e => e.entityId);
    if (entityIds.length === 0) return [];

    // 2. Fetch pending requests
    const rows = await db
      .select({
        request: bondsMembershipRequests,
        entity: {
          id: bondsEntities.id,
          name: bondsEntities.name,
          type: bondsEntities.type,
          logoUrl: bondsEntities.logoUrl,
        },
        user: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(bondsMembershipRequests)
      .innerJoin(bondsEntities, eq(bondsMembershipRequests.entityId, bondsEntities.id))
      .innerJoin(users, eq(bondsMembershipRequests.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(inArray(bondsMembershipRequests.entityId, entityIds))
      .orderBy(desc(bondsMembershipRequests.createdAt));

    return rows.map(r => ({
      ...r.request,
      entity: r.entity,
      user: r.user,
    }));
  }

  static async getSentRequests(userId: string) {
    const rows = await db
      .select({
        request: bondsMembershipRequests,
        entity: {
          id: bondsEntities.id,
          name: bondsEntities.name,
          type: bondsEntities.type,
          category: bondsEntities.category,
          logoUrl: bondsEntities.logoUrl,
          coverUrl: bondsEntities.coverUrl,
        },
      })
      .from(bondsMembershipRequests)
      .innerJoin(bondsEntities, eq(bondsMembershipRequests.entityId, bondsEntities.id))
      .where(eq(bondsMembershipRequests.userId, userId))
      .orderBy(desc(bondsMembershipRequests.createdAt));

    return rows.map(r => ({
      ...r.request,
      entity: r.entity,
    }));
  }

  static async getEntityMembers(entityId: string) {
    return await db
      .select({
        membership: bondsMemberships,
        user: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(bondsMemberships)
      .innerJoin(users, eq(bondsMemberships.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(and(eq(bondsMemberships.entityId, entityId), eq(bondsMemberships.status, 'active')))
      .orderBy(desc(bondsMemberships.joinedAt));
  }

  // ---------------- Team Recruitment Applications ----------------
  static async applyToTeam(entityId: string, userId: string, data: {
    roleApplied: string;
    portfolioUrl?: string;
    answers?: Record<string, any>;
  }) {
    const [entity] = await db
      .select()
      .from(bondsEntities)
      .where(eq(bondsEntities.id, entityId))
      .limit(1);

    if (!entity) throw new Error('Team entity not found');
    if (entity.type !== 'team') throw new Error('Applications are only supported for Teams');

    // Check if already a member
    const [existingMember] = await db
      .select()
      .from(bondsMemberships)
      .where(and(eq(bondsMemberships.entityId, entityId), eq(bondsMemberships.userId, userId)))
      .limit(1);

    if (existingMember && existingMember.status === 'active') {
      return { status: 'already_member', isMember: true };
    }

    // Check if pending application exists
    const [existingApp] = await db
      .select()
      .from(bondsTeamApplications)
      .where(and(
        eq(bondsTeamApplications.entityId, entityId),
        eq(bondsTeamApplications.userId, userId),
        inArray(bondsTeamApplications.status, ['submitted', 'under_review'])
      ))
      .limit(1);

    if (existingApp) {
      return { status: 'application_pending', applicationId: existingApp.id, appStatus: existingApp.status };
    }

    const [newApp] = await db
      .insert(bondsTeamApplications)
      .values({
        entityId,
        userId,
        roleApplied: data.roleApplied,
        portfolioUrl: data.portfolioUrl || null,
        answers: data.answers || {},
        status: 'submitted',
      })
      .returning();

    return { status: 'submitted', applicationId: newApp.id, appStatus: 'submitted' };
  }

  static async getTeamApplications(entityId: string, adminUserId: string) {
    // Verify admin rights
    const [adminRole] = await db
      .select()
      .from(bondsMemberships)
      .where(and(
        eq(bondsMemberships.entityId, entityId),
        eq(bondsMemberships.userId, adminUserId)
      ))
      .limit(1);

    if (!adminRole || !['owner', 'admin', 'moderator'].includes(adminRole.role)) {
      throw new Error('Unauthorized: Only administrators can view team applications');
    }

    const rows = await db
      .select({
        application: bondsTeamApplications,
        user: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(bondsTeamApplications)
      .innerJoin(users, eq(bondsTeamApplications.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(bondsTeamApplications.entityId, entityId))
      .orderBy(desc(bondsTeamApplications.createdAt));

    return rows.map(r => ({
      ...r.application,
      user: r.user,
    }));
  }

  static async reviewTeamApplication(applicationId: string, adminUserId: string, status: 'under_review' | 'accepted' | 'rejected') {
    return await db.transaction(async (tx) => {
      const [app] = await tx
        .select()
        .from(bondsTeamApplications)
        .where(eq(bondsTeamApplications.id, applicationId))
        .limit(1);

      if (!app) throw new Error('Application not found');

      // Verify admin rights
      const [adminRole] = await tx
        .select()
        .from(bondsMemberships)
        .where(and(
          eq(bondsMemberships.entityId, app.entityId),
          eq(bondsMemberships.userId, adminUserId)
        ))
        .limit(1);

      if (!adminRole || !['owner', 'admin', 'moderator'].includes(adminRole.role)) {
        throw new Error('Unauthorized: Only administrators can review applications');
      }

      await tx
        .update(bondsTeamApplications)
        .set({
          status,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bondsTeamApplications.id, applicationId));

      // If accepted, atomically add to memberships and conversation
      if (status === 'accepted') {
        await tx
          .insert(bondsMemberships)
          .values({
            entityId: app.entityId,
            userId: app.userId,
            role: 'member',
            status: 'active',
          })
          .onConflictDoNothing();

        const [entity] = await tx
          .select({ conversationId: bondsEntities.conversationId })
          .from(bondsEntities)
          .where(eq(bondsEntities.id, app.entityId))
          .limit(1);

        if (entity && entity.conversationId) {
          await tx
            .insert(conversationMembers)
            .values({
              conversationId: entity.conversationId,
              userId: app.userId,
              role: 'member',
              unreadCount: 0,
            })
            .onConflictDoNothing();
        }

        await tx.execute(sql`
          UPDATE bonds_entities 
          SET member_count = member_count + 1, updated_at = NOW() 
          WHERE id = ${app.entityId}
        `);
      }

      return {
        success: true,
        entityId: app.entityId,
        applicantUserId: app.userId,
        newStatus: status,
      };
    });
  }

  // ---------------- Security: Entity Conversation Access ----------------
  static async checkEntityConversationAccess(conversationId: string, userId?: string) {
    const [entity] = await db
      .select()
      .from(bondsEntities)
      .where(eq(bondsEntities.conversationId, conversationId))
      .limit(1);

    if (!entity) return null; // Not a bonds entity conversation

    let isMember = false;
    let membershipRole: string | null = null;
    let membershipStatus = 'not_member';

    if (userId) {
      const [m] = await db
        .select()
        .from(bondsMemberships)
        .where(and(eq(bondsMemberships.entityId, entity.id), eq(bondsMemberships.userId, userId)))
        .limit(1);

      if (m) {
        isMember = m.status === 'active';
        membershipRole = m.role;
        membershipStatus = m.status;
      } else {
        const [req] = await db
          .select()
          .from(bondsMembershipRequests)
          .where(and(
            eq(bondsMembershipRequests.entityId, entity.id),
            eq(bondsMembershipRequests.userId, userId),
            eq(bondsMembershipRequests.status, 'pending')
          ))
          .limit(1);
        if (req) membershipStatus = 'pending';
      }
    }

    // Policy:
    // If public: non-members can preview message history if policy allows, but NEVER send
    // If private: only active members can view message history or send
    const canViewHistory = isMember || (entity.privacy === 'public');
    const canSendMessage = isMember;

    return {
      isEntityConversation: true,
      entity,
      isMember,
      membershipRole,
      membershipStatus,
      canViewHistory,
      canSendMessage,
    };
  }

  // ---------------- Entity Posts & Feed ----------------
  static async createPost(data: {
    entityId: string;
    authorId: string;
    content: string;
    mediaUrls?: string[];
    postAs?: 'member' | 'entity';
    isAnonymous?: boolean;
  }) {
    // Check if entity requires post approval
    const [entity] = await db
      .select()
      .from(bondsEntities)
      .where(eq(bondsEntities.id, data.entityId))
      .limit(1);

    if (!entity) throw new Error('Entity not found');
    if ((entity.settings as any)?.status === 'suspended' || (entity as any).status === 'suspended') throw new Error('Forbidden: Entity is suspended');

    // Security check: Must be an active member to post
    const [membership] = await db
      .select()
      .from(bondsMemberships)
      .where(and(eq(bondsMemberships.entityId, data.entityId), eq(bondsMemberships.userId, data.authorId)))
      .limit(1);

    if (!membership || membership.status !== 'active') {
      throw new Error('Forbidden: Only active members can publish posts in this entity');
    }

    const isLeader = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (data.postAs === 'entity' && !isLeader) {
      throw new Error('Forbidden: Only entity owners, admins or moderators can post as the entity');
    }

    const requireApproval = (entity.settings as any)?.requirePostApproval === true;
    const status = (requireApproval && !isLeader) ? 'pending_approval' : 'published';

    const [post] = await db
      .insert(bondsPosts)
      .values({
        entityId: data.entityId,
        authorId: data.authorId,
        content: data.content,
        mediaUrls: data.mediaUrls || [],
        postAs: data.postAs || 'member',
        status,
        likesCount: 0,
        commentsCount: 0,
      })
      .returning();

    return { post, status };
  }

  static async getEntityPosts(entityId: string, options?: {
    status?: 'published' | 'pending_approval';
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const status = options?.status || 'published';
    const limit = Math.min(options?.limit || 30, 60);
    const offset = options?.offset || 0;

    const conditions = [
      eq(bondsPosts.entityId, entityId),
      eq(bondsPosts.status, status)
    ];

    if (options?.search && options.search.trim()) {
      conditions.push(ilike(bondsPosts.content, `%${options.search.trim()}%`));
    }

    const rows = await db
      .select({
        post: bondsPosts,
        author: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(bondsPosts)
      .innerJoin(users, eq(bondsPosts.authorId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(and(...conditions))
      .orderBy(desc(bondsPosts.isPinned), desc(bondsPosts.createdAt))
      .limit(limit)
      .offset(offset);

    // Get author roles in this entity
    const authorIds = Array.from(new Set(rows.map(r => r.author.id)));
    let roleMap = new Map<string, string>();
    if (authorIds.length > 0) {
      const memberships = await db
        .select({ userId: bondsMemberships.userId, role: bondsMemberships.role })
        .from(bondsMemberships)
        .where(and(eq(bondsMemberships.entityId, entityId), inArray(bondsMemberships.userId, authorIds)));
      memberships.forEach(m => roleMap.set(m.userId, m.role));
    }

    return rows.map(r => ({
      ...r.post,
      author: {
        ...r.author,
        role: roleMap.get(r.author.id) || 'member',
      },
    }));
  }

  static async approvePost(postId: string, adminUserId: string) {
    const [post] = await db
      .select()
      .from(bondsPosts)
      .where(eq(bondsPosts.id, postId))
      .limit(1);

    if (!post) throw new Error('Post not found');

    const [admin] = await db
      .select()
      .from(bondsMemberships)
      .where(and(eq(bondsMemberships.entityId, post.entityId), eq(bondsMemberships.userId, adminUserId)))
      .limit(1);

    if (!admin || !['owner', 'admin', 'moderator'].includes(admin.role)) {
      throw new Error('Unauthorized');
    }

    await db
      .update(bondsPosts)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(bondsPosts.id, postId));

    return { success: true };
  }

  static async rejectPost(postId: string, adminUserId: string) {
    const [post] = await db
      .select()
      .from(bondsPosts)
      .where(eq(bondsPosts.id, postId))
      .limit(1);

    if (!post) throw new Error('Post not found');

    const [admin] = await db
      .select()
      .from(bondsMemberships)
      .where(and(eq(bondsMemberships.entityId, post.entityId), eq(bondsMemberships.userId, adminUserId)))
      .limit(1);

    if (!admin || !['owner', 'admin', 'moderator'].includes(admin.role)) {
      throw new Error('Unauthorized');
    }

    await db
      .update(bondsPosts)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(bondsPosts.id, postId));

    return { success: true };
  }

  static async toggleLikePost(postId: string, userId: string) {
    const [post] = await db
      .select({ entityId: bondsPosts.entityId, privacy: bondsEntities.privacy })
      .from(bondsPosts)
      .innerJoin(bondsEntities, eq(bondsPosts.entityId, bondsEntities.id))
      .where(eq(bondsPosts.id, postId))
      .limit(1);

    if (!post) throw new Error('Post not found');

    if (post.privacy === 'private') {
      const [membership] = await db
        .select()
        .from(bondsMemberships)
        .where(and(eq(bondsMemberships.entityId, post.entityId), eq(bondsMemberships.userId, userId), eq(bondsMemberships.status, 'active')))
        .limit(1);

      if (!membership) {
        throw new Error('Forbidden: Only active members can react to posts in a private entity');
      }
    }

    const [existing] = await db
      .select()
      .from(bondsPostLikes)
      .where(and(eq(bondsPostLikes.postId, postId), eq(bondsPostLikes.userId, userId)))
      .limit(1);

    if (existing) {
      await db.delete(bondsPostLikes).where(and(eq(bondsPostLikes.postId, postId), eq(bondsPostLikes.userId, userId)));
      await db.execute(sql`UPDATE bonds_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ${postId}`);
      return { liked: false };
    } else {
      await db.insert(bondsPostLikes).values({ postId, userId }).onConflictDoNothing();
      await db.execute(sql`UPDATE bonds_posts SET likes_count = likes_count + 1 WHERE id = ${postId}`);
      return { liked: true };
    }
  }

  static async createComment(postId: string, authorId: string, content: string) {
    const [post] = await db
      .select({ entityId: bondsPosts.entityId, privacy: bondsEntities.privacy })
      .from(bondsPosts)
      .innerJoin(bondsEntities, eq(bondsPosts.entityId, bondsEntities.id))
      .where(eq(bondsPosts.id, postId))
      .limit(1);

    if (!post) throw new Error('Post not found');

    // Get author's membership in this entity
    const [membership] = await db
      .select({ role: bondsMemberships.role, status: bondsMemberships.status })
      .from(bondsMemberships)
      .where(and(eq(bondsMemberships.entityId, post.entityId), eq(bondsMemberships.userId, authorId)))
      .limit(1);

    if (post.privacy === 'private' && (!membership || membership.status !== 'active')) {
      throw new Error('Forbidden: Only active members can comment on posts in a private entity');
    }

    if (membership && membership.status === 'banned') {
      throw new Error('Forbidden: Restricted users cannot comment');
    }

    const authorRole = (membership && membership.status === 'active') ? membership.role : 'member';

    const [comment] = await db
      .insert(bondsPostComments)
      .values({
        postId,
        authorId,
        content,
        authorRole,
      })
      .returning();

    await db.execute(sql`UPDATE bonds_posts SET comments_count = comments_count + 1 WHERE id = ${postId}`);

    // Fetch author profile
    const [authorProfile] = await db
      .select({
        id: users.id,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
        isVerified: profiles.isVerified,
      })
      .from(users)
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(users.id, authorId))
      .limit(1);

    return {
      ...comment,
      author: {
        id: authorProfile?.id || authorId,
        username: authorProfile?.username || 'member',
        displayName: authorProfile?.displayName || 'Aeirmist Member',
        avatarKey: authorProfile?.avatarKey,
        isVerified: authorProfile?.isVerified || false,
        role: authorRole,
      },
    };
  }

  static async getPostComments(postId: string, userId?: string) {
    const [post] = await db
      .select({ entityId: bondsPosts.entityId, privacy: bondsEntities.privacy })
      .from(bondsPosts)
      .innerJoin(bondsEntities, eq(bondsPosts.entityId, bondsEntities.id))
      .where(eq(bondsPosts.id, postId))
      .limit(1);

    if (!post) throw new Error('Post not found');

    if (post.privacy === 'private') {
      let isMember = false;
      if (userId) {
        const [mem] = await db
          .select({ status: bondsMemberships.status })
          .from(bondsMemberships)
          .where(and(eq(bondsMemberships.entityId, post.entityId), eq(bondsMemberships.userId, userId), eq(bondsMemberships.status, 'active')))
          .limit(1);
        isMember = Boolean(mem);
      }
      if (!isMember) {
        throw new Error('Forbidden: Comments in private entities are restricted to members');
      }
    }

    const rows = await db
      .select({
        comment: bondsPostComments,
        author: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(bondsPostComments)
      .innerJoin(users, eq(bondsPostComments.authorId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(bondsPostComments.postId, postId))
      .orderBy(bondsPostComments.createdAt);

    return rows.map(r => ({
      ...r.comment,
      author: {
        ...r.author,
        role: r.comment.authorRole,
      },
    }));
  }

  // ---------------- Member Roles Management ----------------
  static async updateMemberRole(entityId: string, targetUserId: string, newRole: 'admin' | 'moderator' | 'member', adminUserId: string) {
    if (targetUserId === adminUserId) {
      throw new Error('Forbidden: You cannot modify your own role');
    }

    const [admin] = await db
      .select()
      .from(bondsMemberships)
      .where(and(eq(bondsMemberships.entityId, entityId), eq(bondsMemberships.userId, adminUserId), eq(bondsMemberships.status, 'active')))
      .limit(1);

    if (!admin || !['owner', 'admin'].includes(admin.role)) {
      throw new Error('Unauthorized: Only Owners or Admins can assign roles');
    }

    const [target] = await db
      .select()
      .from(bondsMemberships)
      .where(and(eq(bondsMemberships.entityId, entityId), eq(bondsMemberships.userId, targetUserId)))
      .limit(1);

    if (!target) throw new Error('Target user is not a member of this entity');

    // Protect owner: nobody can demote the owner via role update
    if (target.role === 'owner') {
      throw new Error('Forbidden: Cannot modify the role of the entity owner. Ownership must be explicitly transferred.');
    }

    // Role hierarchy: admins cannot promote someone to admin or modify other admins. Only owner can manage admins.
    if (admin.role !== 'owner') {
      if (newRole === 'admin') {
        throw new Error('Forbidden: Only the entity owner can appoint new admins');
      }
      if (target.role === 'admin') {
        throw new Error('Forbidden: Only the entity owner can modify an existing admin');
      }
    }

    await db
      .update(bondsMemberships)
      .set({ role: newRole })
      .where(and(eq(bondsMemberships.entityId, entityId), eq(bondsMemberships.userId, targetUserId)));

    return { success: true, newRole };
  }

  // ---------------- Bonds Admin Control Center ----------------
  static async getAdminStats() {
    const [counts]: any = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE type = 'group') AS total_groups,
        COUNT(*) FILTER (WHERE type = 'community') AS total_communities,
        COUNT(*) FILTER (WHERE type = 'team') AS total_teams,
        COUNT(*) AS total_entities
      FROM bonds_entities
    `);
    
    const [postCounts]: any = await db.execute(sql`
      SELECT 
        COUNT(*) AS total_posts,
        COUNT(*) FILTER (WHERE status = 'pending_approval') AS total_pending_posts
      FROM bonds_posts
    `);

    const [memberCounts]: any = await db.execute(sql`
      SELECT COUNT(*) AS total_memberships FROM bonds_memberships WHERE status = 'active'
    `);

    return {
      totalGroups: Number(counts?.total_groups || 0),
      totalCommunities: Number(counts?.total_communities || 0),
      totalTeams: Number(counts?.total_teams || 0),
      totalEntities: Number(counts?.total_entities || 0),
      totalPosts: Number(postCounts?.total_posts || 0),
      totalPendingPosts: Number(postCounts?.total_pending_posts || 0),
      totalMemberships: Number(memberCounts?.total_memberships || 0),
    };
  }

  static async getAdminEntities(options?: {
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(options?.limit || 50, 100);
    const offset = options?.offset || 0;

    const conditions = [];

    if (options?.type && options.type !== 'all') {
      conditions.push(eq(bondsEntities.type, options.type));
    }

    if (options?.search && options.search.trim()) {
      const q = `%${options.search.trim()}%`;
      conditions.push(or(
        ilike(bondsEntities.name, q),
        ilike(bondsEntities.slug, q),
        ilike(bondsEntities.category, q),
        ilike(bondsEntities.description, q)
      ));
    }

    const rows = await db
      .select({
        entity: bondsEntities,
        owner: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
        liveMemberCount: sql<number>`(SELECT COUNT(*)::int FROM bonds_memberships WHERE bonds_memberships.entity_id = ${bondsEntities.id} AND bonds_memberships.status = 'active')`,
        livePostCount: sql<number>`(SELECT COUNT(*)::int FROM bonds_posts WHERE bonds_posts.entity_id = ${bondsEntities.id})`,
      })
      .from(bondsEntities)
      .innerJoin(users, eq(bondsEntities.ownerId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bondsEntities.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map(r => {
      const e = r.entity;
      const settings = (e.settings as any) || {};
      const typePlural = e.type === 'community' ? 'communities' : `${e.type}s`;
      const canonicalUrl = settings.canonicalUrl || `/bonds/${typePlural}/${e.slug}`;
      const entityNumber = settings.entityNumber || e.slug.split('-')[0] || '';
      const token = settings.token || '';
      const entityStatus = settings.status || 'active';
      const isVerified = settings.isVerified || false;

      return {
        id: e.id,
        name: e.name,
        slug: e.slug,
        type: e.type,
        description: e.description,
        category: e.category,
        coverUrl: e.coverUrl,
        logoUrl: e.logoUrl,
        privacy: e.privacy,
        membershipPolicy: e.membershipPolicy,
        ownerId: e.ownerId,
        owner: r.owner,
        conversationId: e.conversationId,
        memberCount: r.liveMemberCount || e.memberCount || 1,
        postCount: r.livePostCount || 0,
        activityScore: e.activityScore,
        tags: e.tags,
        rules: e.rules,
        settings: e.settings,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        entityNumber,
        token,
        canonicalUrl,
        status: entityStatus,
        isVerified,
      };
    });
  }

  static async updateEntityStatusAdmin(entityId: string, status: 'active' | 'suspended') {
    const [existing] = await db.select({ settings: bondsEntities.settings }).from(bondsEntities).where(eq(bondsEntities.id, entityId)).limit(1);
    if (!existing) throw new Error('Entity not found');

    const updatedSettings = {
      ...((existing.settings as any) || {}),
      status,
      statusUpdatedAt: new Date().toISOString(),
    };

    await db
      .update(bondsEntities)
      .set({ settings: updatedSettings, updatedAt: new Date() })
      .where(eq(bondsEntities.id, entityId));

    return { success: true, status };
  }

  static async toggleEntityVerifiedAdmin(entityId: string, isVerified: boolean) {
    const [existing] = await db.select({ settings: bondsEntities.settings }).from(bondsEntities).where(eq(bondsEntities.id, entityId)).limit(1);
    if (!existing) throw new Error('Entity not found');

    const updatedSettings = {
      ...((existing.settings as any) || {}),
      isVerified,
      verifiedUpdatedAt: new Date().toISOString(),
    };

    await db
      .update(bondsEntities)
      .set({ settings: updatedSettings, updatedAt: new Date() })
      .where(eq(bondsEntities.id, entityId));

    return { success: true, isVerified };
  }

  static async regenerateEntityUrlAdmin(entityId: string) {
    const [entity] = await db.select().from(bondsEntities).where(eq(bondsEntities.id, entityId)).limit(1);
    if (!entity) throw new Error('Entity not found');

    const { entityNum, token, slug, canonicalUrl } = BondsDAL.generateEntitySlugAndUrl(entity.type as any, entity.name);
    const updatedSettings = {
      ...((entity.settings as any) || {}),
      entityNumber: entityNum,
      entityToken: token,
      canonicalUrl,
      urlRegeneratedAt: new Date().toISOString(),
    };

    await db
      .update(bondsEntities)
      .set({ slug, settings: updatedSettings, updatedAt: new Date() })
      .where(eq(bondsEntities.id, entityId));

    return { success: true, slug, canonicalUrl, entityNum, token };
  }

  static async deleteEntityAdmin(entityId: string) {
    const [deleted] = await db.delete(bondsEntities).where(eq(bondsEntities.id, entityId)).returning();
    return { success: true, deletedId: deleted?.id };
  }

  static async getEntityMembersAdmin(entityId: string) {
    const rows = await db
      .select({
        id: bondsMemberships.id,
        entityId: bondsMemberships.entityId,
        userId: bondsMemberships.userId,
        role: bondsMemberships.role,
        status: bondsMemberships.status,
        joinedAt: bondsMemberships.joinedAt,
        user: {
          id: users.id,
          email: users.email,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(bondsMemberships)
      .innerJoin(users, eq(bondsMemberships.userId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(bondsMemberships.entityId, entityId))
      .orderBy(desc(bondsMemberships.joinedAt));

    return rows;
  }

  static async updateMemberRoleAdmin(entityId: string, userId: string, newRole: 'owner' | 'admin' | 'moderator' | 'member') {
    await db
      .update(bondsMemberships)
      .set({ role: newRole })
      .where(and(eq(bondsMemberships.entityId, entityId), eq(bondsMemberships.userId, userId)));

    return { success: true, role: newRole };
  }

  static async removeMemberAdmin(entityId: string, userId: string) {
    await db
      .delete(bondsMemberships)
      .where(and(eq(bondsMemberships.entityId, entityId), eq(bondsMemberships.userId, userId)));

    await db.execute(sql`
      UPDATE bonds_entities 
      SET member_count = GREATEST(1, (SELECT COUNT(*)::int FROM bonds_memberships WHERE entity_id = ${entityId} AND status = 'active')) 
      WHERE id = ${entityId}
    `);

    return { success: true };
  }

  static async getEntityPostsAdmin(entityId: string) {
    const [entity] = await db
      .select({ slug: bondsEntities.slug, type: bondsEntities.type })
      .from(bondsEntities)
      .where(eq(bondsEntities.id, entityId))
      .limit(1);

    const rows = await db
      .select({
        post: bondsPosts,
        author: {
          id: users.id,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarKey: profiles.avatarKey,
          isVerified: profiles.isVerified,
        },
      })
      .from(bondsPosts)
      .innerJoin(users, eq(bondsPosts.authorId, users.id))
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(eq(bondsPosts.entityId, entityId))
      .orderBy(desc(bondsPosts.createdAt));

    const typePlural = entity?.type === 'community' ? 'communities' : `${entity?.type || 'group'}s`;
    const slug = entity?.slug || entityId;

    return rows.map(r => ({
      ...r.post,
      canonicalUrl: `/bonds/${typePlural}/${slug}/posts/${r.post.id}`,
      author: r.author,
    }));
  }

  static async deletePostAdmin(postId: string) {
    await db.delete(bondsPosts).where(eq(bondsPosts.id, postId));
    return { success: true };
  }
}
