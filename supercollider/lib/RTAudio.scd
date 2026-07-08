/*
Resonant Torus — audio I/O device helpers (macOS Soundflower, BlackHole, etc.)
Set s.options.device / inDevice BEFORE server boot.
*/

~rtDefaultDevicePatterns = [
	"soundflower",
	"blackhole",
];

~rtLower = { |str|
	var s = str.asString;
	if(s.respondsTo(\toLower)) { s.toLower } { s.asLower };
};

~rtListOutputDevices = {
	var list = ServerOptions.devices;
	if(list.isNil or: { list.size == 0 }) {
		["(system default)"];
	} {
		list.asArray.collect(_.asString);
	};
};

~rtListInputDevices = {
	var list = ServerOptions.inDevices;
	if(list.isNil or: { list.size == 0 }) {
		["(system default)"];
	} {
		list.asArray.collect(_.asString);
	};
};

~rtDeviceInOutputList = { |name|
	var devices = ServerOptions.devices;
	devices.notNil and: { devices.any({ |d| d.asString == name.asString }) };
};

~rtDeviceInInputList = { |name|
	var devices = ServerOptions.inDevices;
	devices.notNil and: { devices.any({ |d| d.asString == name.asString }) };
};

~rtFindDevice = { |patterns, devices|
	var match, pat;
	if(devices.isNil) { nil } {
		match = nil;
		patterns.do { |pattern|
			if(match.isNil) {
				pat = ~rtLower.(pattern);
				match = devices.detect({ |name|
					~rtLower.(name).contains(pat);
				});
			};
		};
		match !? { |m| m.asString };
	};
};

~rtFindOutputDevice = { |patterns|
	~rtFindDevice.(patterns, ServerOptions.devices);
};

~rtFindInputDevice = { |patterns|
	~rtFindDevice.(patterns, ServerOptions.inDevices);
};

~rtResolvePreferredOutputDevice = {
	var dev;
	dev = nil;
	if(~rtPreferredDevice.notNil and: { ~rtDeviceInOutputList.(~rtPreferredDevice) }) {
		dev = ~rtPreferredDevice.asString;
	};
	if(dev.isNil) {
		dev = ~rtFindOutputDevice.(~rtDefaultDevicePatterns);
	};
	dev;
};

~rtResolvePreferredInputDevice = {
	var dev;
	dev = nil;
	if(~rtPreferredInDevice.notNil and: { ~rtDeviceInInputList.(~rtPreferredInDevice) }) {
		dev = ~rtPreferredInDevice.asString;
	};
	if(dev.isNil and: { ~rtPreferredDevice.notNil }) {
		if(~rtDeviceInInputList.(~rtPreferredDevice)) {
			dev = ~rtPreferredDevice.asString;
		};
	};
	if(dev.isNil) {
		dev = ~rtFindInputDevice.(~rtDefaultDevicePatterns);
	};
	dev;
};

~rtCurrentOutputDevice = {
	var dev = s.options.device;
	if(dev.isNil) { "(system default)" } { dev.asString };
};

~rtCurrentInputDevice = {
	var dev = s.options.inDevice;
	if(dev.isNil) { "(system default)" } { dev.asString };
};

~rtSetOutputDevice = { |name|
	if(name == "(system default)") {
		s.options.device = nil;
		~rtPreferredDevice = nil;
	} {
		s.options.device = name;
		~rtPreferredDevice = name.asString;
	};
	"RT output device preference: %".format(~rtCurrentOutputDevice.value).postln;
};

~rtSetInputDevice = { |name|
	if(name == "(system default)") {
		s.options.inDevice = nil;
		~rtPreferredInDevice = nil;
	} {
		s.options.inDevice = name;
		~rtPreferredInDevice = name.asString;
	};
	"RT input device preference: %".format(~rtCurrentInputDevice.value).postln;
};

~rtApplyPreferredAudioDevices = {
	var outDev, inDev;
	outDev = ~rtResolvePreferredOutputDevice.value;
	if(outDev.isNil) {
		"RT: Soundflower/BlackHole not found — system default output.".warn;
		s.options.device = nil;
	} {
		if(~rtDeviceInOutputList.(outDev).not) {
			"RT: output '%' unavailable — system default.".format(outDev).warn;
			s.options.device = nil;
			~rtPreferredDevice = nil;
		} {
			s.options.device = outDev;
			~rtPreferredDevice = outDev;
			"RT output device → %".format(outDev).postln;
		};
	};

	s.options.numInputBusChannels = (s.options.numInputBusChannels ? 0).max(2);
	inDev = ~rtResolvePreferredInputDevice.value;
	if(inDev.isNil) {
		s.options.inDevice = nil;
		"RT input device → (system default)".postln;
	} {
		if(~rtDeviceInInputList.(inDev).not) {
			"RT: input '%' unavailable — system default.".format(inDev).warn;
			s.options.inDevice = nil;
			~rtPreferredInDevice = nil;
		} {
			s.options.inDevice = inDev;
			~rtPreferredInDevice = inDev;
			"RT input device → %".format(inDev).postln;
		};
	};
};

~rtApplyPreferredOutputDevice = { ~rtApplyPreferredAudioDevices.value };

~rtPrintOutputDevices = {
	"RT output devices:".postln;
	~rtListOutputDevices.value.do { |d, i|
		"  [%] %".format(i, d).postln;
	};
	"RT input devices:".postln;
	~rtListInputDevices.value.do { |d, i|
		"  [%] %".format(i, d).postln;
	};
	"RT current: out % | in %".format(
		~rtCurrentOutputDevice.value,
		~rtCurrentInputDevice.value
	).postln;
};

~rtRebootAudio = {
	var reinit;
	~rtApplyPreferredAudioDevices.value;
	"RT: rebooting server for audio devices…".postln;
	~rtCleanup !? { ~rtCleanup.value };
	reinit = {
		fork {
			s.sync;
			~rtInit.value;
			~rtOsc.init;
			if(~rt.lastPayload.notNil) {
				~rtHandlePayload.(~rt.lastPayload);
			} {
				~rtLoadDemo.value;
			};
			~rtShowGui.value;
			"RT audio reboot complete → out % | in %".format(
				~rtCurrentOutputDevice.value,
				~rtCurrentInputDevice.value
			).postln;
		};
	};
	if(s.serverRunning) {
		s.reboot(onCompletion: reinit);
	} {
		s.boot(onCompletion: reinit);
	};
};
