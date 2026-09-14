import { Request, Response, NextFunction } from 'express';
import { verifyWebhook } from '@clerk/express/webhooks';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../types/error.types.js';
import {
  ClerkEmailAddress,
  ClerkPhoneNumber,
  ClerkUserCreatedData,
  ClerkUserUpdatedData,
  ClerkUserDeletedData,
  ClerkWebhookData,
} from '../types/clerk.types.js';

function getPrimaryEmail(
  emailAddresses: ClerkEmailAddress[],
  primaryEmailAddressId: string | null,
): string | null {
  if (primaryEmailAddressId) {
    const match = emailAddresses.find((email) => email.id === primaryEmailAddressId);

    if (match) {
      return match.email_address;
    }
  }

  return emailAddresses[0]?.email_address ?? null;
}

function getPrimaryPhone(
  phoneNumbers: ClerkPhoneNumber[],
  primaryPhoneNumberId: string | null,
): string | null {
  if (primaryPhoneNumberId) {
    const match = phoneNumbers.find((phone) => phone.id === primaryPhoneNumberId);

    if (match) {
      return match.phone_number;
    }
  }

  return phoneNumbers[0]?.phone_number ?? null;
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

export const clerkWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const evt = await verifyWebhook(req);

    console.log(`Clerk webhook received: ${evt.type}`);

    const data = evt.data as ClerkWebhookData;

    switch (evt.type) {
      case 'user.created': {
        const userData = data as ClerkUserCreatedData;

        const clerkUserId = userData.id;
        const publicMetadata = userData.public_metadata ?? {};

        const role = publicMetadata.role;

        const hasAdminId = publicMetadata.adminId !== undefined && publicMetadata.adminId !== null;

        const primaryEmail = getPrimaryEmail(
          userData.email_addresses,
          userData.primary_email_address_id,
        );

        if (role === 'USER' && hasAdminId) {
          if (!primaryEmail) {
            const error: AppError = new Error('No email found for created user');
            error.statusCode = 400;
            return next(error);
          }

          const adminId = Number(publicMetadata.adminId);

          if (!Number.isFinite(adminId) || adminId <= 0) {
            const error: AppError = new Error(
              `Invalid adminId in invite metadata: ${publicMetadata.adminId}`,
            );

            error.statusCode = 400;
            return next(error);
          }

          const admin = await prisma.admin.findUnique({
            where: {
              id: adminId,
            },
          });

          if (!admin) {
            const error: AppError = new Error(`Admin with id ${adminId} does not exist`);

            error.statusCode = 404;
            return next(error);
          }

          const name =
            publicMetadata.name ||
            [userData.first_name, userData.last_name].filter(Boolean).join(' ') ||
            'Invited User';

          const phone =
            publicMetadata.phone ||
            getPrimaryPhone(userData.phone_numbers, userData.primary_phone_number_id);

          try {
            const user = await prisma.user.upsert({
              where: {
                clerkUserId,
              },
              update: {},
              create: {
                clerkUserId,
                name,
                email: primaryEmail,
                phone: phone || null,
                adminId,
              },
            });

            console.log(`User created/verified in database: ${user.id}`);

            return res.status(201).json({
              success: true,
              message: 'User created successfully',
              data: user,
            });
          } catch (error) {
            if (isPrismaUniqueConstraintError(error)) {
              const conflict: AppError = new Error(
                `A user with this email already exists: ${primaryEmail}`,
              );
              conflict.statusCode = 409;
              return next(conflict);
            }

            throw error;
          }
        }

        if (role === 'USER' || hasAdminId) {
          const error: AppError = new Error(
            `Malformed invite metadata for ${clerkUserId}: role=${role}, adminId=${publicMetadata.adminId}`,
          );

          error.statusCode = 400;
          return next(error);
        }

        // Independent Clerk signup. Do not grant ADMIN here.
        // Privilege assignment happens only in POST /api/admin/signup.
        return res.status(200).json({
          success: true,
          message: 'Webhook processed successfully',
        });
      }

      case 'user.updated': {
        const userData = data as ClerkUserUpdatedData;

        const clerkUserId = userData.id;

        const primaryEmail = getPrimaryEmail(
          userData.email_addresses,
          userData.primary_email_address_id,
        );

        const name = [userData.first_name, userData.last_name].filter(Boolean).join(' ');

        const user = await prisma.user.findUnique({
          where: {
            clerkUserId,
          },
        });

        if (user) {
          await prisma.user.update({
            where: {
              clerkUserId,
            },
            data: {
              ...(primaryEmail ? { email: primaryEmail } : {}),
              ...(name ? { name } : {}),
            },
          });

          console.log(`User updated in database: ${user.id}`);

          return res.status(200).json({
            success: true,
            message: 'User updated successfully',
          });
        }

        const admin = await prisma.admin.findUnique({
          where: {
            clerkUserId,
          },
        });

        if (admin) {
          console.log(`Admin updated in Clerk: ${admin.id}`);

          return res.status(200).json({
            success: true,
            message: 'Admin updated successfully',
          });
        }

        console.log(`No database record found for Clerk user: ${clerkUserId}`);

        return res.status(200).json({
          success: true,
          message: 'Webhook processed successfully',
        });
      }

      case 'user.deleted': {
        const userData = data as ClerkUserDeletedData;

        const clerkUserId = userData.id;

        const deletedUsers = await prisma.user.deleteMany({
          where: {
            clerkUserId,
          },
        });

        const admin = await prisma.admin.findUnique({
          where: {
            clerkUserId,
          },
        });

        let deletedAdmins = 0;

        if (admin) {
          const relatedUsers = await prisma.user.count({
            where: { adminId: admin.id },
          });

          if (relatedUsers === 0) {
            try {
              await prisma.admin.delete({
                where: { clerkUserId },
              });
              deletedAdmins = 1;
            } catch {
              console.log(
                `Admin ${admin.id} retained after Clerk deletion because related records exist`,
              );
            }
          } else {
            console.log(
              `Admin ${admin.id} retained after Clerk deletion because related users exist (users=${relatedUsers})`,
            );
          }
        }

        console.log(`Clerk user deleted: ${clerkUserId}`);
        console.log(
          `Database records deleted - Users: ${deletedUsers.count}, Admins: ${deletedAdmins}`,
        );

        return res.status(200).json({
          success: true,
          message: 'User deletion processed successfully',
        });
      }

      default: {
        console.log(`Unhandled Clerk webhook event: ${evt.type}`);

        return res.status(200).json({
          success: true,
          message: 'Webhook received successfully',
        });
      }
    }
  } catch (error) {
    console.error('Error processing Clerk webhook:', error);

    const appError: AppError =
      error instanceof Error ? error : new Error('Invalid webhook signature');
    if (!appError.statusCode) {
      appError.statusCode = 400;
    }

    return next(appError);
  }
};
