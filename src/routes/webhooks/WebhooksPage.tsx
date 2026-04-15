import React from "react";
import { Webhook } from "lucide-react";
import { PlaceholderPage } from "../../components/ui/PlaceholderPage";

export const WebhooksPage: React.FC = () => (
  <PlaceholderPage
    icon={Webhook}
    title="Webhooks"
    description="Inspect and rotate webhooks across many repositories from one surface."
    phase="Roadmap"
  />
);
