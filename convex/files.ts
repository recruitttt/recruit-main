/* eslint-disable @typescript-eslint/no-explicit-any */
//
// files — Convex `_storage` upload helpers used by intake adapters.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §7.3
//
// The onboarding resume step uploads PDFs to Convex `_storage` via
// `useMutation(api.files.generateUploadUrl)` → POST → store the returned
// `Id<"_storage">` and pass it to the resume intake flow.

import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const mutation = mutationGeneric;
const query = queryGeneric;

// Generates a short-lived signed URL the browser can POST a file blob to.
// Returns the URL as a plain string. The client then reads the response JSON
// (`{ storageId }`) to get the Convex `_storage` id of the uploaded file.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Resolves a storage id to a public signed URL the Next route handler
// (which can't call `ctx.storage.get` directly via ConvexHttpClient) can
// fetch with plain `fetch()`. Used by `/api/intake/resume` to pull the
// uploaded PDF before parsing it server-side.
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
