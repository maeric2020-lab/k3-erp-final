#!/usr/bin/env bash
# =============================================================================
# K3 ERP — نسخة احتياطية يومية
# =============================================================================
# يُنفَّذ كـ cron job يومياً الساعة 3 صباحاً بتوقيت الكويت:
#   0 3 * * * /opt/k3/scripts/backup/daily-backup.sh
#
# يُولّد:
#   1. ملف SQL (pg_dump) لقاعدة البيانات الكاملة
#   2. ملف JSON بقائمة الـ buckets الحالية لمراجعتها
#   3. يُحمَّل إلى bucket على Supabase Storage باسم 'backups' (خاص)
#   4. يحتفظ بـ 30 يوم آخر (كل ما هو أقدم يُحذف)
#
# متطلبات:
#   - متغيّرات البيئة:
#       SUPABASE_DB_URL          (postgresql://...)
#       SUPABASE_URL
#       SUPABASE_SERVICE_ROLE_KEY
#       BACKUP_BUCKET           (افتراضي: backups)
#   - أدوات: pg_dump (إصدار 15+)، curl
# =============================================================================

set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/k3-backup-${DATE}"
BACKUP_BUCKET="${BACKUP_BUCKET:-backups}"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

echo "[1/5] بدء النسخ الاحتياطي ${DATE}..."

# 1) dump قاعدة البيانات
echo "[2/5] dump قاعدة البيانات..."
pg_dump "$SUPABASE_DB_URL" \
  --no-owner \
  --no-privileges \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=realtime \
  --exclude-schema=supabase_functions \
  -f "k3-db-${DATE}.sql"

# ضغط
gzip "k3-db-${DATE}.sql"
DB_SIZE=$(du -h "k3-db-${DATE}.sql.gz" | cut -f1)
echo "    حجم النسخة: $DB_SIZE"

# 2) قائمة buckets
echo "[3/5] حفظ بيانات buckets..."
curl -sS -X GET "${SUPABASE_URL}/rest/v1/buckets?select=*" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  > "buckets-${DATE}.json" || echo "[]" > "buckets-${DATE}.json"

# 3) رفع إلى Supabase Storage
echo "[4/5] رفع إلى bucket '${BACKUP_BUCKET}'..."
for f in "k3-db-${DATE}.sql.gz" "buckets-${DATE}.json"; do
  curl -sS -X POST \
    "${SUPABASE_URL}/storage/v1/object/${BACKUP_BUCKET}/${f}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@${f}" \
    > /dev/null
  echo "    ✓ ${f} مرفوع"
done

# 4) حذف النسخ الأقدم من 30 يوم
echo "[5/5] تنظيف النسخ القديمة (>${RETENTION_DAYS} يوم)..."
CUTOFF=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d)
LIST=$(curl -sS -X POST \
  "${SUPABASE_URL}/storage/v1/object/list/${BACKUP_BUCKET}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"prefix": "k3-db-", "limit": 1000}')

# البحث عن أسماء الملفات الأقدم من CUTOFF
echo "$LIST" | python3 -c "
import json, sys, re
data = json.load(sys.stdin)
cutoff = '${CUTOFF}'
to_delete = []
for f in data:
    m = re.match(r'k3-db-(\d{8})_.*', f.get('name', ''))
    if m and m.group(1) < cutoff:
        to_delete.append(f['name'])
for name in to_delete:
    print(name)
" | while read OLDFILE; do
  curl -sS -X DELETE \
    "${SUPABASE_URL}/storage/v1/object/${BACKUP_BUCKET}/${OLDFILE}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    > /dev/null
  echo "    × حُذِف: ${OLDFILE}"
done

# تنظيف ملفات tmp
cd /
rm -rf "$BACKUP_DIR"

echo ""
echo "✅ النسخ الاحتياطي ${DATE} مكتمل."
