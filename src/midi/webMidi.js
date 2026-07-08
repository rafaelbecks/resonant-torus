/**
 * WebMIDI input — device selection and note on/off events.
 */
export function createWebMidiController({ onNoteOn, onNoteOff, onStateChange } = {}) {
  let access = null;
  let input = null;
  let selectedDeviceId = "";

  function listInputs() {
    if (!access) return [];
    return [...access.inputs.values()].map((d) => ({
      id: d.id,
      name: d.name || "Unknown device",
      manufacturer: d.manufacturer || "",
    }));
  }

  function handleMessage(ev) {
    const [status, note, velocity] = ev.data;
    const cmd = status & 0xf0;
    const channel = status & 0x0f;

    if (cmd === 0x90 && velocity > 0) {
      onNoteOn?.({ note, velocity, channel });
    } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
      onNoteOff?.({ note, velocity: velocity || 0, channel });
    }
  }

  function selectDevice(deviceId) {
    if (input) {
      input.onmidimessage = null;
      input = null;
    }
    selectedDeviceId = deviceId || "";
    if (!access || !selectedDeviceId) return false;

    input = access.inputs.get(selectedDeviceId);
    if (!input) return false;

    input.onmidimessage = handleMessage;
    return true;
  }

  async function requestAccess() {
    if (!navigator.requestMIDIAccess) {
      throw new Error("WebMIDI is not supported in this browser");
    }
    access = await navigator.requestMIDIAccess({ sysex: false });
    access.onstatechange = () => {
      onStateChange?.(listInputs());
    };
    return listInputs();
  }

  function isSupported() {
    return Boolean(navigator.requestMIDIAccess);
  }

  function disconnect() {
    selectDevice("");
  }

  return {
    isSupported,
    requestAccess,
    listInputs,
    selectDevice,
    disconnect,
    getSelectedDeviceId: () => selectedDeviceId,
  };
}
