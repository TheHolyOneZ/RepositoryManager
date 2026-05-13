import { useEffect, useRef } from "react";
import { useUIStore } from "../stores/uiStore";
import { useAccountStore, selectActiveAccount } from "../stores/accountStore";
import { useOrgStore } from "../stores/orgStore";
import { useRepoStore } from "../stores/repoStore";
import { reposFetchAll, reposFetchOrg } from "../lib/tauri/commands";
import { formatInvokeError } from "../lib/formatError";


export function useGlobalContextRefresh() {
  const contextVersion = useUIStore((s) => s.contextVersion);
  const addToast = useUIStore((s) => s.addToast);
  const setRepos = useRepoStore((s) => s.setRepos);
  const setLoading = useRepoStore((s) => s.setLoading);
  const enrichHealthScores = useRepoStore((s) => s.enrichHealthScores);
  const activeAccount = useAccountStore(selectActiveAccount);
  const orgContext = useOrgStore((s) => s.activeContext);


  const prevVersionRef = useRef<number | null>(null);

  useEffect(() => {

    if (prevVersionRef.current === null) {
      prevVersionRef.current = contextVersion;
      return;
    }

    if (prevVersionRef.current === contextVersion) return;
    prevVersionRef.current = contextVersion;

    if (!activeAccount) return;

    setLoading(true);
    const run = async () => {
      try {
        let repos;
        if (orgContext.type === "org") {
          repos = await reposFetchOrg(orgContext.login, 100, 1);
        } else {
          repos = await reposFetchAll(activeAccount.id, true);
        }
        setRepos(repos);
        enrichHealthScores();
      } catch (e: unknown) {
        addToast({
          type: "error",
          title: "Couldn't reload repositories after context switch",
          message: formatInvokeError(e),
        });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [contextVersion, activeAccount, orgContext, setRepos, setLoading, enrichHealthScores, addToast]);
}
