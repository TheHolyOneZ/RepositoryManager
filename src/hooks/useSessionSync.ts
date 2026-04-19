import { useEffect, useState } from "react";
import { useAccountStore } from "../stores/accountStore";
import { useOrgStore } from "../stores/orgStore";
import { githubGetSession, githubSwitchAccount, githubListOrgs } from "../lib/tauri/commands";
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
          githubListOrgs().then((orgs) => useOrgStore.getState().setOrgs(orgs)).catch(() => {});
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
