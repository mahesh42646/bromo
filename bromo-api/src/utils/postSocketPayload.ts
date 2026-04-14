/** Same shape as POST /posts uses for `emitPostNew` (author nested, authorId stripped). */
export function postForSocketBroadcast(
  populated: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!populated || typeof populated !== "object") return null;
  return {
    ...populated,
    author: populated.authorId,
    authorId: undefined,
  };
}
