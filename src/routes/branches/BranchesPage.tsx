import React from "react";
import { Network } from "lucide-react";
import { PlaceholderPage } from "../../components/ui/PlaceholderPage";

export const BranchesPage: React.FC = () => (
  <PlaceholderPage
    icon={Network}
    title="Branch governance"
    description="Stale branch detection, protection rules at scale, and safe bulk deletes."
    phase="Roadmap"
  />
);
