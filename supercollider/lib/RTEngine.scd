/*
Resonant Torus — engine: parse acoustic_model JSON, build chamber network graph.
State in ~rt; functions at top level (SC Event literals break on nested calls).
*/

~rtJsonGet = { |obj, sym|
	var v;
	if(obj.isNil) { ^nil };
	v = obj[sym];
	if(v.notNil) { ^v };
	obj[sym.asString];
};

~rtJsonField = { |obj, sym, defaultVal=0|
	var v = ~rtJsonGet.(obj, sym);
	if(v.notNil) { v } { defaultVal };
};

~rtJsonNum = { |v, defaultVal=0|
	case
		{ v.isNil } { defaultVal.asFloat }
		{ v.isKindOf(Number) } { v.asFloat }
		{ v.isKindOf(String) } { v.asFloat ? defaultVal.asFloat }
		{ true } { v.tryPerform(\asFloat) ? defaultVal.asFloat };
};

~rtParsePartial = { |p|
	if(p.isArray) {
		[~rtJsonNum.(p[0], 1), ~rtJsonNum.(p[1], 0.5), ~rtJsonNum.(p[2], 0)];
	} {
		[
			~rtJsonNum.(~rtJsonGet.(p, \harmonic), 1),
			~rtJsonNum.(
				~rtJsonGet.(p, \amplitude) ?? ~rtJsonGet.(p, \amp),
				0.5
			),
			~rtJsonNum.(~rtJsonGet.(p, \detune), 0),
		];
	};
};

~rtParseChamber = { |c|
	var d = IdentityDictionary.new;
	var id;
	if(c.isArray) {
		d[\id] = 0;
		d[\chainIndex] = 0;
		d[\freq] = ~rtJsonNum.(c[0], 80);
		d[\amp] = ~rtJsonNum.(c[1], 0.5);
		d[\decay] = ~rtJsonNum.(c[2], 0.4);
		d[\thickness] = 0.3;
		d[\drift] = 0;
		d[\ringAngle] = 0;
		d[\gate] = 1;
	};
	if(c.isArray.not) {
		id = ~rtJsonNum.(~rtJsonField.(c, \id, 0), 0).asInteger;
		d[\id] = id;
		d[\chainIndex] = ~rtJsonNum.(~rtJsonField.(c, \chainIndex, id), id).asInteger;
		d[\freq] = ~rtJsonNum.(
			~rtJsonField.(c, \freq) ?? ~rtJsonField.(c, \frequency),
			80
		);
		d[\amp] = ~rtJsonNum.(
			~rtJsonField.(c, \amp) ?? ~rtJsonField.(c, \amplitude),
			0.5
		);
		d[\decay] = ~rtJsonNum.(~rtJsonField.(c, \decay, 0.4), 0.4);
		d[\thickness] = ~rtJsonNum.(~rtJsonField.(c, \thickness, 0.3), 0.3);
		d[\drift] = ~rtJsonNum.(
			~rtJsonField.(c, \drift) ?? ~rtJsonField.(c, \driftHz),
			0
		);
		d[\ringAngle] = ~rtJsonNum.(~rtJsonField.(c, \ringAngle, 0), 0);
		d[\gate] = ~rtJsonNum.(~rtJsonField.(c, \gate, 1), 1).clip(0, 1);
	};
	d.asEvent;
};

~rtParseRoute = { |r|
	var d = IdentityDictionary.new;
	if(r.isArray) {
		d[\from] = 0;
		d[\to] = 1;
		d[\coupling] = 0.3;
		d[\delayMs] = 8;
		d[\throat] = 0.25;
	};
	if(r.isArray.not) {
		d[\from] = ~rtJsonNum.(~rtJsonField.(r, \from, 0), 0).asInteger;
		d[\to] = ~rtJsonNum.(~rtJsonField.(r, \to, 1), 1).asInteger;
		d[\coupling] = ~rtJsonNum.(~rtJsonField.(r, \coupling, 0.3), 0.3);
		d[\delayMs] = ~rtJsonNum.(~rtJsonField.(r, \delayMs, 8), 8);
		d[\throat] = ~rtJsonNum.(~rtJsonField.(r, \throat, 0.25), 0.25);
	};
	d.asEvent;
};

~rtMaxChambers = 8;
~rtMaxPartials = 10;
~rtFreqMin = 40;
~rtFreqMax = 1200;

~rtClampModel = { |model|
	var chambers, routes, partials, n;
	chambers = model[\chambers] ? [];
	routes = model[\routes] ? [];
	partials = model[\partials] ? [];
	if(chambers.size > ~rtMaxChambers) {
		"RT: capped % chambers → %".format(chambers.size, ~rtMaxChambers).warn;
		chambers = chambers[..(~rtMaxChambers - 1)];
	};
	n = chambers.size;
	chambers.do { |c|
		c[\freq] = ~rtJsonNum.(c[\freq], 80).clip(~rtFreqMin, ~rtFreqMax);
		c[\drift] = ~rtJsonNum.(c[\drift], 0).clip(0, 60);
		c[\decay] = ~rtJsonNum.(c[\decay], 0.4).clip(0.05, 2);
	};
	routes = routes.select { |r|
		var from = ~rtJsonNum.(r[\from], 0).asInteger;
		var to = ~rtJsonNum.(r[\to], 0).asInteger;
		from < n and: { to < n };
	};
	if(partials.size > ~rtMaxPartials) {
		partials = partials[..(~rtMaxPartials - 1)];
	};
	model[\freq] = ~rtJsonNum.(model[\freq], 65).clip(~rtFreqMin, ~rtFreqMax);
	model[\chambers] = chambers;
	model[\routes] = routes;
	model[\partials] = partials;
	model;
};

~rt = (
	synths: IdentityDictionary.new,
	buses: IdentityDictionary.new,
	synthGroup: nil,
	model: nil,
	lastPayload: nil,
	controls: (
		exciterType: 0,
		exciterLevel: 0.22,
		exciterRate: 1.8,
		partialsMix: 0,
		chamberMix: 0.68,
		noiseMix: 0,
		chamberMode: 0,
	),
	exciterTypes: [\pink, \dust, \noise],
	chamberModes: if(~rtHasMembrane) {
		[\tube, \modal, \waveguide, \membrane, \multimodal]
	} {
		[\tube, \modal, \waveguide, \multimodal]
	}
);

~rtFreeSynthValue = { |item|
	case
		{ item.isNil } { }
		{ item.isKindOf(Synth) } { item.free }
		{ item.isKindOf(List) or: { item.isKindOf(Array) } } {
			item.do(~rtFreeSynthValue);
		};
};

~rtFreeAll = {
	~rt.synths.keysValuesDo { |k, v| ~rtFreeSynthValue.(v) };
	~rt.synths.clear;
	~rt.synthGroup !? { |g| g.free };
	~rt.synthGroup = nil;
	~rt.buses.do(_.free);
	~rt.buses.clear;
};

~rtInit = {
	~rtFreeAll.value;
	~rt.synthGroup = Group.tail(s);
	"RT engine ready.".postln;
};

~rtNormalizeModel = { |data|
	var sc = ~rtJsonGet.(data, \superCollider);
	var chambers, routes, partials, model, network;
	if(sc.isNil) { nil } {
		chambers = (~rtJsonGet.(sc, \chambers) ? []).collect({ |c| ~rtParseChamber.(c) });
		chambers = chambers.sort({ |a, b|
			var ia = a[\chainIndex] ? a[\id] ? 0;
			var ib = b[\chainIndex] ? b[\id] ? 0;
			ia < ib;
		});
		network = ~rtJsonGet.(data, \network);
		routes = (~rtJsonGet.(sc, \routes) ? network ? []).collect({ |r| ~rtParseRoute.(r) });
		partials = (~rtJsonGet.(sc, \partials) ? []).collect({ |p| ~rtParsePartial.(p) });
		model = IdentityDictionary.new;
		model[\freq] = ~rtJsonNum.(~rtJsonField.(sc, \freq, 65), 65);
		model[\partials] = partials;
		model[\chambers] = chambers;
		model[\routes] = routes;
		model[\noise] = ~rtJsonNum.(
			~rtJsonField.(sc, \noise) ?? ~rtJsonField.(data, \noiseMix),
			0
		);
		model[\bedsGate] = ~rtJsonNum.(~rtJsonField.(sc, \bedsGate, 1), 1).clip(0, 1);
		model[\shape] = ~rtJsonField.(data, \shape, "unknown");
		model[\timestamp] = ~rtJsonGet.(data, \timestamp);
		model[\timbre] = ~rtJsonGet.(data, \timbre);
		~rtClampModel.(model);
	};
};

~rtChamberModeIndex = {
	var m = ~rt.controls.chamberMode;
	case
		{ m.isKindOf(Symbol) } { ~rt.chamberModes.indexOf(m) ? 0 }
		{ m.isKindOf(String) } { ~rt.chamberModes.indexOf(m.asSymbol) ? 0 }
		{ true } { m.asInteger };
};

~rtExciterTypeIndex = {
	var t = ~rt.controls.exciterType;
	case
		{ t.isKindOf(Symbol) } { ~rt.exciterTypes.indexOf(t) ? 0 }
		{ t.isKindOf(String) } { ~rt.exciterTypes.indexOf(t.asSymbol) ? 0 }
		{ true } { t.asInteger };
};

~rtGraphAlive = { |n, routeCount, partialCount|
	~rt.synths[\master].notNil
		and: { ~rt.synths[\exciter].notNil }
		and: { ~rt.synths[\chambers].notNil }
		and: { ~rt.synths[\chambers].size == n }
		and: { ~rt.synths[\links].notNil }
		and: { ~rt.synths[\links].size == routeCount }
		and: { ~rt.synths[\partials].notNil }
		and: { ~rt.synths[\partials].size == partialCount };
};

~rtBuildGraph = { |model|
	var n, pan, thickAmp, sc, ctrl;
	if(model.isNil) {
		"RT: no model to build.".postln;
	} {
		if(SynthDescLib.global.at(\rt_link).isNil) {
			"RT: SynthDefs missing on server — re-evaluate ResonantTorus.scd".warn;
		} {
		try {
		~rtFreeAll.value;
		~rt.model = model;
		~rt.synthGroup = Group.tail(s);
		n = model[\chambers].size;
		if(n == 0) { "RT: empty chamber list — playing partials only.".postln };
		~rt.buses[\exciter] = Bus.audio(s, 1);
		~rt.buses[\master] = Bus.audio(s, 2);
		~rt.buses[\partials] = Bus.audio(s, 2);
		~rt.buses[\noise] = Bus.audio(s, 2);
		~rt.buses[\chamberIn] = Array.fill(n.max(1), { Bus.audio(s, 1) });
		~rt.buses[\chamberOut] = Array.fill(n.max(1), { Bus.audio(s, 1) });
		sc = ~rt.synths;
		ctrl = ~rt.controls;
		sc[\exciter] = Synth.tail(~rt.synthGroup, \rt_exciter, [
			\out, ~rt.buses[\exciter].index,
			\type, ~rtExciterTypeIndex.value,
			\level, ctrl.exciterLevel,
			\rate, ctrl.exciterRate,
			\freq, model[\freq]
		]);
		if(n > 0) {
			sc[\exciterInject] = Synth.tail(~rt.synthGroup, \rt_exciterInject, [
				\exciterBus, ~rt.buses[\exciter].index,
				\chamberBus, ~rt.buses[\chamberIn][0].index,
				\level, 1.0
			]);
		};
		sc[\chambers] = List.new;
		model[\chambers].do { |ch, idx|
			var chGate = ~rtJsonNum.(ch[\gate], 1).clip(0, 1);
			pan = if(n <= 1) { 0 } { (idx / (n - 1)) * 2 - 1 };
			thickAmp = ~rtJsonNum.(ch[\amp], 0.5).clip(0, 1)
				* (0.04 + ~rtJsonNum.(ch[\thickness], 0.3) * 0.08);
			sc[\chambers].add(
				Synth.tail(~rt.synthGroup, \rt_chamber, [
					\inBus, ~rt.buses[\chamberIn][idx].index,
					\outBus, ~rt.buses[\chamberOut][idx].index,
					\masterBus, ~rt.buses[\master].index,
					\freq, ~rtJsonNum.(ch[\freq], 80),
					\amp, thickAmp,
					\decay, ~rtJsonNum.(ch[\decay], 0.4).clip(0.05, 2.5),
					\drift, ~rtJsonNum.(ch[\drift], 0),
					\thickness, ~rtJsonNum.(ch[\thickness], 0.3),
					\pan, pan,
					\mode, ~rtChamberModeIndex.value,
					\gate, chGate
				])
			);
		};
		sc[\links] = List.new;
		model[\routes].do { |route|
			var from = route[\from].asInteger;
			var to = route[\to].asInteger;
			var fromGate = if(n > 0 and: { from < n }) {
				~rtJsonNum.(model[\chambers][from][\gate], 1).clip(0, 1);
			} { 1 };
			var linkPan = if(n <= 1) { 0 } { (to / (n - 1)) * 2 - 1 };
			if(from < n and: { to < n }) {
				sc[\links].add(
					Synth.tail(~rt.synthGroup, \rt_link, [
						\fromBus, ~rt.buses[\chamberOut][from].index,
						\masterBus, ~rt.buses[\master].index,
						\coupling, ~rtJsonNum.(route[\coupling], 0.3).clip(0, 0.35),
						\delay, ~rtJsonNum.(route[\delayMs], 8) / 1000,
						\throat, ~rtJsonNum.(route[\throat], 0.25).clip(0.01, 1),
						\pan, linkPan,
						\gate, fromGate
					])
				);
			};
		};
		sc[\partials] = List.new;
		model[\partials].do { |p|
			var harm = p[0], amp = p[1], detune = p[2];
			var bedsGate = ~rtJsonNum.(model[\bedsGate], 1).clip(0, 1);
			sc[\partials].add(Synth.tail(~rt.synthGroup, \rt_partial, [
				\out, ~rt.buses[\partials].index,
				\freq, ~rtJsonNum.(model[\freq], 65) * harm,
				\amp, ~rtJsonNum.(amp, 0.5).clip(0, 1) * 0.07,
				\detune, ~rtJsonNum.(detune, 0),
				\gate, bedsGate
			]));
		};
		if(~rtJsonNum.(model[\noise], 0) > 0.01) {
			var bedsGate = ~rtJsonNum.(model[\bedsGate], 1).clip(0, 1);
			sc[\noise] = Synth.tail(~rt.synthGroup, \rt_noiseBed, [
				\out, ~rt.buses[\noise].index,
				\amp, ~rtJsonNum.(model[\noise], 0).clip(0, 1) * 0.04,
				\freq, ~rtJsonNum.(model[\freq], 65),
				\gate, bedsGate
			]);
		};
		sc[\master] = Synth.tail(~rt.synthGroup, \rt_master, [
			\inBus, ~rt.buses[\master].index,
			\partialBus, ~rt.buses[\partials].index,
			\noiseBus, ~rt.buses[\noise].index,
			\chamberMix, ctrl.chamberMix,
			\partialMix, ctrl.partialsMix,
			\noiseMix, ctrl.noiseMix
		]);
		"▸ RT graph: % chambers, % links | f0 % Hz | shape %".format(
			n, model[\routes].size, model[\freq].round(0.1), model[\shape]
		).postln;
		if(s.serverRunning.not) {
			"RT: scsynth died during build — re-eval ResonantTorus.scd".warn;
		};
		} { |err|
			"RT: graph build FAILED".postln;
			err.reportError;
		};
		};
	};
};

~rtUpdateParams = { |model|
	var n = model[\chambers].size;
	var routeCount = model[\routes].size;
	var partialCount = model[\partials].size;
	var sameTopology = ~rt.model.notNil
		and: { ~rt.model[\chambers].size == n }
		and: { ~rt.model[\routes].size == routeCount };
	var canSmooth = sameTopology and: { ~rtGraphAlive.(n, routeCount, partialCount) };
	if(canSmooth) {
		~rt.model = model;
		~rt.synths[\exciter] !? { |x|
			x.set(\freq, model[\freq], \type, ~rtExciterTypeIndex.value,
				\level, ~rt.controls.exciterLevel, \rate, ~rt.controls.exciterRate);
		};
		model[\chambers].do { |ch, i|
			var thickAmp = ~rtJsonNum.(ch[\amp], 0.5).clip(0, 1)
				* (0.04 + ~rtJsonNum.(ch[\thickness], 0.3) * 0.08);
			var chGate = ~rtJsonNum.(ch[\gate], 1).clip(0, 1);
			~rt.synths[\chambers][i].set(
				\freq, ~rtJsonNum.(ch[\freq], 80), \amp, thickAmp,
				\decay, ~rtJsonNum.(ch[\decay], 0.4).clip(0.05, 2.5),
				\drift, ~rtJsonNum.(ch[\drift], 0),
				\thickness, ~rtJsonNum.(ch[\thickness], 0.3),
				\mode, ~rtChamberModeIndex.value,
				\gate, chGate
			);
		};
		model[\routes].do { |route, i|
			var from = route[\from].asInteger;
			var fromGate = if(n > 0 and: { from < n }) {
				~rtJsonNum.(model[\chambers][from][\gate], 1).clip(0, 1);
			} { 1 };
			~rt.synths[\links][i] !? { |x|
				x.set(
					\coupling, ~rtJsonNum.(route[\coupling], 0.3).clip(0, 0.35),
					\delay, ~rtJsonNum.(route[\delayMs], 8) / 1000,
					\throat, ~rtJsonNum.(route[\throat], 0.25).clip(0.01, 1),
					\gate, fromGate
				);
			};
		};
		model[\partials].do { |p, i|
			var bedsGate = ~rtJsonNum.(model[\bedsGate], 1).clip(0, 1);
			~rt.synths[\partials][i] !? { |x|
				x.set(
					\freq, ~rtJsonNum.(model[\freq], 65) * p[0],
					\amp, ~rtJsonNum.(p[1], 0.5).clip(0, 1) * 0.07,
					\detune, ~rtJsonNum.(p[2], 0),
					\gate, bedsGate
				);
			};
		};
		~rt.synths[\noise] !? { |x|
			x.set(
				\amp, ~rtJsonNum.(model[\noise], 0).clip(0, 1) * 0.04,
				\freq, ~rtJsonNum.(model[\freq], 65),
				\gate, ~rtJsonNum.(model[\bedsGate], 1).clip(0, 1)
			);
		};
		~rt.synths[\master] !? { |x|
			x.set(\chamberMix, ~rt.controls.chamberMix,
				\partialMix, ~rt.controls.partialsMix,
				\noiseMix, ~rt.controls.noiseMix);
		};
		"▸ RT smooth update (% chambers)".format(n).postln;
	} {
		~rtBuildGraph.(model);
	};
};

~rtHandlePayload = { |data|
	var model;
	try {
		model = ~rtNormalizeModel.(data);
		if(model.isNil) {
			"RT: payload missing superCollider block.".postln;
		} {
			~rt.lastPayload = data;
			~rtUpdateParams.(model);
			{ ~rtGuiRefresh !? { ~rtGuiRefresh.value } }.defer;
		};
	} { |err|
		"RT: payload handling FAILED".postln;
		err.reportError;
	};
	model;
};

~rtTrigger = {
	// no-op (legacy OSC / GUI hook)
};

~rtSetControl = { |key, val|
	~rt.controls[key] = val;
	~rt.synths[\exciter] !? { |x|
		x.set(\type, ~rtExciterTypeIndex.value, \level, ~rt.controls.exciterLevel,
			\rate, ~rt.controls.exciterRate);
	};
	~rt.synths[\master] !? { |x|
		x.set(\chamberMix, ~rt.controls.chamberMix,
			\partialMix, ~rt.controls.partialsMix,
			\noiseMix, ~rt.controls.noiseMix);
	};
	if((key == \chamberMode) and: { ~rt.synths[\chambers].notNil }) {
		~rt.synths[\chambers].do { |x| x.set(\mode, ~rtChamberModeIndex.value) };
	};
};

~rtDemoPayload = {
	(
		type: "acoustic_model",
		shape: "torus",
		noiseMix: 0.35,
		superCollider: (
			freq: 62,
			partials: [[1, 1, 4], [2, 0.6, 3], [3, 0.45, 2], [4, 0.35, 1.5]],
			chambers: [
				(id: 0, chainIndex: 0, freq: 78, amp: 0.9, decay: 0.42, thickness: 0.28, drift: 0.8, ringAngle: -1.5),
				(id: 1, chainIndex: 1, freq: 64, amp: 0.85, decay: 0.45, thickness: 0.31, drift: 0.4, ringAngle: -0.3),
				(id: 2, chainIndex: 2, freq: 55, amp: 0.7, decay: 0.48, thickness: 0.27, drift: 0.2, ringAngle: 1.2)
			],
			routes: [
				(from: 0, to: 1, coupling: 0.55, delayMs: 7.5, throat: 0.27),
				(from: 1, to: 2, coupling: 0.38, delayMs: 8.1, throat: 0.27),
				(from: 2, to: 0, coupling: 0.45, delayMs: 8.8, throat: 0.27)
			],
			noise: 0.2
		)
	);
};

~rtLoadDemo = { ~rtHandlePayload.(~rtDemoPayload.value) };

~rtLoadFile = { |path|
	var str, data;
	try({
		str = File.use(path, "r", { |f| f.readAllString });
		data = str.parseJSON;
		~rtHandlePayload.(data);
		"RT: loaded %".format(path).postln;
	}, { |err|
		"RT: failed to load % — %".format(path, err.errorString).postln;
	});
};

~rtModelSummary = {
	var m, lines, timbre, purity, modulation, stack;
	m = ~rt !? { ~rt.model };
	if(m.isNil) {
		"No model loaded.";
	} {
		lines = List.new;
		lines.add("shape: % | f0: % Hz | chambers: % | links: %".format(
			m[\shape] ? "—",
			(~rtJsonNum.(m[\freq], 0)).round(0.1),
			(m[\chambers] ? []).size,
			(m[\routes] ? []).size
		));
		timbre = m[\timbre];
		if(timbre.notNil) {
			purity = ~rtJsonNum.(~rtJsonGet.(timbre, \purity), 0);
			modulation = ~rtJsonNum.(~rtJsonGet.(timbre, \modulation), 0);
			stack = ~rtJsonGet.(timbre, \harmonicStack) ? "—";
			lines.add("timbre: purity % mod % stack %".format(
				purity.round(0.01), modulation.round(0.01), stack
			));
		};
		(m[\chambers] ? []).do { |c|
			lines.add("  [%] % Hz  amp %  decay %  drift %  thick %".format(
				c[\chainIndex] ? c[\id] ? 0,
				~rtJsonNum.(c[\freq], 0).round(0.1),
				~rtJsonNum.(c[\amp], 0).round(0.02),
				~rtJsonNum.(c[\decay], 0).round(0.02),
				~rtJsonNum.(c[\drift], 0).round(0.02),
				~rtJsonNum.(c[\thickness], 0).round(0.03)
			));
		};
		(m[\routes] ? []).do { |r|
			lines.add("  link % → %  coupling %  delay % ms  throat %".format(
				r[\from], r[\to],
				~rtJsonNum.(r[\coupling], 0).round(0.02),
				~rtJsonNum.(r[\delayMs], 0).round(0.1),
				~rtJsonNum.(r[\throat], 0).round(0.02)
			));
		};
		lines.join($\n);
	};
};
