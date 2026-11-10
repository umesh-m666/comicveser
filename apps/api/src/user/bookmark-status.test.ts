import { strict as assert } from "node:assert";
import { test } from "node:test";
import { effectiveStatus, normalizeSort, progressPercent, sortBookmarks } from "./bookmark-status";

const base = { manual: null, readCount: 0, hasHistory: false, totalChapters: 10, comicCompleted: false } as const;

test("untouched bookmarks are Plan to Read", () => assert.equal(effectiveStatus({ ...base }), "PLAN_TO_READ"));
test("an in-progress chapter makes it Reading", () => assert.equal(effectiveStatus({ ...base, hasHistory: true }), "READING"));
test("finished chapters make it Reading while the comic is ongoing", () =>
  assert.equal(effectiveStatus({ ...base, readCount: 10 }), "READING"));
test("all chapters of a completed comic read = Completed", () =>
  assert.equal(effectiveStatus({ ...base, readCount: 10, comicCompleted: true }), "COMPLETED"));
test("a comic with no chapters can never auto-complete", () =>
  assert.equal(effectiveStatus({ ...base, totalChapters: 0, readCount: 3, comicCompleted: true }), "READING"));
test("a manual shelf always wins", () => {
  assert.equal(effectiveStatus({ ...base, manual: "DROPPED", readCount: 10, comicCompleted: true }), "DROPPED");
  assert.equal(effectiveStatus({ ...base, manual: "ON_HOLD" }), "ON_HOLD");
});

test("progressPercent is clamped and safe", () => {
  assert.equal(progressPercent(0, 10), 0);
  assert.equal(progressPercent(5, 10), 50);
  assert.equal(progressPercent(1, 3), 33);
  assert.equal(progressPercent(12, 10), 100);
  assert.equal(progressPercent(4, 0), 0);
});

test("normalizeSort accepts the legacy name", () => {
  assert.equal(normalizeSort("recent"), "added");
  assert.equal(normalizeSort("title"), "title");
  assert.equal(normalizeSort(undefined), "updated");
  assert.equal(normalizeSort("nonsense"), "updated");
});

test("sortBookmarks orders by the chosen key", () => {
  const d = (n: number) => new Date(n);
  const items = [
    { title: "beta", bookmarkedAt: d(3), lastUpdatedAt: d(1) },
    { title: "Alpha", bookmarkedAt: d(1), lastUpdatedAt: d(3) },
    { title: "gamma", bookmarkedAt: d(2), lastUpdatedAt: d(2) },
  ];
  assert.deepEqual(sortBookmarks(items, "title").map((i) => i.title), ["Alpha", "beta", "gamma"]);
  assert.deepEqual(sortBookmarks(items, "added").map((i) => i.title), ["beta", "gamma", "Alpha"]);
  assert.deepEqual(sortBookmarks(items, "updated").map((i) => i.title), ["Alpha", "gamma", "beta"]);
});
