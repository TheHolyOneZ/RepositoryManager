import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OrgSummary {
  login: string;
  avatar_url: string;
  description: string | null;
}

type OrgContext =
  | { type: "user" }
  | { type: "org"; login: string; avatar_url: string };

interface OrgState {
  orgs: OrgSummary[];
  activeContext: OrgContext;
  setOrgs: (orgs: OrgSummary[]) => void;
  setContext: (ctx: OrgContext) => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      orgs: [],
      activeContext: { type: "user" },
      setOrgs: (orgs) => set({ orgs }),
      setContext: (activeContext) => set({ activeContext }),
    }),
    { name: "zrm_org_context" }
  )
);
