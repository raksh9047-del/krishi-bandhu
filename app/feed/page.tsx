import { InteractionFeed } from "@/components/farmer/InteractionFeed";
import { WhatsAppStub } from "@/components/WhatsAppStub";

export default function FeedPage() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <WhatsAppStub />
      <InteractionFeed />
    </div>
  );
}
