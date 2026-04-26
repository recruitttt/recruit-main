import { createApplyRunStore } from "./store";

const globalKey = "__recruit_apply_run_store__";

type GlobalWithApplyStore = typeof globalThis & {
  [globalKey]?: ReturnType<typeof createApplyRunStore>;
};

export function getApplyRunStore(): ReturnType<typeof createApplyRunStore> {
  const root = globalThis as GlobalWithApplyStore;
  if (!root[globalKey]) {
    root[globalKey] = createApplyRunStore();
  }
  return root[globalKey];
}
