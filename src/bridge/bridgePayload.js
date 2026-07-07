/**
 * Slim acoustic model for bridge / OSC (UDP ~64KB limit).
 * Omits analysis.samples and other heavy fields kept only for the browser UI.
 */
export function toBridgePayload(model) {
  if (!model) return null;

  return {
    type: "acoustic_model",
    timestamp: model.timestamp,
    shape: model.shape,
    noiseMix: model.noiseMix,
    timbre: model.timbre,
    synthesis: model.synthesis,
    chambers: model.chambers,
    network: model.network,
    superCollider: model.superCollider,
  };
}
