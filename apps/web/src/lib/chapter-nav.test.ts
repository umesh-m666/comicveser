import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNav, loadAllChapters } from "./chapter-nav";

const c = (id: string, n: number | null, label: string | null = n === null ? null : String(n), groups?: string[]) => ({ id, number: n, numberLabel: label, groups });

test("prev and next follow the list, decimals included", () => {
  const r = buildNav([c("a", 1), c("b", 2), c("b5", 2.5), c("c", 3)], "b");
  assert.equal(r.prev?.id, "a"); assert.equal(r.next?.id, "b5"); assert.deepEqual(r.list.map((e) => e.number), [1, 2, 2.5, 3]);
});
test("first and last chapters have no prev / next", () => {
  const items = [c("a", 1), c("b", 2)];
  assert.equal(buildNav(items, "a").prev, null); assert.equal(buildNav(items, "b").next, null);
});
test("duplicate chapter numbers stay distinct because chapter ids are the unique identifier", () => {
  const items = [c("a", 1), c("b-groupX", 2, "2", ["Group X"]), c("b-groupY", 2, "2", ["Group Y"]), c("c", 3)];
  assert.deepEqual(buildNav(items, "a").list.map((e) => e.id), ["a", "b-groupX", "b-groupY", "c"]);
  const r = buildNav(items, "b-groupY");
  assert.deepEqual(r.list.map((e) => e.id), ["a", "b-groupX", "b-groupY", "c"]); assert.equal(r.current?.id, "b-groupY"); assert.equal(r.prev?.id, "b-groupX"); assert.equal(r.next?.id, "c");
  assert.equal(r.list[1].label, "Chapter 2 · Group X");
  assert.equal(r.list[2].label, "Chapter 2 · Group Y");
});
test("chapters without a number stay separate and get a position label", () => {
  const r = buildNav([c("a", 1), c("sp1", null), c("sp2", null)], "sp1");
  assert.deepEqual(r.list.map((e) => e.id), ["a", "sp1", "sp2"]); assert.equal(r.current?.number, 2); assert.equal(r.next?.id, "sp2");
});
test("an unknown current chapter gives no neighbours and does not crash", () => {
  const r = buildNav([c("a", 1)], "zzz");
  assert.equal(r.current, null); assert.equal(r.prev, null); assert.equal(r.next, null);
  assert.deepEqual(buildNav([], "x").list, []);
});
test("reader navigation follows chapter pagination beyond the first five pages", async () => {
  const requested: number[] = [];
  const chapters = await loadAllChapters(async (page) => {
    requested.push(page);
    return { items: [c(`chapter-${page}`, page)], hasMore: page < 6 };
  });
  assert.deepEqual(requested, [1, 2, 3, 4, 5, 6]);
  assert.equal(chapters.at(-1)?.id, "chapter-6");
});
test("reader navigation refuses to present a capped partial list as complete", async () => {
  await assert.rejects(loadAllChapters(async (page) => ({
    items: [c(`chapter-${page}`, page)],
    hasMore: true,
  }), 2), /supported pagination limit/);
});
