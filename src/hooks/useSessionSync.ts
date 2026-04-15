import { useEffect, useState } from "react";
import { useAccountStore } from "../stores/accountStore";
import { githubGetSession, githubSwitchAccount } from "../lib/tauri/commands";
import { isTauriApp } from "../lib/tauri/runtime";


export function useSessionSync(): boolean {
  const [ready, setReady] = useState(() => !isTauriApp());

  useEffect(() => {
    if (!isTauriApp()) return;

    const sync = async () => {
      try {
        const session = await githubGetSession();
        if (session.accounts.length === 0) {
          useAccountStore.setState({ accounts: [], activeAccountId: null });
        } else {
          const raw = session.active_account_id;
          const active =
            raw && session.accounts.some((a) => a.id === raw) ? raw : session.accounts[0].id;
          useAccountStore.setState({
            accounts: session.accounts,
            activeAccountId: active,
          });
          await githubSwitchAccount(active);
        }
      } catch {

      } finally {
        setReady(true);
      }
    };

    if (useAccountStore.persist.hasHydrated()) {
      void sync();
      return;
    }

    return useAccountStore.persist.onFinishHydration(() => {
      void sync();
    });
  }, []);

  return ready;
}
