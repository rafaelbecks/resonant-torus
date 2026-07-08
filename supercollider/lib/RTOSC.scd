/*
Resonant Torus — OSC receiver (browser bridge → UDP 57124)
Address: /resonant_torus/model  <json string>
*/

~rtOscPending = nil;
~rtOscFlushTask = nil;

~rtOscFlush = {
	var data = ~rtOscPending;
	~rtOscPending = nil;
	if(data.notNil) {
		try { ~rtHandlePayload.(data) } { |err| err.reportError };
	};
};

(
~rtOscPort = 57124;

~rtOsc = (
	init: {
		~rtOsc.free;
		thisProcess.openUDPPort(~rtOscPort);
		OSCdef(\rt_model, { |msg|
			var json = msg[1].asString;
			var data;
			try {
				data = json.parseJSON;
				~rtOscPending = data;
				~rtOscFlushTask !? { ~rtOscFlushTask.stop };
				~rtOscFlushTask = SystemClock.sched(0.03, {
					AppClock.sched(0, {
						~rtOscFlush.value;
						nil;
					});
				});
				"RT OSC model OK — % chambers".format(
					(~rtJsonGet.(~rtJsonGet.(data, \superCollider), \chambers) ? []).size
				).postln;
			} { |err|
				"RT OSC parse error: %".format(err.errorString).postln;
			};
		}, "/resonant_torus/model", nil, ~rtOscPort);

		OSCdef(\rt_trigger, { |msg|
			var json, data;
			try {
				json = msg[1].asString;
				data = json.parseJSON;
				{ ~rtTrigger.(data) }.defer;
			} { |err|
				"RT OSC trigger error: %".format(err.errorString).postln;
			};
		}, "/resonant_torus/trigger", nil, ~rtOscPort);

		OSCdef(\rt_server_down, { |msg|
			"RT: scsynth exited — re-evaluate ResonantTorus.scd".warn;
		}, '/quit', s.addr);

		"RT listening on UDP % — /resonant_torus/model, /resonant_torus/trigger".format(~rtOscPort).postln;
	},

	free: {
		OSCdef(\rt_model).free;
		OSCdef(\rt_trigger).free;
		OSCdef(\rt_server_down).free;
		"RT OSC stopped.".postln;
	}
);
)
