/*
Resonant Torus — SuperCollider physical-model engine

Setup:
  1. Evaluate this file (Cmd+Enter)
  2. Default output: Soundflower (fallback BlackHole); input via GUI Audio I/O
  3. npm run bridge  +  browser Tools → External bridge → connect

OSC: /resonant_torus/model  <json>  on UDP 57124
~rtShowGui.value

*/

(
var rtPath = thisProcess.nowExecutingPath.dirname;

~rtCleanup = {
	~rtGuiClose !? { ~rtGuiClose.value };
	~rtOsc !? { ~rtOsc.free };
	~rt !? { ~rtFreeAll.value };
	"Resonant Torus stopped.".postln;
};

~rtStartup = {
	"▸ Resonant Torus loading…".postln;
	try {
		(rtPath +/+ "lib/RTAudio.scd").load;

		if(s.serverRunning.not) {
			~rtApplyPreferredOutputDevice.value;
		} {
			"▸ Server already running (%). Device change: GUI → Apply or ~rtRebootAudio.value".format(
				~rtCurrentOutputDevice.value
			).postln;
		};

		s.waitForBoot({
			~rtGuiClose !? { ~rtGuiClose.value };
			~rtOsc !? { ~rtOsc.free };
			~rt !? { ~rtFreeAll.value };

			(rtPath +/+ "lib/RTDefs.scd").load;
			(rtPath +/+ "lib/RTGui.scd").load;
			(rtPath +/+ "lib/RTEngine.scd").load;
			(rtPath +/+ "lib/RTOSC.scd").load;

			fork {
				s.sync;
				~rtInit.value;
				~rtOsc.init;
				~rtLoadDemo.value;
				~rtShowGui.value;
				"".postln;
				"▸ Resonant Torus running.".postln;
				"  OSC  udp://localhost:%/resonant_torus/model".format(~rtOscPort).postln;
				"  GUI missing?  ~rtShowGui.value".postln;
				"  Devices:      ~rtPrintOutputDevices.value".postln;
				"  Stop:         ~rtCleanup.value".postln;
			};
		});
	} { |err|
		"▸ Resonant Torus startup FAILED:".postln;
		err.reportError;
	};
};

~rtStartup.value;
)

/*
--- Theory mapping (browser acoustic_model → SC graph) ---

Each chamber ≈ acoustic cavity (freq, decay, thickness, drift).
Each route ≈ waveguide link (delayMs, coupling, throat).
Payload: data.superCollider { freq, partials, chambers[], routes[], noise }
*/
