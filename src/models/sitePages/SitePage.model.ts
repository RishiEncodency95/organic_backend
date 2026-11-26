const emptyQuery = () => ({
  select: (_fields?: string) => ({ lean: async () => [] as any[] }),
  lean: async () => [] as any[],
});

export const SitePage = {
  findOne: (_q?: any) => ({ select: (_fields?: string) => ({ lean: async () => null as any }), lean: async () => null as any }),
  find: (_q?: any) => emptyQuery(),
  exists: async (_q?: any) => false,
  updateOne: async (_q?: any, _u?: any) => ({ modifiedCount: 0, matchedCount: 0 }),
};
