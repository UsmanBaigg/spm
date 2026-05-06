/**
 * Role-Based Access Control (RBAC) Service
 * Manages user roles, permissions, and access control
 */

class RBACService {
  constructor() {
    this.roles = new Map();
    this.permissions = new Map();
    this.userRoles = new Map();
    this.roleHierarchy = new Map();
    
    this.initializeRoles();
    this.initializePermissions();
    this.initializeRoleHierarchy();
  }

  /**
   * Initialize system roles
   */
  initializeRoles() {
    const roles = [
      {
        id: 'super_admin',
        name: 'Super Admin',
        description: 'Full system access',
        level: 100,
        permissions: ['*']
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Administrative access',
        level: 80,
        permissions: [
          'users.read', 'users.write', 'users.delete',
          'ratings.read', 'ratings.write', 'ratings.delete',
          'reviews.read', 'reviews.write', 'reviews.delete',
          'trust_scores.read', 'trust_scores.write',
          'moderation.read', 'moderation.write',
          'analytics.read',
          'system.config'
        ]
      },
      {
        id: 'moderator',
        name: 'Moderator',
        description: 'Content moderation access',
        level: 60,
        permissions: [
          'ratings.read', 'ratings.write',
          'reviews.read', 'reviews.write', 'reviews.delete',
          'trust_scores.read',
          'moderation.read', 'moderation.write',
          'analytics.read'
        ]
      },
      {
        id: 'verified_user',
        name: 'Verified User',
        description: 'Verified community member',
        level: 40,
        permissions: [
          'ratings.read', 'ratings.write',
          'reviews.read', 'reviews.write',
          'trust_scores.read',
          'profile.read', 'profile.write'
        ]
      },
      {
        id: 'trusted_user',
        name: 'Trusted User',
        description: 'Trusted community member',
        level: 30,
        permissions: [
          'ratings.read', 'ratings.write',
          'reviews.read', 'reviews.write',
          'trust_scores.read',
          'profile.read', 'profile.write'
        ]
      },
      {
        id: 'user',
        name: 'User',
        description: 'Regular community member',
        level: 20,
        permissions: [
          'ratings.read', 'ratings.write',
          'reviews.read', 'reviews.write',
          'trust_scores.read',
          'profile.read', 'profile.write'
        ]
      },
      {
        id: 'guest',
        name: 'Guest',
        description: 'Unauthenticated user',
        level: 10,
        permissions: [
          'ratings.read',
          'reviews.read',
          'trust_scores.read'
        ]
      }
    ];

    roles.forEach(role => {
      this.roles.set(role.id, role);
    });
  }

  /**
   * Initialize system permissions
   */
  initializePermissions() {
    const permissions = [
      // User management
      { id: 'users.read', name: 'Read Users', category: 'users' },
      { id: 'users.write', name: 'Write Users', category: 'users' },
      { id: 'users.delete', name: 'Delete Users', category: 'users' },
      
      // Profile management
      { id: 'profile.read', name: 'Read Profiles', category: 'profiles' },
      { id: 'profile.write', name: 'Write Profiles', category: 'profiles' },
      { id: 'profile.delete', name: 'Delete Profiles', category: 'profiles' },
      
      // Rating management
      { id: 'ratings.read', name: 'Read Ratings', category: 'ratings' },
      { id: 'ratings.write', name: 'Write Ratings', category: 'ratings' },
      { id: 'ratings.delete', name: 'Delete Ratings', category: 'ratings' },
      
      // Review management
      { id: 'reviews.read', name: 'Read Reviews', category: 'reviews' },
      { id: 'reviews.write', name: 'Write Reviews', category: 'reviews' },
      { id: 'reviews.delete', name: 'Delete Reviews', category: 'reviews' },
      
      // Trust score management
      { id: 'trust_scores.read', name: 'Read Trust Scores', category: 'trust_scores' },
      { id: 'trust_scores.write', name: 'Write Trust Scores', category: 'trust_scores' },
      
      // Moderation
      { id: 'moderation.read', name: 'Read Moderation Data', category: 'moderation' },
      { id: 'moderation.write', name: 'Write Moderation Data', category: 'moderation' },
      
      // Analytics
      { id: 'analytics.read', name: 'Read Analytics', category: 'analytics' },
      { id: 'analytics.write', name: 'Write Analytics', category: 'analytics' },
      
      // System
      { id: 'system.config', name: 'System Configuration', category: 'system' },
      { id: 'system.monitor', name: 'System Monitoring', category: 'system' },
      { id: 'system.backup', name: 'System Backup', category: 'system' }
    ];

    permissions.forEach(permission => {
      this.permissions.set(permission.id, permission);
    });
  }

  /**
   * Initialize role hierarchy
   */
  initializeRoleHierarchy() {
    this.roleHierarchy.set('super_admin', ['admin']);
    this.roleHierarchy.set('admin', ['moderator', 'verified_user']);
    this.roleHierarchy.set('moderator', ['trusted_user', 'user']);
    this.roleHierarchy.set('verified_user', ['user']);
    this.roleHierarchy.set('trusted_user', ['user']);
    this.roleHierarchy.set('user', ['guest']);
  }

  /**
   * Check if user has permission
   */
  hasPermission(userId, permission) {
    const userRoles = this.getUserRoles(userId);
    
    for (const roleId of userRoles) {
      if (this.roleHasPermission(roleId, permission)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if role has permission
   */
  roleHasPermission(roleId, permission) {
    const role = this.roles.get(roleId);
    
    if (!role) {
      return false;
    }

    // Super admin has all permissions
    if (role.permissions.includes('*')) {
      return true;
    }

    // Direct permission check
    if (role.permissions.includes(permission)) {
      return true;
    }

    // Check inherited permissions from higher roles
    const higherRoles = this.getHigherRoles(roleId);
    for (const higherRoleId of higherRoles) {
      if (this.roleHasPermission(higherRoleId, permission)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get user roles
   */
  getUserRoles(userId) {
    return this.userRoles.get(userId) || ['guest'];
  }

  /**
   * Assign role to user
   */
  assignRole(userId, roleId) {
    if (!this.roles.has(roleId)) {
      throw new Error(`Invalid role: ${roleId}`);
    }

    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, []);
    }

    const userRoles = this.userRoles.get(userId);
    if (!userRoles.includes(roleId)) {
      userRoles.push(roleId);
    }

    return true;
  }

  /**
   * Remove role from user
   */
  removeRole(userId, roleId) {
    const userRoles = this.userRoles.get(userId);
    if (userRoles) {
      const index = userRoles.indexOf(roleId);
      if (index > -1) {
        userRoles.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Get higher roles in hierarchy
   */
  getHigherRoles(roleId) {
    const higherRoles = [];
    const visited = new Set();
    
    const traverse = (currentRoleId) => {
      if (visited.has(currentRoleId)) {
        return;
      }
      
      visited.add(currentRoleId);
      const children = this.roleHierarchy.get(currentRoleId) || [];
      
      for (const childRoleId of children) {
        higherRoles.push(childRoleId);
        traverse(childRoleId);
      }
    };
    
    traverse(roleId);
    return higherRoles;
  }

  /**
   * Get role level
   */
  getRoleLevel(roleId) {
    const role = this.roles.get(roleId);
    return role ? role.level : 0;
  }

  /**
   * Check if user can access resource
   */
  canAccess(userId, resource, action) {
    const permission = `${resource}.${action}`;
    return this.hasPermission(userId, permission);
  }

  /**
   * Get user permissions
   */
  getUserPermissions(userId) {
    const userRoles = this.getUserRoles(userId);
    const permissions = new Set();
    
    for (const roleId of userRoles) {
      const role = this.roles.get(roleId);
      if (role) {
        if (role.permissions.includes('*')) {
          // Super admin - add all permissions
          this.permissions.forEach((_, permId) => permissions.add(permId));
        } else {
          role.permissions.forEach(perm => permissions.add(perm));
        }
        
        // Add inherited permissions
        const higherRoles = this.getHigherRoles(roleId);
        for (const higherRoleId of higherRoles) {
          const higherRole = this.roles.get(higherRoleId);
          if (higherRole) {
            higherRole.permissions.forEach(perm => permissions.add(perm));
          }
        }
      }
    }
    
    return Array.from(permissions);
  }

  /**
   * Create custom role
   */
  createRole(roleData) {
    const role = {
      id: roleData.id,
      name: roleData.name,
      description: roleData.description,
      level: roleData.level || 50,
      permissions: roleData.permissions || [],
      custom: true
    };

    this.roles.set(role.id, role);
    return role;
  }

  /**
   * Update role
   */
  updateRole(roleId, updates) {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    if (role.custom) {
      Object.assign(role, updates);
      return role;
    } else {
      throw new Error(`Cannot modify built-in role: ${roleId}`);
    }
  }

  /**
   * Delete custom role
   */
  deleteRole(roleId) {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    if (!role.custom) {
      throw new Error(`Cannot delete built-in role: ${roleId}`);
    }

    // Remove role from all users
    for (const [userId, userRoles] of this.userRoles.entries()) {
      const index = userRoles.indexOf(roleId);
      if (index > -1) {
        userRoles.splice(index, 1);
      }
    }

    this.roles.delete(roleId);
    return true;
  }

  /**
   * Get all roles
   */
  getAllRoles() {
    return Array.from(this.roles.values());
  }

  /**
   * Get role by ID
   */
  getRole(roleId) {
    return this.roles.get(roleId);
  }

  /**
   * Get users with role
   */
  getUsersWithRole(roleId) {
    const users = [];
    for (const [userId, userRoles] of this.userRoles.entries()) {
      if (userRoles.includes(roleId)) {
        users.push(userId);
      }
    }
    return users;
  }

  /**
   * Check role hierarchy
   */
  canAssignRole(assignerId, targetRoleId) {
    const assignerRoles = this.getUserRoles(assignerId);
    const targetRole = this.roles.get(targetRoleId);
    
    if (!targetRole) {
      return false;
    }

    // Check if assigner has higher or equal level
    for (const assignerRoleId of assignerRoles) {
      const assignerRole = this.roles.get(assignerRoleId);
      if (assignerRole && assignerRole.level >= targetRole.level) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get role statistics
   */
  getRoleStatistics() {
    const stats = {};
    
    for (const [roleId, role] of this.roles.entries()) {
      stats[roleId] = {
        name: role.name,
        userCount: 0,
        permissions: role.permissions.length
      };
    }

    for (const userRoles of this.userRoles.values()) {
      for (const roleId of userRoles) {
        if (stats[roleId]) {
          stats[roleId].userCount++;
        }
      }
    }

    return stats;
  }

  /**
   * Validate permission format
   */
  validatePermission(permission) {
    const parts = permission.split('.');
    if (parts.length !== 2) {
      return false;
    }

    const [resource, action] = parts;
    const validActions = ['read', 'write', 'delete'];
    const validResources = ['users', 'profiles', 'ratings', 'reviews', 'trust_scores', 'moderation', 'analytics', 'system'];

    return validActions.includes(action) && validResources.includes(resource);
  }

  /**
   * Export RBAC configuration
   */
  exportConfiguration() {
    return {
      roles: Array.from(this.roles.entries()),
      permissions: Array.from(this.permissions.entries()),
      roleHierarchy: Array.from(this.roleHierarchy.entries()),
      userRoles: Array.from(this.userRoles.entries())
    };
  }

  /**
   * Import RBAC configuration
   */
  importConfiguration(config) {
    this.roles.clear();
    this.permissions.clear();
    this.roleHierarchy.clear();
    this.userRoles.clear();

    config.roles.forEach(([id, role]) => this.roles.set(id, role));
    config.permissions.forEach(([id, permission]) => this.permissions.set(id, permission));
    config.roleHierarchy.forEach(([roleId, children]) => this.roleHierarchy.set(roleId, children));
    config.userRoles.forEach(([userId, roles]) => this.userRoles.set(userId, roles));
  }
}

export default new RBACService();
