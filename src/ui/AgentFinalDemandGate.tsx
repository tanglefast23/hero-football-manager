import { useState } from 'react';
import { AgentFinalDemandWalkOn } from './AgentFinalDemandWalkOn';
import type { MarketNegotiationViewModel } from './market-models';

export interface AgentFinalDemandGateProps {
  /** The live negotiation, if one is open on this screen. */
  negotiation?: MarketNegotiationViewModel;
  reduceMotion?: boolean;
}

/**
 * Shows the agent's ultimatum once, the round it arrives.
 *
 * A gate rather than a plain conditional because `finalDemand` stays set for
 * the whole of the closing round — it is what the panel renders its two buttons
 * from. Rendered directly, he would walk back on after every re-render for as
 * long as the manager sat looking at the number.
 *
 * Keyed on the negotiation id, so the next player's agent gets his own entrance
 * and a career of renewals does not fall silent after the first one.
 *
 * Must be mounted as a direct child of the screen root: the overlay fills its
 * parent, and inside the panel it would be boxed into a paper card halfway down
 * a scroll view.
 */
export function AgentFinalDemandGate({
  negotiation,
  reduceMotion = false,
}: AgentFinalDemandGateProps) {
  const demandId = negotiation?.finalDemand === undefined ? undefined : negotiation.id;
  // Which negotiation's ultimatum has already been delivered. Comparing against
  // the current id is what re-arms the entrance for the next player without
  // letting the current one repeat — no effect needed, and no stale flag to
  // clear when the queue moves on.
  const [heardFor, setHeardFor] = useState<string>();

  if (demandId === undefined || heardFor === demandId) return null;
  return (
    <AgentFinalDemandWalkOn
      key={demandId}
      line={negotiation!.finalDemand!.line}
      reduceMotion={reduceMotion}
      onDone={() => setHeardFor(demandId)}
    />
  );
}
