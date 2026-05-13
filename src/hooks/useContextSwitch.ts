import { useCallback } from "react";
import { useAccountStore } from "../stores/accountStore";
import { useOrgStore } from "../stores/orgStore";
import { useRepoStore } from "../stores/repoStore";
import { useSelectionStore } from "../stores/selectionStore";
import { useUIStore } from "../stores/uiStore";
import { githubSwitchAccount, githubListOrgs } from "../lib/tauri/commands";
import type { OrgSummary } from "../stores/orgStore";

type OrgContext = { type: "user" } | { type: "org"; login: string; avatar_url: string };

function clearContextState() {
  useUIStore.getState().closeSlideOver();
  useUIStore.getState().closeModal();
  useSelectionStore.getState().deselectAll();
  useRepoStore.getState().resetFilters();
  useRepoStore.getState().setRepos([]);
  useUIStore.getState().triggerRepoRefresh();
  useUIStore.getState().bumpContextVersion();
}

export function useContextSwitch() {
  const switchAccount = useCallback(async (accountId: string) => {
    await githubSwitchAccount(accountId);
    useAccountStore.getState().setActiveAccount(accountId);
    useOrgStore.getState().setContext({ type: "user" });
    clearContextState();
    githubListOrgs()
      .then((orgs: OrgSummary[]) => useOrgStore.getState().setOrgs(orgs))
      .catch(() => {});
  }, []);

  const switchContext = useCallback((ctx: OrgContext) => {
    useOrgStore.getState().setContext(ctx);
    clearContextState();
  }, []);

  return { switchAccount, switchContext };
}
