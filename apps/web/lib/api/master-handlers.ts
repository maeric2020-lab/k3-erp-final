import { NextResponse, type NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';
import type { CrudRepository } from '@k3/repositories';

type Json = Record<string, any>;

export function makeListPostHandlers<T extends { id: string }>(opts: {
  buildRepo: () => CrudRepository<any>;
  schema: ZodSchema<any>;
}) {
  return {
    GET: async (req: NextRequest) => {
      const { searchParams } = new URL(req.url);
      const repo = opts.buildRepo();
      try {
        const rows = await (repo as any).list({
          search: searchParams.get('q'),
          limit: Number(searchParams.get('limit') ?? 50),
          offset: Number(searchParams.get('offset') ?? 0),
          active_only: searchParams.get('active_only') === 'true' || undefined,
        });
        const total = await (repo as any).count({ search: searchParams.get('q'), active_only: searchParams.get('active_only') === 'true' || undefined });
        return NextResponse.json({ rows, total });
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
      }
    },
    POST: async (req: NextRequest) => {
      const repo = opts.buildRepo();
      const body = await req.json().catch(() => null);
      const parsed = opts.schema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
      }
      try {
        const created = await (repo as any).create(parsed.data);
        return NextResponse.json(created, { status: 201 });
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
      }
    },
  };
}

export function makeIdHandlers(opts: {
  buildRepo: () => CrudRepository<any>;
  schema: ZodSchema<any>;
  hardDelete?: boolean;
}) {
  return {
    PATCH: async (req: NextRequest, ctx: { params: { id: string } }) => {
      const repo = opts.buildRepo();
      const body = await req.json().catch(() => null);
      const parsed = opts.schema.partial().safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'invalid input' }, { status: 400 });
      }
      try {
        const updated = await (repo as any).update(ctx.params.id, parsed.data);
        return NextResponse.json(updated);
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
      }
    },
    DELETE: async (_req: NextRequest, ctx: { params: { id: string } }) => {
      const repo = opts.buildRepo();
      try {
        if (opts.hardDelete) await (repo as any).hardDelete(ctx.params.id);
        else await (repo as any).softDelete(ctx.params.id);
        return NextResponse.json({ ok: true });
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
      }
    },
  };
}
