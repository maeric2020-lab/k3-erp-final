/**
 * تحقق آمن من الملفات المرفوعة.
 *
 * يفحص ثلاث طبقات:
 *   1. MIME type ضد قائمة بيضاء
 *   2. magic bytes (أول بايتات الملف) لتأكيد النوع الفعلي
 *      — يمنع رفع .exe بامتداد .jpg
 *   3. تطهير اسم الملف من رموز خطرة
 */

export type FileCategory = 'image' | 'document' | 'audio' | 'video';

interface AllowedType {
  mime: string;
  category: FileCategory;
  // أول بايتات السحرية (hex)؛ array لأن بعض الأنواع لها عدة توقيعات
  magic: string[];
  extensions: string[];
}

// قائمة بيضاء: ما يُسمَح به فعلاً في chat-attachments
const ALLOWED_TYPES: AllowedType[] = [
  // صور
  { mime: 'image/jpeg', category: 'image', magic: ['ffd8ff'], extensions: ['jpg', 'jpeg'] },
  { mime: 'image/png', category: 'image', magic: ['89504e47'], extensions: ['png'] },
  { mime: 'image/gif', category: 'image', magic: ['474946383761', '474946383961'], extensions: ['gif'] },
  { mime: 'image/webp', category: 'image', magic: ['52494646'], extensions: ['webp'] },  // RIFF
  // مستندات
  { mime: 'application/pdf', category: 'document', magic: ['25504446'], extensions: ['pdf'] },
  { mime: 'application/msword', category: 'document', magic: ['d0cf11e0'], extensions: ['doc'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    category: 'document',
    magic: ['504b0304'],
    extensions: ['docx'],
  },
  { mime: 'application/vnd.ms-excel', category: 'document', magic: ['d0cf11e0'], extensions: ['xls'] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    category: 'document',
    magic: ['504b0304'],
    extensions: ['xlsx'],
  },
  { mime: 'text/plain', category: 'document', magic: [], extensions: ['txt'] },  // لا magic ثابت
  // صوت (للرسائل الصوتية)
  { mime: 'audio/webm', category: 'audio', magic: ['1a45dfa3'], extensions: ['webm'] },
  { mime: 'audio/ogg', category: 'audio', magic: ['4f676753'], extensions: ['ogg'] },
  { mime: 'audio/mpeg', category: 'audio', magic: ['494433', 'fffb', 'fff3', 'fff2'], extensions: ['mp3'] },
  { mime: 'audio/mp4', category: 'audio', magic: ['00000018', '00000020', '0000001c'], extensions: ['m4a'] },
  { mime: 'audio/wav', category: 'audio', magic: ['52494646'], extensions: ['wav'] },
];

const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'ps1', 'msi', 'app', 'dmg', 'deb', 'rpm',
  'jar', 'js', 'mjs', 'cjs', 'vbs', 'ws', 'wsf', 'scr', 'com', 'pif',
  'php', 'asp', 'aspx', 'jsp', 'cgi', 'py', 'rb', 'pl',
  'html', 'htm', 'svg',  // قد تحوي JS مضمَّناً
]);

export interface FileValidationResult {
  ok: boolean;
  error?: string;
  category?: FileCategory;
  sanitizedName?: string;
}

/**
 * يُحوّل buffer إلى hex (أول N بايت).
 */
function toHex(bytes: Uint8Array, n: number): string {
  const len = Math.min(bytes.length, n);
  let s = '';
  for (let i = 0; i < len; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

/**
 * يُطهّر اسم الملف:
 *   - يستبدل كل ما ليس [a-zA-Z0-9._-] أو حرف عربي بـ _
 *   - يمنع .. و / و \
 *   - يقصّ إلى 100 حرف
 *   - يضمن وجود امتداد
 */
export function sanitizeFilename(name: string): string {
  // إزالة المسارات إن وُجدت
  let n = name.replace(/[\/\\]/g, '_').replace(/\.\./g, '_');
  // حذف أي حرف ليس آمناً (نسمح بالعربي والإنجليزي والأرقام و . _ -)
  n = n.replace(/[^a-zA-Z0-9._\u0600-\u06FF-]/g, '_');
  // قصّ إلى 100 (مع الحفاظ على الامتداد)
  if (n.length > 100) {
    const lastDot = n.lastIndexOf('.');
    if (lastDot > 0 && lastDot > n.length - 12) {
      const ext = n.slice(lastDot);
      n = n.slice(0, 100 - ext.length) + ext;
    } else {
      n = n.slice(0, 100);
    }
  }
  // تجنُّب اسم فارغ
  if (!n || n === '.') n = `file_${Date.now()}`;
  return n;
}

/**
 * يستخرج الامتداد من اسم الملف (lowercase، بدون النقطة).
 */
function getExtension(name: string): string {
  const i = name.lastIndexOf('.');
  if (i < 0) return '';
  return name.slice(i + 1).toLowerCase();
}

/**
 * يفحص الملف فحصاً كاملاً.
 *
 * @param file كائن File من FormData
 * @param maxSizeBytes الحد الأقصى للحجم
 * @param allowedCategories الفئات المسموح بها (افتراضياً: الصور والمستندات والصوت)
 */
export async function validateUpload(
  file: File,
  maxSizeBytes: number,
  allowedCategories: FileCategory[] = ['image', 'document', 'audio']
): Promise<FileValidationResult> {
  // 1) الحجم
  if (file.size === 0) {
    return { ok: false, error: 'الملف فارغ' };
  }
  if (file.size > maxSizeBytes) {
    return {
      ok: false,
      error: `حجم الملف يتجاوز الحد المسموح (${(maxSizeBytes / 1024 / 1024).toFixed(0)} MB)`,
    };
  }

  // 2) الامتداد المحظور
  const ext = getExtension(file.name);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, error: `نوع الملف "${ext}" غير مسموح به` };
  }

  // 3) MIME ضد القائمة البيضاء
  const mime = (file.type || '').toLowerCase();
  const allowedTypes = ALLOWED_TYPES.filter((t) => allowedCategories.includes(t.category));
  const matchByMime = allowedTypes.find((t) => t.mime === mime);
  const matchByExt = allowedTypes.find((t) => t.extensions.includes(ext));
  const allowed = matchByMime ?? matchByExt;

  if (!allowed) {
    return {
      ok: false,
      error: `نوع الملف غير مدعوم. الأنواع المسموحة: صور، PDF، Word، Excel، تسجيلات صوتية`,
    };
  }

  // 4) magic bytes — تأكيد المحتوى الفعلي
  if (allowed.magic.length > 0) {
    const buf = await file.slice(0, 16).arrayBuffer();
    const hex = toHex(new Uint8Array(buf), 16).toLowerCase();
    const matchesMagic = allowed.magic.some((m) => hex.startsWith(m.toLowerCase()));
    if (!matchesMagic) {
      return {
        ok: false,
        error: 'محتوى الملف لا يطابق نوعه المُعلن (قد يكون ملفّاً ضارّاً)',
      };
    }
  }

  return {
    ok: true,
    category: allowed.category,
    sanitizedName: sanitizeFilename(file.name),
  };
}
