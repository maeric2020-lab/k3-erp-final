import { z } from 'zod';

export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const chatAttachmentSchema = z.object({
  name: z.string().min(1).max(255),
  mime: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(MAX_ATTACHMENT_SIZE_BYTES, {
    message: `Attachment exceeds ${MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024} MB limit`,
  }),
  storage_path: z.string().min(1).max(1000),
});
export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;

export const chatMessageInputSchema = z.object({
  body: z.string().max(8000).optional().nullable(),
  attachments: z.array(chatAttachmentSchema).max(MAX_ATTACHMENTS_PER_MESSAGE).default([]),
}).refine(
  (v) => (v.body && v.body.trim().length > 0) || (v.attachments && v.attachments.length > 0),
  { message: 'Message must have a body or at least one attachment' }
);
export type ChatMessageInput = z.infer<typeof chatMessageInputSchema>;

export const chatGroupCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  member_ids: z.array(z.string().uuid()).min(1).max(100),
});
export type ChatGroupCreateInput = z.infer<typeof chatGroupCreateSchema>;
