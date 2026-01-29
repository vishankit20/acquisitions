import logger from '#config/logger.js';
import {
  getAllUsers,
  getUserById as getUserByIdService,
  updateUser as updateUserService,
  deleteUser as deleteUserService,
} from '#services/users.service.js';
import { formatValidationError } from '#utils/format.js';
import {
  userIdSchema,
  updateUserSchema,
} from '#validations/users.validation.js';

export const fetchAllUsers = async (req, res, next) => {
  try {
    logger.info('Getting users...');

    const allUsers = await getAllUsers();

    res.json({
      message: 'Successfully retrieved users',
      users: allUsers,
      count: allUsers.length,
    });
  } catch (e) {
    logger.error(e);
    next(e);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const validationResult = userIdSchema.safeParse(req.params);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;

    logger.info(`Getting user with id ${id}...`);

    const user = await getUserByIdService(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      message: 'Successfully retrieved user',
      user,
    });
  } catch (e) {
    logger.error(e);
    next(e);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const paramsResult = userIdSchema.safeParse(req.params);

    if (!paramsResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(paramsResult.error),
      });
    }

    const bodyResult = updateUserSchema.safeParse(req.body);

    if (!bodyResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(bodyResult.error),
      });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = paramsResult.data;
    const updates = bodyResult.data;

    const authenticatedUserId = Number(req.user.id);
    const isAdmin = req.user.role === 'admin';
    const isSelf = authenticatedUserId === id;

    if (!isSelf && !isAdmin) {
      logger.warn(
        `User ${authenticatedUserId} attempted to update user ${id} without permission`
      );
      return res
        .status(403)
        .json({ error: 'Not authorized to update this user' });
    }

    if (updates.role && !isAdmin) {
      logger.warn(
        `User ${authenticatedUserId} attempted to change role for user ${id} without admin rights`
      );
      return res
        .status(403)
        .json({ error: 'Only admin users can change roles' });
    }

    logger.info(`Updating user with id ${id}...`);

    const updatedUser = await updateUserService(id, updates);

    return res.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (e) {
    logger.error(e);

    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    next(e);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const validationResult = userIdSchema.safeParse(req.params);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = validationResult.data;

    const authenticatedUserId = Number(req.user.id);
    const isAdmin = req.user.role === 'admin';
    const isSelf = authenticatedUserId === id;

    if (!isSelf && !isAdmin) {
      logger.warn(
        `User ${authenticatedUserId} attempted to delete user ${id} without permission`
      );
      return res
        .status(403)
        .json({ error: 'Not authorized to delete this user' });
    }

    logger.info(`Deleting user with id ${id}...`);

    const deletedUser = await deleteUserService(id);

    return res.status(200).json({
      message: 'User deleted successfully',
      user: deletedUser,
    });
  } catch (e) {
    logger.error(e);

    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    next(e);
  }
};
