import React from "react";
import { Users } from "lucide-react";
import { PlaceholderPage } from "../../components/ui/PlaceholderPage";

export const CollaboratorsPage: React.FC = () => (
  <PlaceholderPage
    icon={Users}
    title="Collaborators"
    description="Org-wide access reviews, default teams, and bulk invite or revoke flows."
    phase="Roadmap"
  />
);
