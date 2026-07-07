/*
Resonant Torus — audio output device helpers (macOS Soundflower, BlackHole, etc.)
Set s.options.device BEFORE server boot.
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

~rtDeviceInList = { |name|
	var devices = ServerOptions.devices;
	devices.notNil and: { devices.any({ |d| d.asString == name.asString }) };
};

~rtFindOutputDevice = { |patterns|
	var devices, match, pat;
	devices = ServerOptions.devices;
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

~rtResolvePreferredDevice = {
	var dev;
	dev = nil;
	if(~rtPreferredDevice.notNil and: { ~rtDeviceInList.(~rtPreferredDevice) }) {
		dev = ~rtPreferredDevice.asString;
	};
	if(dev.isNil) {
		dev = ~rtFindOutputDevice.(~rtDefaultDevicePatterns);
	};
	dev;
};

~rtCurrentOutputDevice = {
	var dev = s.options.device;
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

~rtApplyPreferredOutputDevice = {
	var dev;
	dev = ~rtResolvePreferredDevice.value;
	if(dev.isNil) {
		"RT: Soundflower/BlackHole not found — system default.".warn;
		"RT: devices: %".format(~rtListOutputDevices.value.join(", ")).postln;
		s.options.device = nil;
	} {
		if(~rtDeviceInList.(dev).not) {
			"RT: device '%' unavailable — system default.".format(dev).warn;
			s.options.device = nil;
			~rtPreferredDevice = nil;
		} {
			s.options.device = dev;
			~rtPreferredDevice = dev;
			"RT output device → %".format(dev).postln;
		};
	};
};

~rtPrintOutputDevices = {
	"RT audio devices:".postln;
	~rtListOutputDevices.value.do { |d, i|
		"  [%] %".format(i, d).postln;
	};
	"RT current: % | resolved: %".format(
		~rtCurrentOutputDevice.value,
		~rtResolvePreferredDevice.value ? "—"
	).postln;
};

~rtRebootAudio = {
	var reinit;
	~rtApplyPreferredOutputDevice.value;
	"RT: rebooting server for output device…".postln;
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
			"RT audio reboot complete → %".format(~rtCurrentOutputDevice.value).postln;
		};
	};
	if(s.serverRunning) {
		s.reboot(onCompletion: reinit);
	} {
		s.boot(onCompletion: reinit);
	};
};
