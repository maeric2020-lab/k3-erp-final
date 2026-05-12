import { UsersProfileRepository } from '@k3/repositories';
import { MAX_ATTACHMENT_SIZE_BYTES } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withErrorHandler, ApiErrors, ApiError } from '@/lib/api/error-handler';
import { validateUpload } from '@/lib/api/file-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

// صريح: نستخدم Node.js runtime (وليس edge) لأن:
//   1. multipart/form-data parsing أكثر استقراراً في Node
//   2. supabase service_role + storage uploads يحتاجان APIs غير متاحة في edge
//   3. الحجم يصل إلى 25MB — edge محدود
export const runtime = 'nodejs';

// زمن أقصى للتنفيذ (Vercel Hobby = 10s، Pro = 60s)
export const maxDuration = 30;

const BUCKET = 'chat-attachments';

export const POST = withErrorHandler(async (req: Request) => {
  const supabase = createSupabaseServerClient();

  // 1) المصادقة
  const profiles = new UsersProfileRepository(supabase);
  const me = await profiles.getCurrent();
  if (!me) throw ApiErrors.unauthorized();

  // 2) Rate limit (10 رفعات/دقيقة لكل مستخدم — حماية من إغراق التخزين)
  const rateLimitResp = await checkRateLimit('chat.upload', 10, 60_000, req, { userId: me.id });
  if (rateLimitResp) return rateLimitResp;

  // 3) parse form
  const form = await req.formData();
  const file = form.get('file');
  const threadId = form.get('thread_id');

  if (!(file instanceof File)) {
    throw ApiErrors.badRequest('ملف مفقود');
  }
  if (typeof threadId !== 'string' || !threadId) {
    throw ApiErrors.badRequest('thread_id مفقود');
  }

  // 4) فحص أمني شامل
  const validation = await validateUpload(file, MAX_ATTACHMENT_SIZE_BYTES);
  if (!validation.ok) {
    logger.warn('upload.rejected', {
      userId: me.id,
      threadId,
      reason: validation.error,
      mime: file.type,
      size: file.size,
    });
    throw new ApiError(400, 'invalid_file', validation.error ?? 'ملف غير صالح');
  }

  // 5) رفع إلى التخزين
  // المسار: {threadId}/{userId}/{timestamp}_{safe-name}
  const ts = Date.now();
  const path = `${threadId}/${me.id}/${ts}_${validation.sanitizedName}`;
  const arrayBuf = await file.arrayBuffer();

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) {
    logger.error('upload.storage_failed', new Error(error.message), {
      userId: me.id, threadId, path,
    });
    throw ApiErrors.serverError('فشل رفع الملف. حاول مرة أخرى.');
  }

  logger.info('upload.success', {
    userId: me.id, threadId, path,
    category: validation.category, size: file.size,
  });

  return Response.json(
    {
      attachment: {
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        storage_path: path,
        category: validation.category,
      },
    },
    { status: 201 }
  );
});
