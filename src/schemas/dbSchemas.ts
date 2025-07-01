import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { EVENTS } from '../services/wsService.ts';

export const UserSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  userId: z.string().min(1, 'User ID is required'),
  username: z.string().min(1, 'Username is required'),
  registrationDate: z.date(),
  publicKey: z.string(),
  avatarUrl: z.string().url('Invalid URL format').optional(),
  lastActive: z.date().optional(),
  banned: z.boolean().optional().default(false),
  isOnline: z.boolean().optional().default(false)
});

export type User = z.infer<typeof UserSchema>;

export const MessageSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  senderId: z.string().min(1, 'Sender ID is required'),
  receiverId: z.string().min(1, 'Receiver ID is required').optional(),
  payload: z.string().min(1, 'Message payload is required').optional(),
  timestamp: z.date(),
  status: z.enum(['pending', 'delivered']).default('pending'),
  groupId: z.string().uuid().optional(),
  expireAt: z.date().optional().default(() => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)).optional(),
  type: z.enum(['message', 'edit', 'delete']).default('message'),
  messageId: z.instanceof(ObjectId).optional()
}).refine((data) => (!!data.groupId && !data.receiverId) || (!data.groupId && !!data.receiverId),"Group ID cannot be blank when there's no reciever ID")
.refine(data => !(data.type !== 'message' || !!data.messageId), "Message ID cannot be blank when type is not 'message'")
.refine(data => !(data.type === 'message' || data.type === 'edit') || data.payload, "Payload cannot be empty when type is 'message' or 'edit'")

export type Message = z.infer<typeof MessageSchema>;

export const GroupSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  createdBy: z.string(),
  createdAt: z.date(),
  groupId: z.string().uuid(),
  members: z.array(z.string()).min(2, "A group must have a minimum of 2 members"),
  publickey: z.string(),
  lastMessage: z.object({
    content: z.string(),
    timestamp: z.date()
  }).optional()
})

export type Group = z.infer<typeof GroupSchema>

export const EventSchema = z.object({
  _id: z.instanceof(ObjectId).optional(),
  createdBy: z.string(),
  recieverId: z.string(),
  type: z.enum([EVENTS.LASTREAD]).default(EVENTS.LASTREAD).optional(),
  timestamp: z.date().optional().default(new Date())
})

export type Event = z.infer<typeof EventSchema>