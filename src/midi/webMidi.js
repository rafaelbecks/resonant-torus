/**
 * WebMIDI input — device selection, note on/off, and CC events.
 */
export function createWebMidiController({
  onNoteOn,
  onNoteOff,
  onCC,
  onStateChange,
} = {}) {
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
    const [status, data1, data2] = ev.data;
    const cmd = status & 0xf0;
    const channel = status & 0x0f;

    if (cmd === 0xb0) {
      onCC?.({ cc: data1, value: data2, channel, deviceId: selectedDeviceId });
      return;
    }

    if (cmd === 0x90 && data2 > 0) {
      onNoteOn?.({ note: data1, velocity: data2, channel });
    } else if (cmd === 0x80 || (cmd === 0x90 && data2 === 0)) {
      onNoteOff?.({ note: data1, velocity: data2 || 0, channel });
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

  function getSelectedDevice() {
    if (!access || !selectedDeviceId) return null;
    const d = access.inputs.get(selectedDeviceId);
    if (!d) return null;
    return {
      id: d.id,
      name: d.name || "Unknown device",
      manufacturer: d.manufacturer || "",
    };
  }

  return {
    isSupported,
    requestAccess,
    listInputs,
    selectDevice,
    disconnect,
    getSelectedDeviceId: () => selectedDeviceId,
    getSelectedDevice,
  };
}
