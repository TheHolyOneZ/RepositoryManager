import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Account } from "../lib/tauri/types";

interface AccountState {
  accounts: Account[];
  activeAccountId: string | null;
  setAccounts: (accounts: Account[]) => void;
  addAccount: (account: Account) => void;
  removeAccount: (id: string) => void;
  setActiveAccount: (id: string) => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      accounts: [],
      activeAccountId: null,

      setAccounts: (accounts) => set({ accounts }),

      addAccount: (account) =>
        set((state) => ({
          accounts: [...state.accounts.filter((a) => a.id !== account.id), account],
          activeAccountId: state.activeAccountId ?? account.id,
        })),

      removeAccount: (id) =>
        set((state) => {
          const accounts = state.accounts.filter((a) => a.id !== id);
          return {
            accounts,
            activeAccountId:
              state.activeAccountId === id ? (accounts[0]?.id ?? null) : state.activeAccountId,
          };
        }),

      setActiveAccount: (activeAccountId) => set({ activeAccountId }),
    }),
    { name: "zrm-accounts" }
  )
);


export function selectActiveAccount(state: AccountState): Account | null {
  return state.accounts.find((a) => a.id === state.activeAccountId) ?? null;
}
