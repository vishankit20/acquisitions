import logger from '#config/logger.js';
import { db } from '#config/database.js';
import { users } from '#models/user.model.js';
import { eq } from 'drizzle-orm';

export const getAllUsers = async () => {
  try {
    return await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        created_at: users.created_at,
        updated_at: users.updated_at,
      })
      .from(users);
  } catch (e) {
    logger.error('Error getting users', e);
    throw e;
  }
};

export const getUserById = async id => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        created_at: users.created_at,
        updated_at: users.updated_at,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  } catch (e) {
    logger.error(`Error getting user by id: ${id}`, e);
    throw e;
  }
};

export const updateUser = async (id, updates) => {
  try {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existingUser) {
      throw new Error('User not found');
    }

    const allowedFields = ['name', 'email', 'role'];
    const updateData = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        updateData[field] = updates[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
        created_at: existingUser.created_at,
        updated_at: existingUser.updated_at,
      };
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...updateData,
        updated_at: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        created_at: users.created_at,
        updated_at: users.updated_at,
      });

    logger.info(`User ${updatedUser.email} updated successfully`);

    return updatedUser;
  } catch (e) {
    logger.error(`Error updating user with id ${id}`, e);
    throw e;
  }
};

export const deleteUser = async id => {
  try {
    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        created_at: users.created_at,
        updated_at: users.updated_at,
      });

    if (!deletedUser) {
      throw new Error('User not found');
    }

    logger.info(`User ${deletedUser.email} deleted successfully`);

    return deletedUser;
  } catch (e) {
    logger.error(`Error deleting user with id ${id}`, e);
    throw e;
  }
};
