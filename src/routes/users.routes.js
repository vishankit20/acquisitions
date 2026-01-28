import express from 'express';
import {
  fetchAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '#controllers/users.controller.js';
import { requireAuth, requireRoles } from '#middleware/auth.middleware.js';

const router = express.Router();

// Get all users - admin only
router.get('/', requireAuth, requireRoles('admin'), fetchAllUsers);

// Get user by ID - any authenticated user
router.get('/:id', requireAuth, getUserById);

// Update user by ID - authenticated users can update own profile, admin can update any
// (fine-grained checks are enforced inside the controller based on req.user)
router.put('/:id', requireAuth, updateUser);

// Delete user by ID - admin only
router.delete('/:id', requireAuth, requireRoles('admin'), deleteUser);

export default router;
