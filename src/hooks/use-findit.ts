import { useCallback, useEffect, useSyncExternalStore } from "react";
import * as api from "@/lib/api";
import { SAMPLE_CLAIMS, SAMPLE_ITEMS } from "@/lib/sample-data";
import type {
  AuthResponse,
  Claim,
  Item,
  LoginCredentials,
  RegisterCredentials,
  User,
} from "@/lib/types";

interface State {
  items: Item[];
  claims: Claim[];
  currentUser: User | null;
  ready: boolean;
}

const initial: State = {
  items: SAMPLE_ITEMS,
  claims: SAMPLE_CLAIMS,
  currentUser: api.getCachedUser(),
  ready: false,
};

let state: State = initial;
const listeners = new Set<() => void>();
let loading = false;

function emit() {
  listeners.forEach((l) => l());
}

async function refresh() {
  const db = await api.fetchAll();
  state = {
    ...state,
    items: db.items,
    claims: db.claims,
    ready: true,
  };
  emit();
}

/** Shared app data and authentication state. */
export function useFindIt() {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => initial
  );

  useEffect(() => {
    if (!state.ready && !loading) {
      loading = true;
      // Re-validate session if token exists
      if (api.getAuthToken()) {
        void api.fetchMe().then((user) => {
          state = { ...state, currentUser: user };
          emit();
        });
      }
      void refresh();
    }
  }, []);

  const run = useCallback(
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
      async (...a: A) => {
        const r = await fn(...a);
        await refresh();
        return r;
      },
    []
  );

  const login = useCallback(async (creds: LoginCredentials): Promise<AuthResponse> => {
    const res = await api.login(creds);
    state = { ...state, currentUser: res.user };
    emit();
    await refresh();
    return res;
  }, []);

  const register = useCallback(async (creds: RegisterCredentials): Promise<AuthResponse> => {
    const res = await api.register(creds);
    state = { ...state, currentUser: res.user };
    emit();
    await refresh();
    return res;
  }, []);

  const logout = useCallback(() => {
    api.logout();
    state = { ...state, currentUser: null, claims: [] };
    emit();
    void refresh();
  }, []);

  return {
    ...snap,
    currentUser: snap.currentUser,
    login,
    register,
    logout,
    refresh,
    uploadImage: api.uploadImage,
    createItem: run(api.createItem),
    updateItemStatus: run(api.updateItemStatus),
    deleteItem: run(api.deleteItem),
    createClaim: run(api.createClaim),
    updateClaimStatus: run(api.updateClaimStatus),
    resetData: run(api.resetData),
  };
}
