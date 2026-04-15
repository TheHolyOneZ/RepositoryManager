import React from "react";
import { GitBranch } from "lucide-react";
import { PlaceholderPage } from "../../components/ui/PlaceholderPage";

export const ActionsPage: React.FC = () => (
  <PlaceholderPage
    icon={GitBranch}
    title="GitHub Actions"
    description="Bulk workflow runs, Action usage across repos, and policy templates will live here."
    phase="Roadmap"
  />
);
