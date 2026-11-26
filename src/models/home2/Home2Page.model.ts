const emptyQuery = () => ({
  select: () => ({ lean: async () => [] as any[] }),
  lean: async () => [] as any[],
});

export const Home2Page = {
  findOne: (_q?: any) => ({ select: () => ({ lean: async () => null }), lean: async () => null }),
  find: (_q?: any) => emptyQuery(),
  exists: async (_q?: any) => false,
  updateOne: async (_q?: any, _u?: any) => ({ modifiedCount: 0, matchedCount: 0 }),
};
